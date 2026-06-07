import { createUserNotification } from '../../../../lib/notifications';
import { requireOnlineUser } from '../../../../lib/online';
import { distributedRateLimit } from '../../../../lib/rateLimit';
import { uploadDataAssets } from '../../../../lib/storage';
import { isMissingTableError, safeArray } from '../../../../lib/validation';

export const runtime = 'nodejs';

function cleanAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map((item) => ({
    name: String(item?.name || 'evidence').slice(0, 160),
    mimeType: String(item?.mimeType || item?.type || '').slice(0, 80),
    dataUrl: String(item?.dataUrl || '')
  })).filter((item) => item.dataUrl.startsWith('data:'));
}

export async function GET(request) {
  const blocked = await distributedRateLimit(request, { scope: 'anti-cheat-appeal-read', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser({ allowBanned: true });
  if (context.error) return context.error;
  const [{ data: appeals = [], error: appealsError }, { data: reports = [] }] = await Promise.all([
    context.supabase.from('anti_cheat_appeals').select('*').eq('user_id', context.user.id).order('created_at', { ascending: false }),
    context.supabase.from('anti_cheat_reports').select('id, game_id, status, risk_score, created_at').eq('user_id', context.user.id).in('status', ['reviewed', 'actioned'])
  ]);
  if (appealsError && !isMissingTableError(appealsError, 'anti_cheat_appeals')) {
    return Response.json({ ok: false, error: appealsError.message }, { status: 500 });
  }
  return Response.json({
    ok: true,
    appeals: safeArray(appeals),
    reports: safeArray(reports),
    warning: appealsError ? 'Bảng anti_cheat_appeals chưa được triển khai.' : null
  });
}

export async function POST(request) {
  const blocked = await distributedRateLimit(request, { scope: 'anti-cheat-appeal-write', limit: 5, windowMs: 86_400_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser({ allowBanned: true });
  if (context.error) return context.error;
  const payload = await request.json().catch(() => ({}));
  const reportId = String(payload.reportId || '');
  const message = String(payload.message || '').trim().slice(0, 4000);
  if (!message || message.length < 20) return Response.json({ ok: false, error: 'Vui lòng mô tả khiếu nại rõ hơn.' }, { status: 400 });
  const { data: report } = await context.supabase
    .from('anti_cheat_reports')
    .select('id')
    .eq('id', reportId)
    .eq('user_id', context.user.id)
    .maybeSingle();
  if (!report) return Response.json({ ok: false, error: 'Báo cáo fair-play không tồn tại.' }, { status: 404 });
  let attachments = [];
  try {
    attachments = await uploadDataAssets(cleanAttachments(payload.attachments), {
      ownerUserId: context.user.id,
      purpose: 'fair-play-appeals',
      maxBytes: 10 * 1024 * 1024
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 400 });
  }
  const { data, error } = await context.supabase.from('anti_cheat_appeals').insert({
    report_id: reportId,
    user_id: context.user.id,
    message,
    attachments
  }).select('*').single();
  if (isMissingTableError(error, 'anti_cheat_appeals')) {
    return Response.json({
      ok: false,
      error: 'Chức năng khiếu nại cần áp dụng migration database mới nhất.'
    }, { status: 503 });
  }
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  await createUserNotification(context.supabase, {
    audience: 'admin',
    type: 'fair_play_appeal',
    title: 'Có khiếu nại fair-play mới',
    body: `Appeal #${data.id.slice(0, 8)}`,
    actionUrl: '/admin/fairplay',
    priority: 'high',
    metadata: { appealId: data.id, reportId }
  });
  return Response.json({ ok: true, appeal: data });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
