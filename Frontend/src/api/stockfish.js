import { apiUrl } from './config';
import { apiFetch } from './request';

export async function requestStockfishMove(fen, elo, options = {}, timeoutMs = 20000) {
  const { signal, ...parameters } = options;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await apiFetch(apiUrl('/api/analysis/move'), {
      timeoutMs,
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, elo, ...parameters }),
      signal: controller.signal
    });
    const data = await response.json();

    if (!response.ok || !data?.move) {
      throw new Error(data?.error || 'Chưa lấy được nước đi. Hãy thử lại.');
    }

    return data.move;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
