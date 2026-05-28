import { rateLimit } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';

const PAYPAL_API_BASE = process.env.PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

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

function emptyPrices() {
  return Object.fromEntries(
    Object.entries(PLAN_IDS).map(([tier, cycles]) => [
      tier,
      Object.fromEntries(Object.keys(cycles).map((cycle) => [cycle, null]))
    ])
  );
}

async function paypalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new Error('Missing PayPal server credentials.');

  const credentials = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) throw new Error('PayPal token request failed.');
  const data = await response.json();
  if (!data.access_token) throw new Error('PayPal token is empty.');
  return data.access_token;
}

function planPrice(plan) {
  const regularCycle = plan.billing_cycles?.find((cycle) => cycle.tenure_type === 'REGULAR')
    ?? plan.billing_cycles?.[0];
  const fixedPrice = regularCycle?.pricing_scheme?.fixed_price;
  if (!fixedPrice?.value || !fixedPrice?.currency_code) return null;
  return {
    value: Number(fixedPrice.value),
    currency: fixedPrice.currency_code,
    status: plan.status || null
  };
}

async function fetchPlan(planId, token) {
  if (!planId) return null;
  const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans/${encodeURIComponent(planId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  if (!response.ok) return null;
  return planPrice(await response.json());
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'paypal-plans', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const prices = emptyPrices();
  try {
    const token = await paypalAccessToken();
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
