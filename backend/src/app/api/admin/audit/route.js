import { requireAdminPermission, requireAdminUser } from '../../../../lib/admin';
import { rateLimit } from '../../../../lib/rateLimit';
import { safeArray } from '../../../../lib/validation';

export const runtime = 'nodejs';

const ACTION_LABELS = {
  'anti_cheat.scan': 'Admin quét gian lận',
  'anti_cheat.review': 'Admin chuyển báo cáo gian lận sang đã xem',
  'anti_cheat.dismiss': 'Admin bỏ qua báo cáo gian lận',
  'anti_cheat.action': 'Admin xử lý báo cáo gian lận',
  'anti_cheat.report_status': 'Admin đổi trạng thái báo cáo gian lận',
  'user.ban': 'Admin cấm người chơi',
  'user.unban': 'Admin gỡ cấm người chơi',
  'user.mute': 'Admin mute người chơi',
  'user.unmute': 'Admin gỡ mute người chơi',
  'bot.create': 'Admin thêm bot',
  'bot.batch_create': 'Admin thêm 5 bot cùng lúc',
  'bot.update': 'Admin cập nhật bot',
  'event.create': 'Admin tạo sự kiện',
  'event.update': 'Admin cập nhật sự kiện',
  'match.update_status': 'Admin cập nhật trạng thái trận',
  'tournament.create': 'Admin tạo giải đấu',
  'tournament.update_status': 'Admin cập nhật trạng thái giải đấu',
  'moderation.update': 'Admin cập nhật báo cáo người chơi',
  'moderation.report_status': 'Admin đổi trạng thái báo cáo người chơi',
  'admin.me': 'Admin kiểm tra phiên đăng nhập',
  'admin.login': 'Admin đăng nhập',
  'admin.logout': 'Admin đăng xuất',
  'admin.login_failed': 'Đăng nhập admin thất bại',
  'paypal.diagnostics': 'Admin kiểm tra cấu hình PayPal',
  'paypal.test_subscription': 'Admin thử tạo subscription PayPal',
  'paypal.test_subscription_failed': 'Thử PayPal thất bại'
};

function readableAction(log) {
  if (ACTION_LABELS[log.action]) return ACTION_LABELS[log.action];
  return String(log.action || 'admin.action')
    .split(/[._-]/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function detailText(log, userById) {
  const metadata = log.metadata || {};
  const targetUser = userById.get(log.target_user_id || metadata.targetUserId);
  const target = targetUser?.display_name || targetUser?.email || targetUser?.username || log.target_user_id || metadata.targetUserId || metadata.name || metadata.botId || metadata.eventId || '--';
  const parts = [];

  if (target !== '--') parts.push(`Người/đối tượng: ${target}`);
  if (metadata.reason) parts.push(`Lý do: ${metadata.reason}`);
  if (metadata.banType) parts.push(`Kiểu cấm: ${metadata.banType}`);
  if (metadata.status) parts.push(`Trạng thái: ${metadata.status}`);
  if (metadata.category) parts.push(`Loại báo cáo: ${metadata.category}`);
  if (metadata.riskScore !== undefined) parts.push(`Điểm rủi ro: ${metadata.riskScore}`);
  if (metadata.reportsCreated !== undefined) parts.push(`Báo cáo tạo mới: ${metadata.reportsCreated}`);
  if (metadata.name && metadata.elo) parts.push(`Bot: ${metadata.name} (${metadata.elo})`);
  if (metadata.count && Array.isArray(metadata.names)) parts.push(`${metadata.count} bot: ${metadata.names.join(', ')}`);
  if (metadata.title) parts.push(`Sự kiện: ${metadata.title}`);
  if (metadata.tier || metadata.cycle) parts.push(`Gói: ${[metadata.tier, metadata.cycle].filter(Boolean).join(' ')}`);
  if (metadata.error) parts.push(`Lỗi: ${metadata.error}`);

  return parts.join(' | ') || 'Không có chi tiết thêm.';
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-audit', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'audit:view');
  if (permissionError) return permissionError;

  const { searchParams } = new URL(request.url);
  const limit = Math.max(10, Math.min(200, Number(searchParams.get('limit')) || 20));
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const action = String(searchParams.get('action') || '').trim();
  let query = context.supabase
    .from('admin_audit_logs')
    .select('id, admin_user_id, action, target_user_id, target_device_fingerprint, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (action) query = query.ilike('action', `%${action}%`);

  const { data, count = 0, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const targetIds = [...new Set((data || []).map((log) => log.target_user_id || log.metadata?.targetUserId).filter(Boolean))];
  const { data: targetUsers = [] } = targetIds.length
    ? await context.supabase
      .from('users')
      .select('id, username, display_name, email')
      .in('id', targetIds)
    : { data: [] };
  const userById = new Map(safeArray(targetUsers).map((user) => [user.id, user]));

  return Response.json({
    ok: true,
    page,
    limit,
    total: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
    logs: (data || []).map((log) => ({
      ...log,
      readableAction: readableAction(log),
      readableDetail: detailText(log, userById),
      targetLabel: userById.get(log.target_user_id || log.metadata?.targetUserId)?.display_name
        || userById.get(log.target_user_id || log.metadata?.targetUserId)?.email
        || log.metadata?.name
        || log.target_user_id
        || log.target_device_fingerprint
        || '--'
    }))
  });
}
