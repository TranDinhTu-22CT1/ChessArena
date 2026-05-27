import { Chess } from 'chess.js';
import { rateLimit } from '../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../lib/validation';
import { decorateGameRatings, normalizeTimeControl, onlineModeFromTimeControl, publicGame, randomInviteCode, requireOnlineUser, touchPresence } from '../../../../lib/online';
import { publishOnlineGame } from '../../../../lib/onlineEvents';

export const runtime = 'nodejs';

async function uniqueInviteCode(supabase) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomInviteCode();
    const { data } = await supabase.from('online_games').select('id').eq('invite_code', code).maybeSingle();
    if (!data) return code;
  }
  throw new Error('Could not create invite code.');
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'online-friend', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await readJsonPayload(request);
  if (!payload) {
    return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const { supabase, user } = context;
  const timeControl = normalizeTimeControl(payload.timeControl);
  const mode = onlineModeFromTimeControl(timeControl);

  if (payload.action === 'create') {
    const code = await uniqueInviteCode(supabase);
    const requestedSide = ['white', 'black', 'random'].includes(payload.side) ? payload.side : 'random';
    const hostIsWhite = requestedSide === 'white' || (requestedSide === 'random' && Math.random() < 0.5);
    const { data: game, error } = await supabase
      .from('online_games')
      .insert({
        invite_code: code,
        status: 'waiting',
        match_type: 'friend',
        white_user_id: hostIsWhite ? user.id : null,
        black_user_id: hostIsWhite ? null : user.id,
        white_name: hostIsWhite ? user.displayName : 'Player',
        black_name: hostIsWhite ? 'Player' : user.displayName,
        fen: new Chess().fen(),
        pgn: '',
        turn: 'w',
        result: '*',
        time_control: timeControl,
        mode,
        rated: false
      })
      .select('*')
      .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    await touchPresence(supabase, user, { status: 'idle', currentGameId: game.id });
    return Response.json({
      ok: true,
      status: 'waiting',
      gameId: game.id,
      inviteCode: code,
      game: publicGame(await decorateGameRatings(supabase, game), [], user.id)
    });
  }

  const code = String(payload.code || '').trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) {
    return Response.json({ ok: false, error: 'Invalid invite code.' }, { status: 400 });
  }

  const { data: game } = await supabase
    .from('online_games')
    .select('*')
    .eq('invite_code', code)
    .eq('status', 'waiting')
    .maybeSingle();

  if (!game) {
    return Response.json({ ok: false, error: 'Invite not found or already used.' }, { status: 404 });
  }

  if (game.white_user_id === user.id || game.black_user_id === user.id) {
    return Response.json({ ok: false, error: 'You cannot join your own invite.' }, { status: 400 });
  }

  const patch = game.white_user_id
    ? { black_user_id: user.id, black_name: user.displayName }
    : { white_user_id: user.id, white_name: user.displayName };

  const { data: activeGame, error } = await supabase
    .from('online_games')
    .update({
      ...patch,
      status: 'active',
      last_move_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', game.id)
    .eq('status', 'waiting')
    .select('*')
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  await touchPresence(supabase, user, { status: 'playing', currentGameId: activeGame.id });
  publishOnlineGame(activeGame.id, { game: activeGame, moves: [] });
  return Response.json({
    ok: true,
    status: 'matched',
    gameId: activeGame.id,
    inviteCode: code,
    game: publicGame(await decorateGameRatings(supabase, activeGame), [], user.id)
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
