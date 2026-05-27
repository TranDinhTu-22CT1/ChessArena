import { apiUrl } from './config';

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || 'Online request failed.');
  return data;
}

function matchmakingContext() {
  if (typeof window === 'undefined') return {};
  const clientKey = 'chessArenaClientId';
  const sessionKey = 'chessArenaMatchSessionId';
  const createId = () => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let clientId = window.localStorage.getItem(clientKey);
  let sessionId = window.sessionStorage.getItem(sessionKey);
  if (!clientId) {
    clientId = createId();
    window.localStorage.setItem(clientKey, clientId);
  }
  if (!sessionId) {
    sessionId = createId();
    window.sessionStorage.setItem(sessionKey, sessionId);
  }
  return {
    clientId,
    sessionId,
    correlationId: createId(),
    region: Intl.DateTimeFormat().resolvedOptions().timeZone || 'global'
  };
}

function queueAttemptContext() {
  if (typeof window === 'undefined') return matchmakingContext();
  const context = matchmakingContext();
  const attemptKey = 'chessArenaQueueAttemptId';
  const createId = () => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let idempotencyKey = window.sessionStorage.getItem(attemptKey);
  if (!idempotencyKey) {
    idempotencyKey = `${context.sessionId}:${createId()}`;
    window.sessionStorage.setItem(attemptKey, idempotencyKey);
  }
  return { ...context, idempotencyKey };
}

function clearQueueAttemptContext() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem('chessArenaQueueAttemptId');
}

export async function sendOnlineHeartbeat(queueing = false, gameId = null, options = {}) {
  const response = await fetch(apiUrl('/api/online/heartbeat'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queueing, gameId, ...matchmakingContext(), ...options })
  });
  return readJson(response);
}

export async function joinOnlineQueue(timeControl) {
  const response = await fetch(apiUrl('/api/online/matchmaking/find'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'join', timeControl, ...queueAttemptContext() })
  });
  const data = await readJson(response);
  if (data.status === 'matched') clearQueueAttemptContext();
  return data;
}

export async function cancelOnlineQueue() {
  const response = await fetch(apiUrl('/api/online/matchmaking/cancel'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'user_cancelled', ...matchmakingContext() })
  });
  const data = await readJson(response);
  if (data.status === 'cancelled') clearQueueAttemptContext();
  return data;
}

export async function createFriendGame(timeControl, side = 'random') {
  const response = await fetch(apiUrl('/api/online/friend'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', timeControl, side })
  });
  return readJson(response);
}

export async function joinFriendGame(code) {
  const response = await fetch(apiUrl('/api/online/friend'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'join', code })
  });
  return readJson(response);
}

export async function fetchOnlineGame(gameId) {
  const response = await fetch(apiUrl(`/api/online/games/${gameId}`), {
    credentials: 'include'
  });
  return readJson(response);
}

export function onlineGameEventsUrl(gameId) {
  return apiUrl(`/api/online/games/${gameId}/events`);
}

export async function sendOnlineMove(gameId, move) {
  const response = await fetch(apiUrl(`/api/online/games/${gameId}/move`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(move)
  });
  return readJson(response);
}

export async function resignOnlineGame(gameId) {
  const response = await fetch(apiUrl(`/api/online/games/${gameId}/resign`), {
    method: 'POST',
    credentials: 'include'
  });
  return readJson(response);
}

export async function sendOnlineRematch(gameId, action) {
  const response = await fetch(apiUrl(`/api/online/games/${gameId}/rematch`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
  return readJson(response);
}
