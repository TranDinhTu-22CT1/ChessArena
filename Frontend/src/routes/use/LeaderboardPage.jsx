import React from 'react';
import { Crown, LogIn, Medal, RefreshCw, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import { fetchLeaderboard } from '../../api/leaderboard';

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

export default function LeaderboardPage({ authUser, onLogin }) {
  const [mode, setMode] = React.useState('rapid');
  const [entries, setEntries] = React.useState([]);
  const [currentUser, setCurrentUser] = React.useState(null);
  const [loading, setLoading] = React.useState(Boolean(authUser));
  const [message, setMessage] = React.useState('');

  const loadLeaderboard = React.useCallback(async (nextMode = mode) => {
    if (!authUser) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchLeaderboard(nextMode);
      setEntries(data.entries || []);
      setCurrentUser(data.currentUser || null);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [authUser, mode]);

  React.useEffect(() => {
    loadLeaderboard(mode);
  }, [loadLeaderboard, mode]);

  if (!authUser) {
    return (
      <section className="leaderboard-auth-required">
        <Trophy size={48} />
        <h1>Báº£ng xáº¿p háº¡ng</h1>
        <p>ÄÄƒng nháº­p Ä‘á»ƒ xem rating online theo tá»«ng cháº¿ Ä‘á»™ vĂ  vá»‹ trĂ­ cá»§a báº¡n.</p>
        <button onClick={onLogin}><LogIn size={18} /> ÄÄƒng nháº­p</button>
      </section>
    );
  }

  return (
    <section className="leaderboard-page">
      <header className="leaderboard-hero">
        <div>
          <span><Trophy size={18} /> Chess Arena Leaderboard</span>
          <h1>Báº£ng xáº¿p háº¡ng online</h1>
          <p>Rating Ä‘Æ°á»£c tĂ¡ch theo Bullet, Blitz, Rapid vĂ  Classical. NgÆ°á»i chÆ¡i dÆ°á»›i 20 vĂ¡n váº«n Ä‘Æ°á»£c Ä‘Ă¡nh dáº¥u táº¡m tĂ­nh.</p>
        </div>
        <button onClick={() => loadLeaderboard(mode)} disabled={loading}>
          <RefreshCw size={17} /> {loading ? 'Äang táº£i' : 'Táº£i láº¡i'}
        </button>
      </header>

      <nav className="leaderboard-tabs" aria-label="Chá»n cháº¿ Ä‘á»™ rating">
        {MODES.map((item) => (
          <button
            className={mode === item.id ? 'active' : ''}
            key={item.id}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {currentUser && (
        <article className="leaderboard-current">
          <ShieldCheck size={20} />
          <div>
            <strong>Thá»© háº¡ng cá»§a báº¡n: #{currentUser.rank}</strong>
            <span>{currentUser.rating} rating - {currentUser.gamesPlayed} vĂ¡n - tháº¯ng {currentUser.winRate}%</span>
          </div>
        </article>
      )}

      {message && <p className="leaderboard-message">{message}</p>}
      {!loading && entries.length === 0 && <p className="leaderboard-empty">ChÆ°a cĂ³ ngÆ°á»i chÆ¡i nĂ o hoĂ n thĂ nh vĂ¡n trong cháº¿ Ä‘á»™ nĂ y.</p>}

      <div className="leaderboard-table" role="table" aria-label="Báº£ng xáº¿p háº¡ng Chess Arena">
        <div className="leaderboard-head" role="row">
          <span>Rank</span>
          <span>NgÆ°á»i chÆ¡i</span>
          <span>Rating</span>
          <span>VĂ¡n</span>
          <span>W/L/D</span>
          <span>Cáº­p nháº­t</span>
        </div>
        {entries.map((player) => (
          <div className={`leaderboard-row ${player.userId === currentUser?.userId ? 'me' : ''}`} role="row" key={player.userId}>
            <b className={`leaderboard-rank rank-${player.rank}`}>{medalIcon(player.rank)}</b>
            <span className="leaderboard-player">
              <PlayerAvatar player={player} />
              <span>
                <strong>{player.displayName}</strong>
                <small>@{player.username}{player.provisional ? ' - táº¡m tĂ­nh' : ''}</small>
              </span>
            </span>
            <strong>{player.rating}</strong>
            <span>{player.gamesPlayed}</span>
            <span>{player.wins}/{player.losses}/{player.draws}</span>
            <time>{formatDate(player.updatedAt)}</time>
          </div>
        ))}
      </div>
    </section>
  );
}
