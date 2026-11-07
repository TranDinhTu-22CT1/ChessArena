import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { analyzeReviewBatch, classifyReviewError } from '../src/lib/reviewAnalysis.js';

function positionsFrom(sans) {
  const board = new Chess();
  return sans.map((san, index) => {
    const fen = board.fen();
    const move = board.move(san);
    return { ply: index + 1, fen, move: move.lan, priorMoves: [], variant: 'standard' };
  });
}

function engineResult(move) {
  const line = { bestMove: move, score: 24, mate: null, depth: 14, pv: [move], variations: [] };
  return { best: line, played: line, engine: 'test-stockfish', elapsedMs: 3 };
}

test('review batch validates and analyzes every legal ply in order', async () => {
  const positions = positionsFrom(['e4', 'e5', 'Nf3', 'Nc6']);
  const calls = [];
  const results = await analyzeReviewBatch(positions, {
    retries: 0,
    analyze: async (fen, move) => { calls.push([fen, move]); return engineResult(move); }
  });
  assert.deepEqual(calls.map((entry) => entry[1]), positions.map((position) => position.move));
  assert.deepEqual(results.map((result) => result.ply), [1, 2, 3, 4]);
  assert.ok(results.every((result) => ['book', 'best'].includes(result.tone) && result.engine === 'test-stockfish'));
});

test('review batch retries one transient engine failure without duplicating completed plies', async () => {
  const positions = positionsFrom(['d4', 'd5', 'c4']);
  const attempts = new Map();
  const results = await analyzeReviewBatch(positions, {
    analyze: async (_fen, move) => {
      attempts.set(move, (attempts.get(move) || 0) + 1);
      if (move === positions[1].move && attempts.get(move) === 1) throw new Error('engine exited unexpectedly');
      return engineResult(move);
    }
  });
  assert.equal(results.length, 3);
  assert.equal(attempts.get(positions[0].move), 1);
  assert.equal(attempts.get(positions[1].move), 2);
  assert.equal(attempts.get(positions[2].move), 1);
});

test('one persistent engine failure is isolated and later legal plies still complete', async () => {
  const positions = positionsFrom(['e4', 'e5', 'Nf3']);
  const results = await analyzeReviewBatch(positions, {
    retries: 0,
    analyze: async (_fen, move) => {
      if (move === positions[1].move) throw new Error('analysis failed for one position');
      return engineResult(move);
    }
  });
  assert.equal(results.length, 3);
  assert.equal(results[0].analysisError, undefined);
  assert.equal(results[1].analysisError, true);
  assert.equal(results[1].errorCode, 'ANALYSIS_FAILED');
  assert.equal(results[2].analysisError, undefined);
});

test('review errors are classified and invalid positions never reach the engine', async () => {
  let calls = 0;
  await assert.rejects(
    analyzeReviewBatch([{ ply: 1, fen: new Chess().fen(), move: 'e2e5' }], {
      analyze: async () => { calls += 1; return engineResult('e2e5'); }
    }),
    (error) => error.status === 400
  );
  assert.equal(calls, 0);
  assert.equal(classifyReviewError(new DOMException('aborted', 'AbortError')), 'ENGINE_TIMEOUT');
  assert.equal(classifyReviewError(new Error('worker terminated')), 'ENGINE_TERMINATED');
});
