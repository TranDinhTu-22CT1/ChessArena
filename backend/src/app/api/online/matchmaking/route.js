import { rateLimit } from '../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../lib/validation';
import {
  DEFAULT_ONLINE_RATING,
  decorateGameRatings,
  normalizeTimeControl,
  onlineModeFromTimeControl,
  onlineSummary,
  publicGame,
  requireOnlineUser
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

async function matchedResponse(supabase, result, userId) {
  const [{ data: game, error }, { data: moves = [] }] = await Promise.all([
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
    game: publicGame(await decorateGameRatings(supabase, game), moves, userId),
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

  const { data: result, error } = await findGameRpc(supabase, {
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
  if (error) return rpcFailure(error);

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
