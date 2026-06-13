import { cookies } from 'next/headers';
import { clearAdminSessionCookie } from '../../../../lib/admin';
import { revokeFirebaseSessions, verifyFirebaseSession } from '../../../../lib/firebaseAdmin';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('firebase_id_token')?.value;
  let revoked = false;

  try {
    if (token) {
      const decoded = await verifyFirebaseSession(token);
      await revokeFirebaseSessions(decoded.uid);
      revoked = true;
    }
  } catch {
    // An invalid or already-revoked session is safe to clear locally.
  } finally {
    cookieStore.delete('firebase_id_token');
    await clearAdminSessionCookie();
  }

  return Response.json({ ok: true, revoked }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache'
    }
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
