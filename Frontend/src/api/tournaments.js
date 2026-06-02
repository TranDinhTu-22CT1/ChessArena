import { apiUrl } from './config';

export async function fetchTournaments() {
  const response = await fetch(apiUrl('/api/tournaments'), { credentials: 'include' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Không tải được danh sách giải đấu.');
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
