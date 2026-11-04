import { rateLimit } from '../../../../lib/rateLimit';
import { requireAdminCsrf, requireAdminPermission, requireAdminUser, writeAdminAudit } from '../../../../lib/admin';
import { safeArray } from '../../../../lib/validation';

export const runtime = 'nodejs';

const STATUSES = new Set(['pending', 'in_review', 'resolved', 'dismissed', 'escalated']);
const CATEGORIES = new Set(['toxic', 'stalling', 'username', 'avatar', 'harassment', 'match_abuse', 'other']);

function cleanStatus(value) {
  const status = String(value || '').trim();
  return STATUSES.has(status) ? status : '';
}

function cleanNote(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 800);
}

function cleanDate(value, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
  return `${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`;
}

function cleanSearch(value) {
  return String(value || '').trim().replace(/[,%()]/g, '').slice(0, 100);
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-moderation', limit: 50, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'moderation:manage');
  if (permissionError) return permissionError;

  const { searchParams } = new URL(request.url);
  const status = cleanStatus(searchParams.get('status'));
  const limit = Math.max(5, Math.min(100, Number(searchParams.get('limit')) || 10));
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const search = cleanSearch(searchParams.get('search'));
  const category = String(searchParams.get('category') || '').trim();
  const dateFrom = cleanDate(searchParams.get('dateFrom'));
  const dateTo = cleanDate(searchParams.get('dateTo'), true);

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
  if (CATEGORIES.has(category)) query = query.eq('category', category);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);
  if (search) {
    const { data: users = [] } = await context.supabase.from('users').select('id').or(`username.ilike.%${search}%,display_name.ilike.%${search}%,email.ilike.%${search}%`).limit(30);
    const ids = safeArray(users).map((user) => user.id);
    const clauses = [];
    if (/^[0-9a-f-]{36}$/i.test(search)) clauses.push(`id.eq.${search}`);
    if (ids.length) clauses.push(`reporter_user_id.in.(${ids.join(',')})`, `reported_user_id.in.(${ids.join(',')})`);
    if (!clauses.length) return Response.json({ ok: true, reports: [], page, limit, total: 0, totalPages: 1 });
    query = query.or(clauses.join(','));
  }

  const { data: reportRows, count = 0, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const reports = safeArray(reportRows);
  const openCounts = new Map();
  for (const report of reports) {
    const key = report.reported_user_id || 'unknown';
    openCounts.set(key, (openCounts.get(key) || 0) + 1);
  }

  return Response.json({
    ok: true,
    reports: reports.map((report) => ({
      ...report,
      sameTargetOnPage: openCounts.get(report.reported_user_id || 'unknown') || 1
    })),
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
  const permissionError = requireAdminPermission(context, 'moderation:manage');
  if (permissionError) return permissionError;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;

  const payload = await request.json().catch(() => null);
  const reportId = String(payload?.reportId || '').trim();
  const status = cleanStatus(payload?.status);
  const resolutionNote = cleanNote(payload?.resolutionNote);

  if (!reportId || !status) {
    return Response.json({ ok: false, error: 'Invalid moderation action.' }, { status: 400 });
  }

  const { data: previous } = await context.supabase
    .from('player_reports')
    .select('id, status, reporter_user_id, reported_user_id')
    .eq('id', reportId)
    .maybeSingle();
  if (!previous) return Response.json({ ok: false, error: 'Report not found.' }, { status: 404 });

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

  if (previous.status !== status) {
    const statusText = status === 'resolved' ? 'đã được xử lý'
      : status === 'dismissed' ? 'đã được đóng sau khi xem xét'
        : status === 'escalated' ? 'đã được chuyển cấp'
          : status === 'in_review' ? 'đang được xem xét' : 'đã được cập nhật';
    await context.supabase.from('user_notifications').insert({
      recipient_user_id: previous.reporter_user_id,
      audience: 'user',
      type: 'moderation_report',
      title: 'Báo cáo vi phạm đã được cập nhật',
      body: `Báo cáo #${reportId.slice(0, 8)} ${statusText}.`,
      action_url: `/support/tickets?tab=reports&report=${encodeURIComponent(reportId)}`,
      priority: status === 'resolved' ? 'high' : 'normal',
      metadata: { reportId, status }
    });
  }

  return Response.json({ ok: true, report });
}
