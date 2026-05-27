import { rateLimit } from '../../../../../../lib/rateLimit';
import {
  applyOnlineRatingResult,
  abortOnlineGameIfOpeningIdle,
  decorateGameRatings,
  expireOnlineGameOnClock,
  publicGame,
  requireOnlineUser,
  touchPresence
} from '../../../../../../lib/online';
import { publishOnlineGame } from '../../../../../../lib/onlineEvents';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  const blocked = rateLimit(request, { scope: 'online-game-resign', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const { supabase, user } = context;
  const { gameId } = await params;
  const { data: game, error } = await supabase
    .from('online_games')
    .select('*')
    .eq('id', gameId)
    .maybeSingle();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!game) return Response.json({ ok: false, error: 'Game not found.' }, { status: 404 });
  const playerColor = game.white_user_id === user.id ? 'w' : game.black_user_id === user.id ? 'b' : null;
  if (!playerColor) return Response.json({ ok: false, error: 'Forbidden.' }, { status: 403 });

  const { data: moves = [] } = await supabase
    .from('online_game_moves')
    .select('*')
    .eq('game_id', game.id)
    .order('ply', { ascending: true });
  const abandoned = await abortOnlineGameIfOpeningIdle(supabase, game, moves);
  if (abandoned.aborted) {
    publishOnlineGame(abandoned.game.id, { game: abandoned.game, moves });
    return Response.json({ ok: true, game: publicGame(await decorateGameRatings(supabase, abandoned.game), moves, user.id) });
  }
  const expired = await expireOnlineGameOnClock(supabase, abandoned.game, moves);
  if (expired.timedOut) {
    publishOnlineGame(expired.game.id, { game: expired.game, moves });
    return Response.json({ ok: true, game: publicGame(await decorateGameRatings(supabase, expired.game), moves, user.id) });
  }

  if (game.status !== 'active') return Response.json({ ok: false, error: 'Game is not active.' }, { status: 409 });

  const result = playerColor === 'w' ? '0-1' : '1-0';
  const { data: updatedGame, error: updateError } = await supabase
    .from('online_games')
    .update({
      status: 'resigned',
      result,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', game.id)
    .select('*')
    .single();

  if (updateError) return Response.json({ ok: false, error: updateError.message }, { status: 500 });

  publishOnlineGame(updatedGame.id, { game: updatedGame, moves });
  await applyOnlineRatingResult(supabase, updatedGame, result);
  await touchPresence(supabase, user, { status: 'online' });
  const responseGame = publicGame(await decorateGameRatings(supabase, updatedGame), moves, user.id);
  return Response.json({ ok: true, game: responseGame });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
