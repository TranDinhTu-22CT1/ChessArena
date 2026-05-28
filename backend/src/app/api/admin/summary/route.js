import { rateLimit } from '../../../../lib/rateLimit';
import { requireAdminUser } from '../../../../lib/admin';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-summary', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const { supabase } = context;

  const [
    { count: users },
    { count: onlineUsers },
    { count: activeBans },
    { count: openReports },
    { count: suspectedUsers },
    { count: onlineGames },
    { count: queueCount },
    { count: todayGames },
    { count: activeSubscriptions },
    { count: pendingSubscriptions }
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('online_presence').select('user_id', { count: 'exact', head: true }).gte('last_seen', new Date(Date.now() - 45_000).toISOString()),
    supabase.from('user_bans').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('anti_cheat_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('anti_cheat_reports').select('user_id', { count: 'exact', head: true }).gte('risk_score', 70),
    supabase.from('online_games').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('online_match_queue').select('id', { count: 'exact', head: true }).in('status', ['waiting', 'claimed']),
    supabase.from('online_games').select('id', { count: 'exact', head: true }).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase.from('user_memberships').select('user_id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('user_memberships').select('user_id', { count: 'exact', head: true }).eq('status', 'pending')
  ]);

  return Response.json({
    ok: true,
    summary: {
      users: users ?? 0,
      onlineUsers: onlineUsers ?? 0,
      activeBans: activeBans ?? 0,
      openReports: openReports ?? 0,
      suspectedUsers: suspectedUsers ?? 0,
      onlineGames: onlineGames ?? 0,
      queueCount: queueCount ?? 0,
      todayGames: todayGames ?? 0,
      activeSubscriptions: activeSubscriptions ?? 0,
      pendingSubscriptions: pendingSubscriptions ?? 0,
      failedPayments: 0,
      webhookConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID),
      firebaseStatus: process.env.FIREBASE_PROJECT_ID ? 'configured' : 'missing',
      supabaseStatus: process.env.SUPABASE_URL ? 'configured' : 'missing',
      serverHealth: 'ok'
    }
  });
}
