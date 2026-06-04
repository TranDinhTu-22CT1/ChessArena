import { adminTestAccessStatus, grantTestAdminAccess, requireAdminCsrf, requireAdminUser, revokeTestAdminAccess } from '../../../../lib/admin';
import { rateLimit } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-test-access-read', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  return Response.json({ ok: true, testAdmin: await adminTestAccessStatus(context.supabase) });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'admin-test-access-write', limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;
  if (context.admin?.isTestAdmin) {
    return Response.json({ ok: false, error: 'Admin test khong the tu cap quyen.' }, { status: 403 });
  }

  const payload = await request.json().catch(() => ({}));
  const granted = payload?.granted !== false;
  const status = granted
    ? await grantTestAdminAccess(context.supabase, context.admin)
    : await revokeTestAdminAccess(context.supabase, context.admin);

  return Response.json({ ok: true, testAdmin: status });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
