import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('moderation polling is throttled and pauses with the page lifecycle', () => {
  assert.match(appSource, /MODERATION_POLL_INTERVAL_MS\s*=\s*45_000/);
  assert.doesNotMatch(appSource, /setInterval\(checkModeration/);
  assert.match(appSource, /document\.hidden\s*\|\|\s*!navigator\.onLine/);
  assert.match(appSource, /addEventListener\('visibilitychange', checkWhenActive\)/);
  assert.match(appSource, /addEventListener\('online', checkWhenActive\)/);
});
