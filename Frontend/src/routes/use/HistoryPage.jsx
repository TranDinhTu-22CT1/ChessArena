import React from 'react';
import { ArrowRight, Filter, History, LogIn, RefreshCw, ShieldCheck } from 'lucide-react';
import { fetchOnlineHistory } from '../../api/online';
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

function gameResult(game) {
  if (game.result === '1/2-1/2') return { label: 'Hòa', tone: 'draw' };
  const won = (game.result === '1-0' && game.playerColor === 'w')
    || (game.result === '0-1' && game.playerColor === 'b');
  return { label: won ? 'Thắng' : 'Thua', tone: won ? 'win' : 'loss' };
}

function reviewPriority(game) {
  const result = gameResult(game);
  const moveCount = (game.moves || []).length;
  if (result.tone === 'loss' && moveCount >= 20) return 'Ưu tiên review: tìm blunder quyết định';
  if (result.tone === 'loss') return 'Ưu tiên review: khai cuộc/thoát trận nhanh';
  if (result.tone === 'draw') return 'Review tiêu điểm: cơ hội chuyển lợi thế';
  if (moveCount >= 45) return 'Review nâng cao: kỹ thuật chuyển hóa';
  return 'Review nhanh: giữ thói quen tốt';
}

function matchesFilter(game, filters) {
  const result = gameResult(game).tone;
  const mode = game.mode || 'rapid';
  const reviewed = Boolean(game.review);
  return (filters.result === 'all' || filters.result === result)
    && (filters.mode === 'all' || filters.mode === mode)
    && (filters.review === 'all' || (filters.review === 'reviewed' ? reviewed : !reviewed));
}

export default function HistoryPage({ authUser, onLogin, onOpenReview }) {
  const [games, setGames] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(() => getUrlPage('page'));
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(Boolean(authUser));
  const [message, setMessage] = React.useState('');
  const [filters, setFilters] = React.useState({ result: 'all', mode: 'all', review: 'all' });

  const loadHistory = React.useCallback(async (nextPage = page) => {
    if (!authUser) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchOnlineHistory({ page: nextPage, limit: 10 });
      setGames(data.games || []);
      setTotal(data.total ?? (data.games || []).length);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [authUser, page]);

  React.useEffect(() => {
    loadHistory(page);
  }, [loadHistory, page]);

  const changePage = React.useCallback((nextPage) => {
    setPage(nextPage);
    setUrlPage(nextPage, 'page');
  }, []);

  const updateFilters = React.useCallback((patch) => {
    setFilters((current) => ({ ...current, ...patch }));
    changePage(1);
  }, [changePage]);

  const visibleGames = React.useMemo(() => games.filter((game) => matchesFilter(game, filters)), [filters, games]);

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
          <p>Tổng cộng <strong>{total}</strong> trận có kết quả. Đang hiển thị <strong>{visibleGames.length}</strong> trận ở trang <strong>{page}</strong>.</p>
        </div>
        <button onClick={() => loadHistory(page)} disabled={loading}><RefreshCw size={17} /> {loading ? 'Đang tải' : 'Tải lại'}</button>
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
      {!loading && games.length === 0 && <p className="history-empty">Bạn chưa có trận online hoàn thành.</p>}
      {!loading && games.length > 0 && visibleGames.length === 0 && <p className="history-empty">Không có trận nào khớp bộ lọc hiện tại.</p>}

      <div className="history-list">
        {visibleGames.map((game) => {
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
