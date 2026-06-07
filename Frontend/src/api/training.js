import { apiUrl } from './config';

export async function fetchCoachInsights() {
  const response = await fetch(apiUrl('/api/training/coach'), { credentials: 'include' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load coach insights.');
  return data;
}

export async function fetchOpeningRepertoire() {
  const response = await fetch(apiUrl('/api/training/openings'), { credentials: 'include' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load opening repertoire.');
  return data;
}

export async function importOpening(payload) {
  const response = await fetch(apiUrl('/api/training/openings'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not import PGN.');
  return data;
}

export async function deleteOpening(id) {
  const response = await fetch(apiUrl(`/api/training/openings?id=${encodeURIComponent(id)}`), {
    method: 'DELETE',
    credentials: 'include'
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not delete opening.');
  return data;
}
