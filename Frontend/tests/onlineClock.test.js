import assert from 'node:assert/strict';
import test from 'node:test';
import { computeOnlineClocks, parseOnlineTimeControl } from '../src/game/onlineClock.js';

test('active side clock starts from the authoritative server snapshot immediately', () => {
  const snapshotAt = Date.parse('2026-09-21T10:00:00.000Z');
  const game = {
    status: 'active', turn: 'w', clocks: { w: 600_000, b: 600_000 },
    clockSnapshotAt: new Date(snapshotAt).toISOString()
  };
  assert.deepEqual(computeOnlineClocks(game, snapshotAt + 2_250), { w: 597_750, b: 600_000 });
});

test('turn changes stop the previous clock and run only the current clock', () => {
  const snapshotAt = Date.parse('2026-09-21T10:00:10.000Z');
  const game = {
    status: 'active', turn: 'b', clocks: { w: 591_000, b: 600_000 },
    clockSnapshotAt: new Date(snapshotAt).toISOString()
  };
  assert.deepEqual(computeOnlineClocks(game, snapshotAt + 3_000), { w: 591_000, b: 597_000 });
});

test('terminal clocks stay frozen and fallback reconstruction applies increment once per move', () => {
  const startedAt = '2026-09-21T10:00:00.000Z';
  const finished = { status: 'draw', turn: 'w', clocks: { w: 420_000, b: 430_000 }, clockSnapshotAt: startedAt };
  assert.deepEqual(computeOnlineClocks(finished, Date.parse(startedAt) + 50_000), { w: 420_000, b: 430_000 });
  const reconstructed = computeOnlineClocks({
    status: 'active', turn: 'w', timeControl: '60+2', startedAt,
    moves: [
      { color: 'w', createdAt: '2026-09-21T10:00:05.000Z' },
      { color: 'b', createdAt: '2026-09-21T10:00:12.000Z' }
    ]
  }, Date.parse('2026-09-21T10:00:15.000Z'));
  assert.deepEqual(reconstructed, { w: 54_000, b: 55_000 });
  assert.deepEqual(parseOnlineTimeControl('900+10'), { baseSeconds: 900, incrementSeconds: 10 });
});
