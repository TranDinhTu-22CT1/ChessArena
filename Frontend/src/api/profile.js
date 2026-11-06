import { apiUrl } from './config';

async function readProfileResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'Could not load profile.');
  }
  return data.profile;
}

export async function fetchProfile() {
  const response = await fetch(apiUrl('/api/user/profile'), { credentials: 'include' });
  return readProfileResponse(response);
}

export async function fetchPublicProfile(userId) {
  const response = await fetch(apiUrl(`/api/user/profile/${encodeURIComponent(userId)}`), { credentials: 'include' });
  return readProfileResponse(response);
}

export async function saveProfile(profile) {
  const response = await fetch(apiUrl('/api/user/profile'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile)
  });
  return readProfileResponse(response);
}

async function readReportResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || 'Không thể gửi báo cáo.');
  return data;
}

export async function fetchReportOptions(reportedUserId) {
  const response = await fetch(apiUrl(`/api/reports?reportedUserId=${encodeURIComponent(reportedUserId)}`), { credentials: 'include' });
  return readReportResponse(response);
}

export async function fetchMyReports() {
  const response = await fetch(apiUrl('/api/reports'), { credentials: 'include' });
  return readReportResponse(response);
}

export async function createPlayerReport(payload) {
  const response = await fetch(apiUrl('/api/reports'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return readReportResponse(response);
}
