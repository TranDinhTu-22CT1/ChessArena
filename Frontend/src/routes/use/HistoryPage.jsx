import React from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Filter,
  History,
  Loader2,
  LogIn,
  RefreshCw,
  Scale,
  Swords,
  Trophy,
  XCircle
} from 'lucide-react';
import { fetchOnlineHistory } from '../../api/online';
import Pagination, { getUrlPage, setUrlPage } from '../../components/Pagination';

const RESULT_FILTERS = new Set(['all', 'win', 'loss', 'draw']);
const MODE_FILTERS = new Set(['all', 'bullet', 'blitz', 'rapid', 'classical']);
const REVIEW_FILTERS = new Set(['all', 'reviewed', 'unreviewed']);
const MODE_LABELS = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  classical: 'Classical'
};

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
  const won = (game.result === '1-0' && game.playerColor === 'w') || (game.result === '0-1' && game.playerColor === 'b');
  return { label: won ? 'Thắng' : 'Thua', tone: won ? 'win' : 'loss' };
}

function pageSummary(games) {
  return games.reduce((summary, game) => {
    const result = gameResult(game);
    summary[result.tone] += 1;
    if (game.review) summary.reviewed += 1;
    summary.moves += game.moves?.length || 0;
    return summary;
  }, { win: 0, loss: 0, draw: 0, reviewed: 0, moves: 0 });
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
        <ShieldCheckIcon />
        <h1>Lịch sử trận đấu</h1>
        <p>Đăng nhập để xem các ván online đã hoàn thành và mở Game Review.</p>
        <button onClick={onLogin}><LogIn size={18} /> Đăng nhập</button>
      </section>
    );
  }

  const summary = pageSummary(games);
  const averageMoves = games.length ? Math.round(summary.moves / games.length) : 0;
  const activeFilters = Object.values(filters).filter((value) => value !== 'all').length;

  return (
    <section className="history-dashboard">
      <header className="history-dashboard-hero">
        <div className="history-dashboard-copy">
          <span><History size={17} /> Kho lưu trữ ván đấu</span>
          <h1>Lịch sử thi đấu</h1>
          <p>Xem lại phong độ, lọc các ván quan trọng và tiếp tục phân tích bằng Game Review.</p>
        </div>
        <button className="history-refresh-button" onClick={() => loadHistory(page, filters)} disabled={loading}>
          <RefreshCw size={17} className={loading ? 'history-spin' : ''} />
          {loading ? 'Đang tải' : 'Làm mới'}
        </button>
      </header>

      <section className="history-stat-grid" aria-label="Tổng quan trang hiện tại">
        <article className="total">
          <span><Swords size={18} /></span>
          <div><strong>{total}</strong><small>Tổng ván · Trang {page}/{totalPages}</small></div>
        </article>
        <article className="win">
          <span><Trophy size={18} /></span>
          <div><strong>{summary.win}</strong><small>Chiến thắng</small></div>
        </article>
        <article className="loss">
          <span><XCircle size={18} /></span>
          <div><strong>{summary.loss}</strong><small>Thất bại</small></div>
        </article>
        <article className="draw">
          <span><Scale size={18} /></span>
          <div><strong>{summary.draw}</strong><small>Ván hòa</small></div>
        </article>
        <article className="reviewed">
          <span><Brain size={18} /></span>
          <div><strong>{summary.reviewed}</strong><small>Đã review</small></div>
        </article>
        <article>
          <span><BarChart3 size={18} /></span>
          <div><strong>{averageMoves}</strong><small>Nước / ván</small></div>
        </article>
      </section>

      <div className="history-workspace">
        <div className="history-toolbar">
          <div className="history-toolbar-title">
            <span><Filter size={16} /> Bộ lọc</span>
            <small>{activeFilters ? `${activeFilters} bộ lọc đang dùng` : 'Đang hiển thị tất cả'}</small>
          </div>
          <label>
            <span>Kết quả</span>
            <select value={filters.result} onChange={(event) => updateFilters({ result: event.target.value })}>
              <option value="all">Mọi kết quả</option>
              <option value="win">Thắng</option>
              <option value="loss">Thua</option>
              <option value="draw">Hòa</option>
            </select>
          </label>
          <label>
            <span>Chế độ</span>
            <select value={filters.mode} onChange={(event) => updateFilters({ mode: event.target.value })}>
              <option value="all">Mọi chế độ</option>
              <option value="bullet">Bullet</option>
              <option value="blitz">Blitz</option>
              <option value="rapid">Rapid</option>
              <option value="classical">Classical</option>
            </select>
          </label>
          <label>
            <span>Phân tích</span>
            <select value={filters.review} onChange={(event) => updateFilters({ review: event.target.value })}>
              <option value="all">Tất cả ván</option>
              <option value="reviewed">Đã review</option>
              <option value="unreviewed">Chưa review</option>
            </select>
          </label>
        </div>

        {message && <p className="history-message">{message}</p>}

        {loading ? (
          <div className="history-loading">
            <Loader2 size={34} className="history-spin" />
            <span>Đang tải lịch sử...</span>
          </div>
        ) : games.length === 0 ? (
          <div className="history-empty">
            <Swords size={34} />
            <strong>Không tìm thấy ván đấu</strong>
            <span>Thử thay đổi bộ lọc để xem thêm kết quả.</span>
          </div>
        ) : (
          <div className="history-list">
            {games.map((game) => {
              const white = game.white || {};
              const black = game.black || {};
              const opponent = white.you ? black : white;
              const result = gameResult(game);
              const ratingDelta = game.playerColor === 'w' ? white.ratingDelta : black.ratingDelta;
              return (
                <button className="history-row" key={game.id} onClick={() => onOpenReview(game.id)}>
                  <b className={result.tone}>{result.label}</b>
                  <span className="history-game-primary">
                    <strong>vs {opponent?.name || 'Player'}</strong>
                    <small>
                      {MODE_LABELS[game.mode] || game.mode || 'Rapid'}
                      <i>·</i>
                      {game.timeControl || '--'}
                      <i>·</i>
                      {(game.moves || []).length} nước
                      <i>·</i>
                      Quân {game.playerColor === 'w' ? 'Trắng' : 'Đen'}
                    </small>
                  </span>
                  <span className="history-review-state">
                    {game.review ? <CheckCircle2 size={15} /> : <Brain size={15} />}
                    <strong>{game.review ? `${game.review.accuracy ?? '--'}%` : 'Chưa review'}</strong>
                    {Number.isFinite(ratingDelta) && (
                      <small className={ratingDelta > 0 ? 'rating-up' : ratingDelta < 0 ? 'rating-down' : ''}>
                        {ratingDelta > 0 ? '+' : ''}{ratingDelta} rating
                      </small>
                    )}
                  </span>
                  <time>{formatDate(game.finishedAt)}</time>
                  <ArrowUpRight size={18} />
                </button>
              );
            })}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onPageChange={changePage} label="Phân trang lịch sử" />
      </div>
    </section>
  );
}

function ShieldCheckIcon() {
  return (
    <span className="history-auth-icon" aria-hidden="true">
      <Swords size={28} />
    </span>
  );
}
