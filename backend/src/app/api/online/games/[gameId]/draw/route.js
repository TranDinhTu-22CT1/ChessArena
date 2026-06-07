import { distributedRateLimit } from '../../../../../../lib/rateLimit';
import {
  applyOnlineRatingResult,
  applyTournamentResult,
  decorateGameRatings,
  publicGame,
  requireOnlineUser,
  touchPresence
} from '../../../../../../lib/online';
import { publishOnlineGame } from '../../../../../../lib/onlineEvents';

export const runtime = 'nodejs';

const ACTIONS = new Set(['offer', 'accept', 'decline', 'cancel']);

export async function POST(request, { params }) {
  const blocked = await distributedRateLimit(request, { scope: 'online-game-draw', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const { gameId } = await params;
  const payload = await request.json().catch(() => ({}));
  const action = ACTIONS.has(payload.action) ? payload.action : '';
  if (!action) return Response.json({ ok: false, error: 'Invalid draw action.' }, { status: 400 });

  const { data: game, error } = await context.supabase
    .from('online_games')
    .select('*')
    .eq('id', gameId)
    .maybeSingle();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!game) return Response.json({ ok: false, error: 'Game not found.' }, { status: 404 });
  if (![game.white_user_id, game.black_user_id].includes(context.user.id)) {
    return Response.json({ ok: false, error: 'Forbidden.' }, { status: 403 });
  }
  if (game.status !== 'active') return Response.json({ ok: false, error: 'Game is not active.' }, { status: 409 });

  let patch;
  if (action === 'offer') {
    if (game.draw_offered_by && game.draw_offered_by !== context.user.id) {
      return Response.json({ ok: false, error: 'Your opponent already offered a draw.' }, { status: 409 });
    }
    patch = { draw_offered_by: context.user.id, draw_offered_at: new Date().toISOString() };
  } else if (action === 'accept') {
    if (!game.draw_offered_by || game.draw_offered_by === context.user.id) {
      return Response.json({ ok: false, error: 'There is no opponent draw offer to accept.' }, { status: 409 });
    }
    patch = {
      status: 'draw',
      result: '1/2-1/2',
      draw_offered_by: null,
      draw_offered_at: null,
      finished_at: new Date().toISOString()
    };
  } else {
    if (action === 'cancel' && game.draw_offered_by !== context.user.id) {
      return Response.json({ ok: false, error: 'Only the offering player can cancel.' }, { status: 409 });
    }
    patch = { draw_offered_by: null, draw_offered_at: null };
  }
  patch.updated_at = new Date().toISOString();

  const { data: updated, error: updateError } = await context.supabase
    .from('online_games')
    .update(patch)
    .eq('id', gameId)
    .eq('status', 'active')
    .select('*')
    .single();
  if (updateError) return Response.json({ ok: false, error: updateError.message }, { status: 500 });

  const { data: moves = [] } = await context.supabase
    .from('online_game_moves')
    .select('*')
    .eq('game_id', gameId)
    .order('ply', { ascending: true });
  if (action === 'accept') {
    await applyOnlineRatingResult(context.supabase, updated, '1/2-1/2');
    await applyTournamentResult(context.supabase, updated, '1/2-1/2');
    await touchPresence(context.supabase, context.user, { status: 'online' });
  }
  publishOnlineGame(gameId, { game: updated, moves, drawAction: action });
  return Response.json({
    ok: true,
    game: publicGame(await decorateGameRatings(context.supabase, updated), moves, context.user.id)
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
