import { rateLimit } from '../../../../lib/rateLimit';
import { requireAdminUser, writeAdminAudit } from '../../../../lib/admin';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-me', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  await writeAdminAudit(context.supabase, context.admin, 'admin.me');
  return Response.json({ ok: true, admin: context.admin });
}
