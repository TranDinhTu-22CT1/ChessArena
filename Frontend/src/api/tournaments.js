import { apiUrl } from './config';

export async function fetchTournaments({ page = 1, limit = 12, status = 'all' } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), status });
  const response = await fetch(apiUrl(`/api/tournaments?${params.toString()}`), { credentials: 'include' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Không tải được danh sách giải đấu.');
  return data;
}

export async function fetchTournamentDetail(tournamentId) {
  const response = await fetch(apiUrl(`/api/tournaments/${encodeURIComponent(tournamentId)}`), { credentials: 'include' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Không tải được chi tiết giải đấu.');
  return data;
}

export async function joinTournament(tournamentId) {
  const response = await fetch(apiUrl('/api/tournaments'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action: 'join', tournamentId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Không thể tham gia giải đấu.');
  return data;
}

export async function leaveTournament(tournamentId) {
  const response = await fetch(apiUrl('/api/tournaments'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action: 'leave', tournamentId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Không thể rời giải đấu.');
  return data;
}
