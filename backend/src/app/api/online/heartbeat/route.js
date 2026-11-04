import { distributedRateLimit } from '../../../../lib/rateLimit';
import { activeOnlineGameForUser, abortOnlineGameIfOpeningIdle, decorateGameRatings, ensureModeRating,
  expireOnlineGameOnClock, onlineModeFromTimeControl, onlineSummary, publicGame, requireOnlineUser, touchPresence } from '../../../../lib/online';
import { publishOnlineGame } from '../../../../lib/onlineEvents';
import { checkMatchmakingSchema, schemaFailure } from '../../../../lib/schemaReadiness';

export const runtime = 'nodejs';
const clean = (value, max = 120) => String(value || '').trim().slice(0, max);
const uuid = /^[0-9a-f-]{36}$/i;

async function loadMoves(supabase, id) {
  const { data, error } = await supabase.from('online_game_moves').select('*').eq('game_id', id).order('ply');
  if (error) throw error;
  return data || [];
}

export async function POST(request) {
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const { supabase, user } = context;
  const blocked = await distributedRateLimit(request, { scope: 'online-heartbeat', identity: user.id, limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;
  const payload = await request.json().catch(() => ({}));
  const wantsQueue = payload.queueing === true;
  const sessionId = clean(payload.sessionId);
  const ticketId = clean(payload.ticketId, 80);
  const clientId = clean(payload.clientId);
  const clientGameId = uuid.test(payload.gameId || '') ? payload.gameId : null;
  try {
    let activeGame = await activeOnlineGameForUser(supabase, user.id);
    let ticket = null;
    let result = null;
    if (sessionId && uuid.test(ticketId)) {
      const queued = await supabase.from('online_match_queue').select('*').eq('id', ticketId)
        .eq('user_id', user.id).eq('session_id', sessionId).eq('status', 'waiting').maybeSingle();
      if (queued.error) throw queued.error;
      ticket = queued.data;
    }
    if (!activeGame && wantsQueue && ticket) {
      const schemaError=await checkMatchmakingSchema(supabase);
      if(schemaError) return schemaFailure(schemaError) || Response.json({ok:false,error:'Chưa kiểm tra được phiên bản ghép trận.'},{status:503});
      const matched = await supabase.rpc('quick_match_find_game_v3', {
        p_user_id: user.id, p_time_control: ticket.time_control, p_mode: ticket.mode,
        p_client_id: clientId, p_session_id: sessionId, p_region: ticket.region_scope,
        p_rating_range_preference: ticket.rating_range_preference, p_idempotency_key: ticket.idempotency_key
      });
      if (matched.error) throw matched.error;
      result = matched.data;
      if (result.status === 'matched') {
        const game = await supabase.from('online_games').select('*').eq('id', result.game_id).single();
        if (game.error) throw game.error;
        activeGame = game.data;
        ticket = null;
      }
    }
    if (!activeGame && clientGameId) {
      const game = await supabase.from('online_games').select('*').eq('id', clientGameId).maybeSingle();
      if (game.error) throw game.error;
      if (game.data && [game.data.white_user_id, game.data.black_user_id].includes(user.id)) activeGame = game.data;
    }
    let moves = [];
    if (activeGame) {
      moves = await loadMoves(supabase, activeGame.id);
      const abandoned = await abortOnlineGameIfOpeningIdle(supabase, activeGame, moves);
      const expired = await expireOnlineGameOnClock(supabase, abandoned.game, moves);
      activeGame = expired.game;
      if (abandoned.aborted || expired.timedOut) publishOnlineGame(activeGame.id, { game: activeGame, moves });
    }
    const playing = activeGame?.status === 'active';
    // An authenticated participant must be able to restore an active game after a
    // reload even when the browser no longer remembers its queue flag or game id.
    const open = Boolean(activeGame && (playing || clientGameId === activeGame.id));
    const rating = await ensureModeRating(supabase, user.id, activeGame?.mode || ticket?.mode || onlineModeFromTimeControl('600+0'));
    await touchPresence(supabase, user, {
      status: playing ? 'playing' : ticket ? 'queue' : 'online',
      currentGameId: playing ? activeGame.id : null
    });
    return Response.json({
      ok: true, currentGameId: open ? activeGame.id : null,
      game: open ? publicGame(await decorateGameRatings(supabase, activeGame), moves, user.id) : null,
      me: { id: user.id, displayName: user.displayName, rating: result?.rating ?? rating.rating },
      queueStatus: ticket ? 'waiting' : 'idle',
      queueTicketId: playing ? null : result?.queue_ticket_id || ticket?.id || null,
      ratingLimit: result?.rating_limit ?? null,
      ratingWindow: result?.rating_window ?? null, joinedAt: result?.joined_at || ticket?.joined_at || null,
      generation: result?.generation || ticket?.generation || null,
      leaseExpiresAt: result?.lease_expires_at || ticket?.lease_expires_at || null,
      ...(await onlineSummary(supabase))
    });
  } catch (error) {
    console.error('[heartbeat]', error.message);
    const schemaError = schemaFailure(error);
    if (schemaError) return schemaError;
    return Response.json({ ok: false, error: 'Không thể đồng bộ trận đấu. Kiểm tra kết nối và migration database.' }, { status: 503 });
  }
}
export function OPTIONS() { return new Response(null, { status: 204 }); }
