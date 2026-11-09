// Updates only the public owner/developer fields explicitly supplied by the operator.
import { createClient } from '@supabase/supabase-js';
const [name, flag] = process.argv.slice(2);
if (!name?.trim() || name.length > 120 || flag !== '--apply') {
  throw new Error('Usage: node --env-file=.env scripts/set-public-identity.mjs "Public name" --apply');
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const rows = ['ownerName', 'developerName'].map(setting_key => ({ setting_key, value: name.trim(), updated_at: new Date().toISOString() }));
const { error } = await db.from('website_settings').upsert(rows, { onConflict: 'setting_key' });
if (error) throw new Error(`Public identity update failed (${error.code || 'connection'}).`);
const { data, error: readError } = await db.from('website_settings').select('setting_key,value').in('setting_key', rows.map(row => row.setting_key));
if (readError || data?.length !== 2 || data.some(row => row.value !== name.trim())) throw new Error('Public identity verification failed.');
console.log(JSON.stringify(data));
