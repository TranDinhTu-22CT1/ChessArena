import React from 'react';
import { ArrowRight, History, LogIn, RefreshCw, ShieldCheck } from 'lucide-react';
import { fetchOnlineHistory } from '../../api/online';

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
  if (game.result === '1/2-1/2') return { label: 'HĂ²a', tone: 'draw' };
  const won = (game.result === '1-0' && game.playerColor === 'w')
    || (game.result === '0-1' && game.playerColor === 'b');
  return { label: won ? 'Tháº¯ng' : 'Thua', tone: won ? 'win' : 'loss' };
}

function reviewPriority(game) {
  const result = gameResult(game);
  const moveCount = (game.moves || []).length;
  if (result.tone === 'loss' && moveCount >= 20) return 'Uu tien review: tim blunder quyet dinh';
  if (result.tone === 'loss') return 'Uu tien review: khai cuoc/thoat tran nhanh';
  if (result.tone === 'draw') return 'Review tieu diem: co hoi chuyen loi the';
  if (moveCount >= 45) return 'Review nang cao: ky thuat chuyen hoa';
  return 'Review nhanh: giu thoi quen tot';
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
        <h1>Lá»‹ch sá»­ tráº­n Ä‘áº¥u</h1>
        <p>ÄÄƒng nháº­p Ä‘á»ƒ xem cĂ¡c vĂ¡n online Ä‘Ă£ hoĂ n thĂ nh vĂ  má»Ÿ Game Review.</p>
        <button onClick={onLogin}><LogIn size={18} /> ÄÄƒng nháº­p</button>
      </section>
    );
  }

  return (
    <section className="history-page">
      <header className="history-header">
        <div>
          <span><History size={17} /> Lá»‹ch sá»­ online</span>
          <h1>CĂ¡c tráº­n Ä‘Ă£ chÆ¡i</h1>
          <p>Tá»•ng cá»™ng <strong>{total}</strong> tráº­n cĂ³ káº¿t quáº£.</p>
        </div>
        <button onClick={loadHistory} disabled={loading}><RefreshCw size={17} /> {loading ? 'Äang táº£i' : 'Táº£i láº¡i'}</button>
      </header>

      {message && <p className="history-message">{message}</p>}
      {!loading && games.length === 0 && <p className="history-empty">Báº¡n chÆ°a cĂ³ tráº­n online hoĂ n thĂ nh.</p>}

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
                <small>{game.mode || 'rapid'} - {game.timeControl} - {(game.moves || []).length} nÆ°á»›c</small>
                {game.review && <small>Da luu review: accuracy {game.review.accuracy}% - {game.review.blunders} blunder - {game.review.mistakes} mistake</small>}
                <small>{reviewPriority(game)}</small>
              </span>
              <time>{formatDate(game.finishedAt)}</time>
              <em>{game.endReason === 'timeout' ? 'Háº¿t giá»' : game.status}</em>
              <ArrowRight size={18} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
