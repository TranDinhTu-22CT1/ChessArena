/* global clearTimeout, console, process, setTimeout */
import { createClient } from '@supabase/supabase-js';

const pollMs = Math.max(100, Number(process.env.MATCHMAKING_OUTBOX_POLL_MS || 500));
const batchSize = Math.max(1, Math.min(200, Number(process.env.MATCHMAKING_OUTBOX_BATCH || 50)));

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

async function publishToSession(sessionId, payload) {
  const channel = supabase.channel(`matchmaking:session:${sessionId}`);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Realtime subscribe timeout')), 5000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve();
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timeout);
        reject(new Error(`Realtime channel ${status.toLowerCase()}`));
      }
    });
  });
  try {
    const status = await channel.send({
      type: 'broadcast',
      event: 'matched',
      payload
    });
    if (status !== 'ok') throw new Error(`Realtime send returned ${status}`);
  } finally {
    await supabase.removeChannel(channel);
  }
}

async function processBatch() {
  const now = new Date().toISOString();
  const { data: events = [], error } = await supabase
    .from('matchmaking_outbox')
    .select('id, event_type, aggregate_id, payload, attempts')
    .is('delivered_at', null)
    .lte('available_at', now)
    .order('id', { ascending: true })
    .limit(batchSize);
  if (error) throw error;

  for (const event of events) {
    try {
      const recipients = [
        event.payload?.white_session_id,
        event.payload?.black_session_id
      ].filter(Boolean);
      await Promise.all(recipients.map((sessionId) => publishToSession(sessionId, {
        game_id: event.payload?.game_id,
        event_type: event.event_type
      })));
      await supabase
        .from('matchmaking_outbox')
        .update({
          delivered_at: new Date().toISOString(),
          attempts: Number(event.attempts || 0) + 1,
          last_error: null
        })
        .eq('id', event.id)
        .is('delivered_at', null);
    } catch (publishError) {
      const attempts = Number(event.attempts || 0) + 1;
      const delaySeconds = Math.min(60, 2 ** Math.min(attempts, 6));
      await supabase
        .from('matchmaking_outbox')
        .update({
          attempts,
          available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
          last_error: String(publishError?.message || publishError).slice(0, 500)
        })
        .eq('id', event.id)
        .is('delivered_at', null);
    }
  }
  return events.length;
}

while (!stopping) {
  try {
    const processed = await processBatch();
    if (processed === 0) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  } catch (error) {
    console.error('[matchmaking-outbox] worker iteration failed', {
      message: error?.message
    });
    await new Promise((resolve) => setTimeout(resolve, Math.max(1000, pollMs)));
  }
}

console.log('[matchmaking-outbox] stopped');
