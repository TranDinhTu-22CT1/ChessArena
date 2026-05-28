import React from 'react';
import { Ban, CheckCircle2, LogIn, RefreshCw, Shield, ShieldAlert, UserCog, Users } from 'lucide-react';
import {
  adminUserAction,
  fetchAdminMe,
  fetchAdminSummary,
  fetchAdminUsers,
  fetchAntiCheatReports,
  scanUserAntiCheat,
  updateAntiCheatReport
} from '../api/admin';

function pct(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function activeBan(user) {
  return user.bans?.find((ban) => ban.status === 'active') || null;
}

export default function AdminPage({ authUser, onLogin }) {
  const [admin, setAdmin] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [users, setUsers] = React.useState([]);
  const [reports, setReports] = React.useState([]);
  const [search, setSearch] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (nextSearch = search) => {
    if (!authUser) return;
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
    } catch (error) {
      setMessage(error.message || 'Không thể tải admin.');
    } finally {
      setLoading(false);
    }
  }, [authUser, search]);

  React.useEffect(() => {
    load('');
  }, [load]);

  const banUser = async (user, banType = 'account') => {
    const deviceFingerprint = user.devices?.[0]?.device_fingerprint || '';
    const reason = window.prompt('Lý do ban', 'Fair play / policy violation');
    if (!reason) return;
    try {
      await adminUserAction({ action: 'ban', userId: user.id, banType, deviceFingerprint, reason });
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const unbanUser = async (user) => {
    try {
      await adminUserAction({ action: 'unban', userId: user.id });
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const scanUser = async (user) => {
    setMessage(`Đang scan anti-cheat cho ${user.display_name}...`);
    try {
      const data = await scanUserAntiCheat(user.id);
      setMessage(`Đã scan ${data.reports?.length || 0} ván gần nhất.`);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (!authUser) {
    return (
      <main className="admin-login-shell">
        <section>
          <Shield size={52} />
          <h1>ChessArena Admin</h1>
          <p>Trang quản trị tách riêng tại /amdin. Đăng nhập bằng tài khoản root đã cấp trong ADMIN_ROOT_EMAILS.</p>
          <button onClick={onLogin}><LogIn size={18} /> Đăng nhập admin</button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-hero">
        <div>
          <span><Shield size={18} /> Admin Console</span>
          <h1>Quản lý người chơi và fair play</h1>
          <p>Root: {admin?.email || 'đang xác thực'} · Chỉ tài khoản trong ADMIN_ROOT_EMAILS mới truy cập được API admin.</p>
        </div>
        <button onClick={() => load()} disabled={loading}><RefreshCw size={18} /> Làm mới</button>
      </header>

      {message && <p className="admin-message">{message}</p>}

      <section className="admin-stats">
        <div><Users size={22} /><strong>{summary?.users ?? '--'}</strong><span>Người chơi</span></div>
        <div><Ban size={22} /><strong>{summary?.activeBans ?? '--'}</strong><span>Ban active</span></div>
        <div><ShieldAlert size={22} /><strong>{summary?.openReports ?? '--'}</strong><span>Report mở</span></div>
        <div><UserCog size={22} /><strong>{summary?.queueCount ?? '--'}</strong><span>Đang tìm trận</span></div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span>Players</span>
            <h2>Quản lý người chơi</h2>
          </div>
          <form onSubmit={(event) => {
            event.preventDefault();
            load(search);
          }}>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm username/email..." />
            <button disabled={loading}>Tìm</button>
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
                  <button onClick={() => scanUser(user)}><ShieldAlert size={16} /> Scan</button>
                  {ban ? (
                    <button onClick={() => unbanUser(user)}><CheckCircle2 size={16} /> Unban</button>
                  ) : (
                    <>
                      <button onClick={() => banUser(user, 'account')}><Ban size={16} /> Ban account</button>
                      <button disabled={!device} onClick={() => banUser(user, 'account_device')}><Ban size={16} /> Ban device</button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

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
    </main>
  );
}
