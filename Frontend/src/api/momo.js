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
    const error = new Error(data.error || 'MoMo confirmation failed.');
    error.pending = Boolean(data.pending);
    error.resultCode = data.resultCode;
    throw error;
  }
  return data;
}

export async function queryMomoMembershipPayment(orderId) {
  const response = await fetch(apiUrl('/api/momo/status'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || 'MoMo status query failed.');
    error.pending = Boolean(data.pending);
    error.resultCode = data.resultCode;
    throw error;
  }
  return data;
}
