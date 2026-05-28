import React from 'react';
import { Ban, CheckCircle2, LayoutDashboard, LockKeyhole, LogOut, RefreshCw, Search, Shield, ShieldAlert, UserCog, Users } from 'lucide-react';
import {
  adminUserAction,
  fetchAdminMe,
  fetchAdminSummary,
  fetchAdminUserDetail,
  fetchAdminUsers,
  fetchAntiCheatReports,
  lockAdmin,
  scanUserAntiCheat,
  unlockAdmin,
  updateAntiCheatReport
} from '../api/admin';
import { notify } from '../components/ToastHost';

function pct(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function activeBan(user) {
  return user.bans?.find((ban) => ban.status === 'active') || null;
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'players', label: 'Người chơi', icon: Users },
  { id: 'fairplay', label: 'Anti-cheat', icon: ShieldAlert },
  { id: 'detail', label: 'Chi tiết user', icon: UserCog }
];

export default function AdminPage() {
  const [admin, setAdmin] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [users, setUsers] = React.useState([]);
  const [reports, setReports] = React.useState([]);
  const [search, setSearch] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [selectedDetail, setSelectedDetail] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [section, setSection] = React.useState('overview');
  const [unlockEmail, setUnlockEmail] = React.useState('');
  const [unlockPassword, setUnlockPassword] = React.useState('');
  const [unlockRequired, setUnlockRequired] = React.useState(true);

  const load = React.useCallback(async (nextSearch = search) => {
    setLoading(true);
    setMessage('');
    try {
      const [me, summaryData, usersData, reportsData] = await Promise.all([
        fetchAdminMe(),
        fetchAdminSummary(),
        fetchAdminUsers(nextSearch),
        fetchAntiCheatReports()
      ]);
      setAdmin(me.admin);
      setSummary(summaryData.summary);
      setUsers(usersData.users || []);
      setReports(reportsData.reports || []);
      setUnlockRequired(false);
    } catch (error) {
      const text = error.message || 'Không thể tải admin.';
      setMessage(text);
      setUnlockRequired(true);
      if (!text.includes('unlock')) notify(text, 'error');
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    load('');
  }, [load]);

  const submitUnlock = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const data = await unlockAdmin(unlockEmail, unlockPassword);
      setAdmin(data.admin);
      setUnlockPassword('');
      setUnlockRequired(false);
      notify('Đã đăng nhập admin.', 'success');
      await load('');
    } catch (error) {
      setMessage(error.message || 'Không thể đăng nhập admin.');
      notify(error.message || 'Không thể đăng nhập admin.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const logoutAdmin = async () => {
    await lockAdmin().catch(() => {});
    setAdmin(null);
    setSummary(null);
    setUsers([]);
    setReports([]);
    setSelectedDetail(null);
    setUnlockRequired(true);
    notify('Đã khóa phiên admin.', 'info');
  };

  const banUser = async (user, banType = 'account') => {
    const deviceFingerprint = user.devices?.[0]?.device_fingerprint || '';
    const reason = window.prompt('Lý do ban', 'Fair play / policy violation');
    if (!reason) return;
    try {
      await adminUserAction({ action: 'ban', userId: user.id, banType, deviceFingerprint, reason });
      notify('Đã ban người chơi.', 'success');
      await load();
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const unbanUser = async (user) => {
    try {
      await adminUserAction({ action: 'unban', userId: user.id });
      notify('Đã gỡ ban người chơi.', 'success');
      await load();
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const scanUser = async (user) => {
    setMessage(`Đang scan anti-cheat cho ${user.display_name}...`);
    try {
      const data = await scanUserAntiCheat(user.id);
      setMessage(`Đã scan ${data.reports?.length || 0} ván gần nhất.`);
      notify('Anti-cheat scan hoàn tất.', 'success');
      await load();
      setSection('fairplay');
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const openDetail = async (user) => {
    setMessage(`Đang tải chi tiết ${user.display_name}...`);
    try {
      const detail = await fetchAdminUserDetail(user.id);
      setSelectedDetail(detail);
      setSection('detail');
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (unlockRequired) {
    return (
      <main className="admin-login-shell">
        <form className="admin-unlock-card" onSubmit={submitUnlock}>
          <div className="admin-login-banner">
            <Shield size={52} />
            <span>ChessArena Control Room</span>
          </div>
          <h1>Đăng nhập Admin</h1>
          <p>Dùng tài khoản admin được cấu hình trong env. Trang này tách riêng với đăng nhập người chơi.</p>
          <label>
            Email admin
            <input
              type="email"
              value={unlockEmail}
              onChange={(event) => setUnlockEmail(event.target.value)}
              placeholder="admin@gmail.com"
              autoComplete="username"
            />
          </label>
          <label>
            Mật khẩu admin
            <input
              type="password"
              value={unlockPassword}
              onChange={(event) => setUnlockPassword(event.target.value)}
              placeholder="ADMIN_PANEL_PASSWORD"
              autoComplete="current-password"
            />
          </label>
          {message && <p className="admin-message">{message}</p>}
          <button disabled={loading || !unlockEmail || !unlockPassword}><LockKeyhole size={18} /> Đăng nhập</button>
        </form>
      </main>
    );
  }

  const renderOverview = () => (
    <>
      <section className="admin-stats">
        <div><Users size={22} /><strong>{summary?.users ?? '--'}</strong><span>Người chơi</span></div>
        <div><Ban size={22} /><strong>{summary?.activeBans ?? '--'}</strong><span>Ban active</span></div>
        <div><ShieldAlert size={22} /><strong>{summary?.openReports ?? '--'}</strong><span>Report mở</span></div>
        <div><UserCog size={22} /><strong>{summary?.queueCount ?? '--'}</strong><span>Đang tìm trận</span></div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span>Vận hành</span>
            <h2>Việc cần kiểm tra</h2>
          </div>
        </div>
        <div className="admin-ops-grid">
          <button onClick={() => setSection('players')}><Users size={18} /> Quản lý người chơi</button>
          <button onClick={() => setSection('fairplay')}><ShieldAlert size={18} /> Review anti-cheat</button>
          <button onClick={() => load()} disabled={loading}><RefreshCw size={18} /> Đồng bộ dữ liệu</button>
        </div>
      </section>
    </>
  );

  const renderPlayers = () => (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Players</span>
          <h2>Quản lý người chơi thật</h2>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          load(search);
        }}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm username/email..." />
          <button disabled={loading}><Search size={16} /> Tìm</button>
        </form>
      </div>

      <div className="admin-user-list">
        {users.map((user) => {
          const ban = activeBan(user);
          const device = user.devices?.[0];
          const topRating = [...(user.ratings || [])].sort((a, b) => b.rating - a.rating)[0];
          const risk = user.reports?.[0]?.risk_score ?? 0;
          return (
            <article className="admin-user-card" key={user.id}>
              <img src={user.photo_url || '/chessarena-mark.svg'} alt="" />
              <div>
                <strong>{user.display_name}</strong>
                <span>{user.email || user.username}</span>
                <small>Rating: {topRating?.rating ?? 400} · Games: {topRating?.games_played ?? 0} · Risk: {risk}</small>
                {device && <em>Device: {device.device_fingerprint.slice(0, 18)}... · {new Date(device.last_seen_at).toLocaleString()}</em>}
                {ban && <b className="admin-ban-note">Banned: {ban.reason}</b>}
              </div>
              <div className="admin-user-actions">
                <button onClick={() => openDetail(user)}><UserCog size={16} /> Detail</button>
                <button onClick={() => scanUser(user)}><ShieldAlert size={16} /> Scan</button>
                {ban ? (
                  <button onClick={() => unbanUser(user)}><CheckCircle2 size={16} /> Unban</button>
                ) : (
                  <>
                    <button onClick={() => banUser(user, 'account')}><Ban size={16} /> Ban account</button>
                    <button disabled={!device} onClick={() => banUser(user, 'account_device')}><Ban size={16} /> Ban HWID</button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  const renderFairPlay = () => (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Anti-cheat</span>
          <h2>Report cần review</h2>
        </div>
      </div>
      <div className="admin-report-list">
        {reports.length === 0 && <p>Chưa có report anti-cheat.</p>}
        {reports.map((report) => (
          <article className="admin-report-card" key={report.id}>
            <div>
              <strong>{report.users?.display_name || report.users?.email || report.user_id}</strong>
              <span>Risk {report.risk_score}/100 · Engine match {pct(report.engine_match_rate)} · Fast best moves {report.suspicious_move_count}</span>
              <small>{new Date(report.created_at).toLocaleString()} · {report.status}</small>
            </div>
            <div>
              <button onClick={() => updateAntiCheatReport(report.id, 'reviewed').then(() => load())}>Reviewed</button>
              <button onClick={() => updateAntiCheatReport(report.id, 'dismissed').then(() => load())}>Dismiss</button>
              <button onClick={() => updateAntiCheatReport(report.id, 'actioned').then(() => load())}>Actioned</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const renderDetail = () => (
    <section className="admin-panel admin-detail-panel">
      {!selectedDetail ? (
        <p>Chọn một người chơi ở tab Người chơi để xem thiết bị, lịch sử ban và replay gần đây.</p>
      ) : (
        <>
          <div className="admin-panel-head">
            <div>
              <span>Player detail</span>
              <h2>{selectedDetail.user.display_name}</h2>
            </div>
            <button onClick={() => setSelectedDetail(null)}>Đóng</button>
          </div>
          <div className="admin-detail-grid">
            <div>
              <strong>Thiết bị</strong>
              {selectedDetail.devices.length === 0 && <p>Chưa có fingerprint.</p>}
              {selectedDetail.devices.map((device) => (
                <p key={device.id}>{device.device_fingerprint}<br /><small>{device.user_agent || 'unknown'} · {new Date(device.last_seen_at).toLocaleString()}</small></p>
              ))}
            </div>
            <div>
              <strong>Ban history</strong>
              {selectedDetail.bans.length === 0 && <p>Không có ban.</p>}
              {selectedDetail.bans.map((ban) => (
                <p key={ban.id}>{ban.status} · {ban.ban_type}<br /><small>{ban.reason}</small></p>
              ))}
            </div>
          </div>
          <div className="admin-game-replay-list">
            <strong>Replay ván gần đây</strong>
            {selectedDetail.games.map((game) => (
              <details key={game.id} className="admin-replay-card">
                <summary>{game.white.name} vs {game.black.name} · {game.result || '*'} · {(game.moves || []).length} nước</summary>
                <div className="admin-replay-moves">
                  {(game.moves || []).map((move) => <span key={move.ply}>{move.ply}. {move.san}</span>)}
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <Shield size={28} />
          <div>
            <strong>ChessArena</strong>
            <span>Admin</span>
          </div>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button className={section === item.id ? 'active' : ''} key={item.id} onClick={() => setSection(item.id)}>
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </nav>
        <button className="admin-lock-button" onClick={logoutAdmin}><LogOut size={18} /> Khóa admin</button>
      </aside>

      <section className="admin-main">
        <header className="admin-hero">
          <div>
            <span><Shield size={18} /> Admin Console</span>
            <h1>Quản lý người chơi và fair play</h1>
            <p>Admin: {admin?.email || 'đang xác thực'} · Phiên quản trị tách riêng với tài khoản người chơi.</p>
          </div>
          <button onClick={() => load()} disabled={loading}><RefreshCw size={18} /> Làm mới</button>
        </header>

        {message && <p className="admin-message">{message}</p>}
        {section === 'overview' && renderOverview()}
        {section === 'players' && renderPlayers()}
        {section === 'fairplay' && renderFairPlay()}
        {section === 'detail' && renderDetail()}
      </section>
    </main>
  );
}
