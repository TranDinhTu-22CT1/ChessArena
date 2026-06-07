import { apiUrl } from './config';

export async function requestPuzzle(options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl('/api/puzzles/next'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
      signal: controller.signal
    });
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'Could not load puzzle.');
      error.exhausted = Boolean(data.exhausted);
      throw error;
    }

    return data.puzzle;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function checkPuzzleMove(puzzleId, move, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl('/api/puzzles/check'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puzzleId, move }),
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not check puzzle move.');
    return data;
  } finally {
    window.clearTimeout(timeout);
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

export async function savePuzzleProgress(progress) {
  const response = await fetch(apiUrl('/api/puzzles/session'), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(progress)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not save puzzle progress.');
  return data;
}

export async function joinPuzzleBattle() {
  const response = await fetch(apiUrl('/api/puzzles/battle'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'join' })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not join Puzzle Battle.');
  return data;
}

export async function fetchPuzzleBattle(battleId = '') {
  const params = battleId ? `?battleId=${encodeURIComponent(battleId)}` : '';
  const response = await fetch(apiUrl(`/api/puzzles/battle${params}`), { credentials: 'include' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not load Puzzle Battle.');
  return data;
}

export async function answerPuzzleBattle(battleId, move) {
  const response = await fetch(apiUrl('/api/puzzles/battle'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'answer', battleId, move })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not submit battle move.');
  return data;
}

export async function cancelPuzzleBattle(battleId) {
  const response = await fetch(apiUrl('/api/puzzles/battle'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel', battleId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not cancel battle.');
  return data;
}
