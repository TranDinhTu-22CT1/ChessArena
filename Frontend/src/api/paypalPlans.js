import { apiUrl } from './config';

export async function fetchPayPalPlanPrices() {
  const response = await fetch(apiUrl('/api/paypal/plans'), {
    credentials: 'include'
  });
  const data = await response.json().catch(() => ({}));
  return data.prices ?? null;
}

export async function fetchPayPalPlan(planId) {
  const params = new URLSearchParams({ planId });
  const response = await fetch(apiUrl(`/api/paypal/plans?${params.toString()}`), {
    credentials: 'include'
  });
  return response.json().catch(() => ({}));
}

export async function createPayPalSubscriptionCheckout(payload) {
  const response = await fetch(apiUrl('/api/paypal/subscriptions'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'PayPal subscription checkout failed.');
  }
  return data;
}
