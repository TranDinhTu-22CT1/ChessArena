import { requireAdminPermission, requireAdminUser } from '../../../../lib/admin';
import { rateLimit } from '../../../../lib/rateLimit';
import { safeArray } from '../../../../lib/validation';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-payments', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'billing:view');
  if (permissionError) return permissionError;

  const { searchParams } = new URL(request.url);
  const limit = Math.max(5, Math.min(100, Number(searchParams.get('limit')) || 10));
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, count = 0, error } = await context.supabase
    .from('user_memberships')
    .select('user_id, tier, status, billing_cycle, provider, provider_subscription_id, provider_plan_id, started_at, current_period_end, cancelled_at, updated_at, users:user_id(id, username, display_name, email, photo_url)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const userIds = (data || []).map((item) => item.user_id).filter(Boolean);
  const { data: transactions = [] } = userIds.length
    ? await context.supabase
      .from('payment_transactions')
      .select('*')
      .in('user_id', userIds)
      .order('occurred_at', { ascending: false })
    : { data: [] };
  const transactionRows = safeArray(transactions);
  return Response.json({
    ok: true,
    payments: (data || []).map((membership) => {
      const userTransactions = transactionRows.filter((item) => item.user_id === membership.user_id);
      return {
        ...membership,
        latestTransaction: userTransactions[0] || null,
        transactionCount: userTransactions.length
      };
    }),
    page,
    limit,
    total: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit))
  });
}
