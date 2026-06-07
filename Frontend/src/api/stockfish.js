import { apiUrl } from './config';

export async function requestStockfishMove(fen, elo, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(apiUrl('/api/analysis/move'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, elo, ...options }),
    signal: controller.signal
  }).finally(() => window.clearTimeout(timeout));
  const data = await response.json();

  if (!response.ok || !data?.move) {
    throw new Error(data?.error || 'Stockfish move request failed.');
  }

  return data.move;
}
