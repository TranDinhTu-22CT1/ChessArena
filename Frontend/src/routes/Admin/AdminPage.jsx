import React from 'react';
import {
  Activity,
  Bot,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Settings,
  Shield,
  ShieldAlert,
  Swords,
  Users
} from 'lucide-react';
import {
  adminUserAction,
  createAdminBot,
  createAdminEvent,
  fetchAdminAuditLogs,
  fetchAdminBots,
  fetchAdminConfig,
  fetchAdminEvents,
  fetchAdminMatches,
  fetchAdminMe,
  fetchAdminPayments,
  fetchAdminSummary,
  fetchAdminUserDetail,
  fetchAdminUsers,
  fetchAntiCheatReports,
  fetchModerationReports,
  fetchPayPalDiagnostics,
  lockAdmin,
  scanUserAntiCheat,
  testPayPalSubscription,
  unlockAdmin,
  updateAdminBot,
  updateAdminEvent,
  updateAntiCheatReport,
  updateModerationReport
} from '../../api/admin';
import { notify } from '../../components/ToastHost';
import AdminLogin from './AdminLogin';
import AuditSection from './AuditSection';
import BanModal from './BanModal';
import BotsSection from './BotsSection';
import ConfigSection from './ConfigSection';
import DetailModal from './DetailModal';
import FairPlaySection from './FairPlaySection';
import MatchesSection from './MatchesSection';
import ModerationSection from './ModerationSection';
import OverviewSection from './OverviewSection';
import PaymentsSection from './PaymentsSection';
import PlayersSection from './PlayersSection';
import { defaultBotForm, NAV_ITEMS } from './adminUtils';

const ICONS = {
  Activity,
  Bot,
  CreditCard,
  FileText,
  LayoutDashboard,
  Settings,
  Shield,
  ShieldAlert,
  Swords,
  Users
};

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
  const [banForm, setBanForm] = React.useState({ banType: 'account', reason: 'Vi phạm fair play / chính sách', expiresAt: '' });
  const [botForms, setBotForms] = React.useState(() => Array.from({ length: 5 }, (_, index) => defaultBotForm(index)));
  const [eventForm, setEventForm] = React.useState({ title: 'Thử thách bot mùa lễ', eventType: 'bot_challenge', description: 'Đánh bại bot nổi bật và leo bảng sự kiện trong thời gian giới hạn.', rewardLabel: 'Huy hiệu mùa', active: true });
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
      const text = error.message || 'Không thể tải trang quản trị.';
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
      notify('Admin đã đăng nhập.', 'success');
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
    setLoginRequired(true);
    notify('Phiên admin đã được khóa.', 'info');
  };

  const openBan = (user, banType) => {
    setBanTarget(user);
    setBanForm({
      banType,
      reason: banType === 'risk' ? 'Vi phạm công bằng liên quan tín hiệu rủi ro' : 'Vi phạm công bằng / chính sách',
      expiresAt: ''
    });
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
      notify(banForm.banType === 'risk' ? 'Đã áp dụng cấm theo rủi ro.' : 'Đã cấm người chơi.', 'success');
      setBanTarget(null);
      await load();
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const runUserAction = async (action, user, successMessage, extra = {}) => {
    try {
      await adminUserAction({ action, userId: user.id, ...extra });
      notify(successMessage, 'success');
      await load();
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const scanUser = async (user) => {
    setMessage(`Đang quét ${user.display_name || user.email}...`);
    try {
      const data = await scanUserAntiCheat(user.id);
      const scan = data.summary || {};
      setMessage(`Đã quét ${scan.gamesScanned ?? data.reports?.length ?? 0} ván. Rủi ro cao nhất ${scan.maxRisk ?? 0}/100, ${scan.recommendation || 'không cần xử lý'}.`);
      notify('Quét chống gian lận hoàn tất.', 'success');
      await load();
      setSection('fairplay');
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const openDetail = async (user) => {
    setMessage(`Đang tải ${user.display_name || user.email}...`);
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
      notify('Đã thêm 5 bot vào Play Bot.', 'success');
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
      notify('Đã tạo sự kiện.', 'success');
      setEventForm((form) => ({ ...form, title: '' }));
      await load();
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  const saveBot = async (botId, payload) => {
    try {
      await updateAdminBot(botId, payload);
      notify('Đã cập nhật bot.', 'success');
      await load();
    } catch (error) {
      notify(error.message, 'error');
      throw error;
    }
  };

  const saveEvent = async (eventId, payload) => {
    try {
      await updateAdminEvent(eventId, payload);
      notify('Đã cập nhật sự kiện.', 'success');
      await load();
    } catch (error) {
      notify(error.message, 'error');
      throw error;
    }
  };

  const changeModerationStatus = async (report, status) => {
    const resolutionNote = ['resolved', 'dismissed', 'escalated'].includes(status)
      ? window.prompt('Ghi chú xử lý', status === 'dismissed' ? 'Không phát hiện vi phạm chính sách.' : 'Đã được đội kiểm duyệt xem xét.')
      : '';
    if (resolutionNote === null) return;
    await updateModerationReport(report.id, status, resolutionNote || '');
    notify('Đã cập nhật báo cáo kiểm duyệt.', 'success');
    await load();
  };

  const runPayPalDiagnostics = async () => {
    setMessage('Đang kiểm tra PayPal...');
    try {
      const data = await fetchPayPalDiagnostics();
      setPaypalDiagnostics(data);
      setMessage('Đã kiểm tra PayPal xong.');
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const runPayPalCreateTest = async () => {
    setMessage('Đang tạo thử gói PayPal Master hàng tháng...');
    try {
      const data = await testPayPalSubscription('master', 'monthly');
      setMessage(data.approveUrl ? `PayPal thử nghiệm OK. Mã đăng ký ${data.subscriptionId}` : `PayPal thử nghiệm OK: ${data.status}`);
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  if (loginRequired) {
    return (
      <AdminLogin
        loading={loading}
        message={message}
        unlockEmail={unlockEmail}
        unlockPassword={unlockPassword}
        onEmailChange={setUnlockEmail}
        onPasswordChange={setUnlockPassword}
        onSubmit={submitLogin}
      />
    );
  }

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
            const Icon = ICONS[item.iconName] || Shield;
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
            <span><Shield size={18} /> Bảng quản trị vận hành</span>
            <h1>Vận hành, thanh toán và công bằng</h1>
            <p>Admin: {admin?.email || 'đang xác thực'} | Vai trò: {admin?.role || 'owner'} | Phiên admin tách riêng.</p>
          </div>
          <button onClick={() => load()} disabled={loading}><RefreshCw size={18} /> Làm mới</button>
        </header>

        {message && <p className="admin-message">{message}</p>}
        {section === 'overview' && <OverviewSection summary={summary} loading={loading} onLoad={() => load()} onSectionChange={setSection} />}
        {section === 'players' && (
          <PlayersSection
            users={users}
            search={search}
            loading={loading}
            onSearchChange={setSearch}
            onLoad={load}
            onOpenDetail={openDetail}
            onOpenPublicProfile={openPublicProfile}
            onScanUser={scanUser}
            onMuteUser={(user) => {
              const reason = window.prompt('Lý do tắt chat', 'Lạm dụng chat/báo cáo');
              if (reason) runUserAction('mute', user, 'Đã tắt chat người chơi.', { reason });
            }}
            onUnmuteUser={(user) => runUserAction('unmute', user, 'Đã mở chat.')}
            onUnbanUser={(user) => runUserAction('unban', user, 'Đã gỡ cấm.')}
            onOpenBan={openBan}
          />
        )}
        {section === 'matches' && <MatchesSection matches={matches} />}
        {section === 'fairplay' && <FairPlaySection reports={reports} onUpdateReport={(id, status) => updateAntiCheatReport(id, status).then(() => load())} />}
        {section === 'moderation' && <ModerationSection reports={moderationReports} onChangeStatus={changeModerationStatus} />}
        {section === 'payments' && <PaymentsSection payments={payments} paypalDiagnostics={paypalDiagnostics} onRunDiagnostics={runPayPalDiagnostics} onRunCreateTest={runPayPalCreateTest} />}
        {section === 'bots' && (
          <BotsSection
            bots={bots}
            events={events}
            botForms={botForms}
            eventForm={eventForm}
            onSubmitBot={submitBot}
            onUpdateBotForm={updateBotForm}
            onSubmitEvent={submitEvent}
            onUpdateEventForm={(patch) => setEventForm((form) => ({ ...form, ...patch }))}
            onSaveBot={saveBot}
            onSaveEvent={saveEvent}
            onToggleBot={(bot) => updateAdminBot(bot.id, { ...bot, active: !bot.active }).then(() => load())}
            onToggleEvent={(item) => updateAdminEvent(item.id, { ...item, active: !item.active }).then(() => load())}
          />
        )}
        {section === 'audit' && <AuditSection logs={auditLogs} />}
        {section === 'config' && <ConfigSection config={config} />}
      </section>

      <DetailModal selectedDetail={selectedDetail} onClose={() => setSelectedDetail(null)} />
      <BanModal
        banTarget={banTarget}
        banForm={banForm}
        onSubmit={submitBan}
        onClose={() => setBanTarget(null)}
        onChange={(patch) => setBanForm((form) => ({ ...form, ...patch }))}
      />
    </main>
  );
}
