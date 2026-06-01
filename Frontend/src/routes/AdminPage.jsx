import React from 'react';
import {
  Activity,
  Ban,
  Bot,
  CheckCircle2,
  CalendarDays,
  CreditCard,
  Database,
  ExternalLink,
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
  createAdminBot,
  createAdminEvent,
  fetchAdminConfig,
  fetchAdminBots,
  fetchAdminEvents,
  fetchAdminMatches,
  fetchAdminMe,
  fetchModerationReports,
  fetchAdminPayments,
  fetchAdminSummary,
  fetchAdminUserDetail,
  fetchAdminUsers,
  fetchAntiCheatReports,
  fetchPayPalDiagnostics,
  lockAdmin,
  scanUserAntiCheat,
  testPayPalSubscription,
  updateAdminBot,
  updateAdminEvent,
  unlockAdmin,
  updateAntiCheatReport,
  updateModerationReport
} from '../api/admin';
import { notify } from '../components/ToastHost';

const NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'players', label: 'Users', icon: Users },
  { id: 'matches', label: 'Matches', icon: Swords },
  { id: 'fairplay', label: 'Anti-cheat', icon: ShieldAlert },
  { id: 'moderation', label: 'Moderation', icon: Shield },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'bots', label: 'Bots & events', icon: Bot },
  { id: 'audit', label: 'Audit logs', icon: FileText },
  { id: 'config', label: 'System config', icon: Settings }
];

function pct(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function activeBan(user) {
  return user.bans?.find((ban) => ban.status === 'active' && (!ban.expires_at || new Date(ban.expires_at) > new Date())) || null;
}

function activeMute(user) {
  return user.mutes?.find((mute) => mute.status === 'active') || null;
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

function defaultBotForm(index = 0) {
  return {
    name: `Custom Bot ${index + 1}`,
    elo: 1200 + index * 200,
    mood: 'Custom challenge bot',
    chat: 'Ready for a themed game.',
    eventTag: 'seasonal',
    avatarUrl: '/chessarena-mark.svg',
    active: true
  };
}

export default function AdminPage() {
  const [admin, setAdmin] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [users, setUsers] = React.useState([]);
  const [reports, setReports] = React.useState([]);
  const [moderationReports, setModerationReports] = React.useState([]);
  const [matches, setMatches] = React.useState([]);
  const [payments, setPayments] = React.useState([]);
  const [bots, setBots] = React.useState([]);
  const [events, setEvents] = React.useState([]);
  const [auditLogs, setAuditLogs] = React.useState([]);
  const [config, setConfig] = React.useState(null);
  const [paypalDiagnostics, setPaypalDiagnostics] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [selectedDetail, setSelectedDetail] = React.useState(null);
  const [banTarget, setBanTarget] = React.useState(null);
  const [banForm, setBanForm] = React.useState({ banType: 'account', reason: 'Fair play / policy violation', expiresAt: '' });
  const [botForms, setBotForms] = React.useState(() => Array.from({ length: 5 }, (_, index) => defaultBotForm(index)));
  const [eventForm, setEventForm] = React.useState({ title: 'Holiday Bot Challenge', eventType: 'bot_challenge', description: 'Beat the featured bot and climb a limited-time event board.', rewardLabel: 'Seasonal badge', active: true });
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
        moderationData,
        matchesData,
        paymentsData,
        botsData,
        eventsData,
        auditData,
        configData
      ] = await Promise.all([
        fetchAdminMe(),
        fetchAdminSummary(),
        fetchAdminUsers(nextSearch),
        fetchAntiCheatReports(),
        fetchModerationReports().catch(() => ({ reports: [] })),
        fetchAdminMatches(),
        fetchAdminPayments(),
        fetchAdminBots().catch(() => ({ bots: [] })),
        fetchAdminEvents().catch(() => ({ events: [] })),
        fetchAdminAuditLogs(),
        fetchAdminConfig()
      ]);
      setAdmin(me.admin);
      setSummary(summaryData.summary);
      setUsers(usersData.users || []);
      setReports(reportsData.reports || []);
      setModerationReports(moderationData.reports || []);
      setMatches(matchesData.matches || []);
      setPayments(paymentsData.payments || []);
      setBots(botsData.bots || []);
      setEvents(eventsData.events || []);
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

  const submitBan = async (event) => {
    event.preventDefault();
    if (!banTarget) return;
    const deviceFingerprint = banTarget.devices?.[0]?.device_fingerprint || '';
    try {
      await adminUserAction({
        action: 'ban',
        userId: banTarget.id,
        banType: banForm.banType,
        deviceFingerprint,
        reason: banForm.reason,
        expiresAt: banForm.expiresAt || null
      });
      notify(banForm.banType === 'risk' ? 'Risk ban applied.' : 'User banned.', 'success');
      setBanTarget(null);
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

  const muteUser = async (user) => {
    const reason = window.prompt('Mute reason', 'Chat/report abuse');
    if (!reason) return;
    try {
      await adminUserAction({ action: 'mute', userId: user.id, reason });
      notify('User muted.', 'success');
      await load();
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const unmuteUser = async (user) => {
    try {
      await adminUserAction({ action: 'unmute', userId: user.id });
      notify('Mute lifted.', 'success');
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
      const scan = data.summary || {};
      setMessage(
        `Scanned ${scan.gamesScanned ?? data.reports?.length ?? 0} games. Max risk ${scan.maxRisk ?? 0}/100, ${scan.recommendation || 'no_action'}.`
      );
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
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const openPublicProfile = (user) => {
    const profileId = user.id || user.username;
    if (!profileId) return;
    window.open(`/profile/${encodeURIComponent(profileId)}?adminView=1`, '_blank', 'noopener,noreferrer');
  };

  const submitBot = async (event) => {
    event.preventDefault();
    try {
      await createAdminBot({ bots: botForms });
      notify('5 bots added to Play Bots.', 'success');
      setBotForms(Array.from({ length: 5 }, (_, index) => defaultBotForm(index)));
      await load();
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  const updateBotForm = (index, patch) => {
    setBotForms((forms) => forms.map((form, currentIndex) => (
      currentIndex === index ? { ...form, ...patch } : form
    )));
  };

  const submitEvent = async (event) => {
    event.preventDefault();
    try {
      await createAdminEvent(eventForm);
      notify('Event created.', 'success');
      setEventForm((form) => ({ ...form, title: '' }));
      await load();
    } catch (error) {
      notify(error.message, 'error');
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
          {loading && (
            <div className="admin-form-loading" role="status" aria-live="polite">
              <span />
              Securing admin session...
            </div>
          )}
          <button disabled={loading || !unlockEmail || !unlockPassword}>
            {loading ? <RefreshCw size={18} className="admin-spin" /> : <LockKeyhole size={18} />}
            {loading ? 'Loading admin...' : 'Login'}
          </button>
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
        <StatCard icon={Shield} label="Player reports" value={summary?.openPlayerReports} tone={summary?.openPlayerReports ? 'danger' : ''} />
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
          const mute = activeMute(user);
          const device = user.devices?.[0];
          const topRating = [...(user.ratings || [])].sort((a, b) => b.rating - a.rating)[0];
          const risk = user.reports?.[0]?.risk_score ?? 0;
          return (
            <article className="admin-user-card" key={user.id}>
              <img src={user.photo_url || '/chessarena-mark.svg'} alt="" />
              <div>
                <strong>{user.display_name || user.username || user.email}</strong>
                <span>{user.email || user.username}</span>
                <small>UID: {user.id} | Elo: {topRating?.rating ?? 400} | Games: {topRating?.games_played ?? 0} | Cheat score: {risk}</small>
                {device && <em>Risk signals: {device.device_fingerprint.slice(0, 16)}... | IP {device.ip_prefix || '--'} | UA {device.user_agent_hash?.slice(0, 10) || '--'} | {time(device.last_seen_at)}</em>}
                {ban && <b className="admin-ban-note">Banned: {ban.reason}</b>}
                {mute && <b className="admin-ban-note mute">Muted: {mute.reason}</b>}
              </div>
              <div className="admin-user-actions">
                <button onClick={() => openDetail(user)}><UserCog size={16} /> Detail</button>
                <button onClick={() => openPublicProfile(user)}><ExternalLink size={16} /> Profile</button>
                <button onClick={() => scanUser(user)}><ShieldAlert size={16} /> Scan</button>
                {mute ? (
                  <button onClick={() => unmuteUser(user)}><CheckCircle2 size={16} /> Unmute</button>
                ) : (
                  <button onClick={() => muteUser(user)}><Shield size={16} /> Mute</button>
                )}
                {ban ? (
                  <button onClick={() => unbanUser(user)}><CheckCircle2 size={16} /> Unban</button>
                ) : (
                  <>
                    <button onClick={() => {
                      setBanTarget(user);
                      setBanForm({ banType: 'account', reason: 'Fair play / policy violation', expiresAt: '' });
                    }}><Ban size={16} /> Ban</button>
                    <button disabled={!device} onClick={() => {
                      setBanTarget(user);
                      setBanForm({ banType: 'risk', reason: 'Risk-linked fair play violation', expiresAt: '' });
                    }}><Ban size={16} /> Risk ban</button>
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
              <span>{match.status} | {match.result || '*'} | {match.mode || 'rapid'} | {match.time_control} | {match.moveCount} moves</span>
              <small>ID: {match.id} | Created: {time(match.created_at)} | Updated: {time(match.updated_at)}</small>
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
        {reports.map((report) => {
          const details = report.details || {};
          return (
            <article className="admin-report-card" key={report.id}>
              <div>
                <strong>{report.users?.display_name || report.users?.email || report.user_id}</strong>
                <span>
                  Risk {report.risk_score}/100
                  {' | '}{details.band || 'single-game review'}
                  {' | '}Engine {pct(report.engine_match_rate)}
                  {' | '}Critical {pct(details.criticalMatchRate)}
                  {' | '}Complex {pct(details.complexMatchRate)}
                  {' | '}Avg CPL {Math.round(details.averageCpLoss ?? 0)}
                </span>
                <small>{time(report.created_at)} | {report.status} | {details.guidance || 'Review context before action.'}</small>
              </div>
              <div>
                <button onClick={() => updateAntiCheatReport(report.id, 'reviewed').then(() => load())}>Under Review</button>
                <button onClick={() => updateAntiCheatReport(report.id, 'dismissed').then(() => load())}>False positive</button>
                <button onClick={() => updateAntiCheatReport(report.id, 'actioned').then(() => load())}>Punished</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  const changeModerationStatus = async (report, status) => {
    const resolutionNote = ['resolved', 'dismissed', 'escalated'].includes(status)
      ? window.prompt('Resolution note', status === 'dismissed' ? 'No policy violation found.' : 'Reviewed by moderation.')
      : '';
    if (resolutionNote === null) return;
    await updateModerationReport(report.id, status, resolutionNote || '');
    notify('Moderation report updated.', 'success');
    await load();
  };

  const renderModeration = () => (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Player reports</span>
          <h2>Moderation queue</h2>
        </div>
      </div>
      <div className="admin-report-list">
        {moderationReports.length === 0 && <p>No player reports.</p>}
        {moderationReports.map((report) => (
          <article className="admin-report-card admin-moderation-card" key={report.id}>
            <div>
              <strong>{report.reported?.display_name || report.reported?.email || report.reported_user_id || 'Unknown player'}</strong>
              <span>{report.category} | {report.severity} | {report.status}</span>
              <small>
                Reporter: {report.reporter?.display_name || report.reporter?.email || report.reporter_user_id}
                {' '}| Game: {report.game?.white_name || 'White'} vs {report.game?.black_name || 'Black'}
                {' '}| {time(report.created_at)}
              </small>
              <em>{report.description}</em>
              <small>Evidence: {report.evidence?.moveCount ?? 0} moves | Result {report.evidence?.result || report.game?.result || '*'}</small>
            </div>
            <div>
              <button onClick={() => changeModerationStatus(report, 'in_review')}>Under Review</button>
              <button onClick={() => changeModerationStatus(report, 'escalated')}>Escalate</button>
              <button onClick={() => changeModerationStatus(report, 'resolved')}>Resolve</button>
              <button onClick={() => changeModerationStatus(report, 'dismissed')}>Dismiss</button>
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
              <small>{item.ok ? `${item.plan?.status} | ${item.plan?.value || '--'} ${item.plan?.currency || ''}` : item.error}</small>
            </div>
          ))}
        </div>
      )}
      <div className="admin-table-list">
        {payments.map((payment) => (
          <article className="admin-report-card" key={payment.user_id}>
            <div>
              <strong>{payment.users?.display_name || payment.users?.email || payment.user_id}</strong>
              <span>{payment.tier} | {payment.status} | {payment.billing_cycle} | {payment.provider_subscription_id || 'no subscription id'}</span>
              <small>Plan: {payment.provider_plan_id || '--'} | Renewal: {time(payment.current_period_end)} | Updated: {time(payment.updated_at)}</small>
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
              <strong>{log.readableAction || log.action}</strong>
              <span>{log.readableDetail || `Đối tượng: ${log.targetLabel || log.target_user_id || log.target_device_fingerprint || '--'}`}</span>
              <small>{time(log.created_at)} | #{log.id}</small>
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
              <strong>Security/Risk snapshot</strong>
              <p>
                Latest device: {selectedDetail.devices[0]?.device_fingerprint?.slice(0, 24) || '--'}
                <br />
                <small>IP prefix: {selectedDetail.devices[0]?.ip_prefix || '--'} | UA signature: {selectedDetail.devices[0]?.user_agent_hash?.slice(0, 18) || '--'}</small>
              </p>
              <p>
                Reports: {selectedDetail.reports.length}
                <br />
                <small>Highest risk: {Math.max(0, ...selectedDetail.reports.map((report) => Number(report.risk_score || 0)))}/100</small>
              </p>
            </div>
            <div>
              <strong>Device/IP history</strong>
              {selectedDetail.devices.length === 0 && <p>No fingerprint.</p>}
              {selectedDetail.devices.map((device) => (
                <p key={device.id}>{device.device_fingerprint}<br /><small>IP {device.ip_prefix || '--'} | UA {device.user_agent_hash?.slice(0, 18) || '--'} | {time(device.last_seen_at)}</small><br /><small>{device.user_agent || 'unknown'}</small></p>
              ))}
            </div>
            <div>
              <strong>Ban history</strong>
              {selectedDetail.bans.length === 0 && <p>No bans.</p>}
              {selectedDetail.bans.map((ban) => (
                <p key={ban.id}>{ban.status} | {ban.ban_type}<br /><small>{ban.reason}</small>{ban.ip_prefix && <><br /><small>Risk: IP {ban.ip_prefix} | UA {ban.user_agent_hash?.slice(0, 18) || '--'}</small></>}</p>
              ))}
            </div>
          </div>
          <div className="admin-game-replay-list">
            <strong>Recent replays</strong>
            {selectedDetail.games.map((game) => (
              <details key={game.id} className="admin-replay-card">
                <summary>{game.white.name} vs {game.black.name} | {game.result || '*'} | {(game.moves || []).length} moves</summary>
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

  const renderBots = () => (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span><Bot size={16} /> Play Bot content</span>
          <h2>Seasonal bots and events</h2>
        </div>
      </div>
      <div className="admin-content-grid">
        <form className="admin-editor-card" onSubmit={submitBot}>
          <strong>Add 5 bots</strong>
          {botForms.map((botForm, index) => (
            <div className="admin-bot-batch-row" key={index}>
              <span>Bot {index + 1}</span>
              <input value={botForm.name} onChange={(event) => updateBotForm(index, { name: event.target.value })} placeholder="Bot name" />
              <input type="number" value={botForm.elo} onChange={(event) => updateBotForm(index, { elo: event.target.value })} placeholder="Elo" />
              <input value={botForm.eventTag} onChange={(event) => updateBotForm(index, { eventTag: event.target.value })} placeholder="Event tag" />
              <input value={botForm.avatarUrl} onChange={(event) => updateBotForm(index, { avatarUrl: event.target.value })} placeholder="Avatar URL" />
              <textarea value={botForm.mood} onChange={(event) => updateBotForm(index, { mood: event.target.value })} placeholder="Bot style" />
              <textarea value={botForm.chat} onChange={(event) => updateBotForm(index, { chat: event.target.value })} placeholder="Lobby chat" />
              <label className="admin-check"><input type="checkbox" checked={botForm.active} onChange={() => updateBotForm(index, { active: !botForm.active })} /> Active</label>
            </div>
          ))}
          <button><Bot size={16} /> Add 5 bots</button>
        </form>
        <form className="admin-editor-card" onSubmit={submitEvent}>
          <strong>Create event</strong>
          <input value={eventForm.title} onChange={(event) => setEventForm((form) => ({ ...form, title: event.target.value }))} placeholder="Event title" />
          <input value={eventForm.eventType} onChange={(event) => setEventForm((form) => ({ ...form, eventType: event.target.value }))} placeholder="event_type" />
          <input value={eventForm.rewardLabel} onChange={(event) => setEventForm((form) => ({ ...form, rewardLabel: event.target.value }))} placeholder="Reward" />
          <textarea value={eventForm.description} onChange={(event) => setEventForm((form) => ({ ...form, description: event.target.value }))} placeholder="Event idea" />
          <label className="admin-check"><input type="checkbox" checked={eventForm.active} onChange={() => setEventForm((form) => ({ ...form, active: !form.active }))} /> Active</label>
          <button><CalendarDays size={16} /> Create event</button>
        </form>
      </div>
      <div className="admin-table-list">
        {bots.map((bot) => (
          <article className="admin-report-card" key={bot.id}>
            <div>
              <strong>{bot.name} ({bot.elo})</strong>
              <span>{bot.event_tag} | {bot.active ? 'active' : 'hidden'} | {bot.mood}</span>
              <small>{bot.chat}</small>
            </div>
            <div>
              <button onClick={() => updateAdminBot(bot.id, { ...bot, active: !bot.active }).then(() => load())}>{bot.active ? 'Hide' : 'Show'}</button>
            </div>
          </article>
        ))}
        {events.map((item) => (
          <article className="admin-report-card" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.event_type} | {item.active ? 'active' : 'paused'} | Reward: {item.reward_label}</span>
              <small>{item.description}</small>
            </div>
            <div>
              <button onClick={() => updateAdminEvent(item.id, { ...item, active: !item.active }).then(() => load())}>{item.active ? 'Pause' : 'Resume'}</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const renderDetailModal = () => selectedDetail && (
    <div className="admin-modal-layer" role="dialog" aria-modal="true">
      <div className="admin-modal">{renderDetail()}</div>
    </div>
  );

  const renderBanModal = () => banTarget && (
    <div className="admin-modal-layer" role="dialog" aria-modal="true">
      <form className="admin-modal admin-ban-form" onSubmit={submitBan}>
        <div className="admin-panel-head">
          <div>
            <span>{banForm.banType === 'risk' ? 'Risk ban' : 'Ban account'}</span>
            <h2>{banTarget.display_name || banTarget.email}</h2>
          </div>
          <button type="button" onClick={() => setBanTarget(null)}>Close</button>
        </div>
        <label>Ban type
          <select value={banForm.banType} onChange={(event) => setBanForm((form) => ({ ...form, banType: event.target.value }))}>
            <option value="account">Account only</option>
            <option value="account_device">Account + device</option>
            <option value="device">Device only</option>
            <option value="risk">Risk ban: account + device + IP prefix + browser signature</option>
          </select>
        </label>
        {banForm.banType === 'risk' && (
          <p className="admin-ban-note">
            Risk ban for web blocks the account, current browser fingerprint, IP prefix and user-agent signature together.
          </p>
        )}
        <label>Reason
          <textarea value={banForm.reason} onChange={(event) => setBanForm((form) => ({ ...form, reason: event.target.value }))} />
        </label>
        <label>Expires at (optional)
          <input type="datetime-local" value={banForm.expiresAt} onChange={(event) => setBanForm((form) => ({ ...form, expiresAt: event.target.value }))} />
        </label>
        <button><Ban size={16} /> Confirm ban</button>
      </form>
    </div>
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
            <p>Admin: {admin?.email || 'verifying'} | Role: {admin?.role || 'owner'} | Separate admin session.</p>
          </div>
          <button onClick={() => load()} disabled={loading}><RefreshCw size={18} /> Refresh</button>
        </header>

        {message && <p className="admin-message">{message}</p>}
        {section === 'overview' && renderOverview()}
        {section === 'players' && renderPlayers()}
        {section === 'matches' && renderMatches()}
        {section === 'fairplay' && renderFairPlay()}
        {section === 'moderation' && renderModeration()}
        {section === 'payments' && renderPayments()}
        {section === 'bots' && renderBots()}
        {section === 'audit' && renderAudit()}
        {section === 'config' && renderConfig()}
      </section>
      {renderDetailModal()}
      {renderBanModal()}
    </main>
  );
}
