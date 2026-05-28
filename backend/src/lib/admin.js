import { cookies, headers } from 'next/headers';
import { verifyFirebaseSession } from './firebaseAdmin';
import { getSupabaseAdmin } from './supabaseAdmin';

function adminEmails() {
  return String(process.env.ADMIN_ROOT_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function cleanDeviceFingerprint(value) {
  return String(value || '').trim().slice(0, 160);
}

function activeBanFilter(query) {
  return query
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
}

async function currentSessionUser(supabase) {
  const cookieStore = await cookies();
  const token = cookieStore.get('firebase_id_token')?.value;
  if (!token) return { error: Response.json({ ok: false, error: 'Sign in is required.' }, { status: 401 }) };

  let decoded;
  try {
    decoded = await verifyFirebaseSession(token);
  } catch {
    return { error: Response.json({ ok: false, error: 'Invalid or expired session.' }, { status: 401 }) };
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, display_name, email, firebase_uid, photo_url')
    .eq('firebase_uid', decoded.uid)
    .maybeSingle();

  if (error) return { error: Response.json({ ok: false, error: error.message }, { status: 500 }) };
  if (!user) return { error: Response.json({ ok: false, error: 'User profile was not found.' }, { status: 401 }) };
  return { decoded, user };
}

export async function requireAdminUser() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { error: Response.json({ ok: false, error: 'Supabase service role is required.' }, { status: 503 }) };
  }

  const session = await currentSessionUser(supabase);
  if (session.error) return { error: session.error };

  const email = String(session.decoded.email || session.user.email || '').toLowerCase();
  const roots = adminEmails();
  if (!roots.includes(email)) {
    return { error: Response.json({ ok: false, error: 'Admin access denied.' }, { status: 403 }) };
  }

  return {
    supabase,
    admin: {
      id: session.user.id,
      email,
      username: session.user.username,
      displayName: session.user.display_name,
      photoURL: session.user.photo_url
    }
  };
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
