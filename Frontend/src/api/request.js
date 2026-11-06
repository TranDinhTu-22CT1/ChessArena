import { recoverSession, shouldRecoverSession } from './sessionRecovery.js';

// Bound network waits so disconnected backends cannot leave controls busy forever.
export async function apiFetch(url, options = {}) {
  const { timeoutMs = 12_000, ...fetchOptions } = options;
  const timeout = globalThis.AbortSignal.timeout(timeoutMs);
  const requestOptions = { ...fetchOptions, signal: options.signal
    ? globalThis.AbortSignal.any([options.signal, timeout]) : timeout };
  let response = await fetch(url, requestOptions);
  if (shouldRecoverSession(url, response) && await recoverSession()) {
    requestOptions.signal.throwIfAborted();
    response = await fetch(url, requestOptions);
  }
  return response;
}
