import test from 'node:test';
import assert from 'node:assert/strict';
import { signingSecret } from '../src/lib/signingSecrets.js';

test('signing keys never fall back to database/public credentials and must be independent', () => {
  const database='database-key-'.repeat(4), admin='admin-key-'.repeat(4), otp='otp-key-'.repeat(5);
  for(const name of ['ADMIN_SESSION_SECRET','OTP_SECRET']) {
    assert.throws(()=>signingSecret(name,{SUPABASE_SERVICE_ROLE_KEY:database}));
    assert.throws(()=>signingSecret(name,{[name]:'short'}));
    assert.throws(()=>signingSecret(name,{[name]:database,SUPABASE_SERVICE_ROLE_KEY:database}));
    assert.throws(()=>signingSecret(name,{ADMIN_SESSION_SECRET:admin,OTP_SECRET:admin}));
  }
  assert.equal(signingSecret('ADMIN_SESSION_SECRET',{ADMIN_SESSION_SECRET:admin,OTP_SECRET:otp}),admin);
  assert.equal(signingSecret('OTP_SECRET',{ADMIN_SESSION_SECRET:admin,OTP_SECRET:otp}),otp);
});
