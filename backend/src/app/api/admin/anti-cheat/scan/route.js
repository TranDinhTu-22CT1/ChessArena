import { rateLimit } from '../../../../../lib/rateLimit';
import { analyzeOnlineGameForUser } from '../../../../../lib/antiCheat';
import { requireAdminCsrf, requireAdminPermission, requireAdminUser, writeAdminAudit } from '../../../../../lib/admin';
import { safeArray } from '../../../../../lib/validation';

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
  return safeArray(games);
}

function scanSummary(reports) {
  const scores = reports.map((report) => Number(report.risk_score || 0));
  const maxRisk = Math.max(0, ...scores);
  const averageRisk = scores.length
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : 0;
  const highRiskGames = reports.filter((report) => Number(report.risk_score || 0) >= 70).length;
  const mediumRiskGames = reports.filter((report) => Number(report.risk_score || 0) >= 55 && Number(report.risk_score || 0) < 70).length;
  return {
    gamesScanned: reports.length,
    maxRisk,
    averageRisk,
    highRiskGames,
    mediumRiskGames,
    recommendation: maxRisk >= 85 || highRiskGames >= 2
      ? 'manual_review_required'
      : maxRisk >= 70 || mediumRiskGames >= 2
        ? 'watchlist'
        : 'no_action'
  };
}

async function updateTrustScore(supabase, userId, summary) {
  const trustScore = Math.max(0, Math.min(100, 100 - Math.max(summary.maxRisk, summary.averageRisk + summary.highRiskGames * 8)));
  const pool = summary.recommendation === 'manual_review_required'
    ? 'restricted'
    : summary.recommendation === 'watchlist'
      ? 'low_trust'
      : trustScore < 80 ? 'provisional' : 'standard';
  await supabase
    .from('user_trust_scores')
    .upsert({
      user_id: userId,
      trust_score: trustScore,
      pool,
      cheat_suspicion_score: Math.min(1, summary.maxRisk / 100),
      suspicious_pattern_score: Math.min(1, summary.averageRisk / 100),
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'admin-anti-cheat-scan', limit: 8, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'fairplay:manage');
  if (permissionError) return permissionError;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;

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

      const analysis = await analyzeOnlineGameForUser(game, safeArray(moves), userId, { movetime: 220, maxPositions: 40 });
      const reportPayload = {
        user_id: userId,
        game_id: game.id,
        risk_score: analysis.riskScore,
        engine_match_rate: analysis.engineMatchRate,
        low_time_consistency: analysis.lowTimeConsistency,
        suspicious_move_count: analysis.suspiciousMoveCount,
        total_moves: analysis.totalMoves,
        details: analysis.details
      };
      const { data: existing } = await context.supabase
        .from('anti_cheat_reports')
        .select('id')
        .eq('user_id', userId)
        .eq('game_id', game.id)
        .maybeSingle();
      const query = existing
        ? context.supabase
          .from('anti_cheat_reports')
          .update({ ...reportPayload, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        : context.supabase
          .from('anti_cheat_reports')
          .insert(reportPayload);
      const { data: report, error } = await query
        .select('*')
        .single();
      if (error) throw error;
      reports.push(report);
    }

    const summary = scanSummary(reports);
    await updateTrustScore(context.supabase, userId, summary);

    await writeAdminAudit(context.supabase, context.admin, 'anti_cheat.scan', {
      targetUserId: userId,
      gamesScanned: reports.length,
      riskScore: summary.maxRisk,
      recommendation: summary.recommendation
    });

    return Response.json({ ok: true, reports, summary });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Anti-cheat scan failed.' }, { status: 500 });
  }
}
