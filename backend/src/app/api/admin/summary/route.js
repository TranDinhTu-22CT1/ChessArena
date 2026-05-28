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
    { count: activeBans },
    { count: openReports },
    { count: onlineGames },
    { count: queueCount }
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('user_bans').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('anti_cheat_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('online_games').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('online_match_queue').select('id', { count: 'exact', head: true }).in('status', ['waiting', 'claimed'])
  ]);

  return Response.json({
    ok: true,
    summary: {
      users: users ?? 0,
      activeBans: activeBans ?? 0,
      openReports: openReports ?? 0,
      onlineGames: onlineGames ?? 0,
      queueCount: queueCount ?? 0
    }
  });
}
