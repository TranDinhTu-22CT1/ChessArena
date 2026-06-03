import { rateLimit } from '../../../../lib/rateLimit';
import { readJsonPayload, safeArray } from '../../../../lib/validation';
import {
  DEFAULT_ONLINE_RATING,
  decorateGameRatings,
  normalizeTimeControl,
  onlineModeFromTimeControl,
  onlineSummary,
  publicGame,
  requireOnlineUser,
  touchPresence
} from '../../../../lib/online';

export const runtime = 'nodejs';

function cleanClientValue(value, limit) {
  return String(value || '').trim().slice(0, limit) || null;
}

function correlationId(request, payload = {}) {
  return cleanClientValue(
    payload.correlationId || request.headers.get('x-correlation-id') || crypto.randomUUID(),
    120
  );
}

function rpcFailure(error) {
  const message = String(error?.message || '');
  const migrationCodes = new Set(['PGRST202', 'PGRST203', '42703', '42883', '42P01']);
  if (
    migrationCodes.has(error?.code) ||
    message.includes('quick_match_') ||
    message.includes('matchmaking_events') ||
    message.includes('online_match_queue') ||
    message.includes('idempotency_key') ||
    message.includes('correlation_id') ||
    message.includes('fairness_score')
  ) {
    console.error('[matchmaking] database migration mismatch', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint
    });
    return Response.json(
      { ok: false, status: 'unavailable', error: 'Matchmaking database migration is required. Apply backend/supabase/schema.sql.' }
    );
  }
  if (error?.code === '42501') {
    return Response.json({ ok: false, error: 'Matchmaking is temporarily unavailable for this account.' }, { status: 403 });
  }
  return Response.json({ ok: false, error: message || 'Matchmaking failed.' }, { status: 500 });
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

async function findGameRpc(supabase, params) {
  const nextResult = await supabase.rpc('quick_match_find_game', params);
  if (!isMissingRpcSignature(nextResult.error)) return nextResult;

  const { p_idempotency_key: _ignored, ...legacyParams } = params;
  const legacyResult = await supabase.rpc('quick_match_find_game', legacyParams);
  if (legacyResult.error) {
    console.error('[matchmaking] quick_match_find_game failed', {
      next: {
        code: nextResult.error?.code,
        message: nextResult.error?.message,
        details: nextResult.error?.details,
        hint: nextResult.error?.hint
      },
      legacy: {
        code: legacyResult.error?.code,
        message: legacyResult.error?.message,
        details: legacyResult.error?.details,
        hint: legacyResult.error?.hint
      }
    });
  }
  return legacyResult;
}

async function rescueWaitingMatch(supabase, user, timeControl, mode) {
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - 45_000).toISOString();
  const { data: activeGame } = await supabase
    .from('online_games')
    .select('id')
    .eq('status', 'active')
    .or(`white_user_id.eq.${user.id},black_user_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeGame) return { status: 'matched', game_id: activeGame.id, rescued: true };

  let { data: myTicket, error: ticketError } = await supabase
    .from('online_match_queue')
    .select('id, user_id, display_name, rating, time_control, mode, status, joined_at')
    .eq('user_id', user.id)
    .eq('status', 'waiting')
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ticketError) throw ticketError;

  if (!myTicket) {
    const inserted = await supabase
      .from('online_match_queue')
      .insert({
        user_id: user.id,
        firebase_uid: user.firebaseUid,
        display_name: user.displayName,
        time_control: timeControl,
        mode,
        rating: DEFAULT_ONLINE_RATING,
        pool: 'standard',
        status: 'waiting',
        joined_at: now,
        last_seen: now,
        updated_at: now
      })
      .select('id, user_id, display_name, rating, time_control, mode, status, joined_at')
      .single();
    if (inserted.error) throw inserted.error;
    myTicket = inserted.data;
  } else {
    const refreshed = await supabase
      .from('online_match_queue')
      .update({ last_seen: now, updated_at: now })
      .eq('id', myTicket.id)
      .eq('status', 'waiting')
      .select('id, user_id, display_name, rating, time_control, mode, status, joined_at')
      .maybeSingle();
    myTicket = refreshed.data || myTicket;
  }

  await touchPresence(supabase, user, { status: 'queue', currentGameId: null });
  const { data: opponentRows = [], error: opponentError } = await supabase
    .from('online_match_queue')
    .select('id, user_id, display_name, rating, joined_at')
    .neq('user_id', user.id)
    .eq('status', 'waiting')
    .eq('time_control', timeControl)
    .eq('mode', mode)
    .gte('last_seen', staleBefore)
    .order('joined_at', { ascending: true })
    .limit(3);
  if (opponentError) throw opponentError;

  const opponents = safeArray(opponentRows);

  for (const opponent of opponents) {
    const { data: claimed } = await supabase
      .from('online_match_queue')
      .update({ status: 'claimed', claimed_by: user.id, claimed_at: now, updated_at: now })
      .eq('id', opponent.id)
      .eq('status', 'waiting')
      .select('id, user_id, display_name, rating')
      .maybeSingle();
    if (!claimed) continue;

    const userIsWhite = Math.random() < 0.5;
    const whiteUserId = userIsWhite ? user.id : claimed.user_id;
    const blackUserId = userIsWhite ? claimed.user_id : user.id;
    const whiteName = userIsWhite ? user.displayName : claimed.display_name;
    const blackName = userIsWhite ? claimed.display_name : user.displayName;
    const { data: game, error: gameError } = await supabase
      .from('online_games')
      .insert({
        status: 'active',
        match_type: 'quick',
        white_user_id: whiteUserId,
        black_user_id: blackUserId,
        white_name: whiteName,
        black_name: blackName,
        fen: 'start',
        pgn: '',
        turn: 'w',
        result: '*',
        time_control: timeControl,
        mode,
        rated: true,
        last_move_at: now,
        started_at: now,
        updated_at: now,
        matchmaking_ticket_white: userIsWhite ? myTicket.id : claimed.id,
        matchmaking_ticket_black: userIsWhite ? claimed.id : myTicket.id,
        matchmaking_pool: 'rescue'
      })
      .select('id')
      .single();
    if (gameError) {
      await supabase.from('online_match_queue').update({ status: 'waiting', claimed_by: null, claimed_at: null, updated_at: now }).eq('id', claimed.id).eq('status', 'claimed');
      throw gameError;
    }

    await Promise.all([
      supabase
        .from('online_match_queue')
        .update({ status: 'matched', matched_game_id: game.id, updated_at: now })
        .in('id', [myTicket.id, claimed.id]),
      supabase
        .from('online_presence')
        .update({ status: 'playing', current_game_id: game.id, current_queue_ticket_id: null, last_seen: now, updated_at: now })
        .in('user_id', [user.id, claimed.user_id])
    ]);
    return {
      status: 'matched',
      game_id: game.id,
      queue_ticket_id: myTicket.id,
      mode,
      pool: 'rescue',
      rescued: true
    };
  }

  return { status: 'waiting', queue_ticket_id: myTicket.id, mode, pool: 'rescue', rescued: true };
}

async function matchedResponse(supabase, result, userId) {
  const [{ data: game, error }, { data: moveRows = [] }] = await Promise.all([
    supabase.from('online_games').select('*').eq('id', result.game_id).single(),
    supabase.from('online_game_moves').select('*').eq('game_id', result.game_id).order('ply', { ascending: true })
  ]);

  if (error || !game) return Response.json({ ok: false, error: error?.message || 'Matched game not found.' }, { status: 500 });
  return Response.json({
    ok: true,
    status: 'matched',
    gameId: game.id,
    queueTicketId: result.queue_ticket_id ?? null,
    ratingWindow: result.rating_window ?? null,
    ratingGap: result.rating_gap ?? null,
    mode: result.mode ?? game.mode,
    pool: result.pool ?? game.matchmaking_pool,
    game: publicGame(await decorateGameRatings(supabase, game), safeArray(moveRows), userId),
    ...(await onlineSummary(supabase))
  });
}

export async function POST(request) {
  const startedAt = Date.now();
  const blocked = rateLimit(request, { scope: 'online-matchmaking', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await readJsonPayload(request);
  if (!payload) {
    return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const { supabase, user } = context;
  if (payload.action === 'cancel') {
    const { error } = await supabase.rpc('quick_match_cancel', {
      p_user_id: user.id,
      p_reason: cleanClientValue(payload.reason, 80) || 'user_cancelled'
    });
    if (error) return rpcFailure(error);
    return Response.json({ ok: true, status: 'cancelled', ...(await onlineSummary(supabase)) });
  }

  const timeControl = normalizeTimeControl(payload.timeControl);
  const mode = onlineModeFromTimeControl(timeControl);
  const clientId = cleanClientValue(payload.clientId || request.headers.get('x-client-id'), 120);
  const sessionId = cleanClientValue(payload.sessionId || request.headers.get('x-matchmaking-session-id'), 120);
  const requestId = correlationId(request, payload);
  const idempotencyKey = cleanClientValue(
    payload.idempotencyKey || request.headers.get('idempotency-key') || `${sessionId || requestId}:${timeControl}`,
    120
  );
  const region = cleanClientValue(payload.region, 40) || 'global';
  const requestedRange = Number(payload.ratingRangePreference);
  const ratingRangePreference = Number.isFinite(requestedRange)
    ? Math.max(25, Math.min(1000, Math.trunc(requestedRange)))
    : 500;

  const rpcResult = await findGameRpc(supabase, {
    p_user_id: user.id,
    p_time_control: timeControl,
    p_mode: mode,
    p_rating: DEFAULT_ONLINE_RATING,
    p_client_id: clientId,
    p_session_id: sessionId,
    p_region: region,
    p_rating_range_preference: ratingRangePreference,
    p_idempotency_key: idempotencyKey
  });
  let { data: result, error } = rpcResult;
  if (error) {
    try {
      result = await rescueWaitingMatch(supabase, user, timeControl, mode);
      error = null;
    } catch {
      return rpcFailure(error);
    }
  } else if (result?.status === 'waiting') {
    try {
      const rescued = await rescueWaitingMatch(supabase, user, timeControl, mode);
      if (rescued.status === 'matched') result = rescued;
    } catch (rescueError) {
      console.error('[matchmaking] rescue lookup failed', { message: rescueError?.message });
    }
  }

  supabase.from('matchmaking_events').insert({
    user_id: user.id,
    ticket_id: result?.queue_ticket_id ?? null,
    game_id: result?.game_id ?? null,
    event_type: 'api_find_completed',
    mode,
    time_control: timeControl,
    pool: result?.pool ?? null,
    client_id: clientId,
    session_id: sessionId,
    correlation_id: requestId,
    metadata: {
      status: result?.status ?? 'unknown',
      duration_ms: Date.now() - startedAt,
      idempotency_key: idempotencyKey
    }
  }).then(() => {}, () => {});

  if (result?.status === 'matched') return matchedResponse(supabase, result, user.id);
  if (result?.status === 'cooldown') {
    return Response.json({
      ok: false,
      error: 'You cancelled searches repeatedly. Please wait briefly before searching again.',
      cooldownUntil: result.cooldown_until
    }, { status: 429 });
  }

  return Response.json({
    ok: true,
    status: 'waiting',
    queueTicketId: result?.queue_ticket_id ?? null,
    estimatedWait: result?.estimated_wait ?? null,
    ratingWindow: result?.rating_window ?? null,
    rating: result?.rating ?? DEFAULT_ONLINE_RATING,
    mode: result?.mode ?? mode,
    pool: result?.pool ?? 'standard',
    ...(await onlineSummary(supabase))
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
