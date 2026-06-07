import React from 'react';
import { ArrowLeft, CalendarClock, Crown, LogIn, RefreshCw, Trophy, Users } from 'lucide-react';
import { fetchTournamentDetail, fetchTournaments, joinTournament, leaveTournament } from '../../api/tournaments';
import Pagination, { getUrlPage, setUrlPage } from '../../components/Pagination';

const STATUSES = new Set(['all', 'scheduled', 'open', 'running', 'finished', 'cancelled']);

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa lên lịch';
}

function getUrlStatus() {
  if (typeof window === 'undefined') return 'all';
  const value = new URLSearchParams(window.location.search).get('status');
  return STATUSES.has(value) ? value : 'all';
}

function getSelectedTournamentId() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('id') || '';
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

function timeLeft(item) {
  const now = Date.now();
  const start = Date.parse(item?.startsAt || '');
  const end = Date.parse(item?.endsAt || '');

  if (Number.isFinite(end) && end <= now) return 'Đã kết thúc';
  if (Number.isFinite(start) && start > now) return `Bắt đầu sau ${Math.ceil((start - now) / 60000)} phút`;
  if (Number.isFinite(end)) return `Còn ${Math.max(1, Math.ceil((end - now) / 60000))} phút`;

  return 'Đang mở';
}

function tournamentStatusText(item) {
  if (item?.status === 'cancelled') return 'Đã hủy';
  if (item?.status === 'finished') return 'Đã kết thúc';
  return `${statusLabel(item?.status)} | ${timeLeft(item)}`;
}

function getBadgeClass(status) {
  if (status === 'running') return 't-badge running';
  if (status === 'open') return 't-badge open';
  if (status === 'finished') return 't-badge finished';
  if (status === 'cancelled') return 't-badge cancelled';
  return 't-badge scheduled';
}

function resultLabel(game) {
  if (game.result === '1/2-1/2') return 'Hòa';
  if (game.result === '1-0') return `${game.white?.name || 'Trắng'} thắng`;
  if (game.result === '0-1') return `${game.black?.name || 'Đen'} thắng`;
  return game.status || '--';
}

function InlineLoading({ label = 'Đang tải dữ liệu' }) {
  return (
    <div className="t-inline-loading" role="status" aria-live="polite">
      <RefreshCw size={22} className="t-loading-spinner" />
      <span>{label}</span>
    </div>
  );
}

export default function TournamentsPage({ authUser, onLogin, onNavigate }) {
  const [tournaments, setTournaments] = React.useState([]);
  const [detail, setDetail] = React.useState(null);
  const [page, setPage] = React.useState(() => getUrlPage('page'));
  const [totalPages, setTotalPages] = React.useState(1);
  const [status, setStatus] = React.useState(getUrlStatus);
  const [selectedId, setSelectedId] = React.useState(getSelectedTournamentId);
  const [loading, setLoading] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState('');
  const [message, setMessage] = React.useState('');

  const syncUrl = React.useCallback((nextPage = page, nextStatus = status, nextId = selectedId) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);

    if (nextPage <= 1) url.searchParams.delete('page');
    else url.searchParams.set('page', String(nextPage));

    if (nextStatus === 'all') url.searchParams.delete('status');
    else url.searchParams.set('status', nextStatus);

    if (nextId) url.searchParams.set('id', nextId);
    else url.searchParams.delete('id');

    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [page, selectedId, status]);

  const loadList = React.useCallback(async (nextPage = page, nextStatus = status) => {
    if (!authUser) return;

    setLoading(true);
    setMessage('');

    try {
      const data = await fetchTournaments({
        page: nextPage,
        limit: 12,
        status: nextStatus
      });

      setTournaments(Array.isArray(data.tournaments) ? data.tournaments : []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      setMessage(error.message || 'Không tải được danh sách giải đấu.');
    } finally {
      setLoading(false);
    }
  }, [authUser, page, status]);

  const loadDetail = React.useCallback(async (id = selectedId) => {
    if (!authUser || !id) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    setMessage('');

    try {
      const data = await fetchTournamentDetail(id);

      setDetail({
        ...data,
        standings: Array.isArray(data?.standings) ? data.standings : [],
        recentGames: Array.isArray(data?.recentGames) ? data.recentGames : []
      });
    } catch (error) {
      setMessage(error.message || 'Không tải được chi tiết giải đấu.');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [authUser, selectedId]);

  React.useEffect(() => {
    loadList(page, status);
  }, [loadList, page, status]);

  React.useEffect(() => {
    loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const changePage = (nextPage) => {
    setPage(nextPage);
    setUrlPage(nextPage, 'page');
    syncUrl(nextPage, status, selectedId);
  };

  const changeStatus = (nextStatus) => {
    setStatus(nextStatus);
    setPage(1);
    setSelectedId('');
    setDetail(null);
    setUrlPage(1, 'page');
    syncUrl(1, nextStatus, '');
  };

  const openDetail = (id) => {
    setSelectedId(id);
    syncUrl(page, status, id);
  };

  const closeDetail = () => {
    setSelectedId('');
    setDetail(null);
    syncUrl(page, status, '');
  };

  const join = async (id) => {
    setBusyId(id);
    setMessage('');

    try {
      await joinTournament(id);
      setMessage('Đã tham gia giải đấu. Khi chơi online cùng người cũng tham gia giải, điểm sẽ tự cập nhật.');
      await Promise.all([loadList(page, status), loadDetail(id)]);
    } catch (error) {
      setMessage(error.message || 'Không thể tham gia giải đấu.');
    } finally {
      setBusyId('');
    }
  };

  const leave = async (id) => {
    setBusyId(id);
    setMessage('');

    try {
      await leaveTournament(id);
      setMessage('Đã rời giải đấu.');
      await Promise.all([loadList(page, status), loadDetail(id)]);
    } catch (error) {
      setMessage(error.message || 'Không thể rời giải đấu.');
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
        <button onClick={onLogin}>
          <LogIn size={18} />
          Đăng nhập
        </button>
      </section>
    );
  }

  const selectedTournament = detail?.tournament;

  return (
    <section className="feature-page">
      <style>{`
        :root {
          --brand-green: #abc854;
          --brand-green-dark: #87a53b;
          --t-bg-card: #111a13;
          --t-bg-card-soft: #162217;
          --t-text-main: #f8ffe9;
          --t-text-muted: rgba(248, 255, 233, 0.68);
          --t-border: rgba(255, 255, 255, 0.1);
          --t-bg-input: rgba(255, 255, 255, 0.06);
          --t-bg-hover: rgba(255, 255, 255, 0.1);
        }

        .tournament-toolbar select {
          padding: 10px 16px;
          border-radius: 10px;
          border: 1px solid var(--t-border);
          background-color: var(--t-bg-card);
          color: var(--t-text-main);
          font-size: 14px;
          font-weight: 700;
          outline: none;
          cursor: pointer;
        }

        .modern-refresh-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          background-color: var(--t-bg-card);
          color: var(--t-text-main);
          border: 1px solid var(--t-border);
          border-radius: 10px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .modern-refresh-btn:hover:not(:disabled) {
          background-color: var(--t-bg-hover);
          transform: translateY(-1px);
        }

        .modern-refresh-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .t-inline-loading {
          width: 100%;
          min-height: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 36px 20px;
          color: var(--t-text-muted);
          text-align: center;
          transform: none !important;
          rotate: 0deg !important;
          writing-mode: horizontal-tb !important;
        }

        .t-inline-loading span {
          display: block;
          font-weight: 800;
          font-size: 15px;
          letter-spacing: 0.2px;
          transform: none !important;
          rotate: 0deg !important;
          writing-mode: horizontal-tb !important;
        }

        .t-loading-spinner {
          color: var(--brand-green);
          flex: 0 0 auto;
          transform-origin: center;
          animation: tSpinnerRotate 0.85s linear infinite;
        }

        .modern-refresh-btn .t-loading-spinner {
          width: 16px;
          height: 16px;
        }

        @keyframes tSpinnerRotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .modern-tournament-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .modern-t-card {
          background: var(--t-bg-card);
          border: 1px solid var(--t-border);
          border-radius: 20px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          transition: all 0.25s ease;
          box-shadow: 0 16px 32px rgba(0, 0, 0, 0.18);
        }

        .modern-t-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 36px rgba(0, 0, 0, 0.26);
          border-color: rgba(171, 200, 84, 0.75);
        }

        .t-badge {
          display: inline-block;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 8px;
          max-width: 100%;
          line-height: 1.3;
        }

        .t-badge.running {
          background: #dcfce7;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .t-badge.open {
          background: #dbeafe;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .t-badge.finished {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .t-badge.cancelled {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .t-badge.scheduled {
          background: #fef3c7;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .t-title {
          font-size: 20px;
          font-weight: 900;
          margin: 0;
          color: var(--t-text-main);
          line-height: 1.3;
        }

        .t-time-control {
          background: var(--t-bg-input);
          padding: 6px 12px;
          border-radius: 8px;
          font-weight: 900;
          font-size: 14px;
          color: var(--t-text-main);
          align-self: flex-start;
          white-space: nowrap;
        }

        .t-meta {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 13px;
          color: var(--t-text-muted);
          font-weight: 600;
        }

        .t-meta span {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .t-podium {
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: var(--t-bg-input);
          padding: 12px;
          border-radius: 12px;
          border: 1px solid var(--t-border);
        }

        .t-podium span {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 800;
          color: var(--t-text-main);
        }

        .t-podium span:nth-child(1) svg {
          color: #eab308;
        }

        .t-podium span:nth-child(2) svg {
          color: #9ca3af;
        }

        .t-podium span:nth-child(3) svg {
          color: #d97706;
        }

        .t-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: auto;
          padding-top: 16px;
        }

        .t-btn {
          padding: 10px 16px;
          border-radius: 10px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          text-align: center;
          border: none;
          transition: all 0.2s;
        }

        .t-btn.primary {
          background: var(--brand-green);
          color: #101510 !important;
        }

        .t-btn.primary:hover:not(:disabled) {
          background: var(--brand-green-dark);
          transform: translateY(-1px);
        }

        .t-btn.secondary {
          background: var(--t-bg-input);
          color: var(--t-text-main) !important;
          border: 1px solid var(--t-border);
        }

        .t-btn.secondary:hover:not(:disabled) {
          background: var(--t-bg-hover);
        }

        .t-btn.danger {
          background: #fee2e2;
          color: #b91c1c !important;
          border: 1px solid #fecaca;
        }

        .t-btn.danger:hover:not(:disabled) {
          background: #fca5a5;
        }

        .t-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modern-detail-card {
          background: var(--t-bg-card);
          border: 1px solid var(--t-border);
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
        }

        .modern-detail-card .back-btn {
          background: transparent;
          border: none;
          color: var(--t-text-muted);
          font-weight: 700;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          margin-bottom: 24px;
          transition: color 0.2s;
        }

        .modern-detail-card .back-btn:hover {
          color: var(--t-text-main);
        }

        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--t-border);
          margin-bottom: 24px;
        }

        .detail-header h2 {
          font-size: 32px;
          font-weight: 900;
          margin: 12px 0 8px 0;
          color: var(--t-text-main);
        }

        .detail-header p {
          color: var(--t-text-muted);
          font-size: 15px;
          margin: 0;
          font-weight: 600;
        }

        .detail-stats-box {
          background: var(--t-bg-input);
          padding: 16px 24px;
          border-radius: 16px;
          text-align: center;
          border: 1px solid var(--t-border);
        }

        .detail-stats-box strong {
          display: block;
          font-size: 32px;
          font-weight: 900;
          color: var(--brand-green);
          line-height: 1;
        }

        .detail-stats-box span {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          color: var(--t-text-muted);
          letter-spacing: 0.5px;
        }

        .detail-my-standing {
          background: linear-gradient(135deg, rgba(171, 200, 84, 0.18), rgba(135, 165, 59, 0.06));
          border: 1px solid rgba(171, 200, 84, 0.75);
          padding: 16px 20px;
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .detail-my-standing b {
          font-size: 16px;
          color: var(--t-text-main);
        }

        .detail-my-standing span {
          font-size: 14px;
          font-weight: 800;
          color: var(--brand-green);
        }

        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
        }

        .detail-grid h3 {
          font-size: 18px;
          font-weight: 900;
          margin-bottom: 16px;
          color: var(--t-text-main);
        }

        .t-standings {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .t-standings-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          padding: 12px;
          border-radius: 8px;
          background: var(--t-bg-input);
          transition: background 0.2s;
          border: 1px solid transparent;
        }

        .t-standings-item:hover {
          border-color: var(--t-border);
        }

        .t-standings-item span {
          width: 28px;
          font-weight: 900;
          color: var(--t-text-muted);
          text-align: center;
        }

        .t-standings-item b {
          flex: 1;
          color: var(--t-text-main);
          font-weight: 800;
        }

        .t-standings-item small {
          color: var(--t-text-muted);
          font-weight: 700;
        }

        .t-standings-item strong {
          font-weight: 900;
          color: var(--brand-green);
          font-size: 16px;
        }

        .t-games-list button {
          width: 100%;
          text-align: left;
          background: var(--t-bg-input);
          border: 1px solid transparent;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .t-games-list button:hover {
          border-color: var(--brand-green);
          transform: translateX(4px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
        }

        .t-games-list b {
          color: var(--t-text-main);
          font-size: 15px;
          font-weight: 800;
        }

        .t-games-list span {
          color: var(--t-text-muted);
          font-size: 13px;
          font-weight: 700;
        }

        @media (max-width: 768px) {
          .modern-tournament-list {
            grid-template-columns: 1fr;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }

          .modern-detail-card {
            padding: 20px;
          }

          .detail-header h2 {
            font-size: 26px;
          }

          .t-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <header className="feature-hero">
        <div>
          <span>Giải đấu</span>
          <h1 style={{ color: '#ffffff' }}>Giải đấu ChessArena</h1>
          <p>Tham gia các giải mở trong thời gian giới hạn, tích điểm và cạnh tranh top 1-2-3.</p>
        </div>

        <button onClick={() => onNavigate('online')} style={{ fontWeight: 'bold' }}>
          Chơi online ngay
        </button>
      </header>

      <div
        className="tournament-toolbar"
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '24px'
        }}
      >
        <select value={status} onChange={(event) => changeStatus(event.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="open">Đang mở đăng ký</option>
          <option value="running">Đang thi đấu</option>
          <option value="scheduled">Sắp diễn ra</option>
          <option value="finished">Đã kết thúc</option>
        </select>

        <button className="modern-refresh-btn" onClick={() => loadList(page, status)} disabled={loading}>
          <RefreshCw size={16} className={loading ? 't-loading-spinner' : ''} />
          {loading ? 'Đang tải...' : 'Tải lại danh sách'}
        </button>
      </div>

      {message && (
        <p
          style={{
            padding: '16px',
            background: 'rgba(171, 200, 84, 0.15)',
            color: 'var(--brand-green)',
            borderRadius: '12px',
            fontWeight: '700',
            border: '1px solid rgba(171, 200, 84, 0.65)',
            marginBottom: '24px'
          }}
        >
          {message}
        </p>
      )}

      {selectedId && detailLoading && !selectedTournament && (
        <article className="modern-detail-card">
          <button type="button" className="back-btn" onClick={closeDetail}>
            <ArrowLeft size={16} />
            Quay lại danh sách
          </button>

          <InlineLoading label="Đang tải chi tiết giải đấu..." />
        </article>
      )}

      {selectedTournament && (
        <article className="modern-detail-card">
          {detailLoading && <InlineLoading label="Đang cập nhật chi tiết giải đấu..." />}

          <button type="button" className="back-btn" onClick={closeDetail}>
            <ArrowLeft size={16} />
            Quay lại danh sách
          </button>

          <div className="detail-header">
            <div style={{ flex: 1 }}>
              <span className={getBadgeClass(selectedTournament.status)}>
                {tournamentStatusText(selectedTournament)}
              </span>

              <h2>{selectedTournament.title}</h2>

              <p>
                {selectedTournament.timeControl} • {formatDate(selectedTournament.startsAt)} đến{' '}
                {formatDate(selectedTournament.endsAt)}
              </p>
            </div>

            <div className="detail-stats-box">
              <strong>{selectedTournament.playerCount}</strong>
              <span>Kỳ thủ tham gia</span>
            </div>
          </div>

          {detail.myStanding && (
            <div className="detail-my-standing">
              <b>Thành tích của bạn: Hạng #{detail.myStanding.rank}</b>
              <span>
                {detail.myStanding.score} điểm • {detail.myStanding.wins} Thắng •{' '}
                {detail.myStanding.draws} Hòa • {detail.myStanding.losses} Thua
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
            {selectedTournament.joined ? (
              <button
                className="t-btn danger"
                style={{ minWidth: '150px' }}
                disabled={busyId === selectedTournament.id || !['scheduled', 'open'].includes(selectedTournament.status)}
                onClick={() => leave(selectedTournament.id)}
              >
                {busyId === selectedTournament.id ? 'Đang xử lý...' : 'Rời giải đấu'}
              </button>
            ) : (
              <button
                className="t-btn primary"
                style={{ minWidth: '150px' }}
                disabled={busyId === selectedTournament.id || !['scheduled', 'open', 'running'].includes(selectedTournament.status)}
                onClick={() => join(selectedTournament.id)}
              >
                {busyId === selectedTournament.id ? 'Đang tham gia...' : 'Tham gia giải ngay'}
              </button>
            )}

            <button className="t-btn secondary" onClick={() => onNavigate('online')}>
              Tìm trận Online
            </button>
          </div>

          <div className="detail-grid">
            <section>
              <h3>Bảng xếp hạng (Top)</h3>

              <div className="t-standings">
                {(detail.standings || []).length === 0 ? (
                  <p style={{ color: 'var(--t-text-muted)' }}>Chưa có người tham gia.</p>
                ) : (
                  detail.standings.map((player) => (
                    <div className="t-standings-item" key={player.userId}>
                      <span>#{player.rank}</span>
                      <b>{player.displayName}</b>
                      <small>
                        {player.wins}T {player.draws}H {player.losses}B
                      </small>
                      <strong>{player.score}</strong>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3>Ván đấu trong giải</h3>

              <div className="t-games-list">
                {(detail.recentGames || []).length === 0 ? (
                  <p style={{ color: 'var(--t-text-muted)' }}>Chưa có ván nào được tính điểm.</p>
                ) : (
                  detail.recentGames.map((game) => (
                    <button
                      key={game.id}
                      type="button"
                      onClick={() => {
                        window.history.pushState(null, '', `/history/review/${encodeURIComponent(game.id)}`);
                        window.dispatchEvent(new window.PopStateEvent('popstate'));
                      }}
                    >
                      <b>
                        {game.white?.name || 'Trắng'} vs {game.black?.name || 'Đen'}
                      </b>
                      <span>
                        {resultLabel(game)} • {(game.moves || []).length} nước
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        </article>
      )}

      {!selectedId && !selectedTournament && (
        <>
          {loading && tournaments.length === 0 && (
            <InlineLoading label="Đang tải danh sách giải đấu..." />
          )}

          <div className="modern-tournament-list">
            {tournaments.map((item) => {
              const players = Array.isArray(item.players) ? item.players : [];

              return (
                <article className="modern-t-card" key={item.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, paddingRight: '16px' }}>
                      <span className={getBadgeClass(item.status)}>
                        {tournamentStatusText(item)}
                      </span>

                      <h2 className="t-title">{item.title}</h2>
                    </div>

                    <div className="t-time-control">{item.timeControl}</div>
                  </div>

                  <div className="t-meta">
                    <span>
                      <CalendarClock size={16} />
                      {formatDate(item.startsAt)}
                    </span>

                    <span>
                      <Users size={16} />
                      {item.playerCount ?? players.length} kỳ thủ tham gia
                    </span>
                  </div>

                  {players.length > 0 && (
                    <div className="t-podium">
                      {players.slice(0, 3).map((player) => (
                        <span key={player.userId}>
                          <Crown size={15} />
                          Top {player.rank}: {player.displayName}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="t-actions">
                    <button className="t-btn secondary" type="button" onClick={() => openDetail(item.id)}>
                      Chi tiết
                    </button>

                    <button
                      className={`t-btn ${item.joined ? 'secondary' : 'primary'}`}
                      disabled={item.joined || busyId === item.id || !['scheduled', 'open', 'running'].includes(item.status)}
                      onClick={() => join(item.id)}
                    >
                      {item.joined ? 'Đã tham gia' : busyId === item.id ? 'Đang vào...' : 'Tham gia'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={changePage}
            label="Phân trang giải đấu"
          />
        </>
      )}
    </section>
  );
}