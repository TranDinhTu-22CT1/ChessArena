import { apiUrl } from './config';

async function readMembershipResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'Could not load membership.');
  }
  return data.membership;
}

export async function fetchMembership() {
  const response = await fetch(apiUrl('/api/user/membership'), {
    credentials: 'include'
  });
  return readMembershipResponse(response);
}

export async function activateMembership(payload) {
  const response = await fetch(apiUrl('/api/user/membership'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return readMembershipResponse(response);
}
