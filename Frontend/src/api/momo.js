import { apiUrl } from './config';

export async function createMomoMembershipPayment(payload) {
  const response = await fetch(apiUrl('/api/momo/payment'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'MoMo checkout failed.');
  }
  return data;
}

export async function confirmMomoMembershipPayment(params) {
  const payload = Object.fromEntries(params.entries());
  const response = await fetch(apiUrl('/api/momo/confirm'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'MoMo confirmation failed.');
  }
  return data;
}
