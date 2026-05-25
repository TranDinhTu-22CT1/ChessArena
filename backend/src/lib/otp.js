import { createHash, randomInt } from 'node:crypto';
import { getSupabaseAdmin } from './supabaseAdmin';

const fallbackOtps = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function isMissingOtpTable(error) {
  return error?.code === 'PGRST205'
    || error?.code === '42P01'
    || String(error?.message || '').includes("public.auth_otps");
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function otpSecret() {
  return process.env.OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.FIREBASE_PROJECT_ID || 'local-otp-secret';
}

function hashOtp(email, purpose, otp) {
  return createHash('sha256')
    .update(`${normalizeEmail(email)}:${purpose}:${otp}:${otpSecret()}`)
    .digest('hex');
}

export function createOtpCode() {
  return String(randomInt(100000, 1000000));
}

export function otpExpiry() {
  return new Date(Date.now() + OTP_TTL_MS);
}

function storeFallbackOtp({ email, purpose, otpHash, expiresAt }) {
  fallbackOtps.set(`${purpose}:${email}`, {
    email,
    purpose,
    otpHash,
    attempts: 0,
    expiresAt,
    consumedAt: null
  });
}

function verifyFallbackOtp({ email, purpose, expectedHash }) {
  const record = fallbackOtps.get(`${purpose}:${email}`);

  if (!record || record.consumedAt || record.expiresAt <= new Date()) {
    return { ok: false, error: 'Mã OTP đã hết hạn hoặc không tồn tại.' };
  }

  record.attempts += 1;

  if (record.attempts > MAX_ATTEMPTS) {
    return { ok: false, error: 'Bạn đã nhập sai OTP quá nhiều lần.' };
  }

  if (record.otpHash !== expectedHash) {
    return { ok: false, error: 'Mã OTP không chính xác.' };
  }

  return { ok: true };
}

export async function storeOtp({ email, purpose, otp }) {
  const normalizedEmail = normalizeEmail(email);
  const expiresAt = otpExpiry();
  const otpHash = hashOtp(normalizedEmail, purpose, otp);
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    storeFallbackOtp({ email: normalizedEmail, purpose, otpHash, expiresAt });
    return { expiresAt };
  }

  await supabase
    .from('auth_otps')
    .update({ consumed_at: new Date().toISOString() })
    .eq('email', normalizedEmail)
    .eq('purpose', purpose)
    .is('consumed_at', null);

  const { error } = await supabase.from('auth_otps').insert({
    email: normalizedEmail,
    purpose,
    otp_hash: otpHash,
    expires_at: expiresAt.toISOString()
  });

  if (error) {
    if (isMissingOtpTable(error)) {
      storeFallbackOtp({ email: normalizedEmail, purpose, otpHash, expiresAt });
      return { expiresAt, fallback: true };
    }

    throw error;
  }

  return { expiresAt };
}

export async function verifyOtp({ email, purpose, otp, consume = true }) {
  const normalizedEmail = normalizeEmail(email);
  const expectedHash = hashOtp(normalizedEmail, purpose, otp);
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const result = verifyFallbackOtp({ email: normalizedEmail, purpose, expectedHash });
    if (!result.ok) return result;
    if (consume) {
      const record = fallbackOtps.get(`${purpose}:${normalizedEmail}`);
      if (record) record.consumedAt = new Date();
    }
    return { ok: true };
  }

  const { data: record, error } = await supabase
    .from('auth_otps')
    .select('*')
    .eq('email', normalizedEmail)
    .eq('purpose', purpose)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingOtpTable(error)) {
      const result = verifyFallbackOtp({ email: normalizedEmail, purpose, expectedHash });
      if (!result.ok) return result;
      if (consume) {
        const record = fallbackOtps.get(`${purpose}:${normalizedEmail}`);
        if (record) record.consumedAt = new Date();
      }
      return { ok: true, fallback: true };
    }

    throw error;
  }

  if (!record || new Date(record.expires_at) <= new Date()) {
    return { ok: false, error: 'Mã OTP đã hết hạn hoặc không tồn tại.' };
  }

  const attempts = Number(record.attempts || 0) + 1;

  await supabase
    .from('auth_otps')
    .update({ attempts })
    .eq('id', record.id);

  if (attempts > MAX_ATTEMPTS) {
    return { ok: false, error: 'Bạn đã nhập sai OTP quá nhiều lần.' };
  }

  if (record.otp_hash !== expectedHash) {
    return { ok: false, error: 'Mã OTP không chính xác.' };
  }

  if (consume) {
    await supabase
      .from('auth_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', record.id);
  }

  return { ok: true, id: record.id };
}

export function normalizeOtpEmail(email) {
  return normalizeEmail(email);
}

export async function consumeOtp({ email, purpose }) {
  const normalizedEmail = normalizeEmail(email);
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const record = fallbackOtps.get(`${purpose}:${normalizedEmail}`);
    if (record) record.consumedAt = new Date();
    return;
  }

  await supabase
    .from('auth_otps')
    .update({ consumed_at: new Date().toISOString() })
    .eq('email', normalizedEmail)
    .eq('purpose', purpose)
    .is('consumed_at', null);
}
