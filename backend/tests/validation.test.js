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
    moves: [{ san: 'e4' }]
  };
  assert.equal(validateGameLogPayload({ ...base, result: '*' }), 'Only completed games are logged');
  assert.equal(validateGameLogPayload({ ...base, result: '1-0' }), null);
});

test('theme and piece set sanitizers use supported values', () => {
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
