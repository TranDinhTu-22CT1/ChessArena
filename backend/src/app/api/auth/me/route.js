import { cookies } from 'next/headers';
import { verifyFirebaseSession } from '../../../../lib/firebaseAdmin';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { ensureAdminAppUser, requireAdminUser } from '../../../../lib/admin';

export const runtime = 'nodejs';

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function cleanProfileText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function displayNameFromIdentity(decoded, profile = null) {
  const storedName = cleanProfileText(profile?.display_name);
  if (storedName && !isEmailLike(storedName)) return storedName;

  const tokenName = cleanProfileText(decoded?.name);
  if (tokenName && !isEmailLike(tokenName)) return tokenName;

  const emailName = decoded?.email ? String(decoded.email).split('@')[0] : '';
  return cleanProfileText(emailName || decoded?.uid || 'Player');
}

export async function GET(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('firebase_id_token')?.value;
  const adminView = new URL(request.url).searchParams.get('adminView') === '1';
  const supabase = getSupabaseAdmin();

  if (!token) {
    const adminContext = await requireAdminUser();
    if (!adminContext.error) {
      const adminUser = supabase ? await ensureAdminAppUser(supabase, adminContext.admin) : null;
      return Response.json({
        ok: true,
        adminView,
        user: {
          uid: adminUser?.firebaseUid || `admin:${adminContext.admin.email}`,
          email: adminContext.admin.email,
          displayName: 'ADMIN',
          username: adminUser?.username || 'admin',
          isAdmin: true,
          emailVerified: true,
          photoURL: adminUser?.photoURL || null
        }
      });
    }

    return Response.json({ ok: true, authenticated: false, user: null });
  }

  let decoded;
  try {
    decoded = await verifyFirebaseSession(token);
  } catch {
    return Response.json({ ok: true, authenticated: false, user: null });
  }
  let profile = null;

  if (supabase) {
    const { data } = await supabase
      .from('users')
      .select('display_name, photo_url, email_verified')
      .eq('firebase_uid', decoded.uid)
      .maybeSingle();
    profile = data;
  }

  return Response.json({
    ok: true,
    user: {
      uid: decoded.uid,
      email: decoded.email ?? null,
      displayName: displayNameFromIdentity(decoded, profile),
      emailVerified: Boolean(decoded.email_verified || profile?.email_verified),
      photoURL: profile?.photo_url ?? decoded.picture ?? null
    }
  });
}
