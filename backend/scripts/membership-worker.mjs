import { getSupabaseAdmin } from '../src/lib/supabaseAdmin.js';
import { reconcileMemberships } from '../src/lib/membershipService.js';

const supabase = getSupabaseAdmin();
if (!supabase) throw new Error('Supabase credentials are required.');
let stopped = false;
let timer;
const stop = () => { stopped = true; clearTimeout(timer); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
async function tick() {
  try { await reconcileMemberships(supabase); }
  catch (error) { console.error('[membership worker]', error.message); }
  if (!stopped) timer = setTimeout(tick, 60_000);
}
tick();
