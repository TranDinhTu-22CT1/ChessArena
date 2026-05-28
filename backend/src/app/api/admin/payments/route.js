import { requireAdminUser } from '../../../../lib/admin';
import { rateLimit } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-payments', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  const { searchParams } = new URL(request.url);
  const limit = Math.max(5, Math.min(100, Number(searchParams.get('limit')) || 30));
  const { data, error } = await context.supabase
    .from('user_memberships')
    .select('user_id, tier, status, billing_cycle, provider, provider_subscription_id, provider_plan_id, started_at, current_period_end, cancelled_at, updated_at, users:user_id(id, username, display_name, email, photo_url)')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, payments: data || [] });
}
