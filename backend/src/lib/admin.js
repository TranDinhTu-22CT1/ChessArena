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

function cleanDeviceFingerprint(value) {
  return String(value || '').trim().slice(0, 160);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function requestNetworkSignals(headerStore) {
  const userAgent = String(headerStore.get('user-agent') || '').slice(0, 400);
  const rawIp = String(headerStore.get('x-forwarded-for') || headerStore.get('x-real-ip') || '')
    .split(',')[0]
    .trim();
  const ip = /^(\d{1,3}\.){3}\d{1,3}$/.test(rawIp) || rawIp.includes(':') ? rawIp : '';
  const ipPrefix = ip.includes(':')
    ? ip.split(':').slice(0, 4).join(':')
    : ip.split('.').slice(0, 3).join('.');

  return {
    userAgent,
    userAgentHash: userAgent ? sha256(userAgent).slice(0, 64) : '',
    ip,
    ipPrefix: ip ? ipPrefix : ''
  };
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
    role: 'owner',
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
  const session = {
    email: admin.email,
    exp: expiresAt,
    csrf: crypto.randomBytes(24).toString('base64url'),
    issuedAt: Date.now()
  };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return {
    token: `${payload}.${signAdminSession(payload)}`,
    session
  };
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

  return {
    ...context,
    session: adminSession,
    admin: {
      ...context.admin,
      csrfToken: adminSession.csrf,
      expiresAt: new Date(Number(adminSession.exp)).toISOString(),
      issuedAt: adminSession.issuedAt ? new Date(Number(adminSession.issuedAt)).toISOString() : null
    }
  };
}

export async function setAdminSessionCookie(admin) {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE * 1000;
  const encoded = encodeAdminSession(admin, expiresAt);
  cookieStore.set(ADMIN_SESSION_COOKIE, encoded.token, authCookieOptions(ADMIN_SESSION_MAX_AGE));
  return {
    expiresAt: new Date(expiresAt).toISOString(),
    csrfToken: encoded.session.csrf
  };
}

export function requireAdminPermission() {
  return null;
}

export async function requireAdminCsrf(request, context) {
  const method = String(request?.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return null;
  const expected = context?.session?.csrf || context?.admin?.csrfToken || '';
  const provided = request.headers.get('x-admin-csrf') || '';
  if (expected && provided === expected) return null;
  return Response.json({ ok: false, error: 'Phiên admin thiếu mã xác thực thao tác. Hãy tải lại trang và đăng nhập lại nếu cần.' }, { status: 403 });
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

export async function ensureAdminAppUser(supabase, admin) {
  const emailKey = String(admin?.email || 'admin').toLowerCase();
  const username = `admin-${emailKey.replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 52)}`;
  const firebaseUid = `admin:${emailKey}`;
  const { data, error } = await supabase
    .from('users')
    .upsert({
      username,
      display_name: 'ADMIN',
      firebase_uid: firebaseUid,
      email: null,
      email_verified: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'firebase_uid' })
    .select('id, username, display_name, firebase_uid, photo_url, email')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    username: data.username,
    displayName: 'ADMIN',
    firebaseUid: data.firebase_uid,
    email: admin?.email ?? data.email,
    photoURL: data.photo_url,
    isAdmin: true
  };
}

export async function recordUserDevice(supabase, userId, deviceFingerprint) {
  const cleanFingerprint = cleanDeviceFingerprint(deviceFingerprint);
  if (!userId || !cleanFingerprint) return null;

  const headerStore = await headers();
  const signals = requestNetworkSignals(headerStore);

  const { data } = await supabase
    .from('user_devices')
    .upsert({
      user_id: userId,
      device_fingerprint: cleanFingerprint,
      user_agent: signals.userAgent || null,
      user_agent_hash: signals.userAgentHash || null,
      ip_address: signals.ip || null,
      ip_prefix: signals.ipPrefix || null,
      last_seen_at: new Date().toISOString()
    }, { onConflict: 'user_id,device_fingerprint' })
    .select('id, device_fingerprint, ip_prefix, user_agent_hash')
    .maybeSingle();

  return data;
}

export async function activeBanForUser(supabase, userId, deviceFingerprint = '') {
  const cleanFingerprint = cleanDeviceFingerprint(deviceFingerprint);
  const headerStore = await headers();
  const signals = requestNetworkSignals(headerStore);
  const checks = [];

  if (userId) {
    checks.push(activeBanFilter(
      supabase
        .from('user_bans')
        .select('*')
        .eq('user_id', userId)
        .in('ban_type', ['account', 'account_device', 'risk'])
        .limit(1)
    ));
  }

  if (cleanFingerprint) {
    checks.push(activeBanFilter(
      supabase
        .from('user_bans')
        .select('*')
        .eq('device_fingerprint', cleanFingerprint)
        .in('ban_type', ['device', 'account_device', 'risk'])
        .limit(1)
    ));
  }

  if (signals.ipPrefix && signals.userAgentHash) {
    checks.push(activeBanFilter(
      supabase
        .from('user_bans')
        .select('*')
        .eq('ip_prefix', signals.ipPrefix)
        .eq('user_agent_hash', signals.userAgentHash)
        .eq('ban_type', 'risk')
        .limit(1)
    ));
  }

  const results = await Promise.all(checks);
  return results.flatMap((result) => result.data || [])[0] || null;
}

export function riskSignalsFromDevice(device) {
  return {
    deviceFingerprint: cleanDeviceFingerprint(device?.device_fingerprint),
    ipPrefix: String(device?.ip_prefix || '').trim().slice(0, 80),
    userAgentHash: String(device?.user_agent_hash || '').trim().slice(0, 80),
    userAgent: String(device?.user_agent || '').slice(0, 400),
    lastSeenAt: device?.last_seen_at || null
  };
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
