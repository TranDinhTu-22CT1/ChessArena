import { rateLimit } from '../../../../lib/rateLimit';
import { ensureAdminAppUser, requireAdminCsrf, requireAdminPermission, requireAdminUser, writeAdminAudit } from '../../../../lib/admin';
import { createUserNotification } from '../../../../lib/notifications';
import { safeArray } from '../../../../lib/validation';

export const runtime = 'nodejs';

function cleanSearch(value) {
  return String(value || '').trim().slice(0, 80);
}

function cleanReason(value) {
  return String(value || 'Policy violation').trim().replace(/\s+/g, ' ').slice(0, 300) || 'Policy violation';
}

function cleanExpiresAt(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date > new Date() ? date.toISOString() : null;
}

async function notifyAdminAction(context, payload) {
  try {
    const adminUser = await ensureAdminAppUser(context.supabase, context.admin);
    await createUserNotification(context.supabase, {
      recipientUserId: adminUser.id,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      actionUrl: payload.actionUrl || '/admin/players',
      priority: payload.priority || 'normal',
      metadata: payload.metadata || {}
    });
  } catch (error) {
    console.warn('Could not create admin notification:', error.message);
  }
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-users', limit: 50, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'users:view');
  if (permissionError) return permissionError;

  const { searchParams } = new URL(request.url);
  const search = cleanSearch(searchParams.get('search'));
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const limit = Math.max(5, Math.min(50, Math.floor(Number(searchParams.get('limit')) || 10)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = context.supabase
    .from('users')
    .select('id, username, display_name, email, photo_url, email_verified, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: userRows, error, count } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const users = safeArray(userRows);

  const ids = users.map((user) => user.id);
  const [ratings, bans, mutes] = ids.length ? await Promise.all([
    context.supabase.from('user_ratings').select('*').in('user_id', ids),
    context.supabase.from('user_bans').select('*').in('user_id', ids).order('created_at', { ascending: false }),
    context.supabase.from('user_mutes').select('*').in('user_id', ids).order('created_at', { ascending: false }),
  ]) : [];

  return Response.json({
    ok: true,
    page,
    limit,
    total: count ?? users.length,
    totalPages: Math.max(1, Math.ceil((count ?? users.length) / limit)),
    users: users.map((user) => ({
      ...user,
      ratings: safeArray(ratings?.data).filter((row) => row.user_id === user.id),
      bans: safeArray(bans?.data).filter((row) => row.user_id === user.id),
      mutes: safeArray(mutes?.data).filter((row) => row.user_id === user.id),
    }))
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function PATCH(request) {
  const blocked = rateLimit(request, { scope: 'admin-user-action', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'users:manage');
  if (permissionError) return permissionError;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;

  const payload = await request.json().catch(() => null);
  const action = payload?.action;
  const userId = String(payload?.userId || '').trim();

  if (!userId) return Response.json({ ok: false, error: 'Missing user id.' }, { status: 400 });

  if (action === 'ban') {
    if (payload.banType && payload.banType !== 'account') return Response.json({ ok: false, error: 'Chỉ hỗ trợ khóa tài khoản.' }, { status: 400 });
    if (payload.expiresAt && !cleanExpiresAt(payload.expiresAt)) return Response.json({ ok: false, error: 'Thời hạn phải ở trong tương lai.' }, { status: 400 });
    const { data, error } = await context.supabase
      .from('user_bans')
      .insert({
        user_id: userId,
        ban_type: 'account',
        reason: cleanReason(payload?.reason),
        expires_at: cleanExpiresAt(payload?.expiresAt),
        created_by: context.admin.id
      })
      .select('*')
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    await writeAdminAudit(context.supabase, context.admin, 'user.ban', {
      targetUserId: userId,
      reason: data.reason
    });
    await createUserNotification(context.supabase, {
      recipientUserId: userId,
      type: 'account_ban',
      title: 'Tài khoản bị hạn chế',
      body: data.reason || 'Tài khoản của bạn đang bị cấm theo chính sách cộng đồng.',
      actionUrl: '/login',
      priority: 'critical',
      metadata: { banId: data.id, expiresAt: data.expires_at }
    });
    await notifyAdminAction(context, {
      type: 'admin_user_ban',
      title: 'Đã cấm người chơi',
      body: `Khóa tài khoản. Lý do: ${data.reason}`,
      metadata: { targetUserId: userId, banId: data.id }
    });
    return Response.json({ ok: true, ban: data });
  }

  if (action === 'unban') {
    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from('user_bans')
      .update({ status: 'lifted', lifted_by: context.admin.id, lifted_at: now })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    await writeAdminAudit(context.supabase, context.admin, 'user.unban', { targetUserId: userId });
    await createUserNotification(context.supabase, {
      recipientUserId: userId,
      type: 'account_unban',
      title: 'Lệnh cấm đã được gỡ',
      body: 'Tài khoản của bạn đã được mở lại.',
      actionUrl: '/profile',
      priority: 'high'
    });
    await notifyAdminAction(context, {
      type: 'admin_user_unban',
      title: 'Đã gỡ cấm người chơi',
      body: `User ${userId} đã được gỡ lệnh cấm.`,
      metadata: { targetUserId: userId }
    });
    return Response.json({ ok: true });
  }

  if (action === 'mute') {
    const { data, error } = await context.supabase
      .from('user_mutes')
      .insert({
        user_id: userId,
        reason: cleanReason(payload?.reason || 'Chat/report abuse'),
        scopes: Array.isArray(payload?.scopes) && payload.scopes.length ? payload.scopes : ['chat', 'reports'],
        created_by: context.admin.id
      })
      .select('*')
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    await writeAdminAudit(context.supabase, context.admin, 'user.mute', {
      targetUserId: userId,
      reason: data.reason,
      scopes: data.scopes
    });
    await createUserNotification(context.supabase, {
      recipientUserId: userId,
      type: 'chat_mute',
      title: 'Chat/báo cáo đang bị hạn chế',
      body: data.reason || 'Tài khoản của bạn đang bị hạn chế chat hoặc báo cáo.',
      actionUrl: '/profile',
      priority: 'high',
      metadata: { muteId: data.id, scopes: data.scopes }
    });
    await notifyAdminAction(context, {
      type: 'admin_user_mute',
      title: 'Đã tắt chat người chơi',
      body: data.reason || 'Đã áp dụng hạn chế chat/báo cáo.',
      metadata: { targetUserId: userId, muteId: data.id }
    });
    return Response.json({ ok: true, mute: data });
  }

  if (action === 'unmute') {
    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from('user_mutes')
      .update({ status: 'lifted', lifted_by: context.admin.id, lifted_at: now })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    await writeAdminAudit(context.supabase, context.admin, 'user.unmute', { targetUserId: userId });
    await createUserNotification(context.supabase, {
      recipientUserId: userId,
      type: 'chat_unmute',
      title: 'Hạn chế chat đã được gỡ',
      body: 'Bạn có thể sử dụng lại các chức năng chat/báo cáo.',
      actionUrl: '/profile'
    });
    await notifyAdminAction(context, {
      type: 'admin_user_unmute',
      title: 'Đã mở chat người chơi',
      body: `User ${userId} đã được gỡ hạn chế chat/báo cáo.`,
      metadata: { targetUserId: userId }
    });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'Unsupported admin action.' }, { status: 400 });
}
