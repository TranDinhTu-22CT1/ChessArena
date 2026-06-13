import { apiUrl, handleApiSession } from './config';

export async function fetchModerationStatus() {
  const response = handleApiSession(await fetch(apiUrl('/api/user/moderation'), {
    credentials: 'include'
  }));
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'Could not load moderation status.');
  }
  return data.moderation || null;
}
