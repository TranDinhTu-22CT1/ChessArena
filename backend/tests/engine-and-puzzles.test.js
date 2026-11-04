import test from 'node:test';
import assert from 'node:assert/strict';
import { botStrength, engineStrength } from '../src/lib/enginePolicy.js';
import { isUuid } from '../src/lib/puzzleUtils.js';
import { parseStockfishScore } from '../src/lib/stockfishEngine.js';

test('hint analysis always uses maximum Stockfish strength', () => {
  assert.deepEqual(
    engineStrength(1320, true),
    { skillLevel: 20, elo: null, mode: 'analysis', movetime: 1800, depth: 24 }
  );
  assert.deepEqual(
    engineStrength(3190, true),
    { skillLevel: 20, elo: null, mode: 'analysis', movetime: 1800, depth: 24 }
  );
});

test('bot moves still honor configured playing strength', () => {
  for (const elo of [1320, 1600, 1777, 2000, 2400, 2800, 3190]) assert.equal(botStrength(elo).elo, elo);
  assert.equal(botStrength(250).rating, 250);
  assert.ok(botStrength(250).oversight > botStrength(800).oversight);
  assert.ok(botStrength(800).oversight > botStrength(1200).oversight);
  assert.equal(botStrength(1320).oversight, 0);
});

test('personal puzzle exclusions accept UUIDs only', () => {
  assert.equal(isUuid('941aed79-5cac-43a4-b9d1-019d87b73130'), true);
  assert.equal(isUuid('mg-fools-mate-black'), false);
  assert.equal(isUuid(''), false);
});

test('Stockfish scores preserve side-to-move evaluation', () => {
  assert.equal(parseStockfishScore('info depth 18 score cp 42 nodes 10'), 42);
  assert.equal(parseStockfishScore('info depth 18 score cp -87 nodes 10'), -87);
  assert.equal(parseStockfishScore('info depth 18 score mate 1 nodes 10'), 99999);
  assert.equal(parseStockfishScore('info depth 18 score mate -2 nodes 10'), -99998);
});
