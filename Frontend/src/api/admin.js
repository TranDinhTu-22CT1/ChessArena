import { apiUrl } from './config';

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'Admin request failed.');
  }
  return data;
}

export async function fetchAdminMe() {
  const response = await fetch(apiUrl('/api/admin/me'), { credentials: 'include' });
  return readJson(response);
}

export async function unlockAdmin(email, password) {
  const response = await fetch(apiUrl('/api/admin/session'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return readJson(response);
}

export async function lockAdmin() {
  const response = await fetch(apiUrl('/api/admin/session'), {
    method: 'DELETE',
    credentials: 'include'
  });
  return readJson(response);
}

export async function fetchAdminSummary() {
  const response = await fetch(apiUrl('/api/admin/summary'), { credentials: 'include' });
  return readJson(response);
}

export async function fetchAdminUsers(search = '') {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const response = await fetch(apiUrl(`/api/admin/users?${params.toString()}`), { credentials: 'include' });
  return readJson(response);
}

export async function fetchAdminUserDetail(userId) {
  const response = await fetch(apiUrl(`/api/admin/users/${encodeURIComponent(userId)}`), { credentials: 'include' });
  return readJson(response);
}

export async function adminUserAction(payload) {
  const response = await fetch(apiUrl('/api/admin/users'), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return readJson(response);
}

export async function fetchAntiCheatReports() {
  const response = await fetch(apiUrl('/api/admin/anti-cheat'), { credentials: 'include' });
  return readJson(response);
}

export async function scanUserAntiCheat(userId) {
  const response = await fetch(apiUrl('/api/admin/anti-cheat/scan'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, limit: 3 })
  });
  return readJson(response);
}

export async function updateAntiCheatReport(reportId, status) {
  const response = await fetch(apiUrl('/api/admin/anti-cheat'), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportId, status })
  });
  return readJson(response);
}
