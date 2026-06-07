import React from 'react';
import { Bell, CheckCheck, ExternalLink, Filter, Loader2, LogIn } from 'lucide-react';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/notifications';
import Pagination, { getUrlPage, setUrlPage } from '../../components/Pagination';

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function typeLabel(type) {
  if (type === 'friend_request') return 'Bạn bè';
  if (type === 'friend_accepted' || type === 'friend_declined') return 'Bạn bè';
  if (type === 'game_invite') return 'Thách đấu';
  if (type?.includes('ban') || type?.includes('mute')) return 'Tài khoản';
  return 'Hệ thống';
}

export default function NotificationsPage({ authUser, onLogin, onNavigate, onUnreadChange }) {
  const [items, setItems] = React.useState([]);
  const [page, setPage] = React.useState(() => getUrlPage('page'));
  const [totalPages, setTotalPages] = React.useState(1);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [loading, setLoading] = React.useState(Boolean(authUser));
  const [message, setMessage] = React.useState('');
  const [browserPermission, setBrowserPermission] = React.useState(
    typeof window.Notification === 'undefined' ? 'unsupported' : window.Notification.permission
  );

  const load = React.useCallback(async (nextPage = page, nextUnreadOnly = unreadOnly) => {
    if (!authUser) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchNotifications({ page: nextPage, limit: 12, unread: nextUnreadOnly });
      setItems(data.notifications || []);
      setTotalPages(data.totalPages || 1);
      setUnreadCount(data.unreadCount || 0);
      onUnreadChange?.(data.unreadCount || 0);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [authUser, onUnreadChange, page, unreadOnly]);

  React.useEffect(() => {
    load(page, unreadOnly);
  }, [load, page, unreadOnly]);

  const changePage = (nextPage) => {
    setPage(nextPage);
    setUrlPage(nextPage, 'page');
  };

  const toggleUnreadOnly = () => {
    setUnreadOnly((current) => !current);
    setPage(1);
    setUrlPage(1, 'page');
  };

  const markRead = async (notification) => {
    if (!notification.readAt) {
      await markNotificationRead(notification.id).catch((error) => setMessage(error.message));
      await load(page, unreadOnly);
    }
    if (notification.actionUrl) {
      window.history.pushState(null, '', notification.actionUrl);
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      onNavigate?.();
    }
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      await load(1, unreadOnly);
      setPage(1);
      setUrlPage(1, 'page');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const enableBrowserNotifications = async () => {
    if (typeof window.Notification === 'undefined') return;
    const permission = await window.Notification.requestPermission();
    setBrowserPermission(permission);
    setMessage(permission === 'granted' ? 'Đã bật thông báo trên trình duyệt.' : 'Trình duyệt chưa cấp quyền thông báo.');
  };

  if (!authUser) {
    return (
      <section className="notifications-auth-required">
        <Bell size={46} />
        <h1>Thông báo</h1>
        <p>Đăng nhập để xem lời mời kết bạn, trạng thái tài khoản và các cập nhật hệ thống.</p>
        <button onClick={onLogin}><LogIn size={18} /> Đăng nhập</button>
      </section>
    );
  }

  return (
    <section className="notifications-page">
      <style>{`
        /* CSS Layout và UI của các nút action */
        .modern-hero-layout {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 24px;
        }
        .modern-btn-group {
          display: flex;
          gap: 12px;
        }
        .modern-action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 12px 16px;
          background-color: #abc854;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .modern-action-btn span,
        .modern-action-btn svg {
          color: #000000 !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          white-space: nowrap !important;
        }
        .modern-action-btn:hover:not(:disabled) {
          background-color: #bce05d;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(171, 200, 84, 0.3);
        }
        .modern-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* CSS Animation cho vòng tròn Loading */
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        .loading-container {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 60px 0;
          color: #888;
        }
      `}</style>

      <header className="notifications-hero">
        <div className="modern-hero-layout">
          <div style={{ flex: 1, minWidth: '280px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Bell size={17} /> Trung tâm thông báo
            </span>
            <h1 style={{ marginBottom: '12px' }}>Thông báo của bạn</h1>
            <p style={{ lineHeight: '1.5' }}>
              Có <strong>{unreadCount}</strong> thông báo chưa đọc. Các sự kiện quan trọng như <strong>kết bạn</strong>, <strong>fair play</strong> và <strong>tài khoản</strong> sẽ nằm ở đây.
            </p>
          </div>

          <div className="modern-btn-group">
            {browserPermission !== 'granted' && browserPermission !== 'unsupported' && (
              <button
                className="modern-action-btn"
                onClick={enableBrowserNotifications}
              >
                <Bell size={20} strokeWidth={2} />
                <span>Bật thông báo</span>
              </button>
            )}

            <button
              className="modern-action-btn"
              onClick={toggleUnreadOnly}
            >
              <Filter size={20} strokeWidth={2} />
              <span>{unreadOnly ? 'Hiện tất cả' : 'Chưa đọc'}</span>
            </button>

            <button
              className="modern-action-btn"
              onClick={markAll}
              disabled={loading || unreadCount === 0}
            >
              <CheckCheck size={20} strokeWidth={2} />
              <span>Đánh dấu đã đọc</span>
            </button>
          </div>
        </div>
      </header>

      {message && <p className="notifications-message">{message}</p>}

      {/* Logic hiển thị Loading, Trạng thái rỗng hoặc Danh sách thông báo */}
      {loading ? (
        <div className="loading-container">
          <Loader2 size={40} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="notifications-empty">Chưa có thông báo phù hợp.</p>
      ) : (
        <>
          <div className="notifications-list">
            {items.map((item) => (
              <button className={`notification-card ${item.readAt ? '' : 'unread'} ${item.priority}`} key={item.id} onClick={() => markRead(item)}>
                <span className="notification-type">{typeLabel(item.type)}</span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.body || 'Không có nội dung bổ sung.'}</small>
                  <time>{formatDate(item.createdAt)}{item.readAt ? ' | đã đọc' : ' | chưa đọc'}</time>
                </span>
                {item.actionUrl && <ExternalLink size={17} />}
              </button>
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={changePage}
            label="Phân trang thông báo"
          />
        </>
      )}
    </section>
  );
}