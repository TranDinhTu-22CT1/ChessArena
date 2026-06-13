import { analyzeOnlineGameForUser } from '../../../../lib/antiCheat';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 300;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function sendMatchmakingAlert(payload) {
  const text = [
    'ChessArena matchmaking alert',
    `expired_tickets=${payload?.expired_tickets || 0}`,
    `broken_matched_tickets=${payload?.broken_matched_tickets || 0}`,
    `removed_locks=${payload?.removed_locks || 0}`,
    `active_games_without_tickets=${payload?.active_games_without_tickets || 0}`,
    `pending_outbox=${payload?.pending_outbox || 0}`
  ].join('\n');
  const urls = [
    process.env.MATCHMAKING_DISCORD_WEBHOOK_URL,
    process.env.MATCHMAKING_SLACK_WEBHOOK_URL
  ].filter(Boolean);
  await Promise.allSettled(urls.map((url) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(url.includes('discord') ? { content: text } : { text })
  })));
}

export async function GET(request) {
  if (!authorized(request)) return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ ok: false, error: 'Supabase is not configured.' }, { status: 503 });

  let { data: matchmakingCleanup, error: cleanupError } = await supabase.rpc('reconcile_matchmaking_v2');
  if (cleanupError?.code === 'PGRST202' || cleanupError?.code === 'PGRST203') {
    ({ data: matchmakingCleanup, error: cleanupError } = await supabase.rpc('cleanup_online_matchmaking'));
  }
  const criticalMatchmakingIssue = Number(matchmakingCleanup?.broken_matched_tickets || 0) > 0
    || Number(matchmakingCleanup?.active_games_without_tickets || 0) > 0
    || Number(matchmakingCleanup?.pending_outbox || 0) > 100;
  if (!cleanupError && criticalMatchmakingIssue) {
    await sendMatchmakingAlert(matchmakingCleanup);
  }
  const { data: games = [] } = await supabase
    .from('online_games')
    .select('*')
    .in('status', ['checkmate', 'draw', 'resigned'])
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(10);
  let scanned = 0;
  let reportsCreated = 0;
  for (const game of games) {
    const { data: moves = [] } = await supabase.from('online_game_moves').select('*').eq('game_id', game.id).order('ply');
    for (const userId of [game.white_user_id, game.black_user_id].filter(Boolean)) {
      const { data: existing } = await supabase.from('anti_cheat_reports').select('id').eq('game_id', game.id).eq('user_id', userId).maybeSingle();
      if (existing) continue;
      try {
        const analysis = await analyzeOnlineGameForUser(game, moves, userId, { movetime: 180, maxPositions: 36 });
        scanned += 1;
        if (analysis.riskScore < 55) continue;
        const { error: reportError } = await supabase.from('anti_cheat_reports').insert({
          user_id: userId,
          game_id: game.id,
          risk_score: analysis.riskScore,
          engine_match_rate: analysis.engineMatchRate,
          low_time_consistency: analysis.lowTimeConsistency,
          suspicious_move_count: analysis.suspiciousMoveCount,
          total_moves: analysis.totalMoves,
          details: { ...analysis.details, source: 'scheduled_scan' }
        });
        if (reportError) throw reportError;
        reportsCreated += 1;
      } catch (error) {
        console.error('Scheduled anti-cheat scan failed.', { gameId: game.id, userId, message: error.message });
      }
    }
  }

  await supabase.from('api_rate_limits').delete().lt('reset_at', new Date(Date.now() - 86_400_000).toISOString());
  return Response.json({
    ok: true,
    matchmakingCleanup: cleanupError ? { error: cleanupError.message } : matchmakingCleanup,
    antiCheatScans: scanned,
    antiCheatReports: reportsCreated
  });
}
