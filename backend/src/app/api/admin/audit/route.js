import { requireAdminUser } from '../../../../lib/admin';
import { rateLimit } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-audit', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  const { searchParams } = new URL(request.url);
  const limit = Math.max(10, Math.min(200, Number(searchParams.get('limit')) || 80));
  const action = String(searchParams.get('action') || '').trim();
  let query = context.supabase
    .from('admin_audit_logs')
    .select('id, admin_user_id, action, target_user_id, target_device_fingerprint, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (action) query = query.ilike('action', `%${action}%`);

  const { data, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, logs: data || [] });
}
