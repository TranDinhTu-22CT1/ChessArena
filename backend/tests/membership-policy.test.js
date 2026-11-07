import assert from 'node:assert/strict';
import test from 'node:test';
import { addBillingPeriod, assertRecurringPlan, assertUpgrade, eventSubscriptionId, paidPeriodEnd, publicMembership, subscriptionIdentity } from '../src/lib/membershipPolicy.js';
import { adminMembership, REVIEW_DAILY_LIMITS, userEntitlements } from '../src/lib/entitlements.js';

test('admin entitlements are unlimited without creating a fake payment subscription', async () => {
  const membership = adminMembership();
  const entitlements = await userEntitlements(null, { id: 'admin-id', isAdmin: true });
  assert.equal(membership.tier, 'master');
  assert.equal(membership.provider, 'admin');
  assert.equal(membership.providerSubscriptionId, null);
  assert.equal(entitlements.isAdmin, true);
  assert.equal(entitlements.hasPremiumAccess, true);
  assert.equal(entitlements.hasUnlimitedReview, true);
  assert.equal(entitlements.reviewDailyLimit, null);
  assert.equal(REVIEW_DAILY_LIMITS.free, 1);
  assert.equal(REVIEW_DAILY_LIMITS.plus, 10);
});

test('cancellation preserves access until the paid boundary, including the final second', () => {
  const end = '2026-10-12T12:00:00Z';
  const row = { tier: 'pro', status: 'active', current_period_end: end, provider: 'paypal', cancel_at_period_end: true, cancelled_at: '2026-09-20T12:00:00Z' };
  assert.equal(publicMembership(row,Date.parse(end)-1).tier,'pro');
  assert.equal(publicMembership(row,Date.parse(end)-1).autoRenew,false);
  assert.equal(publicMembership(row,Date.parse(end)).tier,'free');
});

test('same and lower tiers are blocked while the paid entitlement remains active', () => {
  const now=Date.parse('2026-09-12');
  const row={tier:'pro',status:'active',current_period_end:'2026-10-12',cancel_at_period_end:true};
  assert.throws(()=>assertUpgrade(row,'plus',now));
  assert.throws(()=>assertUpgrade(row,'pro',now));
  assert.doesNotThrow(()=>assertUpgrade(row,'master',now));
  assert.doesNotThrow(()=>assertUpgrade(row,'plus',Date.parse('2026-10-13')));
});

test('calendar periods clamp month ends and leap years', () => {
  assert.equal(addBillingPeriod('2026-01-31T10:00:00Z','monthly'),'2026-02-28T10:00:00.000Z');
  assert.equal(addBillingPeriod('2024-02-29T10:00:00Z','yearly'),'2025-02-28T10:00:00.000Z');
});

test('provider payment proof is required; an unpaid future billing schedule cannot extend entitlement', () => {
  assert.equal(paidPeriodEnd({status:'ACTIVE',billing_info:{next_billing_time:'2026-12-01'}},'monthly'),null);
  const subscription={billing_info:{last_payment:{time:'2026-09-01T00:00:00Z',amount:{value:'10'}},next_billing_time:'2026-10-01T00:00:00Z'}};
  assert.equal(paidPeriodEnd(subscription,'monthly'),'2026-10-01T00:00:00Z');
  subscription.billing_info.next_billing_time='2026-11-01T00:00:00Z';
  assert.equal(paidPeriodEnd(subscription,'monthly'),'2026-10-01T00:00:00.000Z');
});

test('sale events use the billing agreement id rather than the payment id', () => {
  assert.equal(eventSubscriptionId({event_type:'PAYMENT.SALE.COMPLETED',resource:{id:'SALE-123',billing_agreement_id:'I-123'}}),'I-123');
  assert.equal(eventSubscriptionId({event_type:'BILLING.SUBSCRIPTION.CANCELLED',resource:{id:'I-123'}}),'I-123');
  assert.equal(eventSubscriptionId({event_type:'PAYMENT.SALE.COMPLETED',resource:{id:'SALE-123'}}),null);
});

test('checkout accepts only configured, infinite monthly or annual plans', () => {
  const plan={status:'ACTIVE',billing_cycles:[{tenure_type:'REGULAR',total_cycles:0,frequency:{interval_unit:'MONTH',interval_count:1},pricing_scheme:{fixed_price:{value:'10'}}}]};
  assert.doesNotThrow(()=>assertRecurringPlan(plan,'monthly'));
  assert.throws(()=>assertRecurringPlan(plan,'yearly'));
  plan.billing_cycles[0].total_cycles=12;
  assert.throws(()=>assertRecurringPlan(plan,'monthly'));
});

test('subscription metadata binds the user, tier and server-configured PayPal plan', () => {
  const original=process.env.PAYPAL_PRO_MONTHLY_PLAN_ID;
  process.env.PAYPAL_PRO_MONTHLY_PLAN_ID='P-EXPECTED';
  try {
    const subscription={custom_id:'12345678-1234-1234-1234-123456789abc:pro:monthly',plan_id:'P-EXPECTED'};
    assert.equal(subscriptionIdentity(subscription).tier,'pro');
    assert.throws(()=>subscriptionIdentity({...subscription,plan_id:'P-OTHER'}));
    assert.throws(()=>subscriptionIdentity({...subscription,custom_id:'someone-else'}));
  } finally { if(original===undefined)delete process.env.PAYPAL_PRO_MONTHLY_PLAN_ID;else process.env.PAYPAL_PRO_MONTHLY_PLAN_ID=original; }
});
