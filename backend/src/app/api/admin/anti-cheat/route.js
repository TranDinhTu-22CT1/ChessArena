import { rateLimit } from '../../../../lib/rateLimit';
import { requireAdminUser, writeAdminAudit } from '../../../../lib/admin';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-anti-cheat', limit: 50, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  const { searchParams } = new URL(request.url);
  const limit = Math.max(5, Math.min(100, Number(searchParams.get('limit')) || 30));
  const { data: reports = [], error } = await context.supabase
    .from('anti_cheat_reports')
    .select('*, users:user_id(id, username, display_name, email, photo_url)')
    .order('risk_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, reports });
}

export async function PATCH(request) {
  const blocked = rateLimit(request, { scope: 'admin-anti-cheat-action', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  const payload = await request.json().catch(() => null);
  const reportId = String(payload?.reportId || '').trim();
  const status = String(payload?.status || '').trim();
  if (!reportId || !['reviewed', 'dismissed', 'actioned'].includes(status)) {
    return Response.json({ ok: false, error: 'Invalid report action.' }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from('anti_cheat_reports')
    .update({
      status,
      reviewed_by: context.admin.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', reportId)
    .select('*')
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  await writeAdminAudit(context.supabase, context.admin, 'anti_cheat.report_status', {
    targetUserId: data.user_id,
    reportId,
    status
  });
  return Response.json({ ok: true, report: data });
}
