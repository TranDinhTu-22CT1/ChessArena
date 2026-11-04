import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { findAccountBan } from './banPolicy.js';
import { getSupabaseAdmin } from './supabaseAdmin';
import { authCookieOptions } from './cookies';
import { signingSecret } from './signingSecrets.js';

const ADMIN_SESSION_COOKIE = 'admin_session_token';
const ADMIN_SESSION_MAX_AGE = 60 * 60;
const TEST_ADMIN_EMAIL = 'admintest@gmail.com';
const TEST_ADMIN_GRANT_MS = 24 * 60 * 60 * 1000;

function testAdminEnabled() {
  if (process.env.NODE_ENV === 'production') return process.env.ENABLE_TEST_ACCOUNTS === 'true';
  return process.env.ENABLE_TEST_ACCOUNTS !== 'false';
}

function adminEmails() {
  return String(process.env.ADMIN_ROOT_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function activeBanFilter(query) {
  return query
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
}

function rootAdminIdentityFromEmail(value) {
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
    photoURL: null,
    isTestAdmin: false
  };
}

function testAdminIdentity() {
  return {
    id: null,
    email: TEST_ADMIN_EMAIL,
    role: 'owner',
    permissions: ['*'],
    username: 'admintest',
    displayName: 'Admin Test',
    photoURL: null,
    isTestAdmin: true
  };
}

function adminSessionSecret() {
  return signingSecret('ADMIN_SESSION_SECRET');
}

function signAdminSession(payload) {
  const secret = adminSessionSecret();
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

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail === TEST_ADMIN_EMAIL) {
    const status = await adminTestAccessStatus(supabase);
    if (status.granted) return { supabase, admin: testAdminIdentity() };
  }

  const admin = rootAdminIdentityFromEmail(normalizedEmail);
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

export async function adminTestAccessStatus(supabase) {
  const base = {
    email: TEST_ADMIN_EMAIL,
    enabled: testAdminEnabled(),
    granted: false,
    expiresAt: null,
    grantedAt: null,
    remainingSeconds: 0
  };
  if (!base.enabled || !supabase) return base;

  const { data, error } = await supabase
    .from('admin_audit_logs')
    .select('action, metadata, created_at')
    .in('action', ['admin.test_access.grant', 'admin.test_access.revoke'])
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) {
    console.warn('Admin test access status skipped:', error.message);
    return base;
  }

  const latest = (data || []).find((log) => String(log.metadata?.targetEmail || '').toLowerCase() === TEST_ADMIN_EMAIL);
  if (!latest) {
    if (process.env.ADMIN_TEST_ACCESS_GRANTED !== 'true') return base;
    const expiresAt = new Date(Date.now() + TEST_ADMIN_GRANT_MS).toISOString();
    return {
      ...base,
      granted: true,
      expiresAt,
      grantedAt: null,
      remainingSeconds: Math.ceil(TEST_ADMIN_GRANT_MS / 1000)
    };
  }

  if (latest.action === 'admin.test_access.revoke') return base;

  const grantedAtMs = new Date(latest.created_at).getTime();
  const expiresAt = latest.metadata?.expiresAt || new Date(grantedAtMs + TEST_ADMIN_GRANT_MS).toISOString();
  const remainingSeconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));

  return {
    ...base,
    granted: remainingSeconds > 0,
    expiresAt,
    grantedAt: latest.created_at,
    remainingSeconds
  };
}

export async function grantTestAdminAccess(supabase, admin) {
  const expiresAt = new Date(Date.now() + TEST_ADMIN_GRANT_MS).toISOString();
  await writeAdminAudit(supabase, admin, 'admin.test_access.grant', {
    targetEmail: TEST_ADMIN_EMAIL,
    expiresAt,
    durationHours: 24
  });
  return adminTestAccessStatus(supabase);
}

export async function revokeTestAdminAccess(supabase, admin, metadata = {}) {
  await writeAdminAudit(supabase, admin, 'admin.test_access.revoke', {
    targetEmail: TEST_ADMIN_EMAIL,
    ...metadata
  });
  return adminTestAccessStatus(supabase);
}

export async function writeAdminAudit(supabase, admin, action, metadata = {}) {
  const { error } = await supabase.from('admin_audit_logs').insert({
    admin_user_id: admin?.id ?? null,
    action,
    target_user_id: metadata.targetUserId ?? null,
    metadata
  });
  if (error) {
    console.warn('Admin audit skipped:', error.message);
  }
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

export const activeBanForUser = findAccountBan;

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
