import { cookies } from 'next/headers';
import { authCookieOptions } from '../../../../lib/cookies';
import { createFirebaseSessionCookie, verifyFirebaseToken } from '../../../../lib/firebaseAdmin';
import { rateLimit } from '../../../../lib/rateLimit';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { readJsonPayload, validateSessionPayload } from '../../../../lib/validation';

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
    const blocked = rateLimit(request, { scope: 'auth-session', limit: 12, windowMs: 60_000 });
    if (blocked) return blocked;

    const payload = await readJsonPayload(request);
    if (!payload) {
      return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const validationError = validateSessionPayload(payload);

    if (validationError) {
      return Response.json({ ok: false, error: validationError }, { status: 400 });
    }

    const { idToken, remember = false, deviceId = null, profile = null } = payload;

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

    if (supabase) {
      const { data } = await supabase
        .from('users')
        .select('display_name, photo_url')
        .eq('firebase_uid', decoded.uid)
        .maybeSingle();
      existingProfile = data;
      const { error } = await supabase.from('users').upsert(
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
      );

      if (error) throw error;
    }

    const cookieMaxAge = remember ? REMEMBER_48_HOURS : ONE_HOUR;
    const authCookieValue = await createFirebaseSessionCookie(idToken, cookieMaxAge * 1000);
    const sessionMode = 'session-cookie';

    const cookieStore = await cookies();
    cookieStore.set('firebase_id_token', authCookieValue, authCookieOptions(cookieMaxAge));

    return Response.json({
      ok: true,
      remember: Boolean(remember),
      deviceId,
      expiresIn: remember ? REMEMBER_48_HOURS : ONE_HOUR,
      sessionMode,
      user: {
        uid: decoded.uid,
        username,
        displayName: existingProfile?.display_name || displayName,
        email: decoded.email ?? null,
        emailVerified: Boolean(decoded.email_verified || isTrustedOauthProvider(decoded)),
        photoURL: existingProfile?.photo_url || photoURL
      }
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error.message || 'Could not create secure session' },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
