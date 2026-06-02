import { apiUrl } from './config';

export async function fetchCoachInsights() {
  const response = await fetch(apiUrl('/api/training/coach'), { credentials: 'include' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load coach insights.');
  return data;
}
