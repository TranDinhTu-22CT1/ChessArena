import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { reconcileMemberships } from '../../../../lib/membershipService';

export const runtime = 'nodejs';
export const maxDuration = 300;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
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
  await supabase.from('api_rate_limits').delete().lt('reset_at', new Date(Date.now() - 86_400_000).toISOString());
  const memberships = await reconcileMemberships(supabase);
  await supabase.from('game_invitations').update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('status', 'pending').lt('expires_at', new Date().toISOString());
  return Response.json({
    ok: true,
    memberships,
    matchmakingCleanup: cleanupError ? { error: cleanupError.message } : matchmakingCleanup
  });
}
