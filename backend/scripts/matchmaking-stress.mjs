/* global console, process, setTimeout */
import { createClient } from '@supabase/supabase-js';

const requestedUsers = Math.max(2, Math.min(1000, Number(process.env.STRESS_USERS || 10)));
const userCount = requestedUsers % 2 === 0 ? requestedUsers : requestedUsers - 1;
const concurrency = Math.max(1, Math.min(100, Number(process.env.STRESS_CONCURRENCY || 25)));
const timeoutMs = Math.max(5000, Number(process.env.STRESS_TIMEOUT_MS || 30000));
const runId = `stress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

if (process.env.MATCHMAKING_STRESS_CONFIRM !== 'YES') {
  console.error('Set MATCHMAKING_STRESS_CONFIRM=YES to create temporary database users and games.');
  process.exit(2);
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(2);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function parallel(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

async function createUsers() {
  const rows = Array.from({ length: userCount }, (_, index) => ({
    username: `${runId}-${index}`,
    display_name: `Stress ${index}`,
    firebase_uid: `${runId}-firebase-${index}`,
    email: `${runId}-${index}@example.invalid`,
    email_verified: true
  }));
  const { data, error } = await supabase
    .from('users')
    .insert(rows)
    .select('id, display_name, firebase_uid');
  if (error) throw error;
  return data;
}

function findParams(user, index, sessionSuffix = 'match') {
  return {
    p_user_id: user.id,
    p_time_control: '300+0',
    p_mode: 'blitz',
    p_rating: 400 + (index % 8) * 10,
    p_client_id: `${runId}-client-${index}`,
    p_session_id: `${runId}-${sessionSuffix}-${index}`,
    p_region: 'sea',
    p_rating_range_preference: 500,
    p_idempotency_key: `${runId}-${sessionSuffix}-${index}`
  };
}

async function cancelAndRequeue(users) {
  const first = await parallel(users, (user, index) => (
    supabase.rpc('quick_match_find_game_v2', findParams(user, index, 'cancel'))
  ));
  await parallel(first, async (result, index) => {
    const ticketId = result.data?.queue_ticket_id;
    if (!ticketId || result.data?.status !== 'waiting') return;
    const { error } = await supabase.rpc('quick_match_cancel_v2', {
      p_user_id: users[index].id,
      p_ticket_id: ticketId,
      p_session_id: `${runId}-cancel-${index}`,
      p_reason: 'stress_cancel'
    });
    if (error) throw error;
  });
}

async function matchUsers(users) {
  const states = new Map();
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs && states.size < users.length) {
    await parallel(users, async (user, index) => {
      if (states.has(user.id)) return;
      const { data, error } = await supabase.rpc(
        'quick_match_find_game_v2',
        findParams(user, index)
      );
      if (error) {
        if (error.code === '40001') return;
        throw error;
      }
      if (data?.status === 'matched') {
        states.set(user.id, {
          gameId: data.game_id,
          matchedAtMs: Date.now() - startedAt
        });
      }
    });
    if (states.size < users.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  return { states, durationMs: Date.now() - startedAt };
}

async function verify(users, states) {
  const ids = users.map((user) => user.id);
  const gameIds = [...new Set([...states.values()].map((state) => state.gameId))];
  const [{ data: games = [] }, { data: tickets = [] }, { data: locks = [] }, { data: issues = [] }] = await Promise.all([
    supabase.from('online_games').select('id, white_user_id, black_user_id, matchmaking_match_key').in('id', gameIds),
    supabase.from('online_match_queue').select('id, user_id, status, matched_game_id').in('user_id', ids),
    supabase.from('user_active_locks').select('user_id, game_id').in('user_id', ids),
    supabase.from('matchmaking_integrity_issues').select('*')
  ]);
  const playerGameCounts = new Map();
  for (const game of games) {
    for (const userId of [game.white_user_id, game.black_user_id]) {
      playerGameCounts.set(userId, (playerGameCounts.get(userId) || 0) + 1);
    }
  }
  const duplicatePlayers = [...playerGameCounts].filter(([, count]) => count > 1);
  const duplicateMatchKeys = games.length - new Set(games.map((game) => game.matchmaking_match_key)).size;
  const activeTickets = tickets.filter((ticket) => ['waiting', 'claimed'].includes(ticket.status));
  const relevantIssues = issues.filter((issue) => ids.includes(issue.user_id) || gameIds.includes(issue.game_id));

  return {
    games: games.length,
    matchedUsers: states.size,
    locks: locks.length,
    activeTickets: activeTickets.length,
    duplicatePlayers: duplicatePlayers.length,
    duplicateMatchKeys,
    integrityIssues: relevantIssues.length
  };
}

async function cleanup(users, states) {
  const userIds = users.map((user) => user.id);
  const gameIds = [...new Set([...states.values()].map((state) => state.gameId))];
  if (gameIds.length) {
    await supabase.from('online_games').delete().in('id', gameIds);
  }
  await supabase.from('online_match_queue').delete().in('user_id', userIds);
  await supabase.from('users').delete().in('id', userIds);
}

let users = [];
let states = new Map();
try {
  users = await createUsers();
  await cancelAndRequeue(users);
  const matched = await matchUsers(users);
  states = matched.states;
  const verification = await verify(users, states);
  const latencies = [...states.values()].map((state) => state.matchedAtMs).sort((a, b) => a - b);
  const percentile = (ratio) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * ratio))] || 0;
  const result = {
    runId,
    requestedUsers: userCount,
    durationMs: matched.durationMs,
    p50MatchedMs: percentile(0.50),
    p95MatchedMs: percentile(0.95),
    p99MatchedMs: percentile(0.99),
    ...verification,
    passed: verification.matchedUsers === userCount
      && verification.games === Math.floor(userCount / 2)
      && verification.duplicatePlayers === 0
      && verification.duplicateMatchKeys === 0
      && verification.activeTickets === 0
      && verification.integrityIssues === 0
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} finally {
  if (users.length) await cleanup(users, states);
}
