import { requireOnlineUser } from '../../../../lib/online';
import { distributedRateLimit } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = await distributedRateLimit(request, { scope: 'social-activity-read', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || '';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.max(5, Math.min(30, Number(url.searchParams.get('limit')) || 10));
  const from = (page - 1) * limit;

  let actorIds = [];
  if (userId) actorIds = [userId];
  else {
    const { data: follows = [] } = await context.supabase.from('user_follows').select('followed_user_id').eq('follower_user_id', context.user.id);
    actorIds = [context.user.id, ...follows.map((item) => item.followed_user_id)];
  }
  if (!actorIds.length) return Response.json({ ok: true, activities: [], page, totalPages: 1 });
  const { data = [], count = 0, error } = await context.supabase
    .from('activity_feed')
    .select('*, users:actor_user_id(id, display_name, username, photo_url)', { count: 'exact' })
    .in('actor_user_id', actorIds)
    .neq('visibility', 'private')
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({
    ok: true,
    activities: data,
    page,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit))
  });
}
