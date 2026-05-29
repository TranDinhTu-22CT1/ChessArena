import { rateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../lib/online';
import { assertPayPalPlanVisible, createPayPalSubscription } from '../../../../lib/paypal';

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

function frontendUrl() {
  return String(process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

function approveLink(subscription) {
  return (subscription.links || []).find((link) => link.rel === 'approve')?.href || '';
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'paypal-subscription-create', limit: 12, windowMs: 60_000 });
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

  const baseUrl = frontendUrl();
  try {
    const plan = await assertPayPalPlanVisible(planId);
    if (plan.status && plan.status !== 'ACTIVE') {
      return Response.json({
        ok: false,
        error: `PayPal plan ${planId} is ${plan.status}. Activate it in PayPal before checkout.`
      }, { status: 400 });
    }
    const subscription = await createPayPalSubscription({
      planId,
      customId: `${context.user.id}:${tier}:${billingCycle}`,
      returnUrl: `${baseUrl}/membership?paypal=approved&tier=${tier}&cycle=${billingCycle}`,
      cancelUrl: `${baseUrl}/membership?paypal=cancelled&tier=${tier}&cycle=${billingCycle}`
    });
    const approveUrl = approveLink(subscription);
    if (!approveUrl) {
      return Response.json({ ok: false, error: 'PayPal did not return an approval URL.' }, { status: 502 });
    }
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
      error: `PayPal Sandbox could not create the subscription for plan ${planId}: ${error.message}`
    }, { status: 502 });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
