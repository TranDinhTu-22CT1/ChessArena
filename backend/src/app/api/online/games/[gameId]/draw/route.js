import { distributedRateLimit } from '../../../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../../../lib/online';
import { readJsonPayload } from '../../../../../../lib/validation';
import { onlineActionError, onlineActionGame } from '../../../../../../lib/onlineActionResponse';
import { publishOnlineGame } from '../../../../../../lib/onlineEvents';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  const blocked = await distributedRateLimit(request, { scope: 'online-game-draw', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const payload = await readJsonPayload(request);
  if (!["offer","accept","decline","cancel"].includes(payload?.action)) {
    return Response.json({ ok: false, error: 'Invalid draw action.' }, { status: 400 });
  }
  const { gameId } = await params;
  const { supabase, user } = context;
  const { data, error } = await supabase.rpc('respond_online_draw', {
    p_user: user.id, p_game: gameId, p_action: payload.action
  });
  if (error) return onlineActionError(error);
  try {
    const game = await onlineActionGame(supabase, user, data);
    publishOnlineGame(gameId, { type: 'game-changed' });
    return Response.json({ ok: true, game });
  } catch (error) { return onlineActionError(error); }
}

export function OPTIONS() { return new Response(null, { status: 204 }); }
