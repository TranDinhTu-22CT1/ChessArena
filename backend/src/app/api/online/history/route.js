import { rateLimit } from '../../../../lib/rateLimit';
import { decorateGameRatings, publicGame, requireOnlineUser } from '../../../../lib/online';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'online-history', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const { supabase, user } = context;
  const { data: games = [], error, count } = await supabase
    .from('online_games')
    .select('*', { count: 'exact' })
    .in('status', ['checkmate', 'draw', 'resigned'])
    .or(`white_user_id.eq.${user.id},black_user_id.eq.${user.id}`)
    .order('finished_at', { ascending: false })
    .limit(100);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const history = await Promise.all(games.map(async (game) => {
    const [{ data: moves = [] }, { data: review = null }] = await Promise.all([
      supabase
      .from('online_game_moves')
      .select('*')
      .eq('game_id', game.id)
        .order('ply', { ascending: true }),
      supabase
        .from('game_reviews')
        .select('accuracy, blunders, mistakes, average_centipawn_loss, updated_at')
        .eq('game_id', game.id)
        .eq('user_id', user.id)
        .maybeSingle()
    ]);
    return {
      ...publicGame(await decorateGameRatings(supabase, game), moves, user.id),
      review
    };
  }));

  return Response.json({ ok: true, total: count ?? history.length, games: history });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
