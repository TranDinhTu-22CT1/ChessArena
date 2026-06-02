import React from 'react';
import { CalendarClock, Crown, Trophy, Users } from 'lucide-react';
import { fetchTournaments, joinTournament } from '../../api/tournaments';

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa lên lịch';
}

function statusLabel(status) {
  const labels = {
    scheduled: 'Sắp diễn ra',
    open: 'Đang mở đăng ký',
    running: 'Đang thi đấu',
    finished: 'Đã kết thúc',
    cancelled: 'Đã hủy'
  };
  return labels[status] || status || '--';
}

export default function TournamentsPage({ authUser, onLogin, onNavigate }) {
  const [tournaments, setTournaments] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState('');
  const [message, setMessage] = React.useState('');

  const load = React.useCallback(() => {
    if (!authUser) return;
    setLoading(true);
    setMessage('');
    fetchTournaments()
      .then((data) => setTournaments(data.tournaments || []))
      .catch((error) => setMessage(error.message || 'Không tải được danh sách giải đấu.'))
      .finally(() => setLoading(false));
  }, [authUser]);

  React.useEffect(() => {
    load();
  }, [load]);

  const join = async (id) => {
    setBusyId(id);
    setMessage('');
    try {
      await joinTournament(id);
      setMessage('Đã tham gia giải đấu. Khi giải diễn ra, bảng xếp hạng sẽ cập nhật theo điểm của người chơi.');
      load();
    } catch (error) {
      setMessage(error.message || 'Không thể tham gia giải đấu.');
    } finally {
      setBusyId('');
    }
  };

  if (!authUser) {
    return (
      <section className="feature-page empty-feature">
        <Trophy size={44} />
        <h1>Giải đấu ChessArena</h1>
        <p>Đăng nhập để tham gia các giải mở toàn hệ thống, tích điểm và tranh top vinh danh.</p>
        <button onClick={onLogin}>Đăng nhập</button>
      </section>
    );
  }

  return (
    <section className="feature-page">
      <header className="feature-hero">
        <div>
          <span>Giải đấu</span>
          <h1>Giải đấu ChessArena</h1>
          <p>Tham gia các giải mở trong thời gian giới hạn, tích điểm và cạnh tranh top 1-2-3.</p>
        </div>
        <button onClick={() => onNavigate('online')}>Chơi online</button>
      </header>

      {loading && <p className="feature-message">Đang tải giải đấu...</p>}
      {message && <p className="feature-message">{message}</p>}

      <div className="tournament-list">
        {tournaments.map((item) => (
          <article className="tournament-card" key={item.id}>
            <div className="tournament-top">
              <div>
                <span>{statusLabel(item.status)}</span>
                <h2>{item.title}</h2>
              </div>
              <strong>{item.timeControl}</strong>
            </div>
            <div className="tournament-meta">
              <span><CalendarClock size={16} /> {formatDate(item.startsAt)}</span>
              <span><Users size={16} /> {item.players.length} người tham gia</span>
            </div>
            {item.players.length > 0 && (
              <div className="tournament-podium">
                {item.players.slice(0, 3).map((player) => (
                  <span key={player.userId}>
                    <Crown size={14} /> Top {player.rank}: {player.displayName}
                  </span>
                ))}
              </div>
            )}
            <button disabled={item.joined || busyId === item.id} onClick={() => join(item.id)}>
              {item.joined ? 'Đã tham gia' : busyId === item.id ? 'Đang tham gia...' : 'Tham gia giải'}
            </button>
            <div className="standings">
              {item.players.length === 0 ? (
                <p>Chưa có người tham gia. Hãy là người đầu tiên ghi tên.</p>
              ) : item.players.map((player) => (
                <div key={player.userId}>
                  <span>{player.rank}</span>
                  <b>{player.displayName}</b>
                  <strong>{player.score}</strong>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

    </section>
  );
}
