import { apiUrl } from './config';
import { apiFetch } from './request';

function attemptRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // getRandomValues is also available on HTTP LAN origins used for local demos.
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export async function requestPuzzle(options = {}, timeoutMs = 15000) {
  const { signal, ...payload } = options;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl('/api/puzzles/next'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: attemptRequestId(), ...payload }),
      signal: controller.signal
    });
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'Could not load puzzle.');
      error.exhausted = Boolean(data.exhausted);
      error.data = data;
      throw error;
    }

    return data.puzzle;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function checkPuzzleMove(puzzleId, move, options = {}, timeoutMs = 20000) {
  const { signal, playedMoves = [], attemptId, version } = options;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl('/api/puzzles/check'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puzzleId, move, playedMoves, attemptId, version }),
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not check puzzle move.');
    return data;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function recordPuzzleSession(payload, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl('/api/puzzles/session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save puzzle session.');
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchPuzzleProgress() {
  const response = await fetch(apiUrl('/api/puzzles/session'), { credentials: 'include' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load puzzle progress.');
  return data;
}

export async function joinPuzzleBattle() {
  const response = await apiFetch(apiUrl('/api/puzzles/battle'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'join' })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not join Puzzle Battle.');
  return data;
}

export async function fetchPuzzleBattle(battleId = '', signal) {
  const params = battleId ? `?battleId=${encodeURIComponent(battleId)}` : '';
  const response = await apiFetch(apiUrl(`/api/puzzles/battle${params}`), { credentials: 'include', signal, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load Puzzle Battle.');
  return data;
}

export async function answerPuzzleBattle(battleId, move, index, puzzleId) {
  const response = await apiFetch(apiUrl('/api/puzzles/battle'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'answer', battleId, move, index, puzzleId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not submit battle move.');
  return data;
}

export async function cancelPuzzleBattle(battleId) {
  const response = await apiFetch(apiUrl('/api/puzzles/battle'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel', battleId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not cancel battle.');
  return data;
}
