import { cookies, headers } from 'next/headers';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from './supabaseAdmin';
import { authCookieOptions } from './cookies';

const ADMIN_SESSION_COOKIE = 'admin_session_token';
const ADMIN_SESSION_MAX_AGE = 60 * 60;

function adminEmails() {
  return String(process.env.ADMIN_ROOT_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function adminRoleFor(email) {
  const assignment = String(process.env.ADMIN_ROLE_ASSIGNMENTS || '')
    .split(',')
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith(`${email}:`));
  return assignment?.split(':')[1]?.trim() || 'owner';
}

function cleanDeviceFingerprint(value) {
  return String(value || '').trim().slice(0, 160);
}

function activeBanFilter(query) {
  return query
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
}

function adminIdentityFromEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  const roots = adminEmails();
  if (!email || !roots.includes(email)) return null;
  return {
    id: null,
    email,
    role: adminRoleFor(email),
    permissions: ['*'],
    username: email.split('@')[0],
    displayName: 'Admin',
    photoURL: null
  };
}

function adminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET
    || process.env.OTP_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || '';
}

function signAdminSession(payload) {
  const secret = adminSessionSecret();
  if (!secret) throw new Error('ADMIN_SESSION_SECRET or OTP_SECRET is required.');
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
}

function encodeAdminSession(admin, expiresAt) {
  const payload = Buffer.from(JSON.stringify({
    email: admin.email,
    exp: expiresAt
  })).toString('base64url');
  return `${payload}.${signAdminSession(payload)}`;
}

function decodeAdminSession(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;

  const expected = signAdminSession(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session?.email || Number(session.exp) <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function requireRootAdminIdentity(email) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { error: Response.json({ ok: false, error: 'Supabase service role is required.' }, { status: 503 }) };
  }

  const admin = adminIdentityFromEmail(email);
  if (!admin) {
    return { error: Response.json({ ok: false, error: 'Admin access denied.' }, { status: 403 }) };
  }

  return { supabase, admin };
}

export async function requireAdminUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const adminSession = decodeAdminSession(sessionToken);
  if (!adminSession) {
    return { error: Response.json({ ok: false, error: 'Admin login required.' }, { status: 401 }) };
  }

  const context = await requireRootAdminIdentity(adminSession.email);
  if (context.error) return context;
  if (
    String(adminSession.email).toLowerCase() !== context.admin.email
  ) {
    return { error: Response.json({ ok: false, error: 'Admin login required.' }, { status: 401 }) };
  }

  return context;
}

export async function setAdminSessionCookie(admin) {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE * 1000;
  cookieStore.set(ADMIN_SESSION_COOKIE, encodeAdminSession(admin, expiresAt), authCookieOptions(ADMIN_SESSION_MAX_AGE));
  return {
    expiresAt: new Date(expiresAt).toISOString()
  };
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, '', authCookieOptions(0));
}

export async function writeAdminAudit(supabase, admin, action, metadata = {}) {
  await supabase.from('admin_audit_logs').insert({
    admin_user_id: admin?.id ?? null,
    action,
    target_user_id: metadata.targetUserId ?? null,
    target_device_fingerprint: metadata.deviceFingerprint ?? null,
    metadata
  });
}

export async function recordUserDevice(supabase, userId, deviceFingerprint) {
  const cleanFingerprint = cleanDeviceFingerprint(deviceFingerprint);
  if (!userId || !cleanFingerprint) return null;

  const headerStore = await headers();
  const userAgent = String(headerStore.get('user-agent') || '').slice(0, 400);
  const rawIp = String(headerStore.get('x-forwarded-for') || headerStore.get('x-real-ip') || '')
    .split(',')[0]
    .trim();
  const ip = /^(\d{1,3}\.){3}\d{1,3}$/.test(rawIp) || rawIp.includes(':') ? rawIp : '';

  const { data } = await supabase
    .from('user_devices')
    .upsert({
      user_id: userId,
      device_fingerprint: cleanFingerprint,
      user_agent: userAgent || null,
      ip_address: ip || null,
      last_seen_at: new Date().toISOString()
    }, { onConflict: 'user_id,device_fingerprint' })
    .select('id, device_fingerprint')
    .maybeSingle();

  return data;
}

export async function activeBanForUser(supabase, userId, deviceFingerprint = '') {
  const cleanFingerprint = cleanDeviceFingerprint(deviceFingerprint);
  const checks = [];

  if (userId) {
    checks.push(activeBanFilter(
      supabase
        .from('user_bans')
        .select('*')
        .eq('user_id', userId)
        .in('ban_type', ['account', 'account_device'])
        .limit(1)
    ));
  }

  if (cleanFingerprint) {
    checks.push(activeBanFilter(
      supabase
        .from('user_bans')
        .select('*')
        .eq('device_fingerprint', cleanFingerprint)
        .in('ban_type', ['device', 'account_device'])
        .limit(1)
    ));
  }

  const results = await Promise.all(checks);
  return results.flatMap((result) => result.data || [])[0] || null;
}

export async function activeMuteForUser(supabase, userId) {
  if (!userId) return null;
  const { data = [] } = await activeBanFilter(
    supabase
      .from('user_mutes')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
  );
  return data[0] || null;
}
