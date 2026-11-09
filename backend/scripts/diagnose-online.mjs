// Read-only diagnostics: no names, credentials, session IDs or game contents.
import { getSupabaseAdmin } from '../src/lib/supabaseAdmin.js';
const db = getSupabaseAdmin();
const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const queries = [
  ['settings', db.from('website_settings').select('setting_key,value,updated_at').in('setting_key',['showMaintenanceBanner','maintenanceMessage'])],
  ['tickets', db.from('online_match_queue').select('id,user_id,rating,pool,mode,time_control,status,joined_at,last_seen,lease_expires_at,region_scope,cancel_reason').gte('joined_at',since).order('joined_at',{ascending:false}).limit(20)],
  ['events', db.from('matchmaking_events').select('event_type,rating,rating_window,created_at,metadata').gte('created_at',since).in('event_type',['api_find_completed','maintenance','reconciliation_v2']).order('created_at',{ascending:false}).limit(5)]
];
const aliases = new Map();
function alias(value) { if (!aliases.has(value)) aliases.set(value,`account-${aliases.size+1}`); return aliases.get(value); }
for (const [name, query] of queries) {
  const {data,error} = await query.abortSignal(AbortSignal.timeout(12000));
  console.log(name, JSON.stringify(error ? {code:error.code} : data?.map(row=>{
    const copy={...row};
    if(copy.user_id)copy.user_id=alias(copy.user_id);
    if(copy.metadata)copy.metadata={status:copy.metadata.status,duration_ms:copy.metadata.duration_ms};
    return copy;
  })));
}
console.log('directDatabaseConfigured',Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL));
