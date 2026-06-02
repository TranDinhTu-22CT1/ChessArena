import { apiUrl } from './config';

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'Friend request failed.');
  }
  return data;
}

export async function fetchFriends() {
  const response = await fetch(apiUrl('/api/friends'), {
    credentials: 'include'
  });
  return readJson(response);
}

export async function searchUsers(query) {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(apiUrl(`/api/users/search?${params.toString()}`), {
    credentials: 'include'
  });
  return readJson(response);
}

export async function sendFriendRequest(userId) {
  const response = await fetch(apiUrl('/api/friends'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'request', userId })
  });
  return readJson(response);
}

export async function respondFriendRequest(friendshipId, responseValue) {
  const response = await fetch(apiUrl('/api/friends'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'respond', friendshipId, response: responseValue })
  });
  return readJson(response);
}

export async function removeFriendship({ friendshipId, userId } = {}) {
  const response = await fetch(apiUrl('/api/friends'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'remove', friendshipId, userId })
  });
  return readJson(response);
}
