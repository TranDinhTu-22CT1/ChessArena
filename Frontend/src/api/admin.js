import { apiUrl } from './config';

let adminCsrfToken = '';

async function readJson(response) {
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {};
  if (!response.ok || data.ok === false) {
    if (response.status === 404 && response.url.includes('/api/admin/support')) {
      const error = new Error('API hộp thư hỗ trợ chưa khả dụng trên deployment hiện tại. Kiểm tra VITE_API_URL hoặc redeploy backend để có /api/admin/support.');
      error.status = response.status;
      throw error;
    }
    const error = new Error(data.error || `Yêu cầu admin thất bại (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (data.csrfToken) adminCsrfToken = data.csrfToken;
  if (data.admin?.csrfToken) adminCsrfToken = data.admin.csrfToken;
  return data;
}

function adminWriteHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    ...(adminCsrfToken ? { 'x-admin-csrf': adminCsrfToken } : {}),
    ...extra
  };
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
    headers: adminCsrfToken ? { 'x-admin-csrf': adminCsrfToken } : {},
    credentials: 'include'
  });
  const data = await readJson(response);
  adminCsrfToken = '';
  return data;
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
    headers: adminWriteHeaders(),
    body: JSON.stringify(payload)
  });
  return readJson(response);
}



export async function fetchModerationReports({ page = 1, limit = 10, status = '', search = '', category = '', dateFrom = '', dateTo = '' } = {}) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const response = await fetch(apiUrl(`/api/admin/moderation?${params.toString()}`), { credentials: 'include' });
  return readJson(response);
}

export async function updateModerationReport(reportId, status, resolutionNote = '') {
  const response = await fetch(apiUrl('/api/admin/moderation'), {
    method: 'PATCH',
    credentials: 'include',
    headers: adminWriteHeaders(),
    body: JSON.stringify({ reportId, status, resolutionNote })
  });
  return readJson(response);
}

export async function fetchAdminMatches({ page = 1, limit = 10, status = '', search = '', matchType = '', rated = '', dateFrom = '', dateTo = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  if (matchType) params.set('matchType', matchType);
  if (rated) params.set('rated', rated);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const response = await fetch(apiUrl(`/api/admin/matches?${params.toString()}`), { credentials: 'include' });
  return readJson(response);
}



export async function updateAdminMatchStatus(gameId, status) {
  const response = await fetch(apiUrl('/api/admin/matches'), {
    method: 'PATCH',
    credentials: 'include',
    headers: adminWriteHeaders(),
    body: JSON.stringify({ gameId, status })
  });
  return readJson(response);
}

export async function fetchAdminPayments({ page = 1, limit = 10, search = '', status = '', provider = '', tier = '', dateFrom = '', dateTo = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (provider) params.set('provider', provider);
  if (tier) params.set('tier', tier);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const response = await fetch(apiUrl(`/api/admin/payments?${params.toString()}`), { credentials: 'include' });
  return readJson(response);
}

export async function fetchAdminSupportRequests({ page = 1, limit = 10, status = '', search = '', category = '', dateFrom = '', dateTo = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const response = await fetch(apiUrl(`/api/admin/support?${params.toString()}`), { credentials: 'include' });
  return readJson(response);
}

export async function updateAdminSupportRequest(requestId, status, adminNote = '') {
  const response = await fetch(apiUrl('/api/admin/support'), {
    method: 'PATCH',
    credentials: 'include',
    headers: adminWriteHeaders(),
    body: JSON.stringify({ requestId, status, adminNote, appealDecision: ['approved','rejected'].includes(status) ? status : undefined })
  });
  return readJson(response);
}

export async function fetchAdminSupportThread(requestId) {
  const response = await fetch(apiUrl(`/api/admin/support/${encodeURIComponent(requestId)}/messages`), {
    credentials: 'include'
  });
  return readJson(response);
}

export async function sendAdminSupportMessage(requestId, payload) {
  const response = await fetch(apiUrl(`/api/admin/support/${encodeURIComponent(requestId)}/messages`), {
    method: 'POST',
    credentials: 'include',
    headers: adminWriteHeaders(),
    body: JSON.stringify(payload)
  });
  return readJson(response);
}

export async function fetchAdminAuditLogs({ page = 1, limit = 20, action = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (action) params.set('action', action);
  const response = await fetch(apiUrl(`/api/admin/audit?${params.toString()}`), { credentials: 'include' });
  return readJson(response);
}

export async function fetchAdminConfig() {
  const response = await fetch(apiUrl('/api/admin/config'), { credentials: 'include' });
  return readJson(response);
}

export async function updateAdminConfig(settings) {
  const response = await fetch(apiUrl('/api/admin/config'), {
    method: 'PATCH',
    credentials: 'include',
    headers: adminWriteHeaders(),
    body: JSON.stringify({ settings })
  });
  return readJson(response);
}

export async function updateTestAdminAccess(granted = true) {
  const response = await fetch(apiUrl('/api/admin/test-access'), {
    method: 'POST',
    credentials: 'include',
    headers: adminWriteHeaders(),
    body: JSON.stringify({ granted })
  });
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
    headers: adminWriteHeaders(),
    body: JSON.stringify({ tier, cycle })
  });
  return readJson(response);
}





export async function fetchAdminBots({ page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await fetch(apiUrl(`/api/admin/bots?${params.toString()}`), { credentials: 'include' });
  return readJson(response);
}

export async function createAdminBot(payload) {
  const response = await fetch(apiUrl('/api/admin/bots'), {
    method: 'POST',
    credentials: 'include',
    headers: adminWriteHeaders(),
    body: JSON.stringify(payload)
  });
  return readJson(response);
}

export async function updateAdminBot(botId, payload) {
  const response = await fetch(apiUrl('/api/admin/bots'), {
    method: 'PATCH',
    credentials: 'include',
    headers: adminWriteHeaders(),
    body: JSON.stringify({ botId, ...payload })
  });
  return readJson(response);
}

export async function deleteAdminBot(payload) {
  const response = await fetch(apiUrl('/api/admin/bots'), {
    method: 'DELETE',
    credentials: 'include',
    headers: adminWriteHeaders(),
    body: JSON.stringify(payload)
  });
  return readJson(response);
}

export async function fetchAdminEvents({ page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await fetch(apiUrl(`/api/admin/events?${params.toString()}`), { credentials: 'include' });
  return readJson(response);
}

export async function createAdminEvent(payload) {
  const response = await fetch(apiUrl('/api/admin/events'), {
    method: 'POST',
    credentials: 'include',
    headers: adminWriteHeaders(),
    body: JSON.stringify(payload)
  });
  return readJson(response);
}

export async function updateAdminEvent(eventId, payload) {
  const response = await fetch(apiUrl('/api/admin/events'), {
    method: 'PATCH',
    credentials: 'include',
    headers: adminWriteHeaders(),
    body: JSON.stringify({ eventId, ...payload })
  });
  return readJson(response);
}
