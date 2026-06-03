import { rateLimit } from '../../../../lib/rateLimit';
import { requireAdminUser, writeAdminAudit } from '../../../../lib/admin';

export const runtime = 'nodejs';

const STATUSES = new Set(['pending', 'in_review', 'resolved', 'dismissed', 'escalated']);

function cleanStatus(value) {
  const status = String(value || '').trim();
  return STATUSES.has(status) ? status : '';
}

function cleanNote(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 800);
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-moderation', limit: 50, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  const { searchParams } = new URL(request.url);
  const status = cleanStatus(searchParams.get('status'));
  const limit = Math.max(5, Math.min(100, Number(searchParams.get('limit')) || 10));
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = context.supabase
    .from('player_reports')
    .select(`
      *,
      reporter:reporter_user_id(id, username, display_name, email, photo_url),
      reported:reported_user_id(id, username, display_name, email, photo_url),
      game:game_id(id, white_name, black_name, status, result, time_control, created_at, updated_at)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);

  const { data: reports = [], count = 0, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  return Response.json({
    ok: true,
    reports,
    page,
    limit,
    total: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit))
  });
}

export async function PATCH(request) {
  const blocked = rateLimit(request, { scope: 'admin-moderation-action', limit: 50, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  const payload = await request.json().catch(() => null);
  const reportId = String(payload?.reportId || '').trim();
  const status = cleanStatus(payload?.status);
  const resolutionNote = cleanNote(payload?.resolutionNote);

  if (!reportId || !status) {
    return Response.json({ ok: false, error: 'Invalid moderation action.' }, { status: 400 });
  }

  const { data: report, error } = await context.supabase
    .from('player_reports')
    .update({
      status,
      resolution_note: resolutionNote || null,
      reviewed_by: context.admin.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', reportId)
    .select('*')
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  await writeAdminAudit(context.supabase, context.admin, 'moderation.report_status', {
    targetUserId: report.reported_user_id,
    reportId,
    status,
    resolutionNote
  });

  return Response.json({ ok: true, report });
}
