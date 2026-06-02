import React from 'react';
import { CalendarClock, Crown, Trophy, Users } from 'lucide-react';
import { fetchTournaments, joinTournament } from '../../api/tournaments';

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Chưa lên lịch';
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
      .catch((error) => setMessage(error.message || 'Could not load tournaments.'))
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
      setMessage('Đã tham gia giải. Khi giải chạy, hệ thống sẽ dùng điểm arena để xếp hạng.');
      load();
    } catch (error) {
      setMessage(error.message || 'Could not join tournament.');
    } finally {
      setBusyId('');
    }
  };

  if (!authUser) {
    return (
      <section className="feature-page empty-feature">
        <Trophy size={44} />
        <h1>Tournament Arena</h1>
        <p>Đăng nhập để tham gia giải nhanh toàn hệ thống và theo dõi bảng xếp hạng.</p>
        <button onClick={onLogin}>Đăng nhập</button>
      </section>
    );
  }

  return (
    <section className="feature-page">
      <header className="feature-hero">
        <div>
          <span>Arena</span>
          <h1>Tournament Arena</h1>
          <p>Giải đấu toàn hệ thống, không dùng club. Bản đầu hỗ trợ đăng ký và standings.</p>
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
                <span>{item.status}</span>
                <h2>{item.title}</h2>
              </div>
              <strong>{item.timeControl}</strong>
            </div>
            <div className="tournament-meta">
              <span><CalendarClock size={16} /> {formatDate(item.startsAt)}</span>
              <span><Users size={16} /> {item.players.length} người chơi</span>
            </div>
            <button disabled={item.joined || busyId === item.id} onClick={() => join(item.id)}>
              {item.joined ? 'Đã tham gia' : busyId === item.id ? 'Đang tham gia...' : 'Tham gia giải'}
            </button>
            <div className="standings">
              {item.players.length === 0 ? (
                <p>Chưa có người chơi. Hãy là người đầu tiên tham gia.</p>
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

      <section className="feature-note">
        <Crown size={20} />
        <p>Bước tiếp theo có thể nối arena vào matchmaking để tự ghép cặp trong thời gian giải.</p>
      </section>
    </section>
  );
}
