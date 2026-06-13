import { apiUrl, handleApiSession } from './config';

export async function fetchAchievements() {
  const response = handleApiSession(await fetch(apiUrl('/api/achievements'), { credentials: 'include' }));
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load achievements.');
  return data;
}
