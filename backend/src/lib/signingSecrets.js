// Signing secrets must not inherit database access credentials. A database key
// rotation must never silently change admin signatures or OTP verification.
export function signingSecret(name, env = process.env) {
  if (!['ADMIN_SESSION_SECRET', 'OTP_SECRET'].includes(name)) throw new Error('Unknown signing secret.');
  const value = env[name];
  if (typeof value !== 'string' || value.trim().length < 32 || /^(replace|your-)/i.test(value)) throw new Error(`${name} must contain at least 32 random characters.`);
  if (value === env.SUPABASE_SERVICE_ROLE_KEY || value === env.FIREBASE_PROJECT_ID
      || (env.ADMIN_SESSION_SECRET && env.ADMIN_SESSION_SECRET === env.OTP_SECRET)) {
    throw new Error(`${name} must be an independent signing secret.`);
  }
  return value;
}
