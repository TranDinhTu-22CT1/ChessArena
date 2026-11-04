import { cancelPayPalSubscription, fetchPayPalSubscription } from './paypal.js';
import { paidPeriodEnd, publicMembership, subscriptionIdentity } from './membershipPolicy.js';

export async function membershipRow(supabase, userId) {
  const { data, error } = await supabase.from('user_memberships').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function syncSubscription(supabase, subscription, expectedUserId) {
  const { userId, tier, cycle } = subscriptionIdentity(subscription);
  if (expectedUserId && userId !== expectedUserId) {
    const error = new Error('Giao dịch PayPal thuộc tài khoản khác.'); error.status = 403; throw error;
  }
  const { data, error } = await supabase.rpc('apply_paypal_subscription', {
    p_user: userId, p_subscription: subscription.id, p_tier: tier, p_cycle: cycle,
    p_plan: subscription.plan_id, p_status: subscription.status,
    p_paid_through: paidPeriodEnd(subscription, cycle),
    p_last_payment: subscription.billing_info?.last_payment?.time || null,
    p_started_at: subscription.start_time || subscription.create_time || null,
    p_provider_updated: subscription.status_update_time || subscription.update_time || subscription.create_time || new Date().toISOString()
  });
  if (error) throw error;
  return data;
}

// Durable intent allows maintenance to retry an interrupted provider request.
export async function cancelSubscription(supabase, subscriptionId, userId) {
  const latest = await fetchPayPalSubscription(subscriptionId);
  if (!latest) throw new Error('Không thể xác minh đăng ký PayPal.');
  await syncSubscription(supabase, latest, userId);
  const marked = await supabase.from('membership_subscriptions').update({ cancel_requested: true })
    .eq('subscription_id', subscriptionId).eq('user_id', userId);
  if (marked.error) throw marked.error;
  await cancelPayPalSubscription(subscriptionId);
  await syncSubscription(supabase, { ...latest, status: 'CANCELLED', status_update_time: new Date().toISOString() }, userId);
}

export async function processSubscriptionCancellations(supabase, userId = null) {
  let query = supabase.from('membership_subscriptions').select('subscription_id,user_id')
    .eq('cancel_requested', true).is('cancelled_at', null).limit(25);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  const results = await Promise.allSettled((data || []).map((row) => cancelSubscription(supabase, row.subscription_id, row.user_id)));
  return { processed: results.filter((r) => r.status === 'fulfilled').length, pending: results.filter((r) => r.status === 'rejected').length };
}

export async function refreshMembership(supabase, userId) {
  let row = await membershipRow(supabase, userId);
  const pending = await supabase.from('membership_checkouts').select('subscription_id').eq('user_id', userId).maybeSingle();
  if (pending.error) throw pending.error;
  if (pending.data?.subscription_id) {
    try {
      const subscription = await fetchPayPalSubscription(pending.data.subscription_id);
      if (subscription) row = await syncSubscription(supabase, subscription, userId);
    } catch (error) { console.warn('[membership] checkout reconciliation pending:', error.message); }
  }
  if (row?.provider === 'paypal' && row.provider_subscription_id && Date.now() - Date.parse(row.synced_at || '1970-01-01') > 60_000) {
    try {
      const subscription = await fetchPayPalSubscription(row.provider_subscription_id);
      if (subscription) row = await syncSubscription(supabase, subscription, userId);
    } catch (error) { console.warn('[membership] reconciliation pending:', error.message); }
  }
  return publicMembership(row);
}

export async function reconcileMemberships(supabase) {
  const { data, error } = await supabase.from('membership_subscriptions').select('subscription_id,user_id')
    .in('provider_status', ['ACTIVE', 'SUSPENDED', 'APPROVED', 'APPROVAL_PENDING'])
    .order('synced_at', { ascending: true }).limit(30);
  if (error) throw error;
  const results = await Promise.allSettled((data || []).map(async (row) => {
    const subscription = await fetchPayPalSubscription(row.subscription_id);
    if (subscription) await syncSubscription(supabase, subscription, row.user_id);
  }));
  const cancellations = await processSubscriptionCancellations(supabase);
  const expired = await supabase.from('user_memberships').update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('status', 'active').lt('current_period_end', new Date().toISOString());
  if (expired.error) throw expired.error;
  return { reconciled: results.filter((r) => r.status === 'fulfilled').length, ...cancellations };
}
