import { rateLimit } from '../../../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../../../lib/validation';
import { decorateGameRatings, publicGame, requireOnlineUser, touchPresence } from '../../../../../../lib/online';
import { publishOnlineGame } from '../../../../../../lib/onlineEvents';

export const runtime = 'nodejs';
const REMATCH_RESPONSE_MS = 15_000;

async function fetchMoves(supabase, gameId) {
  const { data = [] } = await supabase
    .from('online_game_moves')
    .select('*')
    .eq('game_id', gameId)
    .order('ply', { ascending: true });
  return data;
}

function opponentId(game, userId) {
  if (game.white_user_id === userId) return game.black_user_id;
  if (game.black_user_id === userId) return game.white_user_id;
  return null;
}

function rematchExpired(game) {
  const requestedAt = Date.parse(game.rematch_requested_at || '');
  return !Number.isFinite(requestedAt) || Date.now() - requestedAt >= REMATCH_RESPONSE_MS;
}

export async function POST(request, { params }) {
  const blocked = rateLimit(request, { scope: 'online-game-rematch', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await readJsonPayload(request);
  if (!payload) {
    return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const action = String(payload.action || '');
  if (!['request', 'accept', 'decline'].includes(action)) {
    return Response.json({ ok: false, error: 'Invalid rematch action.' }, { status: 400 });
  }

  const { supabase, user } = context;
  const { gameId } = await params;
  const { data: game, error: gameError } = await supabase
    .from('online_games')
    .select('*')
    .eq('id', gameId)
    .maybeSingle();

  if (gameError) return Response.json({ ok: false, error: gameError.message }, { status: 500 });
  if (!game) return Response.json({ ok: false, error: 'Game not found.' }, { status: 404 });
  if (![game.white_user_id, game.black_user_id].includes(user.id)) {
    return Response.json({ ok: false, error: 'Forbidden.' }, { status: 403 });
  }
  if (!['checkmate', 'draw', 'resigned'].includes(game.status)) {
    return Response.json({ ok: false, error: 'Rematch is available after the game ends.' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const moves = await fetchMoves(supabase, game.id);

  if (action === 'request') {
    if (game.rematch_requested_by && !game.rematch_response && !rematchExpired(game) && game.rematch_requested_by !== user.id) {
      return Response.json({ ok: false, error: 'Your opponent already requested a rematch. Answer that request first.' }, { status: 409 });
    }
    const { data: updatedGame, error } = await supabase
      .from('online_games')
      .update({
        rematch_requested_by: user.id,
        rematch_requested_at: now,
        rematch_response: null,
        rematch_game_id: null,
        updated_at: now
      })
      .eq('id', game.id)
      .select('*')
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    await touchPresence(supabase, user, { status: 'online', currentGameId: null });
    publishOnlineGame(updatedGame.id, { game: updatedGame, moves });
    return Response.json({ ok: true, game: publicGame(await decorateGameRatings(supabase, updatedGame), moves, user.id) });
  }

  if (!game.rematch_requested_by) {
    return Response.json({ ok: false, error: 'No rematch request found.' }, { status: 409 });
  }
  if (game.rematch_requested_by === user.id) {
    return Response.json({ ok: false, error: 'Waiting for opponent response.' }, { status: 409 });
  }
  if (opponentId(game, game.rematch_requested_by) !== user.id) {
    return Response.json({ ok: false, error: 'Only the opponent can answer this rematch.' }, { status: 403 });
  }
  if (rematchExpired(game)) {
    const { data: expiredGame } = await supabase
      .from('online_games')
      .update({ rematch_response: 'declined', updated_at: now })
      .eq('id', game.id)
      .is('rematch_response', null)
      .select('*')
      .maybeSingle();

    if (expiredGame) publishOnlineGame(expiredGame.id, { game: expiredGame, moves });
    return Response.json({ ok: false, error: 'Rematch request expired.' }, { status: 410 });
  }

  if (action === 'decline') {
    const { data: updatedGame, error } = await supabase
      .from('online_games')
      .update({ rematch_response: 'declined', updated_at: now })
      .eq('id', game.id)
      .select('*')
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    publishOnlineGame(updatedGame.id, { game: updatedGame, moves });
    return Response.json({ ok: true, game: publicGame(await decorateGameRatings(supabase, updatedGame), moves, user.id) });
  }

  const { data: newGame, error: createError } = await supabase
    .from('online_games')
    .insert({
      status: 'active',
      match_type: game.match_type,
      white_user_id: game.black_user_id,
      black_user_id: game.white_user_id,
      white_name: game.black_name,
      black_name: game.white_name,
      fen: 'start',
      pgn: '',
      turn: 'w',
      result: '*',
      time_control: game.time_control,
      mode: game.mode,
      rated: game.rated,
      last_move_at: now,
      created_at: now,
      started_at: now,
      updated_at: now
    })
    .select('*')
    .single();

  if (createError) return Response.json({ ok: false, error: createError.message }, { status: 500 });

  const { data: updatedGame, error: updateError } = await supabase
    .from('online_games')
    .update({ rematch_response: 'accepted', rematch_game_id: newGame.id, updated_at: now })
    .eq('id', game.id)
    .select('*')
    .single();

  if (updateError) return Response.json({ ok: false, error: updateError.message }, { status: 500 });

  await touchPresence(supabase, user, { status: 'playing', currentGameId: newGame.id });
  publishOnlineGame(updatedGame.id, { game: updatedGame, moves });
  return Response.json({ ok: true, game: publicGame(await decorateGameRatings(supabase, newGame), [], user.id) });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
