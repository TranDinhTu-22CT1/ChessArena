import React from 'react';
import { ArrowRight, Filter, History, LogIn, RefreshCw, ShieldCheck } from 'lucide-react';
import { fetchOnlineHistory } from '../../api/online';
import Pagination, { getUrlPage, setUrlPage } from '../../components/Pagination';

const RESULT_FILTERS = new Set(['all', 'win', 'loss', 'draw']);
const MODE_FILTERS = new Set(['all', 'bullet', 'blitz', 'rapid', 'classical']);
const REVIEW_FILTERS = new Set(['all', 'reviewed', 'unreviewed']);

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

function getUrlFilter(name, allowed, fallback = 'all') {
  if (typeof window === 'undefined') return fallback;
  const value = new URLSearchParams(window.location.search).get(name);
  return allowed.has(value) ? value : fallback;
}

function setUrlFilters(next) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  Object.entries(next).forEach(([key, value]) => {
    if (!value || value === 'all') params.delete(key);
    else params.set(key, value);
  });
  const query = params.toString();
  window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

function gameResult(game) {
  if (game.result === '1/2-1/2') return { label: 'Hòa', tone: 'draw' };
  const won = (game.result === '1-0' && game.playerColor === 'w')
    || (game.result === '0-1' && game.playerColor === 'b');
  return { label: won ? 'Thắng' : 'Thua', tone: won ? 'win' : 'loss' };
}

function reviewPriority(game) {
  const result = gameResult(game);
  const moveCount = (game.moves || []).length;
  if (result.tone === 'loss' && moveCount >= 20) return 'Nên review: tìm nước đi làm mất thế trận';
  if (result.tone === 'loss') return 'Nên review: xem lại khai cuộc và cách thoát thế khó';
  if (result.tone === 'draw') return 'Nên review: tìm cơ hội chuyển hòa thành thắng';
  if (moveCount >= 45) return 'Nên review: kỹ thuật chuyển hóa lợi thế';
  return 'Review nhanh: giữ thói quen tốt';
}

export default function HistoryPage({ authUser, onLogin, onOpenReview }) {
  const [games, setGames] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(() => getUrlPage('page'));
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(Boolean(authUser));
  const [message, setMessage] = React.useState('');
  const [filters, setFilters] = React.useState(() => ({
    result: getUrlFilter('result', RESULT_FILTERS),
    mode: getUrlFilter('mode', MODE_FILTERS),
    review: getUrlFilter('review', REVIEW_FILTERS)
  }));

  const loadHistory = React.useCallback(async (nextPage = page, nextFilters = filters) => {
    if (!authUser) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchOnlineHistory({ page: nextPage, limit: 10, ...nextFilters });
      setGames(data.games || []);
      setTotal(data.total ?? (data.games || []).length);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [authUser, filters, page]);

  React.useEffect(() => {
    loadHistory(page, filters);
  }, [filters, loadHistory, page]);

  const changePage = React.useCallback((nextPage) => {
    setPage(nextPage);
    setUrlPage(nextPage, 'page');
  }, []);

  const updateFilters = React.useCallback((patch) => {
    const nextFilters = { ...filters, ...patch };
    setFilters(nextFilters);
    setPage(1);
    setUrlPage(1, 'page');
    setUrlFilters(nextFilters);
  }, [filters]);

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
          <p>Tổng cộng <strong>{total}</strong> trận phù hợp. Đang ở trang <strong>{page}</strong>.</p>
        </div>
        <button onClick={() => loadHistory(page, filters)} disabled={loading}>
          <RefreshCw size={17} /> {loading ? 'Đang tải' : 'Tải lại'}
        </button>
      </header>

      <div className="history-filters" aria-label="Lọc lịch sử online">
        <span><Filter size={16} /> Bộ lọc</span>
        <select value={filters.result} onChange={(event) => updateFilters({ result: event.target.value })}>
          <option value="all">Mọi kết quả</option>
          <option value="win">Thắng</option>
          <option value="loss">Thua</option>
          <option value="draw">Hòa</option>
        </select>
        <select value={filters.mode} onChange={(event) => updateFilters({ mode: event.target.value })}>
          <option value="all">Mọi chế độ</option>
          <option value="bullet">Bullet</option>
          <option value="blitz">Blitz</option>
          <option value="rapid">Rapid</option>
          <option value="classical">Classical</option>
        </select>
        <select value={filters.review} onChange={(event) => updateFilters({ review: event.target.value })}>
          <option value="all">Tất cả review</option>
          <option value="reviewed">Đã review</option>
          <option value="unreviewed">Chưa review</option>
        </select>
      </div>

      {message && <p className="history-message">{message}</p>}
      {!loading && games.length === 0 && <p className="history-empty">Không có trận nào phù hợp với bộ lọc hiện tại.</p>}

      <div className="history-list">
        {games.map((game) => {
          const white = game.white || {};
          const black = game.black || {};
          const opponent = white.you ? black : white;
          const result = gameResult(game);
          const player = game.playerColor === 'w' ? white : black;
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
                {game.review && <small>Đã lưu review: accuracy {game.review.accuracy}% - {game.review.blunders} blunder - {game.review.mistakes} mistake</small>}
                <small>{reviewPriority(game)}</small>
              </span>
              <time>{formatDate(game.finishedAt)}</time>
              <em>{game.endReason === 'timeout' ? 'Hết giờ' : game.status}</em>
              <ArrowRight size={18} />
            </button>
          );
        })}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={changePage}
        label="Phân trang lịch sử trận đấu"
      />
    </section>
  );
}
