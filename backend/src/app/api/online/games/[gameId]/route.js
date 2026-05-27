import { rateLimit } from '../../../../../lib/rateLimit';
import { decorateGameRatings, publicGame, requireOnlineUser, touchPresence } from '../../../../../lib/online';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  const blocked = rateLimit(request, { scope: 'online-game-read', limit: 900, windowMs: 60_000 });
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
  if (![game.white_user_id, game.black_user_id].includes(user.id)) {
    return Response.json({ ok: false, error: 'Forbidden.' }, { status: 403 });
  }

  const { data: moves = [] } = await supabase
    .from('online_game_moves')
    .select('*')
    .eq('game_id', game.id)
    .order('ply', { ascending: true });

  await touchPresence(supabase, user, {
    status: game.status === 'active' ? 'playing' : 'online',
    currentGameId: game.status === 'active' ? game.id : null
  });

  return Response.json({ ok: true, game: publicGame(await decorateGameRatings(supabase, game), moves, user.id) });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
