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
    year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh'
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

function TopThreePodium({ entries, seasonal }) {
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
          <b>{seasonal ? player.points : player.rating}</b>
          <span>{seasonal ? 'điểm kỳ' : 'Elo'}</span>
        </button>
      ))}
    </section>
  );
}

export default function LeaderboardPage({ authUser, onLogin }) {
  const [mode, setMode] = React.useState('rapid');
  const [period, setPeriod] = React.useState('all');
  const [offset, setOffset] = React.useState(0);
  const [season, setSeason] = React.useState(null);
  const requestRef = React.useRef(null);
  const seasonal = period !== 'all';
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
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setMessage('');
    setCurrentUser(null);
    setSeason(null);
    setEntries([]);
    try {
      const data = await fetchLeaderboard(nextMode, { page: nextPage, limit: 20, period, offset, signal: controller.signal });
      if (controller.signal.aborted) return;
      setEntries(data.entries || []);
      setCurrentUser(data.currentUser || null);
      setSeason(data);
      setPage(data.page || nextPage);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [authUser, mode, page, period, offset]);

  React.useEffect(() => {
    loadLeaderboard(mode, page);
    return () => requestRef.current?.abort();
  }, [loadLeaderboard, mode, page]);

  // Refresh an open current-period view after the server's boundary, even if
  // the browser clock is wrong. Past periods do not need a reset timer.
  React.useEffect(() => {
    if (!season?.periodEnd || offset !== 0) return undefined;
    const remaining = Date.parse(season.periodEnd) - Date.parse(season.serverNow);
    const timer = window.setTimeout(() => loadLeaderboard(mode, 1), Math.max(1000, Math.min(86400000, remaining + 500)));
    return () => window.clearTimeout(timer);
  }, [season, offset, mode, loadLeaderboard]);

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
          <p>Elo thể hiện trình độ lâu dài. Điểm tuần và tháng tạo cuộc đua mới, giữ lại kết quả các kỳ trước.</p>
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

      <div className="leaderboard-season-controls">
        <label>Bảng xếp hạng
          <select value={period} onChange={(event) => { setPeriod(event.target.value); setOffset(0); setPage(1); setUrlPage(1, 'page'); }}>
            <option value="all">Elo tổng</option><option value="week">Theo tuần</option><option value="month">Theo tháng</option>
          </select>
        </label>
        {seasonal && <label>Kỳ thi đấu
          <select value={offset} onChange={(event) => { setOffset(Number(event.target.value)); setPage(1); setUrlPage(1, 'page'); }}>
            <option value={0}>{period === 'week' ? 'Tuần này' : 'Tháng này'}</option>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} {period === 'week' ? 'tuần' : 'tháng'} trước</option>)}
          </select>
        </label>}
      </div>
      {seasonal && <aside className="leaderboard-season-note">
        <strong>{season?.periodStart ? `${formatDate(season.periodStart)} – ${formatDate(new Date(Date.parse(season.periodEnd) - 1))} · giờ Việt Nam` : 'Xếp hạng theo kỳ'}</strong>
        <p>Thắng 3 điểm · hòa 1 điểm · thua 0 điểm. Chỉ tính trận ghép nhanh có xếp hạng đã chốt kết quả; tối đa 3 trận với cùng đối thủ mỗi ngày, tính chung mọi chế độ.</p>
        <p>Kỳ mới bắt đầu lúc 00:00 thứ Hai hoặc ngày 1 hằng tháng. Điểm kỳ mới về 0; Elo và lịch sử vẫn giữ nguyên. Chưa có trận hợp lệ thì chưa xếp hạng.</p>
        <small>Bằng điểm: ưu tiên số trận thắng, thời điểm hoàn thành trận tính điểm cuối sớm hơn, rồi mã người chơi để thứ tự ổn định.</small>
        {!loading && season && <p>{season.previousUser ? `Kỳ liền trước: #${season.previousUser.rank} · ${season.previousUser.points} điểm.` : 'Bạn chưa có hạng ở kỳ liền trước.'}</p>}
      </aside>}

      {currentUser && (
        <article className="leaderboard-current">
          <ShieldCheck size={20} />
          <div>
            <strong>Thứ hạng của bạn: #{currentUser.rank}</strong>
            <span>{seasonal ? `${currentUser.points} điểm kỳ · ${currentUser.rating} Elo hiện tại` : `${currentUser.rating} Elo`} · {currentUser.gamesPlayed} ván · thắng {currentUser.winRate}%</span>
          </div>
        </article>
      )}
      {seasonal && season && !currentUser && !loading && <p className="leaderboard-message">Bạn chưa có hạng trong kỳ đã chọn. Hoàn thành một trận hợp lệ để tham gia.</p>}

      {message && <p className="leaderboard-message">{message}</p>}

      {loading ? (
        <div className="leaderboard-loading">
          <Loader2 size={40} className="leaderboard-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p className="leaderboard-empty">Chưa có người chơi nào hoàn thành ván trong chế độ này.</p>
      ) : (
        <>
          {page === 1 && <TopThreePodium entries={entries} seasonal={seasonal} />}
          {visibleEntries.length > 0 && (
            <div className="leaderboard-table" role="table" aria-label="Bảng xếp hạng Chess Arena">
              <div className="leaderboard-head" role="row">
                <span>Hạng</span>
                <span>Người chơi</span>
                <span>{seasonal ? 'Điểm kỳ' : 'Elo'}</span>
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
                  <strong className="leaderboard-rating">{seasonal ? player.points : player.rating}</strong>
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
