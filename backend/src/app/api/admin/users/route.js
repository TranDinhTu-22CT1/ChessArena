import { rateLimit } from '../../../../lib/rateLimit';
import { requireAdminUser, writeAdminAudit } from '../../../../lib/admin';

export const runtime = 'nodejs';

function cleanSearch(value) {
  return String(value || '').trim().slice(0, 80);
}

function cleanReason(value) {
  return String(value || 'Policy violation').trim().replace(/\s+/g, ' ').slice(0, 300) || 'Policy violation';
}

function cleanBanType(value) {
  return ['account', 'device', 'account_device'].includes(value) ? value : 'account';
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-users', limit: 50, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  const { searchParams } = new URL(request.url);
  const search = cleanSearch(searchParams.get('search'));
  const limit = Math.max(5, Math.min(100, Number(searchParams.get('limit')) || 30));

  let query = context.supabase
    .from('users')
    .select('id, username, display_name, email, photo_url, email_verified, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (search) {
    query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: users = [], error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const ids = users.map((user) => user.id);
  const [ratings, bans, mutes, devices, trustScores, reports] = ids.length ? await Promise.all([
    context.supabase.from('user_ratings').select('*').in('user_id', ids),
    context.supabase.from('user_bans').select('*').in('user_id', ids).order('created_at', { ascending: false }),
    context.supabase.from('user_mutes').select('*').in('user_id', ids).order('created_at', { ascending: false }),
    context.supabase.from('user_devices').select('user_id, device_fingerprint, user_agent, last_seen_at').in('user_id', ids).order('last_seen_at', { ascending: false }),
    context.supabase.from('user_trust_scores').select('*').in('user_id', ids),
    context.supabase.from('anti_cheat_reports').select('user_id, status, risk_score, created_at').in('user_id', ids).order('created_at', { ascending: false })
  ]) : [];

  return Response.json({
    ok: true,
    users: users.map((user) => ({
      ...user,
      ratings: (ratings?.data || []).filter((row) => row.user_id === user.id),
      bans: (bans?.data || []).filter((row) => row.user_id === user.id),
      mutes: (mutes?.data || []).filter((row) => row.user_id === user.id),
      devices: (devices?.data || []).filter((row) => row.user_id === user.id).slice(0, 5),
      trust: (trustScores?.data || []).find((row) => row.user_id === user.id) || null,
      reports: (reports?.data || []).filter((row) => row.user_id === user.id).slice(0, 5)
    }))
  });
}

export async function PATCH(request) {
  const blocked = rateLimit(request, { scope: 'admin-user-action', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  const payload = await request.json().catch(() => null);
  const action = payload?.action;
  const userId = String(payload?.userId || '').trim();
  const deviceFingerprint = String(payload?.deviceFingerprint || '').trim().slice(0, 160);

  if (!userId) return Response.json({ ok: false, error: 'Missing user id.' }, { status: 400 });

  if (action === 'ban') {
    const banType = cleanBanType(payload?.banType);
    if ((banType === 'device' || banType === 'account_device') && !deviceFingerprint) {
      return Response.json({ ok: false, error: 'Device fingerprint is required for this ban type.' }, { status: 400 });
    }

    const { data, error } = await context.supabase
      .from('user_bans')
      .insert({
        user_id: banType === 'device' ? null : userId,
        device_fingerprint: banType === 'account' ? null : deviceFingerprint,
        ban_type: banType,
        reason: cleanReason(payload?.reason),
        created_by: context.admin.id
      })
      .select('*')
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    await writeAdminAudit(context.supabase, context.admin, 'user.ban', {
      targetUserId: userId,
      deviceFingerprint,
      banType,
      reason: data.reason
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
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'Unsupported admin action.' }, { status: 400 });
}
