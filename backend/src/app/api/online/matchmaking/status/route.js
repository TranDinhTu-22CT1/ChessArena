import { rateLimit } from '../../../../../lib/rateLimit';
import { activeOnlineGameForUser, onlineSummary, publicGame, decorateGameRatings, requireOnlineUser } from '../../../../../lib/online';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'online-matchmaking-status', limit: 120, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const { supabase, user } = context;

  const [game, { data: ticket }] = await Promise.all([
    activeOnlineGameForUser(supabase, user.id),
    supabase
      .from('online_match_queue')
      .select('id, time_control, mode, pool, rating, rating_min, rating_max, joined_at, last_seen, status')
      .eq('user_id', user.id)
      .in('status', ['waiting', 'claimed'])
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (game?.status === 'active') {
    const { data: moves = [] } = await supabase
      .from('online_game_moves')
      .select('*')
      .eq('game_id', game.id)
      .order('ply', { ascending: true });
    return Response.json({
      ok: true,
      status: 'matched',
      gameId: game.id,
      game: publicGame(await decorateGameRatings(supabase, game), moves, user.id),
      ...(await onlineSummary(supabase))
    });
  }

  return Response.json({
    ok: true,
    status: ticket?.status || 'idle',
    ticket: ticket || null,
    ...(await onlineSummary(supabase))
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
