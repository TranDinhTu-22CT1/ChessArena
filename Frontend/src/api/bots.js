import { apiUrl } from './config';

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'Bot request failed.');
  }
  return data;
}

export async function fetchPublicBots() {
  const response = await fetch(apiUrl('/api/bots'), { credentials: 'include' });
  return readJson(response);
}
