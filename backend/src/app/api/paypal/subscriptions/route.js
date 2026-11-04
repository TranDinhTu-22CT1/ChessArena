import { distributedRateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../lib/online';
import { assertPayPalPlanVisible, createPayPalSubscription, fetchPayPalSubscription, cancelPayPalSubscription } from '../../../../lib/paypal';
import { frontendReturnOrigin } from '../../../../lib/cors';
import { assertRecurringPlan, assertUpgrade } from '../../../../lib/membershipPolicy';
import { membershipRow, refreshMembership, syncSubscription } from '../../../../lib/membershipService';

export const runtime = 'nodejs';

const TIERS = new Set(['plus', 'pro', 'master']);
const CYCLES = new Set(['monthly', 'yearly']);
const PLAN_IDS = {
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

function approveLink(subscription) {
  return (subscription.links || []).find((link) => link.rel === 'approve')?.href || '';
}

export async function POST(request) {
  const blocked = await distributedRateLimit(request, { scope: 'paypal-subscription-create', limit: 12, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await request.json().catch(() => ({}));
  const tier = TIERS.has(payload?.tier) ? payload.tier : '';
  const billingCycle = CYCLES.has(payload?.billingCycle) ? payload.billingCycle : '';
  const expectedPlanId = PLAN_IDS[tier]?.[billingCycle] || '';
  const planId = String(payload?.planId || '').trim();
  if (!tier || !billingCycle || !expectedPlanId || planId !== expectedPlanId) {
    return Response.json({ ok: false, error: 'PayPal plan does not match the selected package.' }, { status: 400 });
  }

  const baseUrl = frontendReturnOrigin(request.headers.get('origin'));
  try {
    await refreshMembership(context.supabase, context.user.id);
    assertUpgrade(await membershipRow(context.supabase, context.user.id), tier);
    const plan = await assertPayPalPlanVisible(planId);
    assertRecurringPlan(plan, billingCycle);
    if (plan.status && plan.status !== 'ACTIVE') {
      return Response.json({
        ok: false,
        error: `PayPal plan ${planId} is ${plan.status}. Activate it in PayPal before checkout.`
      }, { status: 400 });
    }
    const reserved = await context.supabase.rpc('reserve_membership_checkout', {
      p_user: context.user.id, p_tier: tier, p_cycle: billingCycle, p_plan: planId
    });
    if (reserved.error) return Response.json({ ok: false, error: reserved.error.message }, { status: 409 });
    if (reserved.data.approve_url) return Response.json({ ok: true, subscriptionId: reserved.data.subscription_id, approveUrl: reserved.data.approve_url, planId });
    const subscription = await createPayPalSubscription({
      requestId: reserved.data.request_id,
      planId,
      customId: `${context.user.id}:${tier}:${billingCycle}`,
      returnUrl: `${baseUrl}/membership?paypal=approved&tier=${tier}&cycle=${billingCycle}`,
      cancelUrl: `${baseUrl}/membership?paypal=cancelled&tier=${tier}&cycle=${billingCycle}`
    });
    const approveUrl = approveLink(subscription);
    if (!approveUrl) {
      return Response.json({ ok: false, error: 'PayPal did not return an approval URL.' }, { status: 502 });
    }
    const saved = await context.supabase.from('membership_checkouts').update({ subscription_id: subscription.id, approve_url: approveUrl })
      .eq('user_id', context.user.id).eq('request_id', reserved.data.request_id);
    if (saved.error) throw saved.error;
    await syncSubscription(context.supabase, subscription, context.user.id);
    return Response.json({
      ok: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      planId,
      approveUrl
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message
    }, { status: error.status || 502 });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function DELETE() {
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const { supabase, user } = context;
  try {
    const { data: checkout, error } = await supabase.from('membership_checkouts').select('*').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!checkout) return Response.json({ ok: true });
    if (!checkout.subscription_id) return Response.json({ ok: false, error: 'Giao dịch đang khởi tạo. Hãy mở lại cùng gói để hoàn tất hoặc hủy trên PayPal.' }, { status: 409 });
    const subscription = await fetchPayPalSubscription(checkout.subscription_id);
    if (!subscription) throw new Error('Chưa thể xác minh giao dịch với PayPal.');
    await syncSubscription(supabase, subscription, user.id);
    if (subscription.status === 'ACTIVE') return Response.json({ ok: false, error: 'Gói đã được kích hoạt. Hãy dùng nút Hủy gia hạn trong quản lý gói.' }, { status: 409 });
    await cancelPayPalSubscription(checkout.subscription_id, 'Customer cancelled pending checkout');
    await syncSubscription(supabase, { ...subscription, status: 'CANCELLED', status_update_time: new Date().toISOString() }, user.id);
    const deleted = await supabase.from('membership_checkouts').delete().eq('user_id', user.id).eq('request_id', checkout.request_id);
    if (deleted.error) throw deleted.error;
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 502 }); }
}
