import { createUserNotification } from '../../../../../../lib/notifications';
import { requireOnlineUser } from '../../../../../../lib/online';
import { distributedRateLimit } from '../../../../../../lib/rateLimit';
import { uploadDataAssets } from '../../../../../../lib/storage';
import { isMissingTableError, readJsonPayload, safeArray } from '../../../../../../lib/validation';

export const runtime = 'nodejs';

const ATTACHMENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']);

function cleanText(value, limit = 2200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function cleanAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map((item) => ({
    name: cleanText(item?.name, 160) || 'attachment',
    mimeType: cleanText(item?.mimeType || item?.type, 80).toLowerCase(),
    dataUrl: String(item?.dataUrl || item?.url || '').trim()
  })).filter((item) => ATTACHMENT_TYPES.has(item.mimeType) && item.dataUrl.startsWith(`data:${item.mimeType};base64,`));
}

function publicMessage(message) {
  return {
    id: message.id,
    senderType: message.sender_role,
    body: message.body,
    attachments: message.attachments || [],
    createdAt: message.created_at,
    readByUserAt: message.read_by_user_at,
    readByAdminAt: message.read_by_admin_at
  };
}

async function ownedRequest(context, requestId) {
  const { data, error } = await context.supabase
    .from('support_requests')
    .select('id, user_id, status, subject, message, attachments, admin_note, reviewed_at, created_at, updated_at')
    .eq('id', requestId)
    .eq('user_id', context.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function ticketFallbackMessages(ticket) {
  const messages = [{
    id: `ticket-${ticket.id}`,
    senderType: 'user',
    body: ticket.message || '',
    attachments: safeArray(ticket.attachments),
    createdAt: ticket.created_at
  }];
  if (ticket.admin_note) {
    messages.push({
      id: `admin-note-${ticket.id}`,
      senderType: 'admin',
      body: ticket.admin_note,
      attachments: [],
      createdAt: ticket.reviewed_at || ticket.updated_at
    });
  }
  return messages;
}

export async function GET(request, { params }) {
  const blocked = await distributedRateLimit(request, { scope: 'support-messages-read', limit: 100, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser({ allowBanned: true });
  if (context.error) return context.error;
  const { requestId } = await params;
  const ticket = await ownedRequest(context, requestId);
  if (!ticket) return Response.json({ ok: false, error: 'Ticket not found.' }, { status: 404 });

  const { data = [], error } = await context.supabase
    .from('support_messages')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (isMissingTableError(error, 'support_messages')) {
    return Response.json({
      ok: true,
      ticket,
      messages: ticketFallbackMessages(ticket),
      warning: 'Bảng hội thoại hỗ trợ chưa được triển khai; đang hiển thị nội dung ticket.'
    });
  }
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  await context.supabase
    .from('support_messages')
    .update({ read_by_user_at: new Date().toISOString() })
    .eq('request_id', requestId)
    .is('read_by_user_at', null);

  return Response.json({ ok: true, ticket, messages: safeArray(data).map(publicMessage) });
}

export async function POST(request, { params }) {
  const blocked = await distributedRateLimit(request, { scope: 'support-messages-write', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser({ allowBanned: true });
  if (context.error) return context.error;
  const { requestId } = await params;
  const ticket = await ownedRequest(context, requestId);
  if (!ticket) return Response.json({ ok: false, error: 'Ticket not found.' }, { status: 404 });
  if (['resolved', 'dismissed'].includes(ticket.status)) {
    return Response.json({ ok: false, error: 'Ticket đã đóng. Hãy tạo ticket mới nếu bạn cần hỗ trợ thêm.' }, { status: 409 });
  }

  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
  const body = cleanText(payload.body);
  const inputAttachments = cleanAttachments(payload.attachments);
  if (!body && !inputAttachments.length) {
    return Response.json({ ok: false, error: 'Vui lòng nhập nội dung hoặc chọn file.' }, { status: 400 });
  }

  let attachments = [];
  try {
    attachments = await uploadDataAssets(inputAttachments, {
      ownerUserId: context.user.id,
      purpose: 'support',
      maxBytes: 10 * 1024 * 1024
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Không thể tải file.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await context.supabase
    .from('support_messages')
    .insert({
      request_id: requestId,
      sender_user_id: context.user.id,
      sender_role: 'user',
      body,
      attachments,
      read_by_user_at: now
    })
    .select('*')
    .single();
  if (isMissingTableError(error, 'support_messages')) {
    return Response.json({
      ok: false,
      error: 'Gửi tin nhắn ticket cần áp dụng migration database mới nhất.'
    }, { status: 503 });
  }
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  await context.supabase
    .from('support_requests')
    .update({ status: 'in_review', updated_at: now })
    .eq('id', requestId);
  await createUserNotification(context.supabase, {
    audience: 'admin',
    type: 'support_reply',
    title: 'Người chơi vừa phản hồi ticket',
    body: ticket.subject || `Ticket #${requestId.slice(0, 8)}`,
    actionUrl: '/admin/support',
    metadata: { requestId }
  });
  return Response.json({ ok: true, message: publicMessage(data) });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
