import test from 'node:test';
import assert from 'node:assert/strict';
import { pathForRoute, routeFromPath } from '../src/routes/routeConfig.js';

test('route aliases resolve to canonical destinations', () => {
  assert.equal(routeFromPath('/tickets'), 'supportTickets');
  assert.equal(routeFromPath('/online'), 'online');
  assert.equal(routeFromPath('/puzzles/battle'), 'puzzle-battle');
  assert.equal(routeFromPath('/signin'), 'login');
  assert.equal(routeFromPath('/signup'), 'register');
  assert.equal(routeFromPath('/forgot'), 'forgotPassword');
  assert.equal(routeFromPath('/academic'), 'academicNotice');
  assert.equal(routeFromPath('/play/local'), 'local');
});

test('known routes generate stable paths', () => {
  assert.equal(pathForRoute('supportTickets'), '/support/tickets');
  assert.equal(pathForRoute('puzzle-battle'), '/puzzles/battle');
  assert.equal(pathForRoute('login'), '/login');
  assert.equal(pathForRoute('register'), '/register');
  assert.equal(pathForRoute('forgotPassword'), '/forgot-password');
  assert.equal(pathForRoute('academicNotice'), '/academic-notice');
  assert.equal(pathForRoute('local'), '/play/local');
});
