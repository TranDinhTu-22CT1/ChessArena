import { rateLimit } from '../../../../lib/rateLimit';
import { requireAdminPermission, requireAdminUser } from '../../../../lib/admin';

export const runtime = 'nodejs';

function positiveInteger(value) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function configuredSecret(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Boolean(normalized && !normalized.startsWith('your-') && !normalized.includes('replace-with'));
}

function openRouterModels() {
  return String(
    process.env.OPENROUTER_CHAT_MODELS
      || process.env.OPENROUTER_CHAT_MODEL
      || 'google/gemma-4-26b-a4b-it:free,google/gemma-4-31b-it:free'
  )
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
}

function chatModelLimits() {
  const gatewayLimit = positiveInteger(process.env.AI_COACH_RATE_LIMIT_PER_MINUTE) || 20;
  const configuredModels = [
    {
      provider: 'Gemini',
      model: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
      configured: configuredSecret(process.env.GEMINI_API_KEY),
      requestsPerMinute: positiveInteger(process.env.GEMINI_CHAT_RPM),
      requestsPerDay: positiveInteger(process.env.GEMINI_CHAT_RPD)
    },
    {
      provider: 'Groq',
      model: process.env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile',
      configured: configuredSecret(process.env.GROQ_API_KEY),
      requestsPerMinute: positiveInteger(process.env.GROQ_CHAT_RPM),
      requestsPerDay: positiveInteger(process.env.GROQ_CHAT_RPD)
    },
    ...openRouterModels().map((model) => ({
      provider: 'OpenRouter',
      model,
      configured: configuredSecret(process.env.OPENROUTER_API_KEY),
      requestsPerMinute: positiveInteger(process.env.OPENROUTER_CHAT_RPM),
      requestsPerDay: positiveInteger(process.env.OPENROUTER_CHAT_RPD)
    }))
  ];
  const models = configuredModels.map((item) => ({
    ...item,
    applicationRequestsPerMinute: gatewayLimit,
    effectiveRequestsPerMinute: item.requestsPerMinute
      ? Math.min(gatewayLimit, item.requestsPerMinute)
      : gatewayLimit
  }));

  return {
    gatewayLimit,
    models,
    providerMode: process.env.AI_COACH_PROVIDER || 'multi',
    providerOrder: String(process.env.AI_COACH_PROVIDER_ORDER || 'openrouter,gemini,groq,local')
      .split(',')
      .map((provider) => provider.trim())
      .filter(Boolean)
  };
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-summary', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'dashboard:view');
  if (permissionError) return permissionError;
  const { supabase } = context;

  const [
    { count: users },
    { count: onlineUsers },
    { count: activeBans },
    { count: openAntiCheatReports },
    { count: openPlayerReports },
    { count: suspectedUsers },
    { count: onlineGames },
    { count: staleActiveGames },
    { count: queueCount },
    { count: todayGames },
    { count: openTournaments },
    { count: scheduledTournaments },
    { count: activeSubscriptions },
    { count: pendingSubscriptions },
    { count: openSupportRequests }
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('online_presence').select('user_id', { count: 'exact', head: true }).gte('last_seen', new Date(Date.now() - 45_000).toISOString()),
    supabase.from('user_bans').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('anti_cheat_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('player_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('anti_cheat_reports').select('user_id', { count: 'exact', head: true }).gte('risk_score', 70),
    supabase.from('online_games').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('online_games').select('id', { count: 'exact', head: true }).eq('status', 'active').lt('updated_at', new Date(Date.now() - 15 * 60_000).toISOString()),
    supabase.from('online_match_queue').select('id', { count: 'exact', head: true }).in('status', ['waiting', 'claimed']),
    supabase.from('online_games').select('id', { count: 'exact', head: true }).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase.from('arena_tournaments').select('id', { count: 'exact', head: true }).in('status', ['open', 'running']),
    supabase.from('arena_tournaments').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
    supabase.from('user_memberships').select('user_id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('user_memberships').select('user_id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('support_requests').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_review', 'waiting_user'])
  ]);

  const chatLimits = chatModelLimits();
  const { data: activeRateLimitBuckets, error: rateLimitError } = await supabase
    .from('api_rate_limits')
    .select('count, reset_at')
    .like('key', 'ai-coach-chat:%')
    .gt('reset_at', new Date().toISOString());
  const rateLimitBuckets = rateLimitError ? [] : (activeRateLimitBuckets || []);
  const distributedTrackingEnabled = process.env.RATE_LIMIT_BACKEND === 'supabase' && !rateLimitError;
  const requestCount = rateLimitBuckets.reduce((total, bucket) => total + (Number(bucket.count) || 0), 0);
  const peakClientUsage = rateLimitBuckets.reduce(
    (highest, bucket) => Math.max(highest, Number(bucket.count) || 0),
    0
  );
  const [
    { data: matchmakingMetricRows = [], error: matchmakingMetricsError },
    { data: matchmakingIssues = [], error: matchmakingIssuesError },
    { count: pendingMatchEvents }
  ] = await Promise.all([
    supabase
      .from('matchmaking_metrics_5m')
      .select('*')
      .order('bucket', { ascending: false })
      .limit(24),
    supabase
      .from('matchmaking_integrity_issues')
      .select('issue_type, entity_id, user_id, game_id')
      .limit(100),
    supabase
      .from('matchmaking_outbox')
      .select('id', { count: 'exact', head: true })
      .is('delivered_at', null)
  ]);
  const metrics = matchmakingMetricsError ? [] : matchmakingMetricRows;
  const issues = matchmakingIssuesError ? [] : matchmakingIssues;
  const matchedPlayers = metrics.reduce((total, row) => total + Number(row.matched_players || 0), 0);
  const waitingEvents = metrics.reduce((total, row) => total + Number(row.waiting_events || 0), 0);
  const weightedWait = metrics.reduce(
    (total, row) => total + Number(row.p50_wait_ms || 0) * Number(row.matched_players || 0),
    0
  );
  const latestMatchmaking = metrics[0] || {};

  return Response.json({
    ok: true,
    summary: {
      users: users ?? 0,
      onlineUsers: onlineUsers ?? 0,
      activeBans: activeBans ?? 0,
      openReports: (openAntiCheatReports ?? 0) + (openPlayerReports ?? 0),
      openAntiCheatReports: openAntiCheatReports ?? 0,
      openPlayerReports: openPlayerReports ?? 0,
      openSupportRequests: openSupportRequests ?? 0,
      suspectedUsers: suspectedUsers ?? 0,
      onlineGames: onlineGames ?? 0,
      staleActiveGames: staleActiveGames ?? 0,
      queueCount: queueCount ?? 0,
      todayGames: todayGames ?? 0,
      openTournaments: openTournaments ?? 0,
      scheduledTournaments: scheduledTournaments ?? 0,
      activeSubscriptions: activeSubscriptions ?? 0,
      pendingSubscriptions: pendingSubscriptions ?? 0,
      failedPayments: 0,
      webhookConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID),
      firebaseStatus: process.env.FIREBASE_PROJECT_ID ? 'configured' : 'missing',
      supabaseStatus: process.env.SUPABASE_URL ? 'configured' : 'missing',
      serverHealth: 'ok',
      chatRateLimits: {
        gateway: {
          requestsPerMinute: chatLimits.gatewayLimit,
          activeClients: rateLimitBuckets.length,
          requestsInWindow: requestCount,
          peakClientUsage,
          trackingAvailable: distributedTrackingEnabled
        },
        models: chatLimits.models,
        providerMode: chatLimits.providerMode,
        providerOrder: chatLimits.providerOrder
      },
      matchmakingHealth: {
        available: !matchmakingMetricsError && !matchmakingIssuesError,
        integrityIssues: issues.length,
        issuesByType: issues.reduce((result, issue) => {
          result[issue.issue_type] = (result[issue.issue_type] || 0) + 1;
          return result;
        }, {}),
        pendingOutboxEvents: pendingMatchEvents ?? 0,
        matchedPlayers,
        waitingEvents,
        successRate: waitingEvents + matchedPlayers > 0
          ? Number(((matchedPlayers / (waitingEvents + matchedPlayers)) * 100).toFixed(2))
          : 100,
        averageBucketP50Ms: matchedPlayers > 0 ? Math.round(weightedWait / matchedPlayers) : 0,
        latestP50Ms: Math.round(Number(latestMatchmaking.p50_wait_ms || 0)),
        latestP95Ms: Math.round(Number(latestMatchmaking.p95_wait_ms || 0)),
        latestP99Ms: Math.round(Number(latestMatchmaking.p99_wait_ms || 0)),
        latestAverageRatingGap: Math.round(Number(latestMatchmaking.average_rating_gap || 0)),
        buckets: metrics
      }
    }
  });
}
