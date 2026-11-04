import { hasPaidAccess, publicMembership } from './membershipPolicy.js';

export const REVIEW_DAILY_LIMITS = Object.freeze({
  free: 1,
  plus: 10,
  pro: null,
  master: null
});

export function adminMembership() {
  return {
    tier: 'master',
    status: 'active',
    billingCycle: 'admin',
    provider: 'admin',
    providerSubscriptionId: null,
    providerPlanId: null,
    startedAt: null,
    currentPeriodEnd: '9999-12-31T23:59:59.999Z',
    cancelledAt: null,
    autoRenew: false,
    cancelAtPeriodEnd: false,
    isAdmin: true,
    unlimited: true
  };
}

export async function userEntitlements(supabase, user, now = Date.now()) {
  if (user?.isAdmin) {
    return {
      membership: adminMembership(),
      tier: 'master',
      isAdmin: true,
      hasPremiumAccess: true,
      canUseReview: true,
      hasUnlimitedReview: true,
      reviewDailyLimit: null
    };
  }

  const { data, error } = await supabase
    .from('user_memberships')
    .select('tier,status,billing_cycle,provider,provider_subscription_id,provider_plan_id,started_at,current_period_end,cancelled_at,cancel_at_period_end')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;

  const active = hasPaidAccess(data, now);
  const tier = active ? data.tier : 'free';
  const reviewDailyLimit = REVIEW_DAILY_LIMITS[tier] ?? null;
  return {
    membership: publicMembership(data, now),
    tier,
    isAdmin: false,
    hasPremiumAccess: active,
    canUseReview: reviewDailyLimit === null || reviewDailyLimit > 0,
    hasUnlimitedReview: reviewDailyLimit === null,
    reviewDailyLimit
  };
}

