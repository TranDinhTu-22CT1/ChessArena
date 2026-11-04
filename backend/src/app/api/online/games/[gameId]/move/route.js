import { performance } from 'node:perf_hooks';
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
import { onlineActionError, onlineActionGame } from '../../../../../../lib/onlineActionResponse';
import { publishOnlineGame } from '../../../../../../lib/onlineEvents';
import { onlineGameState } from '../../../../../../lib/onlineGameState';

export const runtime = 'nodejs';

function validSquare(value) {
  return /^[a-h][1-8]$/.test(String(value || ''));
}

function validPromotion(value) {
  return value === undefined || value === null || ['q', 'r', 'b', 'n'].includes(value);
}

export async function POST(request, { params }) {
  const startedAt = performance.now();
  const blocked = rateLimit(request, { scope: 'online-game-move', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const authenticatedAt = performance.now();

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
  let snapshot = onlineGameState.get(gameId);
  if (!snapshot) {
    const {data,error}=await supabase.rpc('online_game_snapshot',{p_game:gameId,p_user:user.id});
    if(error)return onlineActionError(error);
    if(!data)return Response.json({ok:false,error:'Game not found.'},{status:404});
    snapshot=data;
  }
  const {game,moves}=snapshot;
  const loadedAt = performance.now();
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
  let played;
  try { played = chess.move({ from, to, promotion }); }
  catch { return Response.json({ ok: false, error: 'Illegal move.' }, { status: 400 }); }

  if (!played) {
    return Response.json({ ok: false, error: 'Illegal move.' }, { status: 400 });
  }

  const nextPly = moves.length + 1;
  const lan = `${played.from}${played.to}${played.promotion ?? ''}`;
  const nextStatus = gameStatus(chess);
  const result = gameResult(chess);

  const moveParams = {
    p_game_id: game.id,
    p_user_id: user.id,
    p_expected_ply: nextPly,
    p_expected_turn: playerColor,
    p_san: played.san,
    p_lan: lan,
    p_from_square: played.from,
    p_to_square: played.to,
    p_promotion: played.promotion ?? null,
    p_fen_after: chess.fen(),
    p_pgn_after: chess.pgn(),
    p_next_turn: chess.turn(),
    p_next_status: nextStatus,
    p_result: result
  };
  const atomicMove = await supabase.rpc('commit_online_move_v3', moveParams);
  if (atomicMove.error) {
    // A different server may have committed a newer position. Discard the hint;
    // the client resynchronizes before retrying, never bypassing the SQL check.
    onlineGameState.remove(gameId);
    return onlineActionError(atomicMove.error);
  }
  const committedAt = performance.now();
  const updatedGame = atomicMove.data;
  // The database may expire the clock while this request is waiting for its lock.
  if (updatedGame.fen !== chess.fen() || updatedGame.pgn !== chess.pgn()) {
    const game = await onlineActionGame(supabase, user, updatedGame);
    return Response.json({ ok: false, error: 'The game ended before this move was committed.', game }, { status: 409 });
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
      created_at: updatedGame.last_move_at
    }
  ];
  const committedGame={...game,...updatedGame};
  publishOnlineGame(updatedGame.id, { game: committedGame, moves: nextMoves });
  const publishedAt = performance.now();

  const [, , decorated] = await Promise.all([
    touchPresence(supabase, user, {
      status: updatedGame.status === 'active' ? 'playing' : 'online',
      currentGameId: updatedGame.status === 'active' ? updatedGame.id : null
    }),
    updatedGame.status !== 'active'
      ? Promise.all([
          applyOnlineRatingResult(supabase, updatedGame, updatedGame.result),
        ])
      : Promise.resolve(),
    updatedGame.status === 'active'
      ? ('white_piece_set' in game ? Promise.resolve(committedGame) : decorateGameRatings(supabase, updatedGame))
      : Promise.resolve(null)
  ]);

  const responseGame = publicGame(decorated || await decorateGameRatings(supabase, updatedGame), nextMoves, user.id);
  const timings = { auth:authenticatedAt-startedAt, read:loadedAt-authenticatedAt,
    commit:committedAt-loadedAt, publish:publishedAt-committedAt, total:performance.now()-startedAt };
  return Response.json({ ok: true, game: responseGame }, { headers: {
    'Server-Timing': Object.entries(timings).map(([name,ms])=>`${name};dur=${ms.toFixed(1)}`).join(', ')
  } });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
