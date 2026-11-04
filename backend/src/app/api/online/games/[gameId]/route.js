import { rateLimit } from '../../../../../lib/rateLimit';
import {
  abortOnlineGameIfOpeningIdle,
  applyOnlineRatingResult,
  decorateGameRatings,
  expireOnlineGameOnClock,
  gameParticipantUserId,
  publicGame,
  relatedOnlineUserIds,
  requireOnlineUser
} from '../../../../../lib/online';
import { publishOnlineGame } from '../../../../../lib/onlineEvents';
import { schemaFailure } from '../../../../../lib/schemaReadiness';

export const runtime = 'nodejs';

async function savedReviewFor(supabase, gameId, userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('game_review_moves')
    .select('ply,san,move,best_move,tone,label,centipawn_loss,win_loss,white_score')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .order('ply', { ascending: true });
  if (error) return [];
  return (data || []).map((item) => ({
    ply: item.ply,
    san: item.san,
    move: item.move,
    bestMove: item.best_move,
    tone: item.tone,
    label: item.label,
    centipawnLoss: Number(item.centipawn_loss || 0),
    winLoss: Number(item.win_loss || 0),
    whiteScore: item.white_score == null ? null : Number(item.white_score),
    mover: Number(item.ply) % 2 === 0 ? 'b' : 'w',
    recovered: true
  }));
}

export async function GET(request, { params }) {
  const blocked = rateLimit(request, { scope: 'online-game-read', limit: 900, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const { supabase, user } = context;
  const { gameId } = await params;
  const { data: initialGame, error } = await supabase
    .from('online_games')
    .select('*')
    .eq('id', gameId)
    .maybeSingle();

  let game = initialGame;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!game) return Response.json({ ok: false, error: 'Game not found.' }, { status: 404 });
  const userIds = await relatedOnlineUserIds(supabase, user);
  const participantUserId = gameParticipantUserId(game, userIds, user.id);
  const isParticipant = [game.white_user_id, game.black_user_id].includes(participantUserId);
  const isFinished = ['checkmate', 'draw', 'resigned', 'abandoned'].includes(game.status);
  if (!isParticipant && !user.isAdmin && !isFinished && game.spectator_allowed === false) {
    return Response.json({ ok: false, error: 'Forbidden.' }, { status: 403 });
  }

  const { data: snapshot, error: snapshotError } = await supabase.rpc('online_game_snapshot', {
    p_game: game.id, p_user: game.white_user_id || game.black_user_id
  });
  if (snapshotError) return schemaFailure(snapshotError) || Response.json({ ok: false, error: 'Chưa tải được trạng thái ván đấu. Hãy thử lại.' }, { status: 503 });
  if (!snapshot) return Response.json({ ok: false, error: 'Game not found.' }, { status: 404 });
  game = snapshot.game;
  const moves = snapshot.moves;

  if (!isParticipant && !user.isAdmin) {
    return Response.json({ ok: true, game: publicGame(await decorateGameRatings(supabase, game), moves, user.id) });
  }

  const abandoned = await abortOnlineGameIfOpeningIdle(supabase, game, moves);
  if (abandoned.aborted) publishOnlineGame(abandoned.game.id, { game: abandoned.game, moves });
  const expired = await expireOnlineGameOnClock(supabase, abandoned.game, moves);
  if (expired.timedOut) {
    publishOnlineGame(expired.game.id, { game: expired.game, moves });
  }

  if (['checkmate', 'draw', 'resigned'].includes(expired.game.status)
    && expired.game.rated !== false && expired.game.white_rating_after == null) {
    await applyOnlineRatingResult(supabase, expired.game, expired.game.result);
  }

  const reviewMoves = isParticipant ? await savedReviewFor(supabase, game.id, participantUserId) : [];
  return Response.json({
    ok: true,
    game: publicGame(await decorateGameRatings(supabase, expired.game), moves, participantUserId),
    reviewMoves
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
