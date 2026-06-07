import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFirebaseUserProviders,
  getPasswordResetEligibility
} from '../src/lib/firebaseAdmin.js';

function firebaseUser(...providerIds) {
  return {
    providerData: providerIds.map((providerId) => ({ providerId }))
  };
}

test('password reset is allowed for password accounts', () => {
  assert.deepEqual(
    getPasswordResetEligibility(firebaseUser('password')),
    { allowed: true, provider: 'password', providers: ['password'] }
  );
});

test('password reset is blocked for social-only accounts', () => {
  assert.deepEqual(
    getPasswordResetEligibility(firebaseUser('google.com')),
    { allowed: false, provider: 'google.com', providers: ['google.com'] }
  );
  assert.deepEqual(
    getPasswordResetEligibility(firebaseUser('github.com')),
    { allowed: false, provider: 'github.com', providers: ['github.com'] }
  );
});

test('linked accounts can reset when the password provider exists', () => {
  const user = firebaseUser('google.com', 'password', 'google.com');

  assert.deepEqual(getFirebaseUserProviders(user), ['google.com', 'password']);
  assert.deepEqual(
    getPasswordResetEligibility(user),
    {
      allowed: true,
      provider: 'password',
      providers: ['google.com', 'password']
    }
  );
});

test('accounts without a known provider cannot reset a password', () => {
  assert.deepEqual(
    getPasswordResetEligibility({ providerData: [] }),
    { allowed: false, provider: null, providers: [] }
  );
});
