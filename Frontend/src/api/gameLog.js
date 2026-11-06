import { apiUrl } from './config.js';

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel, { once: true });
  });
}

export async function saveGameLog(log, { signal, retryDelays = [0, 1500, 4000] } = {}) {
  const body = JSON.stringify(log);
  let lastError;
  for (const delay of retryDelays) {
    signal?.throwIfAborted();
    if (delay) await pause(delay, signal);
    try {
      const timeout = globalThis.AbortSignal.timeout(12_000);
      const response = await fetch(apiUrl('/api/game/log'), {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body,
        signal: signal ? globalThis.AbortSignal.any([signal, timeout]) : timeout
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.ok === true && !data.degraded) return data;
      const error = new Error(data.error || 'Ván đấu chưa được lưu đầy đủ.');
      error.retryable = response.status >= 500 || response.status === 429 || (response.ok && Boolean(data.degraded));
      throw error;
    } catch (error) {
      signal?.throwIfAborted();
      if (error.retryable === false) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('Không lưu được ván đấu.');
}
