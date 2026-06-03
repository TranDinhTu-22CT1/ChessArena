import { rateLimit } from '../../../lib/rateLimit';
import { requireOnlineUser } from '../../../lib/online';
import { readJsonPayload, safeArray } from '../../../lib/validation';

export const runtime = 'nodejs';

function publicNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    actionUrl: row.action_url,
    priority: row.priority,
    metadata: row.metadata || {},
    readAt: row.read_at,
    createdAt: row.created_at
  };
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'notifications-read', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const limit = Math.max(5, Math.min(30, Math.floor(Number(searchParams.get('limit')) || 12)));
  const unreadOnly = searchParams.get('unread') === '1';
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = context.supabase
    .from('user_notifications')
    .select('*', { count: 'exact' })
    .eq('recipient_user_id', context.user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (unreadOnly) query = query.is('read_at', null);

  const [{ data: notificationRows = [], error, count }, { count: unreadCount }] = await Promise.all([
    query,
    context.supabase
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_user_id', context.user.id)
      .is('read_at', null)
  ]);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const notifications = safeArray(notificationRows);

  return Response.json({
    ok: true,
    page,
    limit,
    total: count ?? notifications.length,
    totalPages: Math.max(1, Math.ceil((count ?? notifications.length) / limit)),
    unreadCount: unreadCount ?? 0,
    notifications: notifications.map(publicNotification)
  });
}

export async function PATCH(request) {
  const blocked = rateLimit(request, { scope: 'notifications-write', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });

  const action = String(payload.action || '').trim();
  const now = new Date().toISOString();

  if (action === 'mark_all_read') {
    const { error } = await context.supabase
      .from('user_notifications')
      .update({ read_at: now })
      .eq('recipient_user_id', context.user.id)
      .is('read_at', null);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (action === 'mark_read') {
    const notificationId = String(payload.notificationId || '').trim();
    if (!notificationId) return Response.json({ ok: false, error: 'Missing notification id.' }, { status: 400 });
    const { error } = await context.supabase
      .from('user_notifications')
      .update({ read_at: now })
      .eq('id', notificationId)
      .eq('recipient_user_id', context.user.id);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'Unsupported notification action.' }, { status: 400 });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
