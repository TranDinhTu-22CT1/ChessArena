import { requireOnlineUser } from '../../../../lib/online';
import { rateLimit } from '../../../../lib/rateLimit';
import { schemaFailure } from '../../../../lib/schemaReadiness';

export async function POST(request) {
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const blocked = rateLimit(request, { scope: 'site-presence', identity: context.user.id, limit: 30, windowMs: 60000 });
  if (blocked) return blocked;
  const { error } = await context.supabase.rpc('touch_site_presence', { p_user: context.user.id });
  if (error) return schemaFailure(error) || Response.json({ ok: false, error: 'Chưa cập nhật được trạng thái online.' }, { status: 503 });
  return Response.json({ ok: true });
}
