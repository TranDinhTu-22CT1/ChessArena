import { apiUrl, handleApiSession } from './config';

export async function fetchCoachInsights() {
  const response = handleApiSession(await fetch(apiUrl('/api/training/coach'), { credentials: 'include' }));
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Không thể tải dữ liệu huấn luyện.');
  return data;
}

export async function fetchOpeningRepertoire() {
  const response = handleApiSession(await fetch(apiUrl('/api/training/openings'), { credentials: 'include' }));
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Không thể tải thư viện khai cuộc.');
  return data;
}

export async function importOpening(payload) {
  const response = handleApiSession(await fetch(apiUrl('/api/training/openings'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }));
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Không thể nhập tệp PGN.');
  return data;
}

export async function deleteOpening(id) {
  const response = handleApiSession(await fetch(apiUrl(`/api/training/openings?id=${encodeURIComponent(id)}`), {
    method: 'DELETE',
    credentials: 'include'
  }));
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Không thể xóa khai cuộc.');
  return data;
}
