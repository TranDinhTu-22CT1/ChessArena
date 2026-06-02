import React from 'react';
import { Bell, CheckCheck, ExternalLink, Filter, LogIn } from 'lucide-react';
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
        <div>
          <span><Bell size={17} /> Trung tâm thông báo</span>
          <h1>Thông báo của bạn</h1>
          <p>Có <strong>{unreadCount}</strong> thông báo chưa đọc. Các sự kiện quan trọng như kết bạn, fair play và tài khoản sẽ nằm ở đây.</p>
        </div>
        <div>
          <button onClick={toggleUnreadOnly}><Filter size={17} /> {unreadOnly ? 'Hiện tất cả' : 'Chưa đọc'}</button>
          <button onClick={markAll} disabled={loading || unreadCount === 0}><CheckCheck size={17} /> Đánh dấu đã đọc</button>
        </div>
      </header>

      {message && <p className="notifications-message">{message}</p>}
      {!loading && items.length === 0 && <p className="notifications-empty">Chưa có thông báo phù hợp.</p>}

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
    </section>
  );
}
