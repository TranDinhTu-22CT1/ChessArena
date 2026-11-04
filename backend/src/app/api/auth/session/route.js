import { cookies } from 'next/headers';
import { authCookieOptions } from '../../../../lib/cookies';
import { createFirebaseSessionCookie, verifyFirebaseToken } from '../../../../lib/firebaseAdmin';
import { distributedRateLimit } from '../../../../lib/rateLimit';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { readJsonPayload, validateSessionPayload } from '../../../../lib/validation';
import { activeBanForUser, clearAdminSessionCookie } from '../../../../lib/admin';

import { banNotice } from '../../../../lib/banPolicy';

export const runtime = 'nodejs';
const ONE_HOUR = 60 * 60;
const REMEMBER_48_HOURS = 48 * 60 * 60;

function safeUserId(value) {
  return String(value || 'user')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'user';
}

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function cleanProfileText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function displayNameFromIdentity(decoded, profile = null) {
  const profileName = cleanProfileText(profile?.displayName);
  if (profileName && !isEmailLike(profileName)) return profileName;

  const githubName = cleanProfileText(profile?.githubName);
  if (githubName && !isEmailLike(githubName)) return githubName;

  const githubLogin = cleanProfileText(profile?.githubLogin);
  if (githubLogin && !isEmailLike(githubLogin)) return githubLogin;

  const tokenName = cleanProfileText(decoded?.name);
  if (tokenName && !isEmailLike(tokenName)) return tokenName;

  const emailName = decoded?.email ? String(decoded.email).split('@')[0] : '';
  return cleanProfileText(emailName || decoded?.uid || 'Player');
}

function isTrustedOauthProvider(decoded) {
  const provider = decoded?.firebase?.sign_in_provider;
  return provider === 'google.com' || provider === 'github.com';
}

export async function POST(request) {
  try {
    const blocked = await distributedRateLimit(request, { scope: 'auth-session', limit: 12, windowMs: 60_000 });
    if (blocked) return blocked;

    const payload = await readJsonPayload(request);
    if (!payload) {
      return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const validationError = validateSessionPayload(payload);

    if (validationError) {
      return Response.json({ ok: false, error: validationError }, { status: 400 });
    }

    const { idToken, remember = false, profile = null } = payload;

    if (!idToken) {
      return Response.json({ ok: false, error: 'Missing Firebase ID token' }, { status: 400 });
    }

    const decoded = await verifyFirebaseToken(idToken);

    if (!decoded.email || (!decoded.email_verified && !isTrustedOauthProvider(decoded))) {
      return Response.json(
        { ok: false, error: 'Please verify your email before creating a session.' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();
    const username = safeUserId(decoded.email || decoded.uid);
    const displayName = displayNameFromIdentity(decoded, profile);
    const photoURL = cleanProfileText(profile?.photoURL) || decoded.picture || null;
    let existingProfile = null;
    let storedUserId = null;

    if (!supabase) return Response.json({ ok: false, error: 'Chưa kết nối được dữ liệu tài khoản.' }, { status: 503 });
    if (supabase) {
      const { data, error: profileError } = await supabase
        .from('users')
        .select('id, display_name, photo_url')
        .eq('firebase_uid', decoded.uid)
        .maybeSingle();
      if (profileError) throw profileError;
      existingProfile = data;
      const { data: savedUser, error } = await supabase.from('users').upsert(
        {
          username,
          display_name: existingProfile?.display_name || displayName,
          firebase_uid: decoded.uid,
          email: decoded.email ?? null,
          photo_url: existingProfile?.photo_url || photoURL,
          email_verified: Boolean(decoded.email_verified || isTrustedOauthProvider(decoded)),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'firebase_uid' }
      ).select('id').single();

      if (error) throw error;
      storedUserId = savedUser?.id || existingProfile?.id || null;
      if (!storedUserId) throw new Error('Chưa tạo được hồ sơ tài khoản.');
      const activeBan = await activeBanForUser(supabase, storedUserId);
      if (activeBan) {
        const store = await cookies();
        store.set('firebase_id_token', '', authCookieOptions(0));
        return Response.json(banNotice(activeBan), { status: 403 });
      }
    }

    const cookieMaxAge = remember ? REMEMBER_48_HOURS : ONE_HOUR;
    const authCookieValue = await createFirebaseSessionCookie(idToken, cookieMaxAge * 1000);
    const sessionMode = 'session-cookie';

    const cookieStore = await cookies();
    cookieStore.set('firebase_id_token', authCookieValue, authCookieOptions(cookieMaxAge));
    await clearAdminSessionCookie();

    const { error: auditError } = await supabase.from('admin_audit_logs').insert({
      action: 'auth.user.login',
      target_user_id: storedUserId,
      metadata: {
        provider: decoded?.firebase?.sign_in_provider || 'unknown',
        remember: Boolean(remember)
      }
    });
    if (auditError) console.warn('User login audit skipped:', auditError.message);

    return Response.json({
      ok: true,
      remember: Boolean(remember),
      expiresIn: remember ? REMEMBER_48_HOURS : ONE_HOUR,
      sessionMode,
      user: {
        id: storedUserId,
        uid: decoded.uid,
        username,
        displayName: existingProfile?.display_name || displayName,
        email: decoded.email ?? null,
        emailVerified: Boolean(decoded.email_verified || isTrustedOauthProvider(decoded)),
        photoURL: existingProfile?.photo_url || photoURL,
        role: 'user',
        isAdmin: false
      }
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error.message || 'Could not create secure session' },
      { status: error.status || 500 }
    );
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
