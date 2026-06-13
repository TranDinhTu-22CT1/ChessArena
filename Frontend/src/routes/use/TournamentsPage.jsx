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
      <section className="tournaments-auth-required">
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
    <section className="tournaments-page">
      <header className="tournaments-hero">
        <div>
          <span>Giải đấu</span>
          <h1>Giải đấu ChessArena</h1>
          <p>Tham gia các giải mở trong thời gian giới hạn, tích điểm và cạnh tranh top 1-2-3.</p>
        </div>

        <button className="tournaments-hero-action" onClick={() => onNavigate('online')}>
          Chơi online ngay
        </button>
      </header>

      <div className="tournament-toolbar">
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

      {message && <p className="tournament-message">{message}</p>}

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
            <div className="tournament-detail-copy">
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

          <div className="tournament-detail-actions">
            {selectedTournament.joined ? (
              <button
                className="t-btn danger"
                disabled={busyId === selectedTournament.id || !['scheduled', 'open'].includes(selectedTournament.status)}
                onClick={() => leave(selectedTournament.id)}
              >
                {busyId === selectedTournament.id ? 'Đang xử lý...' : 'Rời giải đấu'}
              </button>
            ) : (
              <button
                className="t-btn primary"
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
                  <p className="tournament-empty-copy">Chưa có người tham gia.</p>
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
                  <p className="tournament-empty-copy">Chưa có ván nào được tính điểm.</p>
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
                  <div className="tournament-card-head">
                    <div className="tournament-card-copy">
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
