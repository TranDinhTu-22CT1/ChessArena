import { createUserNotification } from '../../../../lib/notifications';
import { requireOnlineUser } from '../../../../lib/online';
import { distributedRateLimit } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = await distributedRateLimit(request, { scope: 'social-follow-read', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const targetUserId = new URL(request.url).searchParams.get('userId') || context.user.id;
  const [{ count: followers = 0 }, { count: following = 0 }, { data: relation }] = await Promise.all([
    context.supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('followed_user_id', targetUserId),
    context.supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower_user_id', targetUserId),
    context.supabase.from('user_follows').select('*').eq('follower_user_id', context.user.id).eq('followed_user_id', targetUserId).maybeSingle()
  ]);
  return Response.json({ ok: true, followers: followers || 0, following: following || 0, followed: Boolean(relation) });
}

export async function POST(request) {
  const blocked = await distributedRateLimit(request, { scope: 'social-follow-write', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const payload = await request.json().catch(() => ({}));
  const targetUserId = String(payload.userId || '');
  if (!targetUserId || targetUserId === context.user.id) {
    return Response.json({ ok: false, error: 'Invalid follow target.' }, { status: 400 });
  }
  if (payload.action === 'unfollow') {
    await context.supabase.from('user_follows').delete().eq('follower_user_id', context.user.id).eq('followed_user_id', targetUserId);
    return Response.json({ ok: true, followed: false });
  }
  const { error } = await context.supabase.from('user_follows').upsert({
    follower_user_id: context.user.id,
    followed_user_id: targetUserId
  }, { onConflict: 'follower_user_id,followed_user_id' });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  await Promise.all([
    createUserNotification(context.supabase, {
      recipientUserId: targetUserId,
      type: 'new_follower',
      title: 'Bạn có người theo dõi mới',
      body: `${context.user.displayName || context.user.username} đã theo dõi bạn.`,
      actionUrl: `/profile/${context.user.id}`,
      metadata: { followerUserId: context.user.id }
    }),
    context.supabase.from('activity_feed').insert({
      actor_user_id: context.user.id,
      type: 'followed_player',
      subject_id: targetUserId,
      visibility: 'followers'
    })
  ]);
  return Response.json({ ok: true, followed: true });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
