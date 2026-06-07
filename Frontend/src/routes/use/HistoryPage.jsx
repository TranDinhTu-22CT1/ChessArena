import React from 'react';
import { ArrowRight, Filter, History, Loader2, LogIn, RefreshCw, ShieldCheck } from 'lucide-react';
import { fetchOnlineHistory } from '../../api/online';
import Pagination, { getUrlPage, setUrlPage } from '../../components/Pagination';

const RESULT_FILTERS = new Set(['all', 'win', 'loss', 'draw']);
const MODE_FILTERS = new Set(['all', 'bullet', 'blitz', 'rapid', 'classical']);
const REVIEW_FILTERS = new Set(['all', 'reviewed', 'unreviewed']);

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
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
      <style>{`
      .history-header h1 { color: #ffffff !important; }
        .history-page { color: var(--text-adaptive, #111827); }
        .loading-container { display: flex; justify-content: center; padding: 40px; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .history-row {
          background: var(--bg-surface-adaptive, #ffffff);
          border: 1px solid var(--border-adaptive, #e5e7eb);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 16px;
          width: 100%;
          text-align: left;
          cursor: pointer;
        }
        .history-row b { text-transform: uppercase; font-size: 12px; padding: 4px 8px; border-radius: 4px; }
        .history-row b.win { background: #dcfce7; color: #166534; }
        .history-row b.loss { background: #fee2e2; color: #991b1b; }
        .history-row b.draw { background: #f3f4f6; color: #374151; }
      `}</style>

      <header className="history-header">
        <div>
          <span><History size={17} /> Lịch sử online</span>
          <h1>Các trận đã chơi</h1>
          <p>Tổng cộng <strong>{total}</strong> trận phù hợp. Đang ở trang <strong>{page}</strong>.</p>
        </div>
        <button onClick={() => loadHistory(page, filters)} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> {loading ? 'Đang tải' : 'Tải lại'}
        </button>
      </header>

      <div className="history-filters">
        <span><Filter size={16} /> Bộ lọc</span>
        <select value={filters.result} onChange={(e) => updateFilters({ result: e.target.value })}>
          <option value="all">Mọi kết quả</option>
          <option value="win">Thắng</option>
          <option value="loss">Thua</option>
          <option value="draw">Hòa</option>
        </select>
        <select value={filters.mode} onChange={(e) => updateFilters({ mode: e.target.value })}>
          <option value="all">Mọi chế độ</option>
          <option value="bullet">Bullet</option>
          <option value="blitz">Blitz</option>
          <option value="rapid">Rapid</option>
          <option value="classical">Classical</option>
        </select>
        <select value={filters.review} onChange={(e) => updateFilters({ review: e.target.value })}>
          <option value="all">Tất cả review</option>
          <option value="reviewed">Đã review</option>
          <option value="unreviewed">Chưa review</option>
        </select>
      </div>

      {message && <p className="history-message">{message}</p>}

      {loading ? (
        <div className="loading-container">
          <Loader2 size={40} className="animate-spin" />
        </div>
      ) : games.length === 0 ? (
        <p className="history-empty">Không có trận nào phù hợp với bộ lọc hiện tại.</p>
      ) : (
        <div className="history-list">
          {games.map((game) => {
            const white = game.white || {};
            const black = game.black || {};
            const opponent = white.you ? black : white;
            const result = gameResult(game);
            return (
              <button className="history-row" key={game.id} onClick={() => onOpenReview(game.id)}>
                <b className={result.tone}>{result.label}</b>
                <span style={{ flex: 1 }}>
                  <strong style={{ display: 'block' }}>vs {opponent?.name || 'Player'}</strong>
                  <small style={{ color: 'var(--text-muted, #6b7280)' }}>
                    {game.mode || 'rapid'} • {(game.moves || []).length} nước • {formatDate(game.finishedAt)}
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            );
          })}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={changePage} label="Phân trang" />
    </section>
  );
}