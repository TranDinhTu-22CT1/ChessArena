import React from 'react';
import { Crown, Loader2, LogIn, Medal, RefreshCw, ShieldCheck, Trophy, UserPlus, UserRound } from 'lucide-react';
import { sendFriendRequest } from '../../api/friends';
import { fetchLeaderboard } from '../../api/leaderboard';
import Pagination, { getUrlPage, setUrlPage } from '../../components/Pagination';

const MODES = [
  { id: 'bullet', label: 'Bullet' },
  { id: 'blitz', label: 'Blitz' },
  { id: 'rapid', label: 'Rapid' },
  { id: 'classical', label: 'Classical' }
];

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(value));
}

function medalIcon(rank) {
  if (rank === 1) return <Crown size={20} />;
  if (rank <= 3) return <Medal size={20} />;
  return <span className="leaderboard-rank-number">#{rank}</span>;
}

function PlayerAvatar({ player }) {
  return (
    <span className="leaderboard-avatar">
      {player.photoURL ? <img src={player.photoURL} alt="" /> : <UserRound size={22} />}
    </span>
  );
}

function openProfile(userId) {
  if (!userId) return;
  window.history.pushState(null, '', `/profile/${encodeURIComponent(userId)}`);
  window.dispatchEvent(new window.PopStateEvent('popstate'));
}

export default function LeaderboardPage({ authUser, onLogin }) {
  const [mode, setMode] = React.useState('rapid');
  const [page, setPage] = React.useState(() => getUrlPage('page'));
  const [totalPages, setTotalPages] = React.useState(1);
  const [entries, setEntries] = React.useState([]);
  const [currentUser, setCurrentUser] = React.useState(null);
  const [loading, setLoading] = React.useState(Boolean(authUser));
  const [message, setMessage] = React.useState('');
  const [friendBusyId, setFriendBusyId] = React.useState('');

  const loadLeaderboard = React.useCallback(async (nextMode = mode, nextPage = page) => {
    if (!authUser) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchLeaderboard(nextMode, { page: nextPage, limit: 20 });
      setEntries(data.entries || []);
      setCurrentUser(data.currentUser || null);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [authUser, mode, page]);

  React.useEffect(() => {
    loadLeaderboard(mode, page);
  }, [loadLeaderboard, mode, page]);

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setPage(1);
    setUrlPage(1, 'page');
  };

  const changePage = (nextPage) => {
    setPage(nextPage);
    setUrlPage(nextPage, 'page');
  };

  const addFriend = async (player) => {
    setFriendBusyId(player.userId);
    setMessage('');
    try {
      await sendFriendRequest(player.userId);
      setMessage(`Đã gửi lời mời kết bạn tới ${player.displayName}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setFriendBusyId('');
    }
  };

  if (!authUser) {
    return (
      <section className="leaderboard-auth-required">
        <Trophy size={48} />
        <h1>Bảng xếp hạng</h1>
        <p>Đăng nhập để xem rating online theo từng chế độ và vị trí của bạn.</p>
        <button onClick={onLogin}><LogIn size={18} /> Đăng nhập</button>
      </section>
    );
  }

  return (
    <section className="leaderboard-page">
      {/* CSS Animation cho spinner */}
      <style>{`
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

      <header className="leaderboard-hero">
        <div>
          <span><Trophy size={18} /> Chess Arena Leaderboard</span>
          <h1>Bảng xếp hạng online</h1>
          <p>Rating được tách theo Bullet, Blitz, Rapid và Classical. Người chơi dưới 20 ván vẫn được đánh dấu tạm tính.</p>
        </div>
        <button
          onClick={() => loadLeaderboard(mode, page)}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          {loading ? 'Đang tải...' : 'Tải lại'}
        </button>
      </header>

      <nav className="leaderboard-tabs" aria-label="Chọn chế độ rating">
        {MODES.map((item) => (
          <button
            className={mode === item.id ? 'active' : ''}
            key={item.id}
            onClick={() => changeMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {currentUser && (
        <article className="leaderboard-current">
          <ShieldCheck size={20} />
          <div>
            <strong>Thứ hạng của bạn: #{currentUser.rank}</strong>
            <span>{currentUser.rating} rating - {currentUser.gamesPlayed} ván - thắng {currentUser.winRate}%</span>
          </div>
        </article>
      )}

      {message && <p className="leaderboard-message">{message}</p>}

      {/* Hiển thị vòng tròn loading hoặc bảng xếp hạng */}
      {loading ? (
        <div className="loading-container">
          <Loader2 size={40} className="animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p className="leaderboard-empty">Chưa có người chơi nào hoàn thành ván trong chế độ này.</p>
      ) : (
        <>
          <div className="leaderboard-table" role="table" aria-label="Bảng xếp hạng Chess Arena">
            <div className="leaderboard-head" role="row">
              <span>Rank</span>
              <span>Người chơi</span>
              <span>Rating</span>
              <span>Ván</span>
              <span>W/L/D</span>
              <span>Cập nhật</span>
            </div>
            {entries.map((player) => (
              <div className={`leaderboard-row ${player.userId === currentUser?.userId ? 'me' : ''}`} role="row" key={player.userId}>
                <b className={`leaderboard-rank rank-${player.rank}`}>{medalIcon(player.rank)}</b>
                <button className="leaderboard-player profile-link-button" onClick={() => openProfile(player.userId)} type="button">
                  <PlayerAvatar player={player} />
                  <span>
                    <strong>{player.displayName}</strong>
                    <small>@{player.username}{player.provisional ? ' - tạm tính' : ''}</small>
                  </span>
                </button>
                <strong>{player.rating}</strong>
                <span>{player.gamesPlayed}</span>
                <span>{player.wins}/{player.losses}/{player.draws}</span>
                <span className="leaderboard-actions">
                  <time>{formatDate(player.updatedAt)}</time>
                  {player.userId !== currentUser?.userId && (
                    <button disabled={friendBusyId === player.userId} onClick={() => addFriend(player)} type="button">
                      <UserPlus size={15} /> Kết bạn
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={changePage} label="Phân trang bảng xếp hạng" />
        </>
      )}
    </section>
  );
}