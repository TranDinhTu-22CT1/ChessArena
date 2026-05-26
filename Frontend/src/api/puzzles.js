import { apiUrl } from './config';

export async function requestPuzzle(options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl('/api/puzzles/next'), {
      method: 'POST',
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
