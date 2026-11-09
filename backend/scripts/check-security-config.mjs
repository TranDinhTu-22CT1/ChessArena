import { signingSecret } from '../src/lib/signingSecrets.js';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

let failed = false;
for (const name of ['ADMIN_SESSION_SECRET','OTP_SECRET']) {
  try { signingSecret(name); console.log(`PASS ${name}: independent signing key configured`); }
  catch { failed = true; console.log(`FAIL ${name}: missing, too short, or reused key`); }
}
for (const name of ['FRONTEND_URL','FRONTEND_URLS']) {
  const values = (process.env[name] || '').split(',').map(v=>v.trim()).filter(Boolean);
  const valid = values.every(value=>{try { const u=new URL(value);return ['http:','https:'].includes(u.protocol) && !value.includes('*') && !u.username && !u.password && u.pathname==='/' && !u.search && !u.hash; } catch { return false; }});
  if (!valid || (name==='FRONTEND_URL' && !values.length)) { failed=true;console.log(`FAIL ${name}: configure exact origins`); }
  else console.log(`PASS ${name}: exact origin configuration`);
}
console.log('UNVERIFIED: revocation of the previously exposed Supabase key must be confirmed in Dashboard; this script does not test or print keys.');
try {
  const frontend=parseEnv(await readFile(new URL('../../Frontend/.env',import.meta.url),'utf8'));
  let exposed=false;
  for(const [name,value] of Object.entries(frontend).filter(([name])=>name.startsWith('VITE_'))) {
    let privileged=value.startsWith('sb_secret_') || value===process.env.SUPABASE_SERVICE_ROLE_KEY;
    try { privileged ||= JSON.parse(Buffer.from(value.split('.')[1] || '', 'base64url').toString()).role==='service_role'; } catch { /* Not a JWT. */ }
    if(privileged) { exposed=true;failed=true;console.log(`FAIL ${name}: privileged key must not be exposed to the browser`); }
  }
  if(!exposed)console.log('PASS frontend configuration: no database privileged key in VITE variables');
} catch(error) {
  if(error.code==='ENOENT')console.log('SKIP frontend .env not present');
  else { failed=true;console.log('FAIL frontend configuration could not be checked'); }
}
if (process.env.ENABLE_TEST_ACCOUNTS==='true') console.log('LOCAL ONLY: ENABLE_TEST_ACCOUNTS is enabled; disable for public deployment.');
process.exitCode = failed ? 1 : 0;
