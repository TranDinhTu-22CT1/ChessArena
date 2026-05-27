import { rateLimit } from '../../../../lib/rateLimit';
import {
  activeOnlineGameForUser,
  abortOnlineGameIfOpeningIdle,
  decorateGameRatings,
  ensureModeRating,
  expireOnlineGameOnClock,
  onlineModeFromTimeControl,
  onlineSummary,
  publicGame,
  requireOnlineUser,
  touchPresence
} from '../../../../lib/online';
import { publishOnlineGame } from '../../../../lib/onlineEvents';

export const runtime = 'nodejs';

function cleanClientValue(value, limit) {
  return String(value || '').trim().slice(0, limit) || null;
}

function isMissingRpcSignature(error) {
  const message = String(error?.message || '');
  return (
    error?.code === 'PGRST202' ||
    error?.code === 'PGRST203' ||
    message.includes('Could not find the function') ||
    message.includes('quick_match_find_game')
  );
}

async function quickMatchFindFromTicket(supabase, user, ticket, clientId, sessionId) {
  if (!ticket?.time_control || !ticket?.mode) return null;

  const params = {
    p_user_id: user.id,
    p_time_control: ticket.time_control,
    p_mode: ticket.mode,
    p_rating: ticket.rating ?? null,
    p_client_id: clientId,
    p_session_id: sessionId,
    p_region: ticket.region || 'global',
    p_rating_range_preference: ticket.rating_range_preference ?? 500,
    p_idempotency_key: null
  };
  const nextResult = await supabase.rpc('quick_match_find_game', params);
  if (!isMissingRpcSignature(nextResult.error)) return nextResult;

  const { p_idempotency_key: _ignored, ...legacyParams } = params;
  return supabase.rpc('quick_match_find_game', legacyParams);
}

async function gameMoves(supabase, gameId) {
  const { data = [] } = await supabase
    .from('online_game_moves')
    .select('*')
    .eq('game_id', gameId)
    .order('ply', { ascending: true });
  return data;
}

async function enforceClockTimeout(supabase, game) {
  if (!game) return { game, moves: [] };
  if (game.status !== 'active') return { game, moves: await gameMoves(supabase, game.id) };
  const moves = await gameMoves(supabase, game.id);
  const abandoned = await abortOnlineGameIfOpeningIdle(supabase, game, moves);
  if (abandoned.aborted) publishOnlineGame(abandoned.game.id, { game: abandoned.game, moves });
  const expired = await expireOnlineGameOnClock(supabase, abandoned.game, moves);
  if (expired.timedOut) publishOnlineGame(expired.game.id, { game: expired.game, moves });
  return { game: expired.game, moves };
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'online-heartbeat', limit: 500, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) {
    return Response.json({
      ok: true,
      authenticated: false,
      currentGameId: null,
      game: null,
      me: null,
      onlineCount: 0,
      queueCount: 0
    });
  }

  const { supabase, user } = context;
  const payload = await request.json().catch(() => ({}));
  const wantsQueue = payload?.queueing === true;
  const clientGameId = String(payload?.gameId || '');
  const clientId = cleanClientValue(payload?.clientId || request.headers.get('x-client-id'), 120);
  const sessionId = cleanClientValue(payload?.sessionId || request.headers.get('x-matchmaking-session-id'), 120);
  const [activeGameCandidate, queued, presence] = await Promise.all([
    activeOnlineGameForUser(supabase, user.id),
    supabase
      .from('online_match_queue')
      .select('id, user_id, time_control, mode, rating, rating_range_preference, region')
      .eq('user_id', user.id)
      .eq('status', 'waiting')
      .maybeSingle(),
    supabase
      .from('online_presence')
      .select('status, current_game_id')
      .eq('user_id', user.id)
      .maybeSingle()
  ]);
  let rawActiveGame = activeGameCandidate;
  if (!rawActiveGame && clientGameId) {
    const { data: clientGame } = await supabase
      .from('online_games')
      .select('*')
      .eq('id', clientGameId)
      .maybeSingle();

    if (clientGame && [clientGame.white_user_id, clientGame.black_user_id].includes(user.id)) {
      rawActiveGame = clientGame;
    }
  }
  const enforced = await enforceClockTimeout(supabase, rawActiveGame);
  const activeGame = enforced.game;
  const activeMoves = enforced.moves;
  const rating = await ensureModeRating(
    supabase,
    user.id,
    activeGame?.mode || onlineModeFromTimeControl(activeGame?.time_control)
  );
  let isQueued = Boolean(queued.data);
  if (isQueued && !wantsQueue && presence.data?.status !== 'playing') {
    await supabase.rpc('quick_match_cancel', { p_user_id: user.id, p_reason: 'left_queue_view' });
    isQueued = false;
  }
  if (isQueued && wantsQueue) {
    const { error: heartbeatError } = await supabase.rpc('quick_match_heartbeat', {
      p_user_id: user.id,
      p_client_id: clientId,
      p_session_id: sessionId
    });
    if (isMissingRpcSignature(heartbeatError)) {
      await supabase
        .from('online_match_queue')
        .update({ last_seen: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('status', 'waiting');
    }

    const { data: matchResult, error: matchError } = await quickMatchFindFromTicket(
      supabase,
      user,
      queued.data,
      clientId,
      sessionId
    );
    if (matchError) {
      console.error('[heartbeat] opportunistic matchmaking failed', {
        code: matchError.code,
        message: matchError.message,
        details: matchError.details,
        hint: matchError.hint
      });
    }
    if (matchResult?.status === 'matched' && matchResult.game_id) {
      const [{ data: matchedGame }, { data: matchedMoves = [] }] = await Promise.all([
        supabase.from('online_games').select('*').eq('id', matchResult.game_id).single(),
        gameMoves(supabase, matchResult.game_id)
      ]);
      if (matchedGame) {
        return Response.json({
          ok: true,
          currentGameId: matchedGame.id,
          game: publicGame(await decorateGameRatings(supabase, matchedGame), matchedMoves, user.id),
          me: {
            id: user.id,
            displayName: user.displayName,
            rating: rating.rating
          },
          ...(await onlineSummary(supabase))
        });
      }
    }
  }
  const isClientGame = Boolean(activeGame && clientGameId === activeGame.id);
  const shouldOpenGame = activeGame?.status === 'active' && (wantsQueue || isClientGame);
  const shouldReturnClientGame = Boolean(activeGame && isClientGame && activeGame.status !== 'waiting');
  const waitingFriendGame = activeGame?.status === 'waiting';

  if (shouldOpenGame) {
    await supabase
      .from('online_match_queue')
      .update({ status: 'matched', matched_game_id: activeGame.id, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('status', 'waiting');
  }

  await touchPresence(supabase, user, {
    status: shouldOpenGame ? 'playing' : waitingFriendGame && isClientGame ? 'idle' : wantsQueue && isQueued ? 'queue' : 'online',
    currentGameId: shouldOpenGame || (waitingFriendGame && isClientGame) ? activeGame.id : null
  });
  const summary = await onlineSummary(supabase);

  return Response.json({
    ok: true,
    currentGameId: shouldOpenGame || shouldReturnClientGame ? activeGame.id : null,
    game: shouldReturnClientGame ? publicGame(await decorateGameRatings(supabase, activeGame), activeMoves, user.id) : null,
    me: {
      id: user.id,
      displayName: user.displayName,
      rating: rating.rating
    },
    ...summary
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
