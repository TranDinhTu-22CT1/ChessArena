import assert from 'node:assert/strict';
import test from 'node:test';
import { apiFetch } from '../src/api/request.js';
import { registerSessionRecovery, shouldRecoverSession } from '../src/api/sessionRecovery.js';

test('401 requests refresh the backend session once and retry the original request', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  let recoveries = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response('{}', { status: requests === 1 ? 401 : 200, headers: { 'content-type': 'application/json' } });
  };
  const unregister = registerSessionRecovery(async () => {
    recoveries += 1;
    return true;
  });
  try {
    const response = await apiFetch('/api/online/matchmaking/find', { method: 'POST', body: '{}' });
    assert.equal(response.status, 200);
    assert.equal(requests, 2);
    assert.equal(recoveries, 1);
  } finally {
    unregister();
    globalThis.fetch = originalFetch;
  }
});

test('auth endpoints and non-401 responses never start recursive recovery', () => {
  assert.equal(shouldRecoverSession('/api/auth/session', new Response(null, { status: 401 })), false);
  assert.equal(shouldRecoverSession('/api/auth/me', new Response(null, { status: 401 })), false);
  assert.equal(shouldRecoverSession('/api/online/heartbeat', new Response(null, { status: 503 })), false);
  assert.equal(shouldRecoverSession('/api/online/heartbeat', new Response(null, { status: 401 })), true);
});
