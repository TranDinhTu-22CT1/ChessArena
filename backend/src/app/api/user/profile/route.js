import { rateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../lib/online';

export const runtime = 'nodejs';

function cleanDisplayName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function cleanAvatarURL(value) {
  const input = String(value || '').trim();
  if (!input) return null;
  if (input.length > 500) return undefined;
  try {
    const url = new URL(input);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

async function profilePayload(supabase, userId) {
  const [{ data: profile }, { data: ratings = [] }, { data: games = [] }] = await Promise.all([
    supabase
      .from('users')
      .select('id, username, display_name, email, photo_url, email_verified, created_at')
      .eq('id', userId)
      .single(),
    supabase
      .from('user_ratings')
      .select('mode, rating, games_played, wins, losses, draws, provisional')
      .eq('user_id', userId)
      .order('mode', { ascending: true }),
    supabase
      .from('online_games')
      .select('id, status, result, mode, time_control, white_user_id, black_user_id, white_name, black_name, finished_at')
      .or(`white_user_id.eq.${userId},black_user_id.eq.${userId}`)
      .in('status', ['checkmate', 'draw', 'resigned'])
      .order('finished_at', { ascending: false })
      .limit(10)
  ]);

  const record = profile || {};
  const summary = ratings.reduce((total, rating) => ({
    gamesPlayed: total.gamesPlayed + (rating.games_played || 0),
    wins: total.wins + (rating.wins || 0),
    losses: total.losses + (rating.losses || 0),
    draws: total.draws + (rating.draws || 0)
  }), { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 });

  return {
    id: record.id,
    username: record.username,
    displayName: record.display_name,
    email: record.email,
    emailVerified: Boolean(record.email_verified),
    photoURL: record.photo_url,
    createdAt: record.created_at,
    ratings,
    summary,
    recentGames: games.map((game) => {
      const color = game.white_user_id === userId ? 'w' : 'b';
      const opponent = color === 'w' ? game.black_name : game.white_name;
      const result = game.result === '1/2-1/2'
        ? 'draw'
        : (game.result === '1-0' && color === 'w') || (game.result === '0-1' && color === 'b')
          ? 'win'
          : 'loss';
      return {
        id: game.id,
        opponent,
        result,
        mode: game.mode,
        timeControl: game.time_control,
        finishedAt: game.finished_at
      };
    })
  };
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'profile-read', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  return Response.json({ ok: true, profile: await profilePayload(context.supabase, context.user.id) });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'profile-write', limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await request.json().catch(() => null);
  const displayName = cleanDisplayName(payload?.displayName);
  const photoURL = cleanAvatarURL(payload?.photoURL);
  if (displayName.length < 2) {
    return Response.json({ ok: false, error: 'Display name must contain at least 2 characters.' }, { status: 400 });
  }
  if (photoURL === undefined) {
    return Response.json({ ok: false, error: 'Avatar must be a valid http or https image URL.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await context.supabase
    .from('users')
    .update({ display_name: displayName, photo_url: photoURL, updated_at: now })
    .eq('id', context.user.id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  await context.supabase
    .from('online_presence')
    .update({ display_name: displayName, updated_at: now })
    .eq('user_id', context.user.id);

  return Response.json({ ok: true, profile: await profilePayload(context.supabase, context.user.id) });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
