import { distributedRateLimit } from '../../../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../../../lib/online';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  const blocked = await distributedRateLimit(request, { scope: 'online-game-spectate', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const { gameId } = await params;
  const { data: game } = await context.supabase
    .from('online_games')
    .select('id, spectator_allowed')
    .eq('id', gameId)
    .maybeSingle();
  if (!game) return Response.json({ ok: false, error: 'Game not found.' }, { status: 404 });
  if (game.spectator_allowed === false) return Response.json({ ok: false, error: 'Spectating is disabled.' }, { status: 403 });
  const now = new Date().toISOString();
  const { error } = await context.supabase
    .from('online_game_spectators')
    .upsert({ game_id: gameId, user_id: context.user.id, last_seen: now }, { onConflict: 'game_id,user_id' });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const { count = 0 } = await context.supabase
    .from('online_game_spectators')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId)
    .gte('last_seen', new Date(Date.now() - 60_000).toISOString());
  return Response.json({ ok: true, spectators: count || 0 });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
