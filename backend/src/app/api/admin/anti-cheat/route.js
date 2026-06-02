import { rateLimit } from '../../../../lib/rateLimit';
import { requireAdminUser, writeAdminAudit } from '../../../../lib/admin';

export const runtime = 'nodejs';

async function applyRatingRefund(supabase, report) {
  if (!report?.game_id || !report?.user_id) return null;
  const { data: game } = await supabase
    .from('online_games')
    .select('id, result, rated, mode, time_control, white_user_id, black_user_id, white_rating_before, black_rating_before, white_rating_after, black_rating_after')
    .eq('id', report.game_id)
    .maybeSingle();
  if (!game || game.rated === false || !['1-0', '0-1'].includes(game.result)) return null;

  const offenderColor = game.white_user_id === report.user_id ? 'w' : game.black_user_id === report.user_id ? 'b' : null;
  if (!offenderColor) return null;
  const offenderWon = (game.result === '1-0' && offenderColor === 'w') || (game.result === '0-1' && offenderColor === 'b');
  if (!offenderWon) return null;

  const refundedUserId = offenderColor === 'w' ? game.black_user_id : game.white_user_id;
  const before = Number(offenderColor === 'w' ? game.black_rating_before : game.white_rating_before);
  const after = Number(offenderColor === 'w' ? game.black_rating_after : game.white_rating_after);
  const refundDelta = Number.isFinite(before) && Number.isFinite(after) ? Math.max(0, before - after) : 0;
  if (!refundedUserId || refundDelta <= 0) return null;

  const mode = game.mode || 'rapid';
  const { data: existing } = await supabase
    .from('rating_refunds')
    .select('id')
    .eq('game_id', game.id)
    .eq('refunded_user_id', refundedUserId)
    .eq('reason', 'fair_play_refund')
    .maybeSingle();
  if (existing) return { skipped: true, refundDelta: 0 };

  const { data: rating } = await supabase
    .from('user_ratings')
    .select('rating')
    .eq('user_id', refundedUserId)
    .eq('mode', mode)
    .maybeSingle();
  const currentRating = Number(rating?.rating || after || before || 400);
  const nextRating = Math.max(100, currentRating + refundDelta);

  const { error: refundError } = await supabase.from('rating_refunds').insert({
    report_id: report.id,
    game_id: game.id,
    offender_user_id: report.user_id,
    refunded_user_id: refundedUserId,
    mode,
    rating_before: currentRating,
    rating_after: nextRating,
    refund_delta: refundDelta,
    reason: 'fair_play_refund'
  });
  if (refundError) return null;

  await supabase
    .from('user_ratings')
    .update({ rating: nextRating, updated_at: new Date().toISOString() })
    .eq('user_id', refundedUserId)
    .eq('mode', mode);

  return { refundedUserId, refundDelta, ratingBefore: currentRating, ratingAfter: nextRating };
}

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

  const userIds = [...new Set((reports || []).map((report) => report.user_id).filter(Boolean))];
  const { data: bans = [] } = userIds.length
    ? await context.supabase
      .from('user_bans')
      .select('*')
      .in('user_id', userIds)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
    : { data: [] };

  return Response.json({
    ok: true,
    reports: (reports || []).map((report) => ({
      ...report,
      activeBan: (bans || []).find((ban) => ban.user_id === report.user_id) || null
    }))
  });
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
  const refund = status === 'actioned' ? await applyRatingRefund(context.supabase, data) : null;
  await writeAdminAudit(context.supabase, context.admin, 'anti_cheat.report_status', {
    targetUserId: data.user_id,
    reportId,
    status,
    refund
  });
  return Response.json({ ok: true, report: data, refund });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
