import { distributedRateLimit } from '../../../../lib/rateLimit';
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

let matchmakingV2ColumnsAvailable = null;

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

function isMissingMatchmakingV2Schema(error) {
  const message = String(error?.message || '');
  return (
    error?.code === '42703'
    || error?.code === 'PGRST204'
    || message.includes('region_scope')
    || message.includes('generation')
    || message.includes('lease_expires_at')
  );
}

async function findWaitingTicket(supabase, userId, sessionId, ticketId) {
  const applyOwnershipFilters = (query) => {
    let nextQuery = query.eq('user_id', userId).eq('status', 'waiting');
    if (sessionId) nextQuery = nextQuery.eq('session_id', sessionId);
    if (ticketId) nextQuery = nextQuery.eq('id', ticketId);
    return nextQuery.maybeSingle();
  };

  if (matchmakingV2ColumnsAvailable !== false) {
    const current = await applyOwnershipFilters(
      supabase
        .from('online_match_queue')
        .select('id, user_id, time_control, mode, rating, rating_range_preference, region, region_scope, session_id, generation, lease_expires_at')
    );
    if (!current.error) {
      matchmakingV2ColumnsAvailable = true;
      return current;
    }
    if (!isMissingMatchmakingV2Schema(current.error)) return current;
    matchmakingV2ColumnsAvailable = false;
  }

  return applyOwnershipFilters(
    supabase
      .from('online_match_queue')
      .select('id, user_id, time_control, mode, rating, rating_range_preference, region, session_id')
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
    p_region: ticket.region_scope || ticket.region || 'global',
    p_rating_range_preference: ticket.rating_range_preference ?? 500,
    p_idempotency_key: null
  };
  const v2Result = await supabase.rpc('quick_match_find_game_v2', params);
  if (!isMissingRpcSignature(v2Result.error)) return v2Result;

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
  const blocked = await distributedRateLimit(request, {
    scope: 'online-heartbeat',
    identity: user.id,
    limit: 30,
    windowMs: 60_000
  });
  if (blocked) return blocked;

  const payload = await request.json().catch(() => ({}));
  const wantsQueue = payload?.queueing === true;
  const clientGameId = String(payload?.gameId || '');
  const clientId = cleanClientValue(payload?.clientId || request.headers.get('x-client-id'), 120);
  const sessionId = cleanClientValue(payload?.sessionId || request.headers.get('x-matchmaking-session-id'), 120);
  const ticketId = cleanClientValue(payload?.ticketId, 80);
  const [activeGameCandidate, queued] = await Promise.all([
    activeOnlineGameForUser(supabase, user.id),
    findWaitingTicket(supabase, user.id, sessionId, ticketId)
  ]);
  if (queued.error) {
    console.error('[heartbeat] queue lookup failed', {
      code: queued.error.code,
      message: queued.error.message,
      details: queued.error.details,
      hint: queued.error.hint
    });
  }
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
  if (isQueued && wantsQueue) {
    const v2Heartbeat = await supabase.rpc('quick_match_heartbeat_v2', {
      p_user_id: user.id,
      p_ticket_id: queued.data.id,
      p_client_id: clientId,
      p_session_id: sessionId
    });
    if (isMissingRpcSignature(v2Heartbeat.error)) {
      const legacyHeartbeat = await supabase.rpc('quick_match_heartbeat', {
        p_user_id: user.id,
        p_client_id: clientId,
        p_session_id: sessionId
      });
      if (isMissingRpcSignature(legacyHeartbeat.error)) {
        await supabase
          .from('online_match_queue')
          .update({ last_seen: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', queued.data.id)
          .eq('status', 'waiting');
      }
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
          queueTicketId: queued.data.id,
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
    queueTicketId: isQueued ? queued.data?.id ?? null : null,
    generation: isQueued ? queued.data?.generation ?? null : null,
    leaseExpiresAt: isQueued ? queued.data?.lease_expires_at ?? null : null,
    ...summary
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
