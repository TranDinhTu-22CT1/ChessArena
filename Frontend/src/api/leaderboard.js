import { apiUrl } from './config';

const VALID_MODES = new Set(['bullet', 'blitz', 'rapid', 'classical']);

function cleanMode(mode) {
  return VALID_MODES.has(mode) ? mode : 'rapid';
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'Could not load leaderboard.');
  }
  return data;
}

export async function fetchLeaderboard(mode = 'rapid', limit = 50) {
  const params = new URLSearchParams({
    mode: cleanMode(mode),
    limit: String(limit)
  });
  const response = await fetch(apiUrl(`/api/leaderboard?${params.toString()}`), {
    credentials: 'include'
  });
  return readJson(response);
}
