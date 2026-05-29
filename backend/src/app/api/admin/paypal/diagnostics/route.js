import { assertPayPalPlanVisible, createPayPalSubscription, fetchPayPalPlan, paypalCredentialFingerprint } from '../../../../../lib/paypal';
import { rateLimit } from '../../../../../lib/rateLimit';
import { requireAdminUser, writeAdminAudit } from '../../../../../lib/admin';

export const runtime = 'nodejs';

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

function planSummary(plan, planId) {
  const regularCycle = (plan.billing_cycles || []).find((cycle) => cycle.tenure_type === 'REGULAR')
    || (plan.billing_cycles || []).at(-1)
    || {};
  const fixedPrice = regularCycle.pricing_scheme?.fixed_price;
  return {
    id: planId,
    name: plan.name || null,
    status: plan.status || null,
    productId: plan.product_id || null,
    currency: fixedPrice?.currency_code || null,
    value: fixedPrice?.value || null,
    intervalUnit: regularCycle.frequency?.interval_unit || null,
    intervalCount: regularCycle.frequency?.interval_count || null
  };
}

function frontendUrl() {
  return String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-paypal-diagnostics', limit: 12, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  const diagnostics = [];
  for (const [tier, cycles] of Object.entries(PLAN_IDS)) {
    for (const [cycle, planId] of Object.entries(cycles)) {
      if (!planId) {
        diagnostics.push({ tier, cycle, planId: null, ok: false, error: 'Plan id is not configured.' });
        continue;
      }
      try {
        const plan = await fetchPayPalPlan(planId);
        diagnostics.push({ tier, cycle, ok: true, plan: planSummary(plan, planId) });
      } catch (error) {
        diagnostics.push({ tier, cycle, planId, ok: false, error: error.message });
      }
    }
  }

  await writeAdminAudit(context.supabase, context.admin, 'paypal.diagnostics');
  return Response.json({
    ok: true,
    environment: process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox',
    credential: paypalCredentialFingerprint(),
    webhookConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID),
    diagnostics
  });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'admin-paypal-test-subscription', limit: 4, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  const payload = await request.json().catch(() => ({}));
  const tier = ['plus', 'pro', 'master'].includes(payload.tier) ? payload.tier : 'master';
  const cycle = ['monthly', 'yearly'].includes(payload.cycle) ? payload.cycle : 'monthly';
  const planId = PLAN_IDS[tier]?.[cycle];
  if (!planId) return Response.json({ ok: false, error: 'Plan id is not configured.' }, { status: 400 });

  try {
    const baseUrl = frontendUrl();
    await assertPayPalPlanVisible(planId);
    const subscription = await createPayPalSubscription({
      planId,
      customId: `admin-diagnostic:${tier}:${cycle}:${Date.now()}`,
      returnUrl: `${baseUrl}/membership?paypal=approved&tier=${tier}&cycle=${cycle}`,
      cancelUrl: `${baseUrl}/membership?paypal=cancelled&tier=${tier}&cycle=${cycle}`
    });
    await writeAdminAudit(context.supabase, context.admin, 'paypal.test_subscription', { tier, cycle, planId, subscriptionId: subscription.id });
    return Response.json({
      ok: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      approveUrl: (subscription.links || []).find((link) => link.rel === 'approve')?.href || null
    });
  } catch (error) {
    await writeAdminAudit(context.supabase, context.admin, 'paypal.test_subscription_failed', { tier, cycle, planId, error: error.message });
    return Response.json({ ok: false, error: error.message, tier, cycle, planId }, { status: 502 });
  }
}
