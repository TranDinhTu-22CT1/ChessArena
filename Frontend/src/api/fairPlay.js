import { apiUrl } from './config';

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || 'Fair-play request failed.');
  return data;
}

export async function fetchMyAppeals() {
  return readJson(await fetch(apiUrl('/api/anti-cheat/appeals'), { credentials: 'include' }));
}

export async function createAppeal(payload) {
  return readJson(await fetch(apiUrl('/api/anti-cheat/appeals'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }));
}
