import { rateLimit } from '../../../../lib/rateLimit';
import { decorateGameRatings, publicGame, requireOnlineUser } from '../../../../lib/online';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'online-history', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const { supabase, user } = context;
  const { data: games = [], error } = await supabase
    .from('online_games')
    .select('*')
    .in('status', ['checkmate', 'draw', 'resigned'])
    .or(`white_user_id.eq.${user.id},black_user_id.eq.${user.id}`)
    .order('finished_at', { ascending: false })
    .limit(20);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const history = await Promise.all(games.map(async (game) => {
    const { data: moves = [] } = await supabase
      .from('online_game_moves')
      .select('*')
      .eq('game_id', game.id)
      .order('ply', { ascending: true });
    return publicGame(await decorateGameRatings(supabase, game), moves, user.id);
  }));

  return Response.json({ ok: true, games: history });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
