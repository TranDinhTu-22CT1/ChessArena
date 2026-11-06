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
  const [writing, setWriting] = React.useState(false);
  const writeInFlight = React.useRef(false);
  const [browserPermission, setBrowserPermission] = React.useState(
    typeof window.Notification === 'undefined' ? 'unsupported' : window.Notification.permission
  );

  const activeRequest = React.useRef(null);

  const load = React.useCallback(async (nextPage = page, nextUnreadOnly = unreadOnly) => {
    activeRequest.current?.abort();
    if (!authUser) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchNotifications({ page: nextPage, limit: 12, unread: nextUnreadOnly, signal: controller.signal });
      if (controller.signal.aborted) return;
      setItems(data.notifications || []);
      const lastPage = Math.max(1, data.totalPages || 1);
      if (nextPage > lastPage) { setPage(lastPage); setUrlPage(lastPage, 'page'); }
      setTotalPages(lastPage);
      setUnreadCount(data.unreadCount || 0);
      onUnreadChange?.(data.unreadCount || 0);
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error.message);
    } finally {
      if (activeRequest.current === controller && !controller.signal.aborted) setLoading(false);
    }
  }, [authUser, onUnreadChange, page, unreadOnly]);

  React.useEffect(() => {
    load(page, unreadOnly);
    return () => activeRequest.current?.abort();
  }, [load, page, unreadOnly]);

  const reload = React.useRef(load);
  reload.current = load;

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
    if (writeInFlight.current) return;
    writeInFlight.current = true;
    setWriting(true);
    setMessage('');
    try {
      if (!notification.readAt) {
        await markNotificationRead(notification.id);
        await reload.current();
      }
      if (notification.actionUrl?.startsWith('/') && !notification.actionUrl.startsWith('//')) {
        window.history.pushState(null, '', notification.actionUrl);
        window.dispatchEvent(new window.PopStateEvent('popstate'));
        onNavigate?.();
      }
    } catch (error) { setMessage(error.message); }
    finally { writeInFlight.current = false; setWriting(false); }
  };

  const markAll = async () => {
    if (writeInFlight.current) return;
    writeInFlight.current = true;
    setWriting(true);
    setMessage('');
    try {
      await markAllNotificationsRead();
      await reload.current();
    } catch (error) {
      setMessage(error.message);
    } finally { writeInFlight.current = false; setWriting(false); }
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
      <header className="notifications-hero">
        <div className="notifications-hero-layout">
          <div className="notifications-hero-copy">
            <span><Bell size={17} /> Trung tâm thông báo</span>
            <h1>Thông báo của bạn</h1>
            <p>
              Có <strong>{unreadCount}</strong> thông báo chưa đọc. Các sự kiện quan trọng như <strong>kết bạn</strong>, <strong>chính sách cộng đồng</strong> và <strong>tài khoản</strong> sẽ nằm ở đây.
            </p>
          </div>

          <div className="notifications-actions">
            {browserPermission !== 'granted' && browserPermission !== 'unsupported' && (
              <button onClick={enableBrowserNotifications}>
                <Bell size={18} strokeWidth={2} />
                <span>Bật thông báo</span>
              </button>
            )}

            <button className={unreadOnly ? 'active' : ''} onClick={toggleUnreadOnly}>
              <Filter size={18} strokeWidth={2} />
              <span>{unreadOnly ? 'Hiện tất cả' : 'Chưa đọc'}</span>
            </button>

            <button onClick={markAll} disabled={loading || writing || unreadCount === 0}>
              <CheckCheck size={18} strokeWidth={2} />
              <span>Đánh dấu đã đọc</span>
            </button>
          </div>
        </div>
      </header>

      {message && <p className="notifications-message">{message}</p>}

      {loading ? (
        <div className="social-loading">
          <Loader2 size={38} className="social-spin" />
          <span>Đang tải thông báo...</span>
        </div>
      ) : items.length === 0 ? (
        <p className="notifications-empty">Chưa có thông báo phù hợp.</p>
      ) : (
        <>
          <div className="notifications-list">
            {items.map((item) => (
              <button className={`notification-card ${item.readAt ? '' : 'unread'} ${item.priority}`} key={item.id} disabled={writing} onClick={() => markRead(item)}>
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
