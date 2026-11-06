import React from 'react';
import {
  Activity,
  Bot,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
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
  deleteAdminBot,
  fetchAdminAuditLogs,
  fetchAdminBots,
  fetchAdminConfig,
  fetchAdminEvents,
  fetchAdminMatches,
  fetchAdminMe,
  fetchAdminPayments,
  fetchAdminSummary,
  fetchAdminSupportRequests,
  fetchAdminUserDetail,
  fetchAdminUsers,
  fetchModerationReports,
  fetchPayPalDiagnostics,
  lockAdmin,
  testPayPalSubscription,
  unlockAdmin,
  updateTestAdminAccess,
  updateAdminBot,
  updateAdminConfig,
  updateAdminEvent,
  updateAdminMatchStatus,
  updateAdminSupportRequest,
  updateModerationReport
} from '../../api/admin';
import { notify } from '../../components/ToastHost';
import { getUrlPage, setUrlPage } from '../../components/Pagination';
import AdminLogin from './AdminLogin';
import AuditSection from './AuditSection';
import BanModal from './BanModal';
import BotsSection from './BotsSection';
import ConfigSection from './ConfigSection';
import DetailModal from './DetailModal';

import MatchesSection from './MatchesSection';
import OverviewSection from './OverviewSection';
import PaymentsSection from './PaymentsSection';
import PlayersSection from './PlayersSection';
import SupportSection from './SupportSection';
import ModerationSection from './ModerationSection';
import { defaultBotForm, NAV_ITEMS, SECTION_DESCRIPTIONS } from './adminUtils';
import '../../styles/admin.css';

const ICONS = {
  Activity,
  Bot,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Shield,
  ShieldAlert,
  Swords,
  Users
};

const ADMIN_SECTION_IDS = new Set(NAV_ITEMS.map((item) => item.id));
const EMPTY_MATCH_FILTERS = { search: '', status: '', matchType: '', rated: '', dateFrom: '', dateTo: '' };
const EMPTY_REPORT_FILTERS = { search: '', status: '', category: '', dateFrom: '', dateTo: '' };
const EMPTY_SUPPORT_FILTERS = { search: '', status: '', category: '', dateFrom: '', dateTo: '' };
const EMPTY_PAYMENT_FILTERS = { search: '', status: '', provider: '', tier: '', dateFrom: '', dateTo: '' };

function sectionFromPath() {
  const sectionId = window.location.pathname.split('/').filter(Boolean)[1];
  if (sectionId === 'support' && new URLSearchParams(window.location.search).get('tab') === 'reports') return 'moderation';
  return ADMIN_SECTION_IDS.has(sectionId) ? sectionId : 'overview';
}

function adminSectionPath(sectionId) {
  return sectionId === 'overview' ? '/admin' : `/admin/${sectionId}`;
}

export default function AdminPage() {
  const [admin, setAdmin] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [users, setUsers] = React.useState([]);
  const [userPage, setUserPage] = React.useState(() => getUrlPage('page'));
  const [userTotalPages, setUserTotalPages] = React.useState(1);

  const [moderationReports, setModerationReports] = React.useState([]);
  const [supportRequests, setSupportRequests] = React.useState([]);
  const [supportPage, setSupportPage] = React.useState(() => getUrlPage('page'));
  const [supportTotalPages, setSupportTotalPages] = React.useState(1);
  const [supportStatus, setSupportStatus] = React.useState('');
  const [supportFilters, setSupportFilters] = React.useState(EMPTY_SUPPORT_FILTERS);
  const [matches, setMatches] = React.useState([]);
  const [matchesPage, setMatchesPage] = React.useState(() => getUrlPage('page'));
  const [matchesTotalPages, setMatchesTotalPages] = React.useState(1);
  const [matchFilters, setMatchFilters] = React.useState(EMPTY_MATCH_FILTERS);
  const [payments, setPayments] = React.useState([]);
  const [paymentsPage, setPaymentsPage] = React.useState(() => getUrlPage('page'));
  const [paymentsTotalPages, setPaymentsTotalPages] = React.useState(1);
  const [paymentFilters, setPaymentFilters] = React.useState(EMPTY_PAYMENT_FILTERS);
  const [bots, setBots] = React.useState([]);
  const [botsPage, setBotsPage] = React.useState(() => getUrlPage('botPage'));
  const [botsTotalPages, setBotsTotalPages] = React.useState(1);
  const [events, setEvents] = React.useState([]);
  const [eventsPage, setEventsPage] = React.useState(() => getUrlPage('eventPage'));
  const [eventsTotalPages, setEventsTotalPages] = React.useState(1);
  const [auditLogs, setAuditLogs] = React.useState([]);
  const [auditPage, setAuditPage] = React.useState(() => getUrlPage('page'));
  const [auditTotalPages, setAuditTotalPages] = React.useState(1);
  const [config, setConfig] = React.useState(null);
  const [testAdmin, setTestAdmin] = React.useState(null);
  const [paypalDiagnostics, setPaypalDiagnostics] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [appliedSearch, setAppliedSearch] = React.useState('');
  const adminSessionRef = React.useRef(null);
  const loadRequestRef = React.useRef(0);
  const [message, setMessage] = React.useState('');
  const [selectedDetail, setSelectedDetail] = React.useState(null);
  const [banTarget, setBanTarget] = React.useState(null);
  const [banForm, setBanForm] = React.useState({ reason: 'Vi phạm chính sách', expiresAt: '' });
  const [botForms, setBotForms] = React.useState(() => Array.from({ length: 5 }, (_, index) => defaultBotForm(index)));
  const [eventForm, setEventForm] = React.useState({ title: 'Thử thách bot mùa lễ', eventType: 'bot_challenge', description: 'Đánh bại bot nổi bật và leo bảng sự kiện trong thời gian giới hạn.', rewardLabel: 'Huy hiệu mùa', active: true });
  const [loading, setLoading] = React.useState(false);
  const [section, setSection] = React.useState(() => sectionFromPath());
  const [unlockEmail, setUnlockEmail] = React.useState('');
  const [unlockPassword, setUnlockPassword] = React.useState('');
  const [loginRequired, setLoginRequired] = React.useState(true);
  const [moderationPage, setModerationPage] = React.useState(() => getUrlPage('page'));
  const [moderationTotalPages, setModerationTotalPages] = React.useState(1);
  const [moderationFilters, setModerationFilters] = React.useState(EMPTY_REPORT_FILTERS);

  const load = React.useCallback(async (
    nextSearch = appliedSearch,
    nextUserPage = userPage,
    nextMatchesPage = matchesPage,
    nextModerationPage = moderationPage,
    nextPaymentsPage = paymentsPage,
    nextBotsPage = botsPage,
    nextEventsPage = eventsPage,
    nextAuditPage = auditPage,
    nextSupportPage = supportPage,
    nextSupportStatus = supportStatus
  ) => {
    const activeSection = section;
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setMessage('');
    try {
      const me = adminSessionRef.current || await fetchAdminMe();
      if (requestId !== loadRequestRef.current) return;
      adminSessionRef.current = me;
      setAdmin(me.admin);
      setLoginRequired(false);

      const [
        summaryData,
        usersData,
        moderationData,
        supportData,
        matchesData,
        paymentsData,
        botsData,
        eventsData,
        auditData,
        configData
      ] = await Promise.all([
        activeSection === 'overview' ? fetchAdminSummary() : Promise.resolve(null),
        activeSection === 'players' ? fetchAdminUsers(nextSearch, { page: nextUserPage, limit: 10 }) : Promise.resolve(null),
        activeSection === 'moderation' ? fetchModerationReports({ page: nextModerationPage, limit: 10, ...moderationFilters }) : Promise.resolve(null),
        activeSection === 'support' ? fetchAdminSupportRequests({ page: nextSupportPage, limit: 10, ...supportFilters, status: nextSupportStatus || supportFilters.status }) : Promise.resolve(null),
        activeSection === 'matches' ? fetchAdminMatches({ page: nextMatchesPage, limit: 10, ...matchFilters }) : Promise.resolve(null),
        activeSection === 'payments' ? fetchAdminPayments({ page: nextPaymentsPage, limit: 10, ...paymentFilters }) : Promise.resolve(null),
        activeSection === 'bots' ? fetchAdminBots({ page: nextBotsPage, limit: 50 }) : Promise.resolve(null),
        activeSection === 'bots' ? fetchAdminEvents({ page: nextEventsPage, limit: 10 }) : Promise.resolve(null),
        activeSection === 'audit' ? fetchAdminAuditLogs({ page: nextAuditPage, limit: 20 }) : Promise.resolve(null),
        activeSection === 'config' ? fetchAdminConfig() : Promise.resolve(null)
      ]);
      if (requestId !== loadRequestRef.current) return;
      if (summaryData) setSummary(summaryData.summary);
      if (usersData) {
        setUsers(usersData.users || []);
        setUserTotalPages(usersData.totalPages || 1);
      }

      if (moderationData) {
        setModerationReports(moderationData.reports || []);
        setModerationTotalPages(moderationData.totalPages || 1);
      }
      if (supportData) {
        setSupportRequests(supportData.requests || []);
        setSupportTotalPages(supportData.totalPages || 1);
      }
      if (matchesData) {
        setMatches(matchesData.matches || []);
        setMatchesTotalPages(matchesData.totalPages || 1);
      }
      if (paymentsData) {
        setPayments(paymentsData.payments || []);
        setPaymentsTotalPages(paymentsData.totalPages || 1);
      }
      if (botsData) {
        setBots(botsData.bots || []);
        setBotsTotalPages(botsData.totalPages || 1);
      }
      if (eventsData) {
        setEvents(eventsData.events || []);
        setEventsTotalPages(eventsData.totalPages || 1);
      }
      if (auditData) {
        setAuditLogs(auditData.logs || []);
        setAuditTotalPages(auditData.totalPages || 1);
      }
      if (configData) {
        setConfig(configData.config || null);
        setTestAdmin(configData.testAdmin || null);
      }
      setLoginRequired(false);
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      const text = error.message || 'Không thể tải trang quản trị.';
      setMessage(text);
      if (error.status === 401 || error.status === 403) {
        adminSessionRef.current = null;
        setLoginRequired(true);
      }
      notify(text, 'error');
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [auditPage, botsPage, eventsPage, matchFilters, matchesPage, moderationFilters, moderationPage, paymentFilters, paymentsPage, appliedSearch, section, supportFilters, supportPage, supportStatus, userPage]);

  const changeSection = React.useCallback((nextSection) => {
    const nextPath = adminSectionPath(nextSection);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
    if (nextSection === 'players') setUserPage(1);
    if (nextSection === 'matches') setMatchesPage(1);

    if (nextSection === 'support') setSupportPage(1);
    if (nextSection === 'moderation') setModerationPage(1);
    if (nextSection === 'payments') setPaymentsPage(1);
    if (nextSection === 'bots') {
      setBotsPage(1);
      setEventsPage(1);
    }
    if (nextSection === 'audit') setAuditPage(1);
    setSection(nextSection);
  }, []);

  const changeUserPage = React.useCallback((nextPage) => {
    setUserPage(nextPage);
    setUrlPage(nextPage, 'page');
  }, []);

  const changeMatchesPage = React.useCallback((nextPage) => {
    setMatchesPage(nextPage);
    setUrlPage(nextPage, 'page');
  }, []);

  const changeModerationPage = React.useCallback((nextPage) => {
    setModerationPage(nextPage);
    setUrlPage(nextPage, 'page');
  }, []);

  const changeSupportPage = React.useCallback((nextPage) => {
    setSupportPage(nextPage);
    setUrlPage(nextPage, 'page');
  }, []);

  const changeSupportStatus = React.useCallback((nextStatus) => {
    setSupportStatus(nextStatus);
    setSupportFilters((current) => ({ ...current, status: nextStatus }));
    setSupportPage(1);
    setUrlPage(1, 'page');
  }, []);

  const applyMatchFilters = React.useCallback((filters) => { setMatchFilters(filters); setMatchesPage(1); setUrlPage(1, 'page'); }, []);
  const applyModerationFilters = React.useCallback((filters) => { setModerationFilters(filters); setModerationPage(1); setUrlPage(1, 'page'); }, []);
  const applySupportFilters = React.useCallback((filters) => { setSupportFilters(filters); setSupportStatus(filters.status || ''); setSupportPage(1); setUrlPage(1, 'page'); }, []);
  const applyPaymentFilters = React.useCallback((filters) => { setPaymentFilters(filters); setPaymentsPage(1); setUrlPage(1, 'page'); }, []);

  const changePaymentsPage = React.useCallback((nextPage) => {
    setPaymentsPage(nextPage);
    setUrlPage(nextPage, 'page');
  }, []);

  const changeBotsPage = React.useCallback((nextPage) => {
    setBotsPage(nextPage);
    setUrlPage(nextPage, 'botPage');
  }, []);

  const changeEventsPage = React.useCallback((nextPage) => {
    setEventsPage(nextPage);
    setUrlPage(nextPage, 'eventPage');
  }, []);

  const changeAuditPage = React.useCallback((nextPage) => {
    setAuditPage(nextPage);
    setUrlPage(nextPage, 'page');
  }, []);

  React.useEffect(() => {
    const syncSection = () => {
      const nextSection = sectionFromPath();
      setSection(nextSection);
      if (nextSection === 'players') setUserPage(getUrlPage('page'));
      if (nextSection === 'matches') setMatchesPage(getUrlPage('page'));

      if (nextSection === 'support') setSupportPage(getUrlPage('page'));
      if (nextSection === 'moderation') setModerationPage(getUrlPage('page'));
      if (nextSection === 'payments') setPaymentsPage(getUrlPage('page'));
      if (nextSection === 'bots') {
        setBotsPage(getUrlPage('botPage'));
        setEventsPage(getUrlPage('eventPage'));
      }
      if (nextSection === 'audit') setAuditPage(getUrlPage('page'));
    };
    window.addEventListener('popstate', syncSection);
    return () => window.removeEventListener('popstate', syncSection);
  }, []);

  React.useEffect(() => {
    void load();
    return () => { loadRequestRef.current += 1; };
  }, [load]);

  const submitLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const data = await unlockAdmin(unlockEmail, unlockPassword);
      adminSessionRef.current = data;
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
    adminSessionRef.current = null;
    loadRequestRef.current += 1;
    setSummary(null);
    setLoginRequired(true);
    notify('Phiên admin đã được khóa.', 'info');
  };

  const openBan = (user) => {
    setBanTarget(user);
    setBanForm({
      reason: 'Vi phạm chính sách',
      expiresAt: ''
    });
  };

  const submitBan = async (event) => {
    event.preventDefault();
    if (!banTarget) return;
    try {
      await adminUserAction({
        action: 'ban',
        userId: banTarget.id,
        reason: banForm.reason,
        expiresAt: banForm.expiresAt || null
      });
      notify('Đã khóa tài khoản người chơi.', 'success');
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
      return true;
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
      return false;
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

  const deleteBot = async (botId) => {
    try {
      await deleteAdminBot({ botId });
      notify('Da xoa bot khoi Supabase.', 'success');
      await load();
    } catch (error) {
      notify(error.message, 'error');
      throw error;
    }
  };

  const deleteBotGroup = async (eventTag) => {
    try {
      await deleteAdminBot({ eventTag });
      notify('Da xoa nhom bot khoi Supabase.', 'success');
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

  const changeMatchStatus = async (match, status) => {
    const label = status === 'abandoned' ? 'đánh dấu bỏ ván' : status === 'draw' ? 'kết thúc hòa' : 'đánh dấu đầu hàng';
    if (!window.confirm(`Xác nhận ${label} trận ${match.white_name || 'Trắng'} vs ${match.black_name || 'Đen'}?`)) return;
    try {
      await updateAdminMatchStatus(match.id, status);
      notify('Đã cập nhật trạng thái trận đấu.', 'success');
      await load();
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const changeModerationStatus = async (report, status, suppliedNote) => {
    const resolutionNote = suppliedNote !== undefined ? suppliedNote : ['resolved', 'dismissed', 'escalated'].includes(status)
      ? window.prompt('Ghi chú xử lý', status === 'dismissed' ? 'Không phát hiện vi phạm chính sách.' : 'Đã được đội kiểm duyệt xem xét.')
      : '';
    if (resolutionNote === null) return;
    await updateModerationReport(report.id, status, resolutionNote || '');
    notify('Đã cập nhật báo cáo kiểm duyệt.', 'success');
    await load();
  };

  const changeSupportRequestStatus = async (request, status, adminNote = '') => {
    try {
      await updateAdminSupportRequest(request.id, status, adminNote);
      notify('Đã cập nhật yêu cầu hỗ trợ.', 'success');
      await load();
      return true;
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
      return false;
    }
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

  const changeTestAdminAccess = async (granted) => {
    try {
      const data = await updateTestAdminAccess(granted);
      setTestAdmin(data.testAdmin || null);
      notify(granted ? 'Da cap quyen admin test trong 24h.' : 'Da thu hoi quyen admin test.', 'success');
      await load();
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const saveWebsiteSettings = async (settings) => {
    try {
      const data = await updateAdminConfig(settings);
      setConfig(data.config);
      notify('Đã lưu Website Settings.', 'success');
    } catch (error) {
      notify(error.message, 'error');
      throw error;
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
            <span>Không gian quản trị</span>
          </div>
        </div>
        <nav aria-label="Danh mục quản trị">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.iconName] || Shield;
            return (
              <button className={section === item.id ? 'active' : ''} aria-current={section === item.id ? 'page' : undefined} key={item.id} onClick={() => changeSection(item.id)}>
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-identity"><span>{(admin?.email || 'A').slice(0, 1).toUpperCase()}</span><div><strong>Quản trị viên</strong><small>{admin?.email}</small></div></div>
          <a className="admin-return-link" href="/">← Về ChessArena</a>
          <button className="admin-lock-button" onClick={logoutAdmin}><LogOut size={16} /> Khóa quản trị</button>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-hero">
          <div>
            <span><Shield size={15} /> ChessArena / Quản trị</span>
            <h1>{NAV_ITEMS.find((item) => item.id === section)?.label || 'Tổng quan'}</h1>
            <p>{SECTION_DESCRIPTIONS[section]}</p>
          </div>
          <button onClick={() => load()} disabled={loading}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {loading ? 'Đang tải...' : 'Làm mới'}</button>
        </header>

        {message && <p className="admin-message" role="status">{message}</p>}
        <div className="admin-section-content" key={section} aria-busy={loading}>
        {section === 'overview' && <OverviewSection summary={summary} admin={admin} loading={loading} onLoad={() => load()} onSectionChange={changeSection} />}
        {section === 'players' && (
          <PlayersSection
            users={users}
            search={search}
            loading={loading}
            onSearchChange={setSearch}
            onLoad={(nextSearch) => {
              const query = nextSearch.trim();
              if (query === appliedSearch && userPage === 1) { void load(); return; }
              setAppliedSearch(query);
              setUserPage(1);
              setUrlPage(1, 'page');
            }}
            page={userPage}
            totalPages={userTotalPages}
            onPageChange={changeUserPage}
            onOpenDetail={openDetail}
            onOpenPublicProfile={openPublicProfile}

            onMuteUser={(user) => {
              const reason = window.prompt('Lý do tắt chat', 'Lạm dụng chat/báo cáo');
              if (reason) runUserAction('mute', user, 'Đã tắt chat người chơi.', { reason });
            }}
            onUnmuteUser={(user) => runUserAction('unmute', user, 'Đã mở chat.')}
            onUnbanUser={(user) => runUserAction('unban', user, 'Đã gỡ cấm.')}
            onOpenBan={openBan}
          />
        )}
        {section === 'matches' && (
          <MatchesSection
            matches={matches}
            filters={matchFilters}
            loading={loading}
            page={matchesPage}
            totalPages={matchesTotalPages}
            onPageChange={changeMatchesPage}
            onFiltersChange={applyMatchFilters}
            onChangeStatus={changeMatchStatus}
          />
        )}
        {section === 'support' && (
          <SupportSection
            selectedRequestId={new URLSearchParams(window.location.search).get('ticket') || ''}
            {...{
              requests: supportRequests,
              loading,
              page: supportPage,
              totalPages: supportTotalPages,
              status: supportStatus,
              filters: supportFilters,
              onStatusFilter: changeSupportStatus,
              onFiltersChange: applySupportFilters,
              onPageChange: changeSupportPage,
              onChangeStatus: changeSupportRequestStatus,
              onReload: () => load()
            }}
          />
        )}
        {section === 'moderation' && (
          <ModerationSection
            selectedReportId={new URLSearchParams(window.location.search).get('report') || ''}
            {...{
              reports: moderationReports,
              filters: moderationFilters,
              loading,
              page: moderationPage,
              totalPages: moderationTotalPages,
              onPageChange: changeModerationPage,
              onFiltersChange: applyModerationFilters,
              onChangeStatus: changeModerationStatus,
              onTakeAction: openBan
            }}
          />
        )}
        {section === 'payments' && (
          <PaymentsSection
            payments={payments}
            filters={paymentFilters}
            loading={loading}
            page={paymentsPage}
            totalPages={paymentsTotalPages}
            onPageChange={changePaymentsPage}
            onFiltersChange={applyPaymentFilters}
            paypalDiagnostics={paypalDiagnostics}
            onRunDiagnostics={runPayPalDiagnostics}
            onRunCreateTest={runPayPalCreateTest}
          />
        )}
        {section === 'bots' && (
          <BotsSection
            bots={bots}
            events={events}
            loading={loading}
            botsPage={botsPage}
            botsTotalPages={botsTotalPages}
            eventsPage={eventsPage}
            eventsTotalPages={eventsTotalPages}
            botForms={botForms}
            eventForm={eventForm}
            onBotsPageChange={changeBotsPage}
            onEventsPageChange={changeEventsPage}
            onSubmitBot={submitBot}
            onUpdateBotForm={updateBotForm}
            onSubmitEvent={submitEvent}
            onUpdateEventForm={(patch) => setEventForm((form) => ({ ...form, ...patch }))}
            onSaveBot={saveBot}
            onDeleteBot={deleteBot}
            onDeleteBotGroup={deleteBotGroup}
            onSaveEvent={saveEvent}
            onToggleBot={(bot) => updateAdminBot(bot.id, { ...bot, active: !bot.active }).then(() => load())}
            onToggleEvent={(item) => updateAdminEvent(item.id, { ...item, active: !item.active }).then(() => load())}
          />
        )}
        {section === 'audit' && (
          <AuditSection
            logs={auditLogs}
            loading={loading}
            page={auditPage}
            totalPages={auditTotalPages}
            onPageChange={changeAuditPage}
          />
        )}
        {section === 'config' && (
          <ConfigSection
            admin={admin}
            config={config}
            testAdmin={testAdmin}
            loading={loading}
            onSave={saveWebsiteSettings}
            onGrantTestAdmin={() => changeTestAdminAccess(true)}
            onRevokeTestAdmin={() => changeTestAdminAccess(false)}
          />
        )}
        </div>
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
