import { rateLimit } from '../../../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../../../lib/online';
import { onlineActionError, onlineActionGame } from '../../../../../../lib/onlineActionResponse';
import { publishOnlineGame } from '../../../../../../lib/onlineEvents';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  const blocked = rateLimit(request, { scope: 'online-game-resign', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const { gameId } = await params;
  const { supabase, user } = context;
  const { data, error } = await supabase.rpc('resign_online_game', {
    p_user: user.id, p_game: gameId
  });
  if (error) return onlineActionError(error);
  try {
    const game = await onlineActionGame(supabase, user, data);
    publishOnlineGame(gameId, { type: 'game-changed' });
    return Response.json({ ok: true, game });
  } catch (error) { return onlineActionError(error); }
}

export function OPTIONS() { return new Response(null, { status: 204 }); }
