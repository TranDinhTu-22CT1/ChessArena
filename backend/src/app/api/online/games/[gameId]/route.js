import { rateLimit } from '../../../../../lib/rateLimit';
import {
  abortOnlineGameIfOpeningIdle,
  decorateGameRatings,
  expireOnlineGameOnClock,
  gameParticipantUserId,
  publicGame,
  relatedOnlineUserIds,
  requireOnlineUser,
  touchPresence
} from '../../../../../lib/online';
import { publishOnlineGame } from '../../../../../lib/onlineEvents';

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
  const userIds = await relatedOnlineUserIds(supabase, user);
  const participantUserId = gameParticipantUserId(game, userIds, user.id);
  const isParticipant = [game.white_user_id, game.black_user_id].includes(participantUserId);
  const isFinished = ['checkmate', 'draw', 'resigned', 'abandoned'].includes(game.status);
  if (!isParticipant && !user.isAdmin && !isFinished && game.spectator_allowed === false) {
    return Response.json({ ok: false, error: 'Forbidden.' }, { status: 403 });
  }

  const { data: moves = [] } = await supabase
    .from('online_game_moves')
    .select('*')
    .eq('game_id', game.id)
    .order('ply', { ascending: true });

  if (!isParticipant && !user.isAdmin) {
    return Response.json({ ok: true, game: publicGame(await decorateGameRatings(supabase, game), moves, user.id) });
  }

  const abandoned = await abortOnlineGameIfOpeningIdle(supabase, game, moves);
  if (abandoned.aborted) publishOnlineGame(abandoned.game.id, { game: abandoned.game, moves });
  const expired = await expireOnlineGameOnClock(supabase, abandoned.game, moves);
  if (expired.timedOut) publishOnlineGame(expired.game.id, { game: expired.game, moves });

  await touchPresence(supabase, user, {
    status: expired.game.status === 'active' ? 'playing' : 'online',
    currentGameId: expired.game.status === 'active' ? expired.game.id : null
  });

  return Response.json({ ok: true, game: publicGame(await decorateGameRatings(supabase, expired.game), moves, participantUserId) });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
