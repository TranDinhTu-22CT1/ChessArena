import { rateLimit } from '../../../../lib/rateLimit';
import { decorateGameRatings, gameParticipantUserId, publicGame, relatedOnlineUserIds, requireOnlineUser } from '../../../../lib/online';

export const runtime = 'nodejs';

const COMPLETED_STATUSES = ['checkmate', 'draw', 'resigned', 'abandoned'];
const RESULT_STATUSES = ['checkmate', 'draw', 'resigned'];
const MODES = new Set(['bullet', 'blitz', 'rapid', 'classical']);

function participantFilter(userIds) {
  const values = userIds.join(',');
  return `white_user_id.in.(${values}),black_user_id.in.(${values})`;
}

function resultFilter(userIds, result) {
  const values = userIds.join(',');
  if (result === 'win') {
    return `and(white_user_id.in.(${values}),result.eq.1-0),and(black_user_id.in.(${values}),result.eq.0-1)`;
  }
  if (result === 'loss') {
    return `and(white_user_id.in.(${values}),result.eq.0-1),and(black_user_id.in.(${values}),result.eq.1-0)`;
  }
  if (result === 'draw') return 'result.eq.1/2-1/2,status.eq.draw';
  return '';
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
  const url = new URL(request.url);
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
  const limit = Math.max(5, Math.min(30, Math.floor(Number(url.searchParams.get('limit')) || 10)));
  const result = url.searchParams.get('result') || 'all';
  const mode = url.searchParams.get('mode') || 'all';
  const review = url.searchParams.get('review') || 'all';
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data: reviewRows = [], error: reviewError } = review === 'all'
    ? { data: [], error: null }
    : await supabase
      .from('game_reviews')
      .select('game_id')
      .in('user_id', userIds);
  if (reviewError) return Response.json({ ok: false, error: reviewError.message }, { status: 500 });

  const reviewedGameIds = [...new Set(reviewRows.map((row) => row.game_id).filter(Boolean))];
  if (review === 'reviewed' && reviewedGameIds.length === 0) {
    return Response.json({ ok: true, page, limit, total: 0, totalPages: 1, games: [] });
  }

  let query = supabase
    .from('online_games')
    .select('*', { count: 'exact' })
    .in('status', COMPLETED_STATUSES)
    .or(participantFilter(userIds));

  if (MODES.has(mode)) query = query.eq('mode', mode);
  const nextResultFilter = resultFilter(userIds, result);
  if (nextResultFilter) query = query.or(nextResultFilter);
  if (review === 'reviewed') query = query.in('id', reviewedGameIds);
  if (review === 'unreviewed' && reviewedGameIds.length > 0) query = query.not('id', 'in', `(${reviewedGameIds.join(',')})`);

  const { data: games = [], error, count } = await query
    .order('finished_at', { ascending: false })
    .range(from, to);

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

  return Response.json({
    ok: true,
    page,
    limit,
    total: count ?? history.length,
    totalPages: Math.max(1, Math.ceil((count ?? history.length) / limit)),
    games: history
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
