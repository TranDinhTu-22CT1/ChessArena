import { rateLimit } from '../../../lib/rateLimit';
import { requireOnlineUser } from '../../../lib/online';

export const runtime = 'nodejs';

const VALID_MODES = new Set(['bullet', 'blitz', 'rapid', 'classical']);

function cleanMode(value) {
  return VALID_MODES.has(value) ? value : 'rapid';
}

function cleanLimit(value) {
  const limit = Number(value);
  return Number.isFinite(limit) ? Math.max(10, Math.min(100, Math.floor(limit))) : 50;
}

function publicPlayer(rating, profile, rank) {
  const gamesPlayed = rating.games_played ?? 0;
  const wins = rating.wins ?? 0;
  return {
    rank,
    userId: rating.user_id,
    username: profile?.username || 'player',
    displayName: profile?.display_name || profile?.username || 'Player',
    photoURL: profile?.photo_url || null,
    mode: rating.mode,
    rating: rating.rating,
    deviation: rating.deviation,
    provisional: Boolean(rating.provisional),
    gamesPlayed,
    wins,
    losses: rating.losses ?? 0,
    draws: rating.draws ?? 0,
    winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
    updatedAt: rating.updated_at
  };
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'leaderboard-read', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const url = new URL(request.url);
  const mode = cleanMode(url.searchParams.get('mode'));
  const limit = cleanLimit(url.searchParams.get('limit'));
  const { supabase, user } = context;

  const { data: ratings = [], error } = await supabase
    .from('user_ratings')
    .select('user_id, mode, rating, deviation, games_played, wins, losses, draws, provisional, updated_at')
    .eq('mode', mode)
    .gt('games_played', 0)
    .order('rating', { ascending: false })
    .order('games_played', { ascending: false })
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const userIds = [...new Set(ratings.map((rating) => rating.user_id).filter(Boolean))];
  if (!userIds.includes(user.id)) userIds.push(user.id);

  const { data: profiles = [] } = userIds.length
    ? await supabase
      .from('users')
      .select('id, username, display_name, photo_url')
      .in('id', userIds)
    : { data: [] };
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  const entries = ratings.map((rating, index) => publicPlayer(rating, profilesById.get(rating.user_id), index + 1));

  const { data: myRating } = await supabase
    .from('user_ratings')
    .select('user_id, mode, rating, deviation, games_played, wins, losses, draws, provisional, updated_at')
    .eq('user_id', user.id)
    .eq('mode', mode)
    .maybeSingle();

  let currentUser = null;
  if (myRating && (myRating.games_played ?? 0) > 0) {
    const { count: higherRated = 0 } = await supabase
      .from('user_ratings')
      .select('user_id', { count: 'exact', head: true })
      .eq('mode', mode)
      .gt('games_played', 0)
      .gt('rating', myRating.rating);
    currentUser = publicPlayer(myRating, profilesById.get(user.id), (higherRated ?? 0) + 1);
  }

  return Response.json({
    ok: true,
    mode,
    limit,
    entries,
    currentUser,
    total: entries.length
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
