import { apiUrl } from './config';

async function readJson(response, fallbackError) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || fallbackError);
  }
  return data;
}

export async function fetchTournaments({ page = 1, limit = 12, status = 'all' } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), status });
  const response = await fetch(apiUrl(`/api/tournaments?${params.toString()}`), { credentials: 'include' });
  return readJson(response, 'Không tải được danh sách giải đấu.');
}

export async function fetchTournamentDetail(tournamentId) {
  const response = await fetch(apiUrl(`/api/tournaments/${encodeURIComponent(tournamentId)}`), { credentials: 'include' });
  return readJson(response, 'Không tải được chi tiết giải đấu.');
}

export async function joinTournament(tournamentId) {
  const response = await fetch(apiUrl('/api/tournaments'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action: 'join', tournamentId })
  });
  return readJson(response, 'Không thể tham gia giải đấu.');
}

export async function leaveTournament(tournamentId) {
  const response = await fetch(apiUrl('/api/tournaments'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action: 'leave', tournamentId })
  });
  return readJson(response, 'Không thể rời giải đấu.');
}
