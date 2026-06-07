import { requireAdminCsrf, requireAdminPermission, requireAdminUser, writeAdminAudit } from '../../../../../lib/admin';
import { createUserNotification } from '../../../../../lib/notifications';
import { distributedRateLimit } from '../../../../../lib/rateLimit';
import { isMissingTableError, safeArray } from '../../../../../lib/validation';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = await distributedRateLimit(request, { scope: 'admin-appeals-read', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'fairplay:manage');
  if (permissionError) return permissionError;
  const { data = [], error } = await context.supabase
    .from('anti_cheat_appeals')
    .select('*, users:user_id(id, display_name, username, email), reports:report_id(id, game_id, risk_score, status)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (isMissingTableError(error, 'anti_cheat_appeals')) {
    return Response.json({
      ok: true,
      appeals: [],
      warning: 'Bảng anti_cheat_appeals chưa được triển khai.'
    });
  }
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, appeals: safeArray(data) });
}

export async function PATCH(request) {
  const blocked = await distributedRateLimit(request, { scope: 'admin-appeals-write', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'fairplay:manage');
  if (permissionError) return permissionError;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;
  const payload = await request.json().catch(() => ({}));
  const status = ['in_review', 'accepted', 'rejected'].includes(payload.status) ? payload.status : '';
  if (!payload.appealId || !status) return Response.json({ ok: false, error: 'Invalid appeal action.' }, { status: 400 });
  const now = new Date().toISOString();
  const { data, error } = await context.supabase.from('anti_cheat_appeals').update({
    status,
    admin_note: String(payload.adminNote || '').trim().slice(0, 2000),
    reviewed_by: context.admin.id,
    reviewed_at: now,
    updated_at: now
  }).eq('id', payload.appealId).select('*').single();
  if (isMissingTableError(error, 'anti_cheat_appeals')) {
    return Response.json({
      ok: false,
      error: 'Chức năng khiếu nại cần áp dụng migration database mới nhất.'
    }, { status: 503 });
  }
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  await Promise.all([
    createUserNotification(context.supabase, {
      recipientUserId: data.user_id,
      type: 'fair_play_appeal_update',
      title: 'Khiếu nại fair-play đã được cập nhật',
      body: status === 'accepted' ? 'Khiếu nại của bạn đã được chấp nhận.' : status === 'rejected' ? 'Khiếu nại của bạn đã được xem xét và từ chối.' : 'Khiếu nại đang được xem xét.',
      actionUrl: '/profile',
      priority: 'high',
      metadata: { appealId: data.id }
    }),
    writeAdminAudit(context.supabase, context.admin, 'anti_cheat.appeal_update', {
      targetUserId: data.user_id,
      appealId: data.id,
      status
    })
  ]);
  return Response.json({ ok: true, appeal: data });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
