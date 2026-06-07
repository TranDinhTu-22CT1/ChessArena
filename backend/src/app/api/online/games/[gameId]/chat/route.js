import { distributedRateLimit } from '../../../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../../../lib/online';

export const runtime = 'nodejs';

function publicChat(row, userId) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.users?.display_name || 'Player',
    photoURL: row.users?.photo_url || null,
    body: row.body,
    createdAt: row.created_at,
    you: row.user_id === userId
  };
}

async function canAccess(supabase, gameId, userId) {
  const { data: game } = await supabase
    .from('online_games')
    .select('id, white_user_id, black_user_id, spectator_allowed')
    .eq('id', gameId)
    .maybeSingle();
  if (!game) return { game: null, allowed: false };
  const participant = [game.white_user_id, game.black_user_id].includes(userId);
  return { game, participant, allowed: participant || game.spectator_allowed !== false };
}

export async function GET(request, { params }) {
  const blocked = await distributedRateLimit(request, { scope: 'online-game-chat-read', limit: 120, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const { gameId } = await params;
  const access = await canAccess(context.supabase, gameId, context.user.id);
  if (!access.game) return Response.json({ ok: false, error: 'Game not found.' }, { status: 404 });
  if (!access.allowed) return Response.json({ ok: false, error: 'Spectating is disabled.' }, { status: 403 });

  const { data = [], error } = await context.supabase
    .from('online_game_chat')
    .select('id, user_id, body, created_at, users:user_id(display_name, photo_url)')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, messages: data.map((row) => publicChat(row, context.user.id)) });
}

export async function POST(request, { params }) {
  const blocked = await distributedRateLimit(request, { scope: 'online-game-chat-write', limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const { gameId } = await params;
  const access = await canAccess(context.supabase, gameId, context.user.id);
  if (!access.game) return Response.json({ ok: false, error: 'Game not found.' }, { status: 404 });
  if (!access.allowed) return Response.json({ ok: false, error: 'Spectating is disabled.' }, { status: 403 });
  const payload = await request.json().catch(() => ({}));
  const body = String(payload.body || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!body) return Response.json({ ok: false, error: 'Message is required.' }, { status: 400 });

  const { data, error } = await context.supabase
    .from('online_game_chat')
    .insert({ game_id: gameId, user_id: context.user.id, body })
    .select('id, user_id, body, created_at, users:user_id(display_name, photo_url)')
    .single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, message: publicChat(data, context.user.id) });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
