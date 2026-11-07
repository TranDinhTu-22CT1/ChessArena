import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_GAME_STORAGE_PREFIX,
  LOCAL_GAME_STORAGE_KEY,
  loadAiGame,
  loadLocalGame,
  saveAiGame,
  saveLocalGame
} from '../src/game/gamePersistence.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data
  };
}

test('Bot and Coach snapshots restore only legal moves for the matching mode', () => {
  const storage = memoryStorage();
  assert.equal(saveAiGame(storage, {
    mode: 'coach', started: true, gameId: 'coach-1', moves: [{ from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' }],
    playerColor: 'w', aiElo: 1600, coachMode: 'basic', botOptions: { moveFeedback: true }
  }), true);
  const restored = loadAiGame(storage, 'coach');
  assert.deepEqual(restored.moves, [{ from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' }]);
  assert.equal(restored.gameId, 'coach-1');
  assert.equal(restored.botOptions.moveFeedback, true);
  assert.equal(loadAiGame(storage, 'bot'), null);

  storage.setItem(`${AI_GAME_STORAGE_PREFIX}bot`, JSON.stringify({
    version: 2, mode: 'bot', started: true, moves: [{ from: 'e2', to: 'e5' }]
  }));
  assert.equal(loadAiGame(storage, 'bot'), null);
});

test('Pass-and-play restores clocks and charges hidden/reload time to the active side', () => {
  const storage = memoryStorage();
  const savedAt = Date.parse('2026-09-22T10:00:00.000Z');
  assert.equal(saveLocalGame(storage, {
    started: true,
    moves: [{ from: 'e2', to: 'e4' }],
    clocks: { w: 590, b: 600 },
    names: { w: 'A', b: 'B' },
    timeControlId: '600+0'
  }), true);
  const raw = JSON.parse(storage.getItem(LOCAL_GAME_STORAGE_KEY));
  raw.savedAt = new Date(savedAt).toISOString();
  storage.setItem(LOCAL_GAME_STORAGE_KEY, JSON.stringify(raw));
  const restored = loadLocalGame(storage, savedAt + 20_000);
  assert.equal(Math.round(restored.clocks.w), 590);
  assert.equal(Math.round(restored.clocks.b), 580);
  assert.deepEqual(restored.moves, [{ from: 'e2', to: 'e4' }]);
  assert.deepEqual(restored.names, { w: 'A', b: 'B' });
});
