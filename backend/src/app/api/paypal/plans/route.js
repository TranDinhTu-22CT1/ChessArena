import { rateLimit } from '../../../../lib/rateLimit';
import { fetchPayPalPlan, paypalAccessToken, paypalBaseUrl, paypalPlanCredentialError } from '../../../../lib/paypal';

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

function emptyPlans() {
  return Object.fromEntries(
    Object.entries(PLAN_IDS).map(([tier, cycles]) => [
      tier,
      Object.fromEntries(Object.keys(cycles).map((cycle) => [cycle, null]))
    ])
  );
}

function planSummary(plan, planId) {
  const billingCycles = Array.isArray(plan.billing_cycles) ? plan.billing_cycles : [];
  const regularCycle = billingCycles.find((cycle) => cycle.tenure_type === 'REGULAR')
    ?? billingCycles[billingCycles.length - 1]
    ?? null;
  const fixedPrice = regularCycle?.pricing_scheme?.fixed_price;
  if (!fixedPrice?.value || !fixedPrice?.currency_code) return null;
  return {
    id: planId,
    name: plan.name || null,
    value: Number(fixedPrice.value),
    currency: fixedPrice.currency_code,
    status: plan.status || null,
    tenureType: regularCycle?.tenure_type || null,
    intervalUnit: regularCycle?.frequency?.interval_unit || null,
    intervalCount: regularCycle?.frequency?.interval_count || null
  };
}

async function fetchPlan(planId, token) {
  if (!planId) return null;
  if (!token) return planSummary(await fetchPayPalPlan(planId), planId);
  const response = await fetch(`${paypalBaseUrl()}/v1/billing/plans/${encodeURIComponent(planId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  if (!response.ok) return null;
  return planSummary(await response.json(), planId);
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'paypal-plans', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const singlePlanId = searchParams.get('planId');
  const prices = emptyPlans();
  try {
    const token = await paypalAccessToken();
    if (singlePlanId) {
      try {
        const plan = await fetchPlan(singlePlanId, token);
        return Response.json({
          ok: Boolean(plan),
          plan,
          error: plan ? null : paypalPlanCredentialError(singlePlanId)
        }, { status: 200 });
      } catch (error) {
        return Response.json({ ok: false, plan: null, error: error.message }, { status: 200 });
      }
    }

    await Promise.all(Object.entries(PLAN_IDS).flatMap(([tier, cycles]) => (
      Object.entries(cycles).map(async ([cycle, planId]) => {
        prices[tier][cycle] = await fetchPlan(planId, token);
      })
    )));
  } catch (error) {
    return Response.json({ ok: false, error: error.message, prices }, { status: 200 });
  }

  return Response.json({ ok: true, prices }, {
    headers: {
      'Cache-Control': 's-maxage=900, stale-while-revalidate=3600'
    }
  });
}
