import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseNewestGameSnapshot, mergeOnlineChatMessages } from '../src/game/realtimeState.js';

test('chat realtime merge keeps ordering and removes API/SSE duplicates', () => {
  const first = { id: 1, body: 'A', createdAt: '2026-09-21T10:00:00Z' };
  const second = { id: 2, body: 'B', createdAt: '2026-09-21T10:00:01Z' };
  assert.deepEqual(mergeOnlineChatMessages([second], [first, second]), [first, second]);
});

test('older game events cannot overwrite a newer authoritative snapshot', () => {
  const current = { id: 'g', stateVersion: 8, updatedAt: '2026-09-21T10:00:08Z', moves: [{}, {}], turn: 'w' };
  const stale = { id: 'g', stateVersion: 7, updatedAt: '2026-09-21T10:00:09Z', moves: [{}, {}, {}], turn: 'b' };
  const next = { id: 'g', stateVersion: 9, updatedAt: '2026-09-21T10:00:07Z', moves: [{}, {}, {}], turn: 'b' };
  assert.equal(chooseNewestGameSnapshot(current, stale), current);
  assert.equal(chooseNewestGameSnapshot(current, next), next);
});
