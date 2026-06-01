export const NAV_ITEMS = [
  { id: 'overview', label: 'Tong quan', iconName: 'LayoutDashboard' },
  { id: 'players', label: 'Nguoi choi', iconName: 'Users' },
  { id: 'matches', label: 'Tran dau', iconName: 'Swords' },
  { id: 'fairplay', label: 'Anti-cheat', iconName: 'ShieldAlert' },
  { id: 'moderation', label: 'Bao cao', iconName: 'Shield' },
  { id: 'payments', label: 'Thanh toan', iconName: 'CreditCard' },
  { id: 'bots', label: 'Bot & su kien', iconName: 'Bot' },
  { id: 'audit', label: 'Nhat ky', iconName: 'FileText' },
  { id: 'config', label: 'Cau hinh', iconName: 'Settings' }
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
  return value ? new Date(value).toLocaleString() : '--';
}

export function defaultBotForm(index = 0) {
  return {
    name: `Custom Bot ${index + 1}`,
    elo: 1200 + index * 200,
    mood: 'Custom challenge bot',
    chat: 'Ready for a themed game.',
    eventTag: 'seasonal',
    avatarUrl: '/chessarena-mark.svg',
    active: true
  };
}

export function gameStatusLabel(status) {
  const labels = {
    waiting: 'Dang cho nguoi choi',
    active: 'Dang dien ra',
    checkmate: 'Chieu het',
    draw: 'Hoa',
    resigned: 'Da dau hang',
    abandoned: 'Bo van',
    timeout: 'Het gio'
  };
  return labels[status] || status || '--';
}

export function gameModeLabel(mode) {
  const labels = {
    bullet: 'Co sieu chop',
    blitz: 'Co chop',
    rapid: 'Co nhanh',
    classical: 'Co tieu chuan'
  };
  return labels[mode] || mode || '--';
}

export function resultLabel(result) {
  if (!result || result === '*') return 'Chua co ket qua';
  if (result === '1-0') return 'Trang thang';
  if (result === '0-1') return 'Den thang';
  if (result === '1/2-1/2') return 'Hoa';
  return result;
}

export function paymentStatusLabel(status) {
  const labels = {
    active: 'Dang hoat dong',
    cancelled: 'Da huy',
    expired: 'Da het han',
    past_due: 'Qua han thanh toan',
    pending: 'Dang cho'
  };
  return labels[status] || status || '--';
}

export function billingCycleLabel(cycle) {
  const labels = {
    monthly: 'Hang thang',
    yearly: 'Hang nam'
  };
  return labels[cycle] || cycle || '--';
}

export function tierLabel(tier) {
  const labels = {
    master: 'Master',
    plus: 'Plus',
    free: 'Mien phi'
  };
  return labels[tier] || tier || '--';
}

export function auditFallback(log) {
  const target = log.targetLabel || log.target_user_id || log.target_device_fingerprint || '--';
  return `Doi tuong: ${target}`;
}

export function adminActionLabel(action) {
  const labels = {
    'admin.me': 'Admin kiem tra phien dang nhap',
    'admin.login': 'Admin dang nhap',
    'admin.logout': 'Admin dang xuat',
    'anti_cheat.scan': 'Admin quet gian lan',
    'anti_cheat.report_status': 'Admin doi trang thai bao cao gian lan',
    'user.ban': 'Admin cam nguoi choi',
    'user.unban': 'Admin go cam nguoi choi',
    'user.mute': 'Admin chan chat nguoi choi',
    'user.unmute': 'Admin mo chan chat nguoi choi',
    'bot.create': 'Admin them bot',
    'bot.batch_create': 'Admin them 5 bot',
    'bot.update': 'Admin cap nhat bot',
    'event.create': 'Admin tao su kien',
    'event.update': 'Admin cap nhat su kien',
    'paypal.diagnostics': 'Admin kiem tra PayPal',
    'paypal.test_subscription': 'Admin tao thu dang ky PayPal'
  };
  return labels[action] || action || 'Hoat dong admin';
}
