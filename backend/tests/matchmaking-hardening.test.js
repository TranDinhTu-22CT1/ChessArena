import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';

const workspaceRoot = new URL('../../', import.meta.url);

async function workspaceFile(path) {
  return readFile(new URL(path, workspaceRoot), 'utf8');
}

test('race migration wraps the deployed matcher without source-text replacement', async () => {
  const migration = await workspaceFile(
    'backend/supabase/migrations/20260606_matchmaking_race_fix.sql'
  );

  assert.doesNotMatch(migration, /pg_get_functiondef|replace\s*\(\s*v_definition/i);
  assert.match(migration, /rename to quick_match_find_game_core/i);
  assert.match(migration, /cancel_reason = 'concurrent_match_won'/i);
  assert.match(migration, /'race_recovered', true/i);
});

test('canonical matcher isolates trust pools and avoids stale-table cleanup in the hot path', async () => {
  const schema = await workspaceFile('backend/supabase/schema.sql');
  const matcherStart = schema.indexOf('create or replace function public.quick_match_find_game(');
  const matcherEnd = schema.indexOf(
    'revoke all on function public.quick_match_find_game(',
    matcherStart
  );
  const matcher = schema.slice(matcherStart, matcherEnd);

  assert.ok(matcherStart >= 0 && matcherEnd > matcherStart);
  assert.match(matcher, /and q\.pool = v_pool/i);
  assert.doesNotMatch(
    matcher,
    /set status = 'stale'[\s\S]*last_seen < v_now - interval '30 seconds'/i
  );
});

test('queue heartbeat interval is no longer one second', async () => {
  const onlinePage = await workspaceFile('Frontend/src/routes/use/OnlinePage.jsx');
  assert.match(onlinePage, /const intervalMs = queueing \? 5000/);
});

test('heartbeat falls back cleanly when matchmaking v2 columns are not deployed', async () => {
  const heartbeat = await workspaceFile(
    'backend/src/app/api/online/heartbeat/route.js'
  );

  assert.match(heartbeat, /isMissingMatchmakingV2Schema/);
  assert.match(heartbeat, /message\.includes\('region_scope'\)/);
  assert.match(
    heartbeat,
    /\.select\('id, user_id, time_control, mode, rating, rating_range_preference, region, session_id'\)/
  );
  assert.match(heartbeat, /ticket\.region_scope \|\| ticket\.region \|\| 'global'/);
});

test('a stale pre-join heartbeat cannot cancel a newly-created queue ticket', async () => {
  const heartbeat = await workspaceFile(
    'backend/src/app/api/online/heartbeat/route.js'
  );
  const onlinePage = await workspaceFile('Frontend/src/routes/use/OnlinePage.jsx');

  assert.doesNotMatch(heartbeat, /left_queue_view/);
  assert.match(onlinePage, /queueing && !data\.queueTicketId/);
});

test('matchmaking v2 has leases, session ownership, region expansion, and an outbox', async () => {
  const migration = await workspaceFile(
    'backend/supabase/migrations/20260606_matchmaking_v2.sql'
  );

  assert.match(migration, /lease_expires_at timestamptz/i);
  assert.match(migration, /generation bigint/i);
  assert.match(migration, /quick_match_find_game_v2/i);
  assert.match(migration, /quick_match_heartbeat_v2/i);
  assert.match(migration, /session_id = left\(p_session_id, 120\)/i);
  assert.match(migration, /matchmaking_regions_compatible/i);
  assert.match(migration, /matchmaking_match_key/i);
  assert.match(migration, /matchmaking_outbox/i);
  assert.match(migration, /commit_online_move_v2/i);
  assert.match(migration, /reconcile_matchmaking_v2/i);
});
