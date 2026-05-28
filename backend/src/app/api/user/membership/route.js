import { rateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../lib/online';

export const runtime = 'nodejs';

const TIERS = new Set(['free', 'plus', 'pro', 'master']);
const CYCLES = new Set(['monthly', 'yearly']);
const PAYPAL_PLAN_IDS = {
  plus: {
    monthly: process.env.PAYPAL_PLUS_MONTHLY_PLAN_ID,
    yearly: process.env.PAYPAL_PLUS_YEARLY_PLAN_ID
  },
  pro: {
    monthly: process.env.PAYPAL_PRO_MONTHLY_PLAN_ID,
    yearly: process.env.PAYPAL_PRO_YEARLY_PLAN_ID
  },
  master: {
    monthly: process.env.PAYPAL_MASTER_MONTHLY_PLAN_ID,
    yearly: process.env.PAYPAL_MASTER_YEARLY_PLAN_ID
  }
};

const FREE_MEMBERSHIP = {
  tier: 'free',
  status: 'inactive',
  billingCycle: 'monthly',
  provider: null,
  providerSubscriptionId: null,
  providerPlanId: null,
  startedAt: null,
  currentPeriodEnd: null,
  cancelledAt: null
};

function normalizeTier(value) {
  return TIERS.has(value) ? value : 'free';
}

function normalizeCycle(value) {
  return CYCLES.has(value) ? value : 'monthly';
}

function publicMembership(row) {
  if (!row) return FREE_MEMBERSHIP;
  const status = row.status || 'inactive';
  const tier = status === 'active' ? normalizeTier(row.tier) : 'free';
  return {
    tier,
    status,
    billingCycle: normalizeCycle(row.billing_cycle),
    provider: row.provider || null,
    providerSubscriptionId: row.provider_subscription_id || null,
    providerPlanId: row.provider_plan_id || null,
    startedAt: row.started_at || null,
    currentPeriodEnd: row.current_period_end || null,
    cancelledAt: row.cancelled_at || null
  };
}

function expectedPayPalPlanId(tier, billingCycle) {
  return PAYPAL_PLAN_IDS[tier]?.[billingCycle] || '';
}

async function membershipPayload(supabase, userId) {
  const { data } = await supabase
    .from('user_memberships')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return publicMembership(data);
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'membership-read', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  return Response.json({
    ok: true,
    membership: await membershipPayload(context.supabase, context.user.id)
  });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'membership-write', limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await request.json().catch(() => null);
  const tier = normalizeTier(payload?.tier);
  const billingCycle = normalizeCycle(payload?.billingCycle);
  const providerSubscriptionId = String(payload?.subscriptionId || '').trim().slice(0, 160);
  const providerPlanId = String(payload?.planId || '').trim().slice(0, 160);

  if (tier === 'free' || !providerSubscriptionId || !providerPlanId) {
    return Response.json({ ok: false, error: 'Missing PayPal subscription data.' }, { status: 400 });
  }

  const expectedPlanId = expectedPayPalPlanId(tier, billingCycle);
  if (expectedPlanId && providerPlanId !== expectedPlanId) {
    return Response.json({ ok: false, error: 'PayPal plan does not match the selected membership.' }, { status: 400 });
  }

  const now = new Date();
  const currentPeriodEnd = new Date(now);
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

  const { error } = await context.supabase
    .from('user_memberships')
    .upsert({
      user_id: context.user.id,
      tier,
      status: 'active',
      billing_cycle: billingCycle,
      provider: 'paypal',
      provider_subscription_id: providerSubscriptionId,
      provider_plan_id: providerPlanId,
      started_at: now.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      cancelled_at: null,
      updated_at: now.toISOString()
    }, { onConflict: 'user_id' });

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  return Response.json({
    ok: true,
    membership: await membershipPayload(context.supabase, context.user.id)
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
