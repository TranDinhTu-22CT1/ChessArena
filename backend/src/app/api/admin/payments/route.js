import { requireAdminPermission, requireAdminUser } from '../../../../lib/admin';
import { rateLimit } from '../../../../lib/rateLimit';
import { safeArray } from '../../../../lib/validation';

export const runtime = 'nodejs';

function cleanDate(value, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
  return `${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`;
}

function cleanSearch(value) {
  return String(value || '').trim().replace(/[,%()]/g, '').slice(0, 120);
}

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
  const search = cleanSearch(searchParams.get('search'));
  const status = String(searchParams.get('status') || '').trim();
  const provider = String(searchParams.get('provider') || '').trim();
  const tier = String(searchParams.get('tier') || '').trim();
  const dateFrom = cleanDate(searchParams.get('dateFrom'));
  const dateTo = cleanDate(searchParams.get('dateTo'), true);

  let searchUserIds = [];
  if (search) {
    const [{ data: users = [] }, { data: transactions = [] }] = await Promise.all([
      context.supabase.from('users').select('id').or(`username.ilike.%${search}%,display_name.ilike.%${search}%,email.ilike.%${search}%`).limit(30),
      context.supabase.from('payment_transactions').select('user_id').or(`provider_transaction_id.ilike.%${search}%,provider_event_id.ilike.%${search}%`).limit(30)
    ]);
    searchUserIds = [...new Set([...safeArray(users).map((user) => user.id), ...safeArray(transactions).map((transaction) => transaction.user_id).filter(Boolean)])];
  }

  let query = context.supabase
    .from('user_memberships')
    .select('user_id, tier, status, billing_cycle, provider, provider_subscription_id, provider_plan_id, started_at, current_period_end, cancelled_at, cancel_at_period_end, updated_at, users:user_id(id, username, display_name, email, photo_url)', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, to);
  if (status) query = query.eq('status', status);
  if (provider) query = query.eq('provider', provider);
  if (tier) query = query.eq('tier', tier);
  if (dateFrom) query = query.gte('updated_at', dateFrom);
  if (dateTo) query = query.lte('updated_at', dateTo);
  if (search) {
    const clauses = [`provider_subscription_id.ilike.%${search}%`, `provider_plan_id.ilike.%${search}%`];
    if (searchUserIds.length) clauses.push(`user_id.in.(${searchUserIds.join(',')})`);
    query = query.or(clauses.join(','));
  }
  const { data, count = 0, error } = await query;

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
