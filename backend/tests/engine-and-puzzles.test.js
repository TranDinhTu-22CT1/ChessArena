import test from 'node:test';
import assert from 'node:assert/strict';
import { botStrength, engineStrength } from '../src/lib/enginePolicy.js';
import { isUuid } from '../src/lib/puzzleUtils.js';
import { parseStockfishScore } from '../src/lib/stockfishEngine.js';

test('hint analysis always uses maximum Stockfish strength', () => {
  assert.deepEqual(
    engineStrength(1320, true),
    { skillLevel: 20, elo: null, movetime: 2400 }
  );
  assert.deepEqual(
    engineStrength(3190, true),
    { skillLevel: 20, elo: null, movetime: 2400 }
  );
});

test('bot moves still honor configured playing strength', () => {
  assert.equal(botStrength(1320).skillLevel, 4);
  assert.equal(botStrength(2000).skillLevel, 14);
  assert.equal(botStrength(3190).skillLevel, 20);
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
