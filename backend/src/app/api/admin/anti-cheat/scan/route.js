import { rateLimit } from '../../../../../lib/rateLimit';
import { analyzeOnlineGameForUser } from '../../../../../lib/antiCheat';
import { requireAdminUser, writeAdminAudit } from '../../../../../lib/admin';

export const runtime = 'nodejs';

async function loadRecentCompletedGames(supabase, userId, limit) {
  const { data: games = [], error } = await supabase
    .from('online_games')
    .select('*')
    .or(`white_user_id.eq.${userId},black_user_id.eq.${userId}`)
    .neq('result', '*')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return games;
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'admin-anti-cheat-scan', limit: 8, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  const payload = await request.json().catch(() => null);
  const userId = String(payload?.userId || '').trim();
  const limit = Math.max(1, Math.min(10, Number(payload?.limit) || 6));
  if (!userId) return Response.json({ ok: false, error: 'Missing user id.' }, { status: 400 });

  try {
    const games = await loadRecentCompletedGames(context.supabase, userId, limit);
    const reports = [];

    for (const game of games) {
      const { data: moves = [], error: movesError } = await context.supabase
        .from('online_game_moves')
        .select('*')
        .eq('game_id', game.id)
        .order('ply', { ascending: true });
      if (movesError) throw movesError;

      const analysis = await analyzeOnlineGameForUser(game, moves, userId);
      const { data: report, error } = await context.supabase
        .from('anti_cheat_reports')
        .insert({
          user_id: userId,
          game_id: game.id,
          risk_score: analysis.riskScore,
          engine_match_rate: analysis.engineMatchRate,
          low_time_consistency: analysis.lowTimeConsistency,
          suspicious_move_count: analysis.suspiciousMoveCount,
          total_moves: analysis.totalMoves,
          details: analysis.details
        })
        .select('*')
        .single();
      if (error) throw error;
      reports.push(report);
    }

    await writeAdminAudit(context.supabase, context.admin, 'anti_cheat.scan', {
      targetUserId: userId,
      gamesScanned: reports.length
    });

    return Response.json({ ok: true, reports });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Anti-cheat scan failed.' }, { status: 500 });
  }
}
