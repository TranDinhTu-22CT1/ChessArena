import { distributedRateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../lib/online';
import { readJsonPayload } from '../../../../lib/validation';
import { uploadDataAssets } from '../../../../lib/storage';

export const runtime = 'nodejs';

const CATEGORIES = new Set(['account', 'billing', 'online', 'moderation', 'puzzle', 'tournament', 'technical', 'general']);
const ATTACHMENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']);
const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_DATA_LENGTH = 14_000_000;

function cleanText(value, limit = 1200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function cleanCategory(value) {
  const category = cleanText(value, 40).toLowerCase();
  return CATEGORIES.has(category) ? category : 'general';
}

function cleanContext(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    pageUrl: cleanText(source.pageUrl, 500),
    assistantMode: cleanText(source.assistantMode, 40),
    route: cleanText(source.route, 80),
    mode: cleanText(source.mode, 80),
    fen: cleanText(source.fen, 160),
    latestMove: cleanText(source.latestMove, 120),
    recentMessages: Array.isArray(source.recentMessages)
      ? source.recentMessages.slice(-8).map((message) => ({
        role: message?.role === 'assistant' ? 'assistant' : 'user',
        content: cleanText(message?.content, 700)
      })).filter((message) => message.content)
      : []
  };
}

function cleanAttachment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const mimeType = cleanText(value.mimeType || value.type, 80).toLowerCase();
  if (!ATTACHMENT_TYPES.has(mimeType)) return null;
  const dataUrl = String(value.dataUrl || value.url || '').trim();
  const escapedType = mimeType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`^data:${escapedType};base64,`, 'i').test(dataUrl)) return null;
  if (dataUrl.length > MAX_ATTACHMENT_DATA_LENGTH) return null;
  return {
    id: cleanText(value.id, 80) || crypto.randomUUID(),
    name: cleanText(value.name, 160) || 'attachment',
    mimeType,
    size: Math.max(0, Math.floor(Number(value.size) || 0)),
    dataUrl,
    createdAt: new Date().toISOString()
  };
}

function cleanAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ATTACHMENTS).map(cleanAttachment).filter(Boolean);
}

function publicSupportRequest(row) {
  return {
    id: row.id,
    category: row.category,
    status: row.status,
    subject: row.subject,
    message: row.message,
    pageUrl: row.page_url,
    contactEmail: row.contact_email,
    context: row.context || {},
    adminNote: row.admin_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attachments: Array.isArray(row.attachments) ? row.attachments : []
  };
}

export async function GET(request) {
  const blocked = await distributedRateLimit(request, { scope: 'support-request-read', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser({ allowBanned: true });
  if (context.error) return context.error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const limit = Math.max(5, Math.min(20, Math.floor(Number(searchParams.get('limit')) || 8)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data = [], error, count = 0 } = await context.supabase
    .from('support_requests')
    .select('id, category, status, subject, message, page_url, contact_email, context, attachments, admin_note, reviewed_at, created_at, updated_at', { count: 'exact' })
    .eq('user_id', context.user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({
    ok: true,
    requests: data.map(publicSupportRequest),
    page,
    limit,
    total: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit))
  });
}

export async function POST(request) {
  const blocked = await distributedRateLimit(request, { scope: 'support-request-create', limit: 8, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser({ allowBanned: true });
  if (context.error) return context.error;

  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });

  const subject = cleanText(payload.subject, 140);
  const message = cleanText(payload.message, 2200);
  if (message.length < 8) {
    return Response.json({ ok: false, error: 'Vui lòng mô tả yêu cầu hỗ trợ rõ hơn.' }, { status: 400 });
  }

  const supportContext = cleanContext(payload.context);
  let attachments = [];
  try {
    const cleanedAttachments = cleanAttachments(payload.attachments);
    attachments = await uploadDataAssets(cleanedAttachments, {
      ownerUserId: context.user.id,
      purpose: 'support',
      maxBytes: 10 * 1024 * 1024
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Không thể tải file đính kèm.' }, { status: 400 });
  }

  const row = {
    user_id: context.user.id,
    category: cleanCategory(payload.category),
    subject: subject || message.slice(0, 80),
    message,
    page_url: cleanText(payload.pageUrl || supportContext.pageUrl, 500) || null,
    contact_email: cleanText(payload.contactEmail || context.user.email, 160) || null,
    context: supportContext,
    attachments
  };
  const { data, error } = await context.supabase
    .from('support_requests')
    .insert(row)
    .select('id, category, status, subject, created_at, attachments')
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  await context.supabase.from('support_messages').insert({
    request_id: data.id,
    sender_user_id: context.user.id,
    sender_role: 'user',
    body: message,
    attachments,
    read_by_user_at: new Date().toISOString()
  });
  await context.supabase.from('support_status_events').insert({
    request_id: data.id,
    actor_user_id: context.user.id,
    actor_role: 'user',
    old_status: null,
    new_status: 'new',
    note: 'Ticket created'
  });
  return Response.json({ ok: true, request: data });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
