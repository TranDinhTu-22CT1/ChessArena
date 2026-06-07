/* global console, process, setTimeout */
import { createClient } from '@supabase/supabase-js';

const pollMs = Math.max(25, Number(process.env.MATCHMAKING_WORKER_POLL_MS || 100));
const batchSize = Math.max(2, Math.min(200, Number(process.env.MATCHMAKING_WORKER_BATCH || 50)));
const workerConcurrency = Math.max(1, Math.min(50, Number(process.env.MATCHMAKING_WORKER_CONCURRENCY || 10)));
const workerShards = String(process.env.MATCHMAKING_WORKER_SHARDS || '')
  .split(',')
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isInteger(value) && value >= 0 && value < 64);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(2);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

async function parallel(items, worker) {
  let cursor = 0;
  await Promise.all(Array.from(
    { length: Math.min(workerConcurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index]);
      }
    }
  ));
}

async function runIteration() {
  let query = supabase
    .from('online_match_queue')
    .select('id, user_id, time_control, mode, rating, client_id, session_id, region_scope, rating_range_preference')
    .eq('status', 'waiting')
    .gt('lease_expires_at', new Date().toISOString())
    .order('joined_at', { ascending: true })
    .limit(batchSize);
  if (workerShards.length) query = query.in('queue_shard', workerShards);
  const { data: tickets = [], error } = await query;
  if (error) throw error;

  await parallel(tickets, async (ticket) => {
    const { error: matchError } = await supabase.rpc('quick_match_find_game_v2', {
      p_user_id: ticket.user_id,
      p_time_control: ticket.time_control,
      p_mode: ticket.mode,
      p_rating: ticket.rating,
      p_client_id: ticket.client_id,
      p_session_id: ticket.session_id,
      p_region: ticket.region_scope,
      p_rating_range_preference: ticket.rating_range_preference,
      p_idempotency_key: null,
      p_renew_lease: false
    });
    if (matchError && !['40001', '23505'].includes(matchError.code)) {
      console.error('[matchmaking-worker] ticket failed', {
        ticketId: ticket.id,
        code: matchError.code,
        message: matchError.message
      });
    }
  });
  return tickets.length;
}

while (!stopping) {
  try {
    const processed = await runIteration();
    await new Promise((resolve) => setTimeout(
      resolve,
      processed === 0 ? Math.max(250, pollMs) : pollMs
    ));
  } catch (error) {
    console.error('[matchmaking-worker] iteration failed', { message: error?.message });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

console.log('[matchmaking-worker] stopped');
