import { syncAchievements } from '../../../lib/achievements';
import { requireOnlineUser } from '../../../lib/online';
import { rateLimit } from '../../../lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'achievements-read', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const achievements = await syncAchievements(context.supabase, context.user.id);
  return Response.json({ ok: true, achievements });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
