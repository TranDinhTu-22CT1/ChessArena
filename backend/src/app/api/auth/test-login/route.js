import { createFirebaseCustomToken, ensureVerifiedFirebaseUser } from '../../../../lib/firebaseAdmin';
import { distributedRateLimit } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';

const TEST_EMAIL = 'test@gmail.com';
const TEST_PASSWORD = '123456';

function testAccountsEnabled() {
  if (process.env.NODE_ENV === 'production') return process.env.ENABLE_TEST_ACCOUNTS === 'true';
  return process.env.ENABLE_TEST_ACCOUNTS !== 'false';
}

export async function POST(request) {
  const blocked = await distributedRateLimit(request, { scope: 'auth-test-login', limit: 10, windowMs: 60_000 });
  if (blocked) return blocked;

  if (!testAccountsEnabled()) {
    return Response.json({ ok: false, error: 'Test accounts are disabled.' }, { status: 403 });
  }

  const payload = await request.json().catch(() => ({}));
  const email = String(payload?.email || '').trim().toLowerCase();
  const password = String(payload?.password || '');

  if (email !== TEST_EMAIL || password !== TEST_PASSWORD) {
    return Response.json({ ok: false, error: 'Email hoac mat khau test khong dung.' }, { status: 403 });
  }

  const user = await ensureVerifiedFirebaseUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    displayName: 'Test User'
  });
  const customToken = await createFirebaseCustomToken(user.uid);

  return Response.json({ ok: true, email: TEST_EMAIL, customToken });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
