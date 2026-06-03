import crypto from 'node:crypto';
import { clearAdminSessionCookie, requireAdminCsrf, requireAdminUser, requireRootAdminIdentity, setAdminSessionCookie, writeAdminAudit } from '../../../../lib/admin';
import { rateLimit } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-session-read', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  return Response.json({ ok: true, admin: context.admin });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'admin-session-unlock', limit: 8, windowMs: 60_000 });
  if (blocked) return blocked;

  const payload = await request.json().catch(() => ({}));
  const email = String(payload?.email || '').trim().toLowerCase();
  const password = String(payload?.password || '');
  const expected = process.env.ADMIN_PANEL_PASSWORD || '';
  if (!expected) {
    return Response.json({ ok: false, error: 'ADMIN_PANEL_PASSWORD is not configured.' }, { status: 503 });
  }

  const context = await requireRootAdminIdentity(email);
  if (context.error) {
    return Response.json({ ok: false, error: 'Sai email hoặc mật khẩu admin.' }, { status: 403 });
  }
  if (!constantTimeEqual(password, expected)) {
    await writeAdminAudit(context.supabase, context.admin, 'admin.login_failed');
    return Response.json({ ok: false, error: 'Sai email hoặc mật khẩu admin.' }, { status: 403 });
  }

  const session = await setAdminSessionCookie(context.admin);
  await writeAdminAudit(context.supabase, context.admin, 'admin.login');
  return Response.json({
    ok: true,
    admin: { ...context.admin, csrfToken: session.csrfToken, expiresAt: session.expiresAt },
    expiresAt: session.expiresAt,
    csrfToken: session.csrfToken
  });
}

export async function DELETE(request) {
  const blocked = rateLimit(request, { scope: 'admin-session-lock', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) {
    await clearAdminSessionCookie();
    return Response.json({ ok: true });
  }
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;
  await writeAdminAudit(context.supabase, context.admin, 'admin.logout');
  await clearAdminSessionCookie();
  return Response.json({ ok: true });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
