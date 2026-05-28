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
