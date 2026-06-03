import { rateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../lib/online';
import { safeArray } from '../../../../lib/validation';

export const runtime = 'nodejs';

const ACTIVE_WINDOW_MS = 45_000;

function cleanQuery(value) {
  return String(value || '')
    .trim()
    .replace(/[,%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 60);
}

function relationStatus(row, userId) {
  if (!row) return 'none';
  if (row.status === 'accepted') return 'friends';
  if (row.status === 'blocked') return 'blocked';
  if (row.status === 'pending') return row.requester_id === userId ? 'outgoing' : 'incoming';
  return row.status || 'none';
}

function publicSearchUser(profile, presence, friendship, userId) {
  const lastSeen = presence?.last_seen || null;
  const online = lastSeen ? Date.parse(lastSeen) >= Date.now() - ACTIVE_WINDOW_MS : false;
  return {
    id: profile.id,
    username: profile.username || 'player',
    displayName: profile.display_name || profile.username || 'Player',
    photoURL: profile.photo_url || null,
    friendship: {
      status: relationStatus(friendship, userId),
      id: friendship?.id || null,
      requestedByYou: friendship?.requester_id === userId
    },
    presence: {
      online,
      status: online ? presence?.status || 'online' : 'offline',
      currentGameId: online ? presence?.current_game_id || null : null,
      lastSeen
    }
  };
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'users-search', limit: 50, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const url = new URL(request.url);
  const q = cleanQuery(url.searchParams.get('q'));
  if (q.length < 2) {
    return Response.json({ ok: true, users: [] });
  }

  const { supabase, user } = context;
  const pattern = `%${q}%`;
  const { data: profileRows, error } = await supabase
    .from('users')
    .select('id, username, display_name, photo_url')
    .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
    .neq('id', user.id)
    .limit(20);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const profiles = safeArray(profileRows);

  const userIds = profiles.map((profile) => profile.id);
  if (userIds.length === 0) return Response.json({ ok: true, users: [] });

  const [{ data: friendshipRows }, { data: presenceRows }] = await Promise.all([
    supabase
      .from('user_friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`),
    supabase
      .from('online_presence')
      .select('user_id, status, current_game_id, last_seen')
      .in('user_id', userIds)
  ]);
  const friendships = safeArray(friendshipRows);
  const presences = safeArray(presenceRows);

  const friendshipByOtherId = new Map();
  for (const friendship of friendships) {
    const otherId = friendship.requester_id === user.id ? friendship.receiver_id : friendship.requester_id;
    if (userIds.includes(otherId)) friendshipByOtherId.set(otherId, friendship);
  }
  const presenceById = new Map(presences.map((presence) => [presence.user_id, presence]));

  return Response.json({
    ok: true,
    users: profiles.map((profile) => publicSearchUser(profile, presenceById.get(profile.id), friendshipByOtherId.get(profile.id), user.id))
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
