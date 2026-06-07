import { apiUrl } from './config';

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || 'Social request failed.');
  return data;
}

export async function fetchFollowSummary(userId) {
  const response = await fetch(apiUrl(`/api/social/follows?userId=${encodeURIComponent(userId)}`), { credentials: 'include' });
  return readJson(response);
}

export async function changeFollow(userId, action = 'follow') {
  const response = await fetch(apiUrl('/api/social/follows'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, action })
  });
  return readJson(response);
}

export async function fetchActivityFeed({ userId = '', page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (userId) params.set('userId', userId);
  const response = await fetch(apiUrl(`/api/social/activity?${params}`), { credentials: 'include' });
  return readJson(response);
}
