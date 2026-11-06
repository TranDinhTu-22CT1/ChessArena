import { apiUrl } from './config';

async function readJson(response) {
  const data = await response.json().catch(() => ({
    error: response.ok ? '' : `Không thể gửi yêu cầu, mã lỗi ${response.status}.`
  }));
  if (!response.ok || data.ok === false) {
    if (response.status === 404) {
      throw new Error('Hệ thống hỗ trợ chưa sẵn sàng. Vui lòng thử lại sau.');
    }
    throw new Error(data.error || 'Chưa thực hiện được yêu cầu hỗ trợ.');
  }
  return data;
}

export async function createSupportRequest(payload) {
  const response = await fetch(apiUrl('/api/support/requests'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return readJson(response);
}

export async function fetchMySupportRequests({ page = 1, limit = 8 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const response = await fetch(apiUrl(`/api/support/requests?${params.toString()}`), {
    credentials: 'include'
  });
  return readJson(response);
}

export async function fetchSupportMessages(requestId) {
  const response = await fetch(apiUrl(`/api/support/requests/${encodeURIComponent(requestId)}/messages`), {
    credentials: 'include'
  });
  return readJson(response);
}

export async function sendSupportMessage(requestId, payload) {
  const response = await fetch(apiUrl(`/api/support/requests/${encodeURIComponent(requestId)}/messages`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return readJson(response);
}
