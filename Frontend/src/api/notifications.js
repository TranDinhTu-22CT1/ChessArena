import { apiUrl } from './config';

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'Notification request failed.');
  }
  return data;
}

export async function fetchNotifications({ page = 1, limit = 12, unread = false } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit)
  });
  if (unread) params.set('unread', '1');
  const response = await fetch(apiUrl(`/api/notifications?${params.toString()}`), {
    credentials: 'include'
  });
  return readJson(response);
}

export async function markNotificationRead(notificationId) {
  const response = await fetch(apiUrl('/api/notifications'), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'mark_read', notificationId })
  });
  return readJson(response);
}

export async function markAllNotificationsRead() {
  const response = await fetch(apiUrl('/api/notifications'), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'mark_all_read' })
  });
  return readJson(response);
}
