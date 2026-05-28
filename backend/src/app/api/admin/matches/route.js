import { requireAdminUser } from '../../../../lib/admin';
import { rateLimit } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-matches', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  const { searchParams } = new URL(request.url);
  const limit = Math.max(5, Math.min(80, Number(searchParams.get('limit')) || 30));
  const status = String(searchParams.get('status') || '').trim();

  let query = context.supabase
    .from('online_games')
    .select('id, white_user_id, black_user_id, white_name, black_name, result, status, mode, rated, time_control, white_rating_before, black_rating_before, white_rating_after, black_rating_after, created_at, started_at, finished_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (status) query = query.eq('status', status);

  const { data: games = [], error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const ids = games.map((game) => game.id);
  const { data: moves = [] } = ids.length
    ? await context.supabase
      .from('online_game_moves')
      .select('game_id, ply, san, created_at')
      .in('game_id', ids)
      .order('ply', { ascending: true })
    : { data: [] };

  return Response.json({
    ok: true,
    matches: games.map((game) => ({
      ...game,
      moveCount: (moves || []).filter((move) => move.game_id === game.id).length,
      lastMoves: (moves || []).filter((move) => move.game_id === game.id).slice(-8)
    }))
  });
}
