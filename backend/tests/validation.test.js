import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePieceSet, sanitizeTheme, validateGameLogPayload, validateSessionPayload } from '../src/lib/validation.js';

test('session validation rejects short Firebase tokens', () => {
  assert.equal(validateSessionPayload({ idToken: 'short' }), 'Missing or invalid Firebase ID token');
  assert.equal(validateSessionPayload({ idToken: 'x'.repeat(24) }), null);
});

test('game log validation accepts only completed games', () => {
  const base = {
    gameId: 'game-1',
    userId: 'user-1',
    playerColor: 'w',
    aiElo: 1200,
    fen: 'valid-fen-value',
    savedAt: new Date().toISOString(), pgn: '1. e4', headers: {},
    moves: [{ ply: 1, moveNumber: 1, color: 'white', san: 'e4', lan: 'e2e4', from: 'e2', to: 'e4', piece: 'p' }]
  };
  assert.equal(validateGameLogPayload({ ...base, result: '*' }), 'Only completed games are logged');
  assert.equal(validateGameLogPayload({ ...base, result: '1-0' }), null);
  assert.equal(validateGameLogPayload({ ...base, result: '1-0', gameId: '../escape' }), 'Invalid game id');
  assert.equal(validateGameLogPayload({ ...base, result: '1-0', savedAt: 'bad' }), 'Invalid save date');
  for(const savedAt of ['../2026/10/22','2026/10/22','2026-10-22',null,0,'2026-10-22T12:00:00Z/../escape']) {
    assert.equal(validateGameLogPayload({...base,result:'1-0',savedAt}),'Invalid save date');
  }
  assert.equal(validateGameLogPayload({...base,result:'1-0',savedAt:'2026-10-22T00:30:00+07:00'}),null);
  assert.equal(validateGameLogPayload({ ...base, result: '1-0', moves: [null] }), 'Invalid move list');
});

test('theme and piece set sanitizers use supported values', () => {
  assert.deepEqual(sanitizeTheme({appearance:'light',pieceSet:'neo'}),{appearance:'light',pieceSet:'neo'});
  assert.deepEqual(sanitizeTheme({}),{});
  assert.equal(sanitizeTheme({accent:'red'}),null);
  assert.equal(sanitizePieceSet('royal'), 'royal');
  assert.equal(sanitizePieceSet('unknown'), 'classic');
  assert.equal(sanitizeTheme({
    accent: '#112233',
    lightSquare: '#eeeeee',
    darkSquare: '#333333',
    surface: '#222222',
    page: '#111111',
    pieceSet: 'minimal',
    appearance: 'dark'
  })?.pieceSet, 'minimal');
});
