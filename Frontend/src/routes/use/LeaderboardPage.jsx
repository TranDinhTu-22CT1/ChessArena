import React from 'react';
import { Loader2, LogIn, RefreshCw, ShieldCheck, Trophy, UserPlus, UserRound } from 'lucide-react';
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

function Medal3D({ rank, compact = false }) {
  return (
    <span className={`leaderboard-medal-3d medal-${rank} ${compact ? 'compact' : ''}`} aria-label={`Hạng ${rank}`}>
      <span className="leaderboard-medal-ribbon" aria-hidden="true" />
      <span className="leaderboard-medal-disc">
        <span>{rank}</span>
      </span>
    </span>
  );
}

function rankIcon(rank) {
  if (rank <= 3) return <Medal3D rank={rank} compact />;
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

function TopThreePodium({ entries }) {
  const players = [2, 1, 3]
    .map((rank) => entries.find((player) => player.rank === rank))
    .filter(Boolean);

  if (!players.length) return null;

  return (
    <section className="leaderboard-podium" aria-label="Top 3 người chơi">
      {players.map((player) => (
        <button
          className={`leaderboard-podium-card podium-rank-${player.rank}`}
          key={player.userId}
          onClick={() => openProfile(player.userId)}
          type="button"
        >
          <span className="leaderboard-podium-medal-slot">
          <Medal3D rank={player.rank} />
          </span>
          <PlayerAvatar player={player} />
          <strong>{player.displayName}</strong>
          {player.provisional && <small>Tạm tính</small>}
          <b>{player.rating}</b>
          <span>rating</span>
        </button>
      ))}
    </section>
  );
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
  const visibleEntries = page === 1
    ? entries.filter((player) => player.rank > 3)
    : entries;

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
      <header className="leaderboard-hero">
        <div>
          <span><Trophy size={18} /> Chess Arena Leaderboard</span>
          <h1>Bảng xếp hạng online</h1>
          <p>Rating được tách theo Bullet, Blitz, Rapid và Classical. Người chơi dưới 20 ván vẫn được đánh dấu tạm tính.</p>
        </div>
        <button onClick={() => loadLeaderboard(mode, page)} disabled={loading}>
          <RefreshCw size={17} className={loading ? 'leaderboard-spin' : ''} />
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
            <span>{currentUser.rating} rating · {currentUser.gamesPlayed} ván · thắng {currentUser.winRate}%</span>
          </div>
        </article>
      )}

      {message && <p className="leaderboard-message">{message}</p>}

      {loading ? (
        <div className="leaderboard-loading">
          <Loader2 size={40} className="leaderboard-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p className="leaderboard-empty">Chưa có người chơi nào hoàn thành ván trong chế độ này.</p>
      ) : (
        <>
          {page === 1 && <TopThreePodium entries={entries} />}
          {visibleEntries.length > 0 && (
            <div className="leaderboard-table" role="table" aria-label="Bảng xếp hạng Chess Arena">
              <div className="leaderboard-head" role="row">
                <span>Hạng</span>
                <span>Người chơi</span>
                <span>Rating</span>
                <span>Ván</span>
                <span>Thắng/Thua/Hòa</span>
                <span>Cập nhật</span>
              </div>
              {visibleEntries.map((player) => (
                <div className={`leaderboard-row ${player.userId === currentUser?.userId ? 'me' : ''}`} role="row" key={player.userId}>
                  <b className={`leaderboard-rank rank-${player.rank}`}>{rankIcon(player.rank)}</b>
                  <button className="leaderboard-player" onClick={() => openProfile(player.userId)} type="button">
                  <PlayerAvatar player={player} />
                  <span>
                    <strong>{player.displayName}</strong>
                    {player.provisional && <small>Tạm tính</small>}
                  </span>
                  </button>
                  <strong className="leaderboard-rating">{player.rating}</strong>
                  <span className="leaderboard-games">{player.gamesPlayed}</span>
                  <span className="leaderboard-record">{player.wins}/{player.losses}/{player.draws}</span>
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
          )}
          <Pagination page={page} totalPages={totalPages} onPageChange={changePage} label="Phân trang bảng xếp hạng" />
        </>
      )}
    </section>
  );
}
