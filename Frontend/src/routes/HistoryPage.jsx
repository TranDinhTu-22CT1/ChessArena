import React from 'react';
import { ArrowRight, History, LogIn, RefreshCw, ShieldCheck } from 'lucide-react';
import { fetchOnlineHistory } from '../api/online';

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

function gameResult(game) {
  if (game.result === '1/2-1/2') return { label: 'Hòa', tone: 'draw' };
  const won = (game.result === '1-0' && game.playerColor === 'w')
    || (game.result === '0-1' && game.playerColor === 'b');
  return { label: won ? 'Thắng' : 'Thua', tone: won ? 'win' : 'loss' };
}

export default function HistoryPage({ authUser, onLogin, onOpenReview }) {
  const [games, setGames] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(Boolean(authUser));
  const [message, setMessage] = React.useState('');

  const loadHistory = React.useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchOnlineHistory();
      setGames(data.games || []);
      setTotal(data.total ?? (data.games || []).length);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (!authUser) {
    return (
      <section className="history-auth-required">
        <ShieldCheck size={46} />
        <h1>Lịch sử trận đấu</h1>
        <p>Đăng nhập để xem các ván online đã hoàn thành và mở Game Review.</p>
        <button onClick={onLogin}><LogIn size={18} /> Đăng nhập</button>
      </section>
    );
  }

  return (
    <section className="history-page">
      <header className="history-header">
        <div>
          <span><History size={17} /> Lịch sử online</span>
          <h1>Các trận đã chơi</h1>
          <p>Tổng cộng <strong>{total}</strong> trận có kết quả.</p>
        </div>
        <button onClick={loadHistory} disabled={loading}><RefreshCw size={17} /> {loading ? 'Đang tải' : 'Tải lại'}</button>
      </header>

      {message && <p className="history-message">{message}</p>}
      {!loading && games.length === 0 && <p className="history-empty">Bạn chưa có trận online hoàn thành.</p>}

      <div className="history-list">
        {games.map((game) => {
          const opponent = game.white.you ? game.black : game.white;
          const result = gameResult(game);
          const player = game.playerColor === 'w' ? game.white : game.black;
          const ratingDelta = player?.ratingDelta;
          const ratingDeltaText = Number.isFinite(ratingDelta)
            ? `${ratingDelta > 0 ? '+' : ''}${ratingDelta} rating`
            : '';
          return (
            <button className="history-row" key={game.id} onClick={() => onOpenReview(game.id)}>
              <b className={result.tone}>{result.label}</b>
              <span>
                <strong>vs {opponent?.name || 'Player'}</strong>
                {ratingDeltaText && <small className={ratingDelta > 0 ? 'rating-up' : ratingDelta < 0 ? 'rating-down' : ''}>{ratingDeltaText}</small>}
                <small>{game.mode || 'rapid'} - {game.timeControl} - {(game.moves || []).length} nước</small>
              </span>
              <time>{formatDate(game.finishedAt)}</time>
              <em>{game.endReason === 'timeout' ? 'Hết giờ' : game.status}</em>
              <ArrowRight size={18} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
