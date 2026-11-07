import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverFriends, friendRating } from '../src/api/friendDiscovery.js';

const now = Date.parse('2026-10-15T12:00:00Z');
const viewer = { ratings: { rapid: { rating: 600, gamesPlayed: 2 }, blitz: { rating: 900, gamesPlayed: 5 } } };
const friend = (id, rating, { online = false, status = 'online', ago = 1000, blitz = 400 } = {}) => ({ id, user: {
  id, displayName: id, ratings: rating === null ? {} : { rapid: { rating, gamesPlayed: 2 }, blitz: { rating: blitz, gamesPlayed: 2 } },
  presence: { online, status, lastSeen: new Date(now - ago).toISOString() }, lastActiveAt: new Date(now - ago).toISOString()
} });
const ids = rows => rows.map(row => row.id);

test('recommended friends prefer availability then mode-specific rating, without mutating input', () => {
  const rows = [friend('offline', 600), friend('busy', 600, { online: true, status: 'playing' }), friend('far', 900, { online: true }), friend('near', 620, { online: true })];
  assert.deepEqual(ids(discoverFriends(rows, viewer, {}, now)), ['near', 'far', 'busy', 'offline']);
  assert.equal(rows[0].id, 'offline');
  assert.deepEqual(ids(discoverFriends(rows, viewer, { sort: 'rating' }, now)), ['busy', 'offline', 'near', 'far']);
});
test('filter compares only chosen mode and excludes unranked users from a numeric gap', () => {
  const rows = [friend('rapid', 600), friend('blitz', 1200, { blitz: 920 }), friend('new', null)];
  assert.deepEqual(ids(discoverFriends(rows, viewer, { mode: 'blitz', gap: '100' }, now)), ['blitz']);
  assert.deepEqual(ids(discoverFriends(rows, viewer, { mode: 'rapid', gap: '100' }, now)), ['rapid']);
  assert.equal(friendRating({ ratings: { rapid: { rating: 400, gamesPlayed: 0 } } }, 'rapid'), null);
});
test('online expires; recent activity and search filters compose before pagination', () => {
  const rows = [friend('Trần Đình Tú', 650, { online: true }), friend('stale', 600, { online: true, ago: 46000 }), friend('old', 600, { ago: 8 * 86400000 })];
  assert.deepEqual(ids(discoverFriends(rows, viewer, { status: 'online' }, now)), ['Trần Đình Tú']);
  assert.deepEqual(ids(discoverFriends(rows, viewer, { query: 'tran dinh', status: 'day', gap: '100' }, now)), ['Trần Đình Tú']);
  assert.equal(discoverFriends(rows, viewer, { status: 'week' }, now).length, 2);
  const many = Array.from({ length: 25 }, (_, i) => friend(String(i), 900 - i * 10));
  assert.equal(discoverFriends(many, viewer, { sort: 'rating' }, now)[0].id, '24');
});
