import { rateLimit } from '../../../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../../../lib/online';
import { readJsonPayload } from '../../../../../../lib/validation';
import { onlineActionError, onlineActionGame } from '../../../../../../lib/onlineActionResponse';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  const blocked = rateLimit(request, { scope: 'online-game-rematch', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const payload = await readJsonPayload(request);
  if (!["request","accept","decline"].includes(payload?.action)) {
    return Response.json({ ok: false, error: 'Invalid rematch action.' }, { status: 400 });
  }
  const { gameId } = await params;
  const { supabase, user } = context;
  const { data, error } = await supabase.rpc('respond_online_rematch', {
    p_user: user.id, p_game: gameId, p_action: payload.action
  });
  if (error) return onlineActionError(error);
  try {
    const previous = await onlineActionGame(supabase, user, data.previous_game);
    if (data.expired) return Response.json({ ok: false, error: 'Rematch request expired.', game: previous }, { status: 410 });
    const game = data.game ? await onlineActionGame(supabase, user, data.game) : previous;
    return Response.json({ ok: true, game });
  } catch (error) { return onlineActionError(error); }
}

export function OPTIONS() { return new Response(null, { status: 204 }); }
