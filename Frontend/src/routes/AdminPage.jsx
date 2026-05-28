import React from 'react';
import {
  Activity,
  Ban,
  CheckCircle2,
  CreditCard,
  Database,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Swords,
  UserCog,
  Users
} from 'lucide-react';
import {
  adminUserAction,
  fetchAdminAuditLogs,
  fetchAdminConfig,
  fetchAdminMatches,
  fetchAdminMe,
  fetchAdminPayments,
  fetchAdminSummary,
  fetchAdminUserDetail,
  fetchAdminUsers,
  fetchAntiCheatReports,
  fetchPayPalDiagnostics,
  lockAdmin,
  scanUserAntiCheat,
  testPayPalSubscription,
  unlockAdmin,
  updateAntiCheatReport
} from '../api/admin';
import { notify } from '../components/ToastHost';

const NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'players', label: 'Users', icon: Users },
  { id: 'matches', label: 'Matches', icon: Swords },
  { id: 'fairplay', label: 'Anti-cheat', icon: ShieldAlert },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'audit', label: 'Audit logs', icon: FileText },
  { id: 'config', label: 'System config', icon: Settings },
  { id: 'detail', label: 'User detail', icon: UserCog }
];

function pct(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function activeBan(user) {
  return user.bans?.find((ban) => ban.status === 'active') || null;
}

function time(value) {
  return value ? new Date(value).toLocaleString() : '--';
}

function StatCard({ icon: Icon, label, value, tone = '' }) {
  return (
    <div className={`admin-stat-card ${tone}`}>
      <Icon size={22} />
      <strong>{value ?? '--'}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function AdminPage() {
  const [admin, setAdmin] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [users, setUsers] = React.useState([]);
  const [reports, setReports] = React.useState([]);
  const [matches, setMatches] = React.useState([]);
  const [payments, setPayments] = React.useState([]);
  const [auditLogs, setAuditLogs] = React.useState([]);
  const [config, setConfig] = React.useState(null);
  const [paypalDiagnostics, setPaypalDiagnostics] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [selectedDetail, setSelectedDetail] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [section, setSection] = React.useState('overview');
  const [unlockEmail, setUnlockEmail] = React.useState('');
  const [unlockPassword, setUnlockPassword] = React.useState('');
  const [loginRequired, setLoginRequired] = React.useState(true);

  const load = React.useCallback(async (nextSearch = search) => {
    setLoading(true);
    setMessage('');
    try {
      const [
        me,
        summaryData,
        usersData,
        reportsData,
        matchesData,
        paymentsData,
        auditData,
        configData
      ] = await Promise.all([
        fetchAdminMe(),
        fetchAdminSummary(),
        fetchAdminUsers(nextSearch),
        fetchAntiCheatReports(),
        fetchAdminMatches(),
        fetchAdminPayments(),
        fetchAdminAuditLogs(),
        fetchAdminConfig()
      ]);
      setAdmin(me.admin);
      setSummary(summaryData.summary);
      setUsers(usersData.users || []);
      setReports(reportsData.reports || []);
      setMatches(matchesData.matches || []);
      setPayments(paymentsData.payments || []);
      setAuditLogs(auditData.logs || []);
      setConfig(configData.config || null);
      setLoginRequired(false);
    } catch (error) {
      const text = error.message || 'Cannot load admin panel.';
      setMessage(text);
      setLoginRequired(true);
      notify(text, 'error');
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    load('');
  }, [load]);

  const submitLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const data = await unlockAdmin(unlockEmail, unlockPassword);
      setAdmin(data.admin);
      setUnlockPassword('');
      setLoginRequired(false);
      notify('Admin logged in.', 'success');
      await load('');
    } catch (error) {
      setMessage(error.message || 'Cannot login admin.');
      notify(error.message || 'Cannot login admin.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const logoutAdmin = async () => {
    await lockAdmin().catch(() => {});
    setAdmin(null);
    setSummary(null);
    setLoginRequired(true);
    notify('Admin session locked.', 'info');
  };

  const banUser = async (user, banType = 'account') => {
    const deviceFingerprint = user.devices?.[0]?.device_fingerprint || '';
    const reason = window.prompt('Ban reason', 'Fair play / policy violation');
    if (!reason) return;
    try {
      await adminUserAction({ action: 'ban', userId: user.id, banType, deviceFingerprint, reason });
      notify('User banned.', 'success');
      await load();
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const unbanUser = async (user) => {
    try {
      await adminUserAction({ action: 'unban', userId: user.id });
      notify('Ban lifted.', 'success');
      await load();
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const scanUser = async (user) => {
    setMessage(`Scanning ${user.display_name || user.email}...`);
    try {
      const data = await scanUserAntiCheat(user.id);
      setMessage(`Scanned ${data.reports?.length || 0} recent games.`);
      notify('Anti-cheat scan completed.', 'success');
      await load();
      setSection('fairplay');
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const openDetail = async (user) => {
    setMessage(`Loading ${user.display_name || user.email}...`);
    try {
      const detail = await fetchAdminUserDetail(user.id);
      setSelectedDetail(detail);
      setSection('detail');
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const runPayPalDiagnostics = async () => {
    setMessage('Running PayPal diagnostics...');
    try {
      const data = await fetchPayPalDiagnostics();
      setPaypalDiagnostics(data);
      setMessage('PayPal diagnostics completed.');
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const runPayPalCreateTest = async () => {
    setMessage('Testing PayPal subscription create for Master monthly...');
    try {
      const data = await testPayPalSubscription('master', 'monthly');
      setMessage(data.approveUrl ? `PayPal test OK. Subscription ${data.subscriptionId}` : `PayPal test OK: ${data.status}`);
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  if (loginRequired) {
    return (
      <main className="admin-login-shell">
        <form className="admin-unlock-card" onSubmit={submitLogin}>
          <div className="admin-login-banner">
            <Shield size={52} />
            <span>ChessArena Control Room</span>
          </div>
          <h1>Admin Login</h1>
          <label>
            Admin email
            <input type="email" value={unlockEmail} onChange={(event) => setUnlockEmail(event.target.value)} placeholder="admin@gmail.com" autoComplete="username" />
          </label>
          <label>
            Admin password
            <input type="password" value={unlockPassword} onChange={(event) => setUnlockPassword(event.target.value)} placeholder="ADMIN_PANEL_PASSWORD" autoComplete="current-password" />
          </label>
          {message && <p className="admin-message">{message}</p>}
          <button disabled={loading || !unlockEmail || !unlockPassword}><LockKeyhole size={18} /> Login</button>
        </form>
      </main>
    );
  }

  const renderOverview = () => (
    <>
      <section className="admin-stats admin-stats-wide">
        <StatCard icon={Users} label="Total users" value={summary?.users} />
        <StatCard icon={Activity} label="Users online" value={summary?.onlineUsers} />
        <StatCard icon={Swords} label="Active matches" value={summary?.onlineGames} />
        <StatCard icon={RefreshCw} label="Matchmaking queue" value={summary?.queueCount} />
        <StatCard icon={Swords} label="Games today" value={summary?.todayGames} />
        <StatCard icon={ShieldAlert} label="Pending reports" value={summary?.openReports} tone="danger" />
        <StatCard icon={Shield} label="High risk users" value={summary?.suspectedUsers} tone="danger" />
        <StatCard icon={CreditCard} label="Active subscriptions" value={summary?.activeSubscriptions} />
        <StatCard icon={CreditCard} label="Failed payments" value={summary?.failedPayments} tone="danger" />
        <StatCard icon={Database} label="Webhook" value={summary?.webhookConfigured ? 'Ready' : 'Missing'} />
        <StatCard icon={Database} label="Supabase" value={summary?.supabaseStatus || '--'} />
        <StatCard icon={Database} label="Firebase" value={summary?.firebaseStatus || '--'} />
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span>Realtime operations</span>
            <h2>Live control surface</h2>
          </div>
        </div>
        <div className="admin-ops-grid">
          <button onClick={() => setSection('players')}><Users size={18} /> Manage users</button>
          <button onClick={() => setSection('matches')}><Swords size={18} /> Review matches</button>
          <button onClick={() => setSection('fairplay')}><ShieldAlert size={18} /> Anti-cheat queue</button>
          <button onClick={() => setSection('payments')}><CreditCard size={18} /> Payments</button>
          <button onClick={() => setSection('audit')}><FileText size={18} /> Audit logs</button>
          <button onClick={() => load()} disabled={loading}><RefreshCw size={18} /> Refresh data</button>
        </div>
      </section>
    </>
  );

  const renderPlayers = () => (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>User management</span>
          <h2>Accounts, devices and bans</h2>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          load(search);
        }}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search username/email..." />
          <button disabled={loading}><Search size={16} /> Search</button>
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
                <strong>{user.display_name || user.username || user.email}</strong>
                <span>{user.email || user.username}</span>
                <small>UID: {user.id} · Elo: {topRating?.rating ?? 400} · Games: {topRating?.games_played ?? 0} · Cheat score: {risk}</small>
                {device && <em>Device: {device.device_fingerprint.slice(0, 22)}... · {time(device.last_seen_at)}</em>}
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

  const renderMatches = () => (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Match management</span>
          <h2>Recent online games</h2>
        </div>
      </div>
      <div className="admin-table-list">
        {matches.map((match) => (
          <article className="admin-report-card" key={match.id}>
            <div>
              <strong>{match.white_name || 'White'} vs {match.black_name || 'Black'}</strong>
              <span>{match.status} · {match.result || '*'} · {match.mode || 'rapid'} · {match.time_control} · {match.moveCount} moves</span>
              <small>ID: {match.id} · Created: {time(match.created_at)} · Updated: {time(match.updated_at)}</small>
              <em>{(match.lastMoves || []).map((move) => move.san).join(' ')}</em>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const renderFairPlay = () => (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Advanced anti-cheat</span>
          <h2>Moderation workflow</h2>
        </div>
      </div>
      <div className="admin-report-list">
        {reports.length === 0 && <p>No anti-cheat reports.</p>}
        {reports.map((report) => (
          <article className="admin-report-card" key={report.id}>
            <div>
              <strong>{report.users?.display_name || report.users?.email || report.user_id}</strong>
              <span>Risk {report.risk_score}/100 · Engine match {pct(report.engine_match_rate)} · Fast best moves {report.suspicious_move_count}</span>
              <small>{time(report.created_at)} · {report.status}</small>
            </div>
            <div>
              <button onClick={() => updateAntiCheatReport(report.id, 'reviewed').then(() => load())}>Under Review</button>
              <button onClick={() => updateAntiCheatReport(report.id, 'dismissed').then(() => load())}>False positive</button>
              <button onClick={() => updateAntiCheatReport(report.id, 'actioned').then(() => load())}>Punished</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const renderPayments = () => (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>PayPal subscriptions</span>
          <h2>Billing operations</h2>
        </div>
        <div className="admin-inline-actions">
          <button onClick={runPayPalDiagnostics}><Database size={16} /> Diagnose plans</button>
          <button onClick={runPayPalCreateTest}><CreditCard size={16} /> Test create</button>
        </div>
      </div>
      {paypalDiagnostics && (
        <div className="admin-diagnostic-grid">
          {paypalDiagnostics.diagnostics?.map((item) => (
            <div className={`admin-diagnostic-card ${item.ok ? 'ok' : 'danger'}`} key={`${item.tier}-${item.cycle}`}>
              <strong>{item.tier} {item.cycle}</strong>
              <span>{item.plan?.id || item.planId}</span>
              <small>{item.ok ? `${item.plan?.status} · ${item.plan?.value || '--'} ${item.plan?.currency || ''}` : item.error}</small>
            </div>
          ))}
        </div>
      )}
      <div className="admin-table-list">
        {payments.map((payment) => (
          <article className="admin-report-card" key={payment.user_id}>
            <div>
              <strong>{payment.users?.display_name || payment.users?.email || payment.user_id}</strong>
              <span>{payment.tier} · {payment.status} · {payment.billing_cycle} · {payment.provider_subscription_id || 'no subscription id'}</span>
              <small>Plan: {payment.provider_plan_id || '--'} · Renewal: {time(payment.current_period_end)} · Updated: {time(payment.updated_at)}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const renderAudit = () => (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Immutable audit trail</span>
          <h2>Admin actions</h2>
        </div>
      </div>
      <div className="admin-table-list">
        {auditLogs.map((log) => (
          <article className="admin-report-card" key={log.id}>
            <div>
              <strong>{log.action}</strong>
              <span>Target: {log.target_user_id || log.target_device_fingerprint || '--'}</span>
              <small>{time(log.created_at)} · log #{log.id}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const renderConfig = () => (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>System configuration</span>
          <h2>Runtime configuration</h2>
        </div>
      </div>
      <div className="admin-config-grid">
        {Object.entries(config || {}).map(([key, value]) => (
          <div key={key}>
            <strong>{key}</strong>
            <span>{Array.isArray(value) ? value.join(', ') : String(value)}</span>
          </div>
        ))}
      </div>
    </section>
  );

  const renderDetail = () => (
    <section className="admin-panel admin-detail-panel">
      {!selectedDetail ? (
        <p>Select a user from Users to inspect devices, bans and recent replays.</p>
      ) : (
        <>
          <div className="admin-panel-head">
            <div>
              <span>User detail</span>
              <h2>{selectedDetail.user.display_name}</h2>
            </div>
            <button onClick={() => setSelectedDetail(null)}>Close</button>
          </div>
          <div className="admin-detail-grid">
            <div>
              <strong>Device/IP history</strong>
              {selectedDetail.devices.length === 0 && <p>No fingerprint.</p>}
              {selectedDetail.devices.map((device) => (
                <p key={device.id}>{device.device_fingerprint}<br /><small>{device.user_agent || 'unknown'} · {time(device.last_seen_at)}</small></p>
              ))}
            </div>
            <div>
              <strong>Ban history</strong>
              {selectedDetail.bans.length === 0 && <p>No bans.</p>}
              {selectedDetail.bans.map((ban) => (
                <p key={ban.id}>{ban.status} · {ban.ban_type}<br /><small>{ban.reason}</small></p>
              ))}
            </div>
          </div>
          <div className="admin-game-replay-list">
            <strong>Recent replays</strong>
            {selectedDetail.games.map((game) => (
              <details key={game.id} className="admin-replay-card">
                <summary>{game.white.name} vs {game.black.name} · {game.result || '*'} · {(game.moves || []).length} moves</summary>
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
        <button className="admin-lock-button" onClick={logoutAdmin}><LogOut size={18} /> Lock admin</button>
      </aside>

      <section className="admin-main">
        <header className="admin-hero">
          <div>
            <span><Shield size={18} /> Production Admin Console</span>
            <h1>Operations, payments and fair play</h1>
            <p>Admin: {admin?.email || 'verifying'} · Role: {admin?.role || 'owner'} · Separate admin session.</p>
          </div>
          <button onClick={() => load()} disabled={loading}><RefreshCw size={18} /> Refresh</button>
        </header>

        {message && <p className="admin-message">{message}</p>}
        {section === 'overview' && renderOverview()}
        {section === 'players' && renderPlayers()}
        {section === 'matches' && renderMatches()}
        {section === 'fairplay' && renderFairPlay()}
        {section === 'payments' && renderPayments()}
        {section === 'audit' && renderAudit()}
        {section === 'config' && renderConfig()}
        {section === 'detail' && renderDetail()}
      </section>
    </main>
  );
}
