import { rateLimit } from '../../../../lib/rateLimit';
import { decorateGameRatings, gameParticipantUserId, publicGame, relatedOnlineUserIds, requireOnlineUser } from '../../../../lib/online';

export const runtime = 'nodejs';

const COMPLETED_STATUSES = ['checkmate', 'draw', 'resigned', 'abandoned'];
const RESULT_STATUSES = ['checkmate', 'draw', 'resigned'];

function participantFilter(userIds) {
  const values = userIds.join(',');
  return `white_user_id.in.(${values}),black_user_id.in.(${values})`;
}

function gameHasResult(game) {
  return RESULT_STATUSES.includes(game.status) || ['1-0', '0-1', '1/2-1/2'].includes(game.result);
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'online-history', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const { supabase, user } = context;
  const userIds = await relatedOnlineUserIds(supabase, user);
  const { data: games = [], error, count } = await supabase
    .from('online_games')
    .select('*', { count: 'exact' })
    .in('status', COMPLETED_STATUSES)
    .or(participantFilter(userIds))
    .order('finished_at', { ascending: false })
    .limit(100);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const completedGames = games.filter(gameHasResult);
  const history = await Promise.all(completedGames.map(async (game) => {
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
        .in('user_id', userIds)
        .limit(1)
        .maybeSingle()
    ]);
    const participantUserId = gameParticipantUserId(game, userIds, user.id);
    return {
      ...publicGame(await decorateGameRatings(supabase, game), moves, participantUserId),
      review
    };
  }));

  return Response.json({ ok: true, total: count === games.length ? history.length : count ?? history.length, games: history });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
