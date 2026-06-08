export const NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan', iconName: 'LayoutDashboard' },
  { id: 'players', label: 'Người chơi', iconName: 'Users' },
  { id: 'matches', label: 'Trận đấu', iconName: 'Swords' },
  { id: 'tournaments', label: 'Giải đấu', iconName: 'Trophy' },
  { id: 'fairplay', label: 'Chống gian lận', iconName: 'ShieldAlert' },
  { id: 'support', label: 'Hỗ trợ', iconName: 'MessageSquare' },
  { id: 'payments', label: 'Thanh toán', iconName: 'CreditCard' },
  { id: 'bots', label: 'Bot & thẻ', iconName: 'Bot' },
  { id: 'audit', label: 'Nhật ký', iconName: 'FileText' },
  { id: 'config', label: 'Cấu hình', iconName: 'Settings' }
];

export function pct(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

export function activeBan(user) {
  return user.bans?.find((ban) => ban.status === 'active' && (!ban.expires_at || new Date(ban.expires_at) > new Date())) || null;
}

export function activeMute(user) {
  return user.mutes?.find((mute) => mute.status === 'active') || null;
}

export function time(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '--';
}

export function defaultBotForm(index = 0) {
  return {
    name: `Bot tùy chỉnh ${index + 1}`,
    elo: 1200 + index * 200,
    mood: 'Bot thử thách theo chủ đề',
    chat: 'Sẵn sàng cho một ván đấu đặc biệt.',
    eventTag: 'seasonal',
    avatarUrl: '/chessarena-mark.svg',
    sortOrder: 50 + index,
    active: true
  };
}

export function gameStatusLabel(status) {
  const labels = {
    waiting: 'Đang chờ người chơi',
    active: 'Đang diễn ra',
    checkmate: 'Chiếu hết',
    draw: 'Hòa',
    resigned: 'Đã đầu hàng',
    abandoned: 'Bỏ ván',
    timeout: 'Hết giờ'
  };
  return labels[status] || status || '--';
}

export function gameModeLabel(mode) {
  const labels = {
    bullet: 'Cờ siêu chớp',
    blitz: 'Cờ chớp',
    rapid: 'Cờ nhanh',
    classical: 'Cờ tiêu chuẩn'
  };
  return labels[mode] || mode || '--';
}

export function resultLabel(result) {
  if (!result || result === '*') return 'Chưa có kết quả';
  if (result === '1-0') return 'Trắng thắng';
  if (result === '0-1') return 'Đen thắng';
  if (result === '1/2-1/2') return 'Hòa';
  return result;
}

export function paymentStatusLabel(status) {
  const labels = {
    active: 'Đang hoạt động',
    cancelled: 'Đã hủy',
    expired: 'Đã hết hạn',
    past_due: 'Quá hạn thanh toán',
    pending: 'Đang chờ'
  };
  return labels[status] || status || '--';
}

export function billingCycleLabel(cycle) {
  const labels = {
    monthly: 'Hàng tháng',
    yearly: 'Hàng năm'
  };
  return labels[cycle] || cycle || '--';
}

export function tierLabel(tier) {
  const labels = {
    master: 'Master',
    plus: 'Plus',
    pro: 'Pro',
    free: 'Miễn phí'
  };
  return labels[tier] || tier || '--';
}

export function auditFallback(log) {
  const target = log.targetLabel || log.target_user_id || log.target_device_fingerprint || '--';
  return `Đối tượng: ${target}`;
}

export function adminActionLabel(action) {
  const labels = {
    'admin.me': 'Admin kiểm tra phiên đăng nhập',
    'admin.login': 'Admin đăng nhập',
    'admin.logout': 'Admin đăng xuất',
    'admin.test_access.grant': 'Admin cấp quyền tài khoản test',
    'admin.test_access.revoke': 'Admin thu hồi quyền tài khoản test',
    'anti_cheat.scan': 'Admin quét gian lận',
    'anti_cheat.report_status': 'Admin đổi trạng thái báo cáo gian lận',
    'user.ban': 'Admin cấm người chơi',
    'user.unban': 'Admin gỡ cấm người chơi',
    'user.mute': 'Admin chặn chat người chơi',
    'user.unmute': 'Admin mở chặn chat người chơi',
    'bot.create': 'Admin thêm bot',
    'bot.batch_create': 'Admin thêm 5 bot',
    'bot.update': 'Admin cập nhật bot',
    'event.create': 'Admin tạo sự kiện',
    'event.update': 'Admin cập nhật sự kiện',
    'match.create': 'Admin tạo trận đấu',
    'match.update_status': 'Admin cập nhật trạng thái trận',
    'tournament.create': 'Admin tạo giải đấu',
    'tournament.update_status': 'Admin cập nhật trạng thái giải',
    'paypal.diagnostics': 'Admin kiểm tra PayPal',
    'paypal.test_subscription': 'Admin tạo thử đăng ký PayPal'
  };
  return labels[action] || action || 'Hoạt động admin';
}
