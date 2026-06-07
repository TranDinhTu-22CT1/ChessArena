import { requireAdminCsrf, requireAdminPermission, requireAdminUser, writeAdminAudit } from '../../../../lib/admin';
import { rateLimit } from '../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../lib/validation';
import { createUserNotification } from '../../../../lib/notifications';

export const runtime = 'nodejs';

const STATUSES = new Set(['new', 'in_review', 'waiting_user', 'resolved', 'dismissed']);

function cleanText(value, limit = 1200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function cleanStatus(value) {
  const status = cleanText(value, 40).toLowerCase();
  return STATUSES.has(status) ? status : '';
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-support', limit: 50, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'support:view');
  if (permissionError) return permissionError;

  const { searchParams } = new URL(request.url);
  const limit = Math.max(5, Math.min(50, Number(searchParams.get('limit')) || 10));
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const status = cleanStatus(searchParams.get('status'));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = context.supabase
    .from('support_requests')
    .select('id, user_id, category, status, subject, message, page_url, contact_email, context, attachments, admin_note, reviewed_at, created_at, updated_at, users:user_id(id, username, display_name, email, photo_url)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (status) query = query.eq('status', status);

  const { data, count = 0, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  return Response.json({
    ok: true,
    requests: data || [],
    page,
    limit,
    total: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit))
  });
}

export async function PATCH(request) {
  const blocked = rateLimit(request, { scope: 'admin-support-write', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;
  const permissionError = requireAdminPermission(context, 'support:write');
  if (permissionError) return permissionError;

  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });

  const requestId = cleanText(payload.requestId, 80);
  const status = cleanStatus(payload.status);
  if (!requestId || !status) {
    return Response.json({ ok: false, error: 'Missing request id or status.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: previous } = await context.supabase
    .from('support_requests')
    .select('status')
    .eq('id', requestId)
    .maybeSingle();
  const { data, error } = await context.supabase
    .from('support_requests')
    .update({
      status,
      admin_note: cleanText(payload.adminNote, 1800) || null,
      reviewed_by: context.admin?.id || null,
      reviewed_at: now,
      updated_at: now
    })
    .eq('id', requestId)
    .select('id, user_id, category, status, subject, message, page_url, contact_email, context, attachments, admin_note, reviewed_at, created_at, updated_at, users:user_id(id, username, display_name, email, photo_url)')
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  await writeAdminAudit(context.supabase, context.admin, 'support.update_status', {
    supportRequestId: requestId,
    status,
    targetUserId: data.user_id
  });
  await context.supabase.from('support_status_events').insert({
    request_id: requestId,
    actor_user_id: context.admin?.id || null,
    actor_role: 'admin',
    old_status: previous?.status || null,
    new_status: status,
    note: cleanText(payload.adminNote, 1800) || null
  });
  await createUserNotification(context.supabase, {
    recipientUserId: data.user_id,
    type: 'support_status',
    title: 'Ticket hỗ trợ đã được cập nhật',
    body: `${data.subject || `Ticket #${requestId.slice(0, 8)}`}: ${status}`,
    actionUrl: '/support/tickets',
    metadata: { requestId, status }
  });

  return Response.json({ ok: true, request: data });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
