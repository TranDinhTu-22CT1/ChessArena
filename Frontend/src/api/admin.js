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

export async function fetchAdminUsers(search = '', { page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  params.set('page', String(page));
  params.set('limit', String(limit));
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

export async function fetchAntiCheatReports({ page = 1, limit = 10, status = 'all', minRisk = 0, search = '' } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    status,
    minRisk: String(minRisk)
  });
  if (search) params.set('search', search);
  const response = await fetch(apiUrl(`/api/admin/anti-cheat?${params.toString()}`), { credentials: 'include' });
  return readJson(response);
}

export async function fetchModerationReports(status = '') {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const response = await fetch(apiUrl(`/api/admin/moderation?${params.toString()}`), { credentials: 'include' });
  return readJson(response);
}

export async function updateModerationReport(reportId, status, resolutionNote = '') {
  const response = await fetch(apiUrl('/api/admin/moderation'), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportId, status, resolutionNote })
  });
  return readJson(response);
}

export async function fetchAdminMatches() {
  const response = await fetch(apiUrl('/api/admin/matches'), { credentials: 'include' });
  return readJson(response);
}

export async function createAdminMatch(payload) {
  const response = await fetch(apiUrl('/api/admin/matches'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return readJson(response);
}

export async function fetchAdminPayments() {
  const response = await fetch(apiUrl('/api/admin/payments'), { credentials: 'include' });
  return readJson(response);
}

export async function fetchAdminAuditLogs() {
  const response = await fetch(apiUrl('/api/admin/audit'), { credentials: 'include' });
  return readJson(response);
}

export async function fetchAdminConfig() {
  const response = await fetch(apiUrl('/api/admin/config'), { credentials: 'include' });
  return readJson(response);
}

export async function fetchPayPalDiagnostics() {
  const response = await fetch(apiUrl('/api/admin/paypal/diagnostics'), { credentials: 'include' });
  return readJson(response);
}

export async function testPayPalSubscription(tier = 'master', cycle = 'monthly') {
  const response = await fetch(apiUrl('/api/admin/paypal/diagnostics'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier, cycle })
  });
  return readJson(response);
}

export async function scanUserAntiCheat(userId) {
  const response = await fetch(apiUrl('/api/admin/anti-cheat/scan'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, limit: 6 })
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

export async function fetchAdminBots() {
  const response = await fetch(apiUrl('/api/admin/bots'), { credentials: 'include' });
  return readJson(response);
}

export async function createAdminBot(payload) {
  const response = await fetch(apiUrl('/api/admin/bots'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return readJson(response);
}

export async function updateAdminBot(botId, payload) {
  const response = await fetch(apiUrl('/api/admin/bots'), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ botId, ...payload })
  });
  return readJson(response);
}

export async function fetchAdminEvents() {
  const response = await fetch(apiUrl('/api/admin/events'), { credentials: 'include' });
  return readJson(response);
}

export async function createAdminEvent(payload) {
  const response = await fetch(apiUrl('/api/admin/events'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return readJson(response);
}

export async function updateAdminEvent(eventId, payload) {
  const response = await fetch(apiUrl('/api/admin/events'), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, ...payload })
  });
  return readJson(response);
}
