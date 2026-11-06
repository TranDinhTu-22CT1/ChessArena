import React from 'react';
import { Bell, Brain, Flame, HelpCircle, Info, Settings, Sparkles, Target, Wifi, WifiOff, X } from 'lucide-react';
import { BOARD_PRESETS, PIECE_SETS } from '../game/constants';
import { getPieceImage } from '../game/pieces';
import { fetchNotifications, markNotificationRead } from '../api/notifications';
import Modal from './Modal';

const puzzleRoutes = new Set(['puzzles', 'daily-puzzle', 'puzzle-rush', 'puzzle-battle', 'custom-puzzles']);
const playRoutes = new Set(['online', 'bot', 'player', 'coach', 'custom', 'local']);

const puzzleTips = [
  'Tìm nước chiếu, bắt quân, đe dọa trước.',
  'Nếu có nhiều nước hay, ưu tiên nước ép vua đối thủ.',
  'Trong tàn cuộc, kích hoạt vua trước khi đẩy tốt.',
  'Ở trung cuộc, hãy nhìn các quân đang bị ghim hoặc quá tải.'
];

const playTips = [
  'Phát triển quân nhẹ trước khi mở trung tâm.',
  'Khi đối thủ đe dọa, tìm nước phản công có tempo.',
  'Nhìn an toàn vua trước khi tham quân.',
  'Đừng đổi quân khi bạn đang tấn công mạnh.'
];

const reviewTips = [
  'Tập trung vào nước làm đổi đánh giá nhiều nhất.',
  'So sánh nước đã đi với gợi ý engine ở cùng thế.',
  'Ghi nhớ mẫu sai lặp lại để sửa ở ván sau.'
];

function dailyPick(items) {
  return items[new Date().getDate() % items.length];
}

function notificationTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));
}

function headerInsights(activeRoute) {
  if (puzzleRoutes.has(activeRoute)) {
    return [
      { icon: Target, label: 'Puzzle focus', text: dailyPick(puzzleTips) },
      { icon: Flame, label: 'Streak', text: activeRoute === 'puzzle-rush' ? '3 phút, tối đa 3 lỗi.' : 'Giải đúng liên tiếp để tăng điểm nhanh.' }
    ];
  }

  if (playRoutes.has(activeRoute)) {
    if (activeRoute === 'local') {
      return [
        {
          icon: Brain,
          label: 'Chơi cùng máy',
          text: 'Hai người chơi trên một thiết bị, đồng hồ chạy ngay khi bắt đầu.'
        }
      ];
    }

    return [
      { icon: activeRoute === 'coach' ? Sparkles : Brain, label: activeRoute === 'coach' ? 'Coach' : activeRoute === 'online' ? 'Online' : 'Game plan', text: activeRoute === 'coach' ? 'Coach sẽ nhắc kế hoạch theo thế cờ.' : activeRoute === 'online' ? 'Chỉ ghép người thật, server xác thực từng nước.' : dailyPick(playTips) }
    ];
  }

  if (activeRoute === 'review') {
    return [
      { icon: Brain, label: 'Review', text: dailyPick(reviewTips) },
      { icon: Target, label: 'Goal', text: 'Tìm một lỗi chính và một nước tốt nhất.' }
    ];
  }

  return [
    { icon: Sparkles, label: 'Hôm nay', text: 'Chọn chế độ luyện và bắt đầu một ván mới.' },
    { icon: Target, label: 'Bàn cờ', text: 'Đổi màu bàn cờ và mẫu quân trong Cài đặt giao diện.' }
  ];
}

export default function TopHeader({
  activeRoute,
  apiOnline,
  settingsOpen,
  theme,
  appearance,
  pieceSet,
  authUser,
  notificationCount = 0,
  onNotificationCountChange,
  onOpenAcademicNotice,
  onOpenNotifications,
  onOpenSupport,
  onToggleSettings,
  onCloseSettings,
  onResetTheme,
  onUpdateTheme,
  onSetAppearance,
  onApplyBoardPreset,
  onSetPieceSet
}) {
  const notificationRef = React.useRef(null);
  const [notificationOpen, setNotificationOpen] = React.useState(false);
  const [notificationItems, setNotificationItems] = React.useState([]);
  const [notificationLoading, setNotificationLoading] = React.useState(false);
  const [notificationError, setNotificationError] = React.useState('');
  const insights = headerInsights(activeRoute);
  const selectedPieceSet = PIECE_SETS.find((set) => set.id === pieceSet) ?? PIECE_SETS[0];
  const connectionLabel = apiOnline == null ? 'Đang kiểm tra kết nối' : apiOnline ? 'Máy chủ sẵn sàng' : 'Mất kết nối máy chủ';

  React.useEffect(() => {
    setNotificationOpen(false);
  }, [activeRoute]);

  React.useEffect(() => {
    if (!notificationOpen) return undefined;
    const controller = new AbortController();
    setNotificationLoading(true);
    setNotificationError('');
    fetchNotifications({ page: 1, limit: 5, signal: controller.signal })
      .then((data) => {
        setNotificationItems(data.notifications || []);
        onNotificationCountChange?.(data.unreadCount || 0);
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setNotificationError(error.message || 'Không thể tải thông báo.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setNotificationLoading(false);
      });
    const closeOutside = (event) => {
      if (!notificationRef.current?.contains(event.target)) setNotificationOpen(false);
    };
    const closeWithEscape = (event) => {
      if (event.key !== 'Escape') return;
      setNotificationOpen(false);
      notificationRef.current?.querySelector('.notification-bell')?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      controller.abort();
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [notificationOpen, onNotificationCountChange]);

  const openNotification = async (item) => {
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id);
        setNotificationItems((current) => current.map((entry) => (
          entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry
        )));
        onNotificationCountChange?.(Math.max(0, notificationCount - 1));
      } catch (error) {
        setNotificationError(error.message || 'Không thể cập nhật thông báo.');
        return;
      }
    }
    setNotificationOpen(false);
    if (item.actionUrl?.startsWith('/') && !item.actionUrl.startsWith('//')) {
      window.history.pushState(null, '', item.actionUrl);
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      return;
    }
    onOpenNotifications?.();
  };

  return (
    <header className="top-header">
      <div className="top-insight-cluster" aria-label="Gợi ý cho bạn">
        {insights.map((item) => {
          const Icon = item.icon;
          return (
            <div className="top-insight" key={item.label}>
              <Icon size={18} />
              <span>
                <strong>{item.label}</strong>
                {item.text}
              </span>
            </div>
          );
        })}
      </div>
      <div className="header-actions">
        <span className={`api-pill ${apiOnline == null ? 'pending' : apiOnline ? 'online' : 'offline'}`} title={connectionLabel} role="status" aria-label={connectionLabel}>
          {apiOnline === false ? <WifiOff size={16} /> : <Wifi size={16} />}
          <span>{apiOnline == null ? 'Đang kết nối' : apiOnline ? 'Sẵn sàng' : 'Mất kết nối'}</span>
        </span>
        <div className="notification-popover-anchor" ref={notificationRef}>
          <button
            className="notification-bell"
            aria-label={`Thông báo${notificationCount > 0 ? ` (${notificationCount} chưa đọc)` : ''}`}
            aria-haspopup="dialog"
            aria-expanded={notificationOpen}
            title="Thông báo"
            onClick={() => setNotificationOpen((open) => !open)}
          >
            <Bell size={19} />
            {notificationCount > 0 && <b>{Math.min(notificationCount, 99)}</b>}
          </button>
          {notificationOpen && (
            <section className="notification-popover" role="dialog" aria-label="Thông báo mới nhất">
              <header>
                <div><strong>Thông báo</strong><span>5 cập nhật mới nhất</span></div>
                <button type="button" onClick={() => setNotificationOpen(false)} aria-label="Đóng thông báo"><X size={17} /></button>
              </header>
              <div className="notification-popover-list">
                {notificationLoading && <p className="notification-popover-state">Đang tải thông báo…</p>}
                {!notificationLoading && notificationError && <p className="notification-popover-state error">{notificationError}</p>}
                {!notificationLoading && !notificationError && notificationItems.length === 0 && (
                  <p className="notification-popover-state">Bạn chưa có thông báo.</p>
                )}
                {!notificationLoading && notificationItems.map((item) => (
                  <button type="button" className={`notification-popover-item ${item.readAt ? '' : 'unread'}`} onClick={() => openNotification(item)} key={item.id}>
                    <span className="notification-popover-icon"><Bell size={16} /></span>
                    <span>
                      <strong>{item.title || 'Thông báo ChessArena'}</strong>
                      <small>{item.body || 'Có cập nhật mới cho bạn.'}</small>
                      <time>{notificationTime(item.createdAt)}</time>
                    </span>
                    {!item.readAt && <i aria-label="Chưa đọc" />}
                  </button>
                ))}
              </div>
              <button type="button" className="notification-popover-all" onClick={() => { setNotificationOpen(false); onOpenNotifications?.(); }}>
                Xem tất cả thông báo
              </button>
            </section>
          )}
        </div>
        <button className="header-support-button" aria-label="Hỗ trợ" onClick={onOpenSupport}>
          <HelpCircle size={19} />
          <span>Hỗ trợ</span>
        </button>
        <button aria-label="Thông tin học thuật và bản quyền" title="Thông tin học thuật và bản quyền" onClick={onOpenAcademicNotice}>
          <Info size={19} />
        </button>
        <button aria-label="Cài đặt giao diện" title="Cài đặt giao diện" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={onToggleSettings}>
          <Settings size={19} />
        </button>
      </div>
      <Modal open={settingsOpen} onClose={onCloseSettings} className="settings-dialog" aria-label="Cá nhân hóa giao diện">
        <div className="theme-panel">
          <div className="theme-panel-head">
            <strong>Cá nhân hóa giao diện</strong>
            <span className="theme-panel-actions">
              <button onClick={onResetTheme}>Đặt lại</button>
              <button className="theme-panel-close" onClick={onCloseSettings} aria-label="Tắt cài đặt" type="button" autoFocus>
                <X size={18} />
              </button>
            </span>
          </div>
          <label>
            <span>Chế độ giao diện</span>
            <select value={appearance} onChange={(event) => onSetAppearance(event.target.value)}>
              <option value="system">Theo hệ thống</option>
              <option value="dark">Tối</option>
              <option value="light">Sáng</option>
              <option value="custom">Tùy chỉnh</option>
            </select>
          </label>
          <label>
            <span>Màu nhấn</span>
            <input type="color" value={theme.accent} onChange={(event) => onUpdateTheme('accent', event.target.value)} />
          </label>
          <label>
            <span>Ô sáng</span>
            <input type="color" value={theme.lightSquare} onChange={(event) => onUpdateTheme('lightSquare', event.target.value)} />
          </label>
          <label>
            <span>Ô tối</span>
            <input type="color" value={theme.darkSquare} onChange={(event) => onUpdateTheme('darkSquare', event.target.value)} />
          </label>
          <label>
            <span>Bảng điều khiển</span>
            <input type="color" value={theme.surface} onChange={(event) => onUpdateTheme('surface', event.target.value)} />
          </label>
          <label>
            <span>Nền trang</span>
            <input type="color" value={theme.page} onChange={(event) => onUpdateTheme('page', event.target.value)} />
          </label>
          <label>
            <span>Màu bàn cờ có sẵn</span>
            <select onChange={(event) => onApplyBoardPreset(event.target.value)} defaultValue="">
              <option value="" disabled>Chọn bảng màu</option>
              {BOARD_PRESETS.map((preset) => (
                <option value={preset.id} key={preset.id}>{preset.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Mẫu quân cờ</span>
            <select value={pieceSet} onChange={(event) => onSetPieceSet(event.target.value)}>
              {PIECE_SETS.map((set) => (
                <option value={set.id} key={set.id}>{set.label}</option>
              ))}
            </select>
          </label>
          <div className="piece-set-preview" aria-label={`Bộ quân đang chọn: ${selectedPieceSet?.label}`}>
            <span>{selectedPieceSet?.label}</span>
            <img src={getPieceImage(pieceSet, 'wk')} alt="" draggable="false" />
            <img src={getPieceImage(pieceSet, 'wq')} alt="" draggable="false" />
            <img src={getPieceImage(pieceSet, 'bn')} alt="" draggable="false" />
            <img src={getPieceImage(pieceSet, 'br')} alt="" draggable="false" />
          </div>
          <small className="theme-note">Màu bàn cờ chỉ hiển thị với bạn. Khi chơi online, mẫu quân cờ được áp dụng cho quân của bạn.</small>
          <strong className="chesscom-asset-credit">
            Chess.com owns the referenced piece sets and board themes. Academic-use permission is pending written approval.
          </strong>
          <p className="theme-note">
            {authUser ? 'Màu sẽ được lưu theo tài khoản của bạn.' : 'Đăng nhập để đồng bộ màu trên tài khoản.'}
          </p>
        </div>
      </Modal>
    </header>
  );
}
