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

export async function saveProfile(profile) {
  const response = await fetch(apiUrl('/api/user/profile'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile)
  });
  return readProfileResponse(response);
}
