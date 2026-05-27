import { rateLimit } from '../../../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../../../lib/validation';
import {
  applyOnlineRatingResult,
  abortOnlineGameIfOpeningIdle,
  chessFromMoves,
  decorateGameRatings,
  expireOnlineGameOnClock,
  gameResult,
  gameStatus,
  publicGame,
  requireOnlineUser,
  touchPresence
} from '../../../../../../lib/online';
import { publishOnlineGame } from '../../../../../../lib/onlineEvents';

export const runtime = 'nodejs';

function validSquare(value) {
  return /^[a-h][1-8]$/.test(String(value || ''));
}

function validPromotion(value) {
  return value === undefined || value === null || ['q', 'r', 'b', 'n'].includes(value);
}

export async function POST(request, { params }) {
  const blocked = rateLimit(request, { scope: 'online-game-move', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await readJsonPayload(request);
  if (!payload) {
    return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const from = String(payload.from || '');
  const to = String(payload.to || '');
  const promotion = payload.promotion ? String(payload.promotion) : undefined;
  if (!validSquare(from) || !validSquare(to) || !validPromotion(promotion)) {
    return Response.json({ ok: false, error: 'Invalid move payload.' }, { status: 400 });
  }

  const { supabase, user } = context;
  const { gameId } = await params;
  const [{ data: game, error: gameError }, { data: moves = [] }] = await Promise.all([
    supabase
      .from('online_games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle(),
    supabase
      .from('online_game_moves')
      .select('*')
      .eq('game_id', gameId)
      .order('ply', { ascending: true })
  ]);

  if (gameError) return Response.json({ ok: false, error: gameError.message }, { status: 500 });
  if (!game) return Response.json({ ok: false, error: 'Game not found.' }, { status: 404 });
  const playerColor = game.white_user_id === user.id ? 'w' : game.black_user_id === user.id ? 'b' : null;
  if (!playerColor) return Response.json({ ok: false, error: 'Forbidden.' }, { status: 403 });
  const abandoned = await abortOnlineGameIfOpeningIdle(supabase, game, moves);
  if (abandoned.aborted) {
    publishOnlineGame(abandoned.game.id, { game: abandoned.game, moves });
    const responseGame = publicGame(await decorateGameRatings(supabase, abandoned.game), moves, user.id);
    return Response.json({ ok: false, error: 'Game aborted because an opening move was not played in time.', game: responseGame }, { status: 409 });
  }
  const expired = await expireOnlineGameOnClock(supabase, abandoned.game, moves);
  if (expired.timedOut) {
    publishOnlineGame(expired.game.id, { game: expired.game, moves });
    const responseGame = publicGame(await decorateGameRatings(supabase, expired.game), moves, user.id);
    return Response.json({ ok: false, error: 'Time expired. The game is over.', game: responseGame }, { status: 409 });
  }
  if (game.status !== 'active') {
    return Response.json({ ok: false, error: 'Game is not active.' }, { status: 409 });
  }

  if (game.turn !== playerColor) {
    return Response.json({ ok: false, error: 'It is not your turn.' }, { status: 409 });
  }

  const chess = chessFromMoves(moves);
  const played = chess.move({ from, to, promotion });

  if (!played) {
    return Response.json({ ok: false, error: 'Illegal move.' }, { status: 400 });
  }

  const nextPly = moves.length + 1;
  const lan = `${played.from}${played.to}${played.promotion ?? ''}`;
  const nextStatus = gameStatus(chess);
  const result = gameResult(chess);
  const now = new Date().toISOString();

  const { error: insertError } = await supabase
    .from('online_game_moves')
    .insert({
      game_id: game.id,
      ply: nextPly,
      user_id: user.id,
      color: playerColor,
      san: played.san,
      lan,
      from_square: played.from,
      to_square: played.to,
      promotion: played.promotion ?? null,
      fen_after: chess.fen(),
      created_at: now
    });

  if (insertError) {
    return Response.json({ ok: false, error: insertError.message }, { status: 409 });
  }

  const { data: updatedGame, error: updateError } = await supabase
    .from('online_games')
    .update({
      status: nextStatus,
      fen: chess.fen(),
      pgn: chess.pgn(),
      turn: chess.turn(),
      result,
      last_move_at: now,
      finished_at: nextStatus === 'active' ? null : now,
      updated_at: now
    })
    .eq('id', game.id)
    .eq('turn', playerColor)
    .select('*')
    .single();

  if (updateError) {
    return Response.json({ ok: false, error: updateError.message }, { status: 409 });
  }

  const nextMoves = [
    ...moves,
    {
      ply: nextPly,
      color: playerColor,
      san: played.san,
      lan,
      from_square: played.from,
      to_square: played.to,
      promotion: played.promotion ?? null,
      fen_after: chess.fen(),
      created_at: now
    }
  ];
  publishOnlineGame(updatedGame.id, { game: updatedGame, moves: nextMoves });

  await Promise.all([
    touchPresence(supabase, user, {
      status: updatedGame.status === 'active' ? 'playing' : 'online',
      currentGameId: updatedGame.status === 'active' ? updatedGame.id : null
    }),
    updatedGame.status !== 'active'
      ? applyOnlineRatingResult(supabase, updatedGame, updatedGame.result)
      : Promise.resolve()
  ]);

  const responseGame = publicGame(await decorateGameRatings(supabase, updatedGame), nextMoves, user.id);
  return Response.json({ ok: true, game: responseGame });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
