export const TIER_RANK = { free: 0, plus: 1, pro: 2, master: 3 };

export function hasPaidAccess(row, now = Date.now()) {
  return Boolean(row && TIER_RANK[row.tier] && row.status === 'active'
    && Number.isFinite(Date.parse(row.current_period_end)) && Date.parse(row.current_period_end) > now);
}

export function publicMembership(row, now = Date.now()) {
  const active = hasPaidAccess(row, now);
  return {
    tier: active ? row.tier : 'free',
    status: active ? 'active' : row?.status === 'pending' ? 'pending' : 'inactive',
    billingCycle: row?.billing_cycle || 'monthly',
    provider: row?.provider || null,
    providerSubscriptionId: row?.provider_subscription_id || null,
    providerPlanId: row?.provider_plan_id || null,
    startedAt: row?.started_at || null,
    currentPeriodEnd: row?.current_period_end || null,
    cancelledAt: row?.cancelled_at || null,
    autoRenew: active && row?.provider === 'paypal' && !row?.cancel_at_period_end && !row?.cancelled_at,
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end || row?.cancelled_at)
  };
}

export function assertUpgrade(row, tier, now = Date.now()) {
  if (!TIER_RANK[tier]) throw new Error('Gói thành viên không hợp lệ.');
  if (hasPaidAccess(row, now) && TIER_RANK[tier] <= TIER_RANK[row.tier]) {
    const error = new Error(tier === row.tier ? 'Bạn đang sử dụng gói này đến hết kỳ đã thanh toán.' : 'Bạn đang có gói cao hơn; không thể đăng ký gói thấp hơn.');
    error.status = 409;
    throw error;
  }
}

export function configuredPlan(tier, cycle) {
  if (!TIER_RANK[tier] || !['monthly', 'yearly'].includes(cycle)) return '';
  return process.env[`PAYPAL_${tier.toUpperCase()}_${cycle.toUpperCase()}_PLAN_ID`] || '';
}

export function subscriptionIdentity(subscription) {
  const [userId, tier, cycle] = String(subscription?.custom_id || '').split(':');
  if (!/^[0-9a-f-]{36}$/i.test(userId || '') || !configuredPlan(tier, cycle)
    || configuredPlan(tier, cycle) !== subscription.plan_id) throw new Error('PayPal subscription ownership or plan is invalid.');
  return { userId, tier, cycle };
}

export function addBillingPeriod(iso, cycle) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + (cycle === 'yearly' ? 12 : 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString();
}

// Entitlement is based on a verified payment, never the browser callback time.
export function paidPeriodEnd(subscription, cycle) {
  const payment = subscription?.billing_info?.last_payment;
  if (!(Number(payment?.amount?.value) > 0) || !Number.isFinite(Date.parse(payment?.time))) return null;
  const next = subscription.billing_info.next_billing_time;
  const calculated = addBillingPeriod(payment.time, cycle);
  // A retry may pay late. Prefer the provider's scheduled period boundary when present.
  const calendarSlack = (cycle === 'yearly' ? 1 : 3) * 86_400_000;
  return Number.isFinite(Date.parse(next)) && Date.parse(next) > Date.parse(payment.time)
    && Date.parse(next) <= Date.parse(calculated) + calendarSlack ? next : calculated;
}

export function assertRecurringPlan(plan, cycle) {
  const regular = plan?.billing_cycles?.filter((entry) => entry.tenure_type === 'REGULAR') || [];
  if (plan?.status !== 'ACTIVE' || regular.length !== 1 || regular[0].total_cycles !== 0
    || regular[0].frequency?.interval_unit !== (cycle === 'yearly' ? 'YEAR' : 'MONTH')
    || regular[0].frequency?.interval_count !== 1
    || !(Number(regular[0].pricing_scheme?.fixed_price?.value) > 0)
    || Number(plan.payment_preferences?.setup_fee?.value || 0) > 0
    || plan.billing_cycles.some((entry) => entry.tenure_type === 'TRIAL')) {
    throw new Error('PayPal cần gói ACTIVE, tự gia hạn không giới hạn, đúng chu kỳ tháng/năm và không có kỳ dùng thử.');
  }
}

export function eventSubscriptionId(event) {
  return event?.resource?.billing_agreement_id || event?.resource?.subscription_id
    || (String(event?.event_type || '').startsWith('BILLING.SUBSCRIPTION.') ? event.resource?.id : null);
}
