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

export async function fetchLeaderboard(mode = 'rapid', { page = 1, limit = 20, period = 'all', offset = 0, signal } = {}) {
  const params = new URLSearchParams({
    mode: cleanMode(mode),
    page: String(page),
    limit: String(limit), period, offset: String(offset)
  });
  const response = await fetch(apiUrl(`/api/leaderboard?${params.toString()}`), {
    credentials: 'include', signal
  });
  return readJson(response);
}
