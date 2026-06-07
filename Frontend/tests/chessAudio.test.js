import assert from 'node:assert/strict';
import test from 'node:test';
import { chessSoundEvent, chessSoundProfile } from '../src/game/chessAudio.js';

test('chess sound events prioritize mate, check, castle, capture, then move', () => {
  assert.equal(chessSoundEvent({ san: 'Qh7#', captured: 'p' }), 'checkmate');
  assert.equal(chessSoundEvent({ san: 'Bb5+' }), 'check');
  assert.equal(chessSoundEvent({ san: 'O-O', flags: 'k' }), 'castle');
  assert.equal(chessSoundEvent({ san: '0-0-0' }), 'castle');
  assert.equal(chessSoundEvent({ san: 'O-O+', flags: 'k' }), 'check');
  assert.equal(chessSoundEvent({ san: 'exd5', captured: 'p' }), 'capture');
  assert.equal(chessSoundEvent({ san: 'Nf3' }), 'move');
});

test('piece sets select distinct sound materials', () => {
  const theme = { lightSquare: '#f0ead2', darkSquare: '#8a5a37' };
  assert.equal(chessSoundProfile('wood3d', theme).type, 'wood');
  assert.equal(chessSoundProfile('metal', theme).type, 'metal');
  assert.equal(chessSoundProfile('glass', theme).type, 'crystal');
  assert.equal(chessSoundProfile('eightBit', theme).type, 'retro');
});
