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
  Trophy,
  Users
} from 'lucide-react';
import {
  adminUserAction,
  createAdminBot,
  createAdminEvent,
  createAdminTournament,
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
  fetchAdminTournaments,
  fetchAntiCheatReports,
  fetchModerationReports,
  fetchPayPalDiagnostics,
  lockAdmin,
  scanUserAntiCheat,
  testPayPalSubscription,
  unlockAdmin,
  updateTestAdminAccess,
  updateAdminBot,
  updateAdminEvent,
  updateAdminMatchStatus,
  updateAdminTournamentStatus,
  updateAntiCheatReport,
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
import FairPlaySection from './FairPlaySection';
import MatchesSection from './MatchesSection';
import ModerationSection from './ModerationSection';
import OverviewSection from './OverviewSection';
import PaymentsSection from './PaymentsSection';
import PlayersSection from './PlayersSection';
import TournamentsSection from './TournamentsSection';
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
  Trophy,
  Users
};

const ADMIN_SECTION_IDS = new Set(NAV_ITEMS.map((item) => item.id));

function sectionFromPath() {
  const sectionId = window.location.pathname.split('/').filter(Boolean)[1];
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
  const [reports, setReports] = React.useState([]);
  const [fairPlayPage, setFairPlayPage] = React.useState(() => getUrlPage('page'));
  const [fairPlayTotalPages, setFairPlayTotalPages] = React.useState(1);
  const [fairPlayFilters, setFairPlayFilters] = React.useState({ status: 'all', minRisk: 0, search: '' });
  const [moderationReports, setModerationReports] = React.useState([]);
  const [matches, setMatches] = React.useState([]);
  const [matchesPage, setMatchesPage] = React.useState(() => getUrlPage('page'));
  const [matchesTotalPages, setMatchesTotalPages] = React.useState(1);
  const [tournaments, setTournaments] = React.useState([]);
  const [tournamentsPage, setTournamentsPage] = React.useState(() => getUrlPage('page'));
  const [tournamentsTotalPages, setTournamentsTotalPages] = React.useState(1);
  const [payments, setPayments] = React.useState([]);
  const [paymentsPage, setPaymentsPage] = React.useState(() => getUrlPage('page'));
  const [paymentsTotalPages, setPaymentsTotalPages] = React.useState(1);
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
  const [message, setMessage] = React.useState('');
  const [selectedDetail, setSelectedDetail] = React.useState(null);
  const [banTarget, setBanTarget] = React.useState(null);
  const [banForm, setBanForm] = React.useState({ banType: 'account', reason: 'Vi phạm fair play / chính sách', expiresAt: '' });
  const [botForms, setBotForms] = React.useState(() => Array.from({ length: 5 }, (_, index) => defaultBotForm(index)));
  const [eventForm, setEventForm] = React.useState({ title: 'Thử thách bot mùa lễ', eventType: 'bot_challenge', description: 'Đánh bại bot nổi bật và leo bảng sự kiện trong thời gian giới hạn.', rewardLabel: 'Huy hiệu mùa', active: true });
  const [tournamentForm, setTournamentForm] = React.useState({
    title: 'Giải nhanh ChessArena',
    timeControl: '300+0',
    durationMinutes: 30,
    startsAt: ''
  });
  const [loading, setLoading] = React.useState(false);
  const [section, setSection] = React.useState(() => sectionFromPath());
  const [unlockEmail, setUnlockEmail] = React.useState('');
  const [unlockPassword, setUnlockPassword] = React.useState('');
  const [loginRequired, setLoginRequired] = React.useState(true);
  const [moderationPage, setModerationPage] = React.useState(() => getUrlPage('page'));
  const [moderationTotalPages, setModerationTotalPages] = React.useState(1);

  const load = React.useCallback(async (
    nextSearch = search,
    nextUserPage = userPage,
    nextFairPlayPage = fairPlayPage,
    nextFairPlayFilters = fairPlayFilters,
    nextMatchesPage = matchesPage,
    nextTournamentsPage = tournamentsPage,
    nextModerationPage = moderationPage,
    nextPaymentsPage = paymentsPage,
    nextBotsPage = botsPage,
    nextEventsPage = eventsPage,
    nextAuditPage = auditPage
  ) => {
    const activeSection = section;
    setLoading(true);
    setMessage('');
    try {
      const me = await fetchAdminMe();
      setAdmin(me.admin);
      setLoginRequired(false);

      const [
        summaryData,
        usersData,
        reportsData,
        moderationData,
        matchesData,
        tournamentsData,
        paymentsData,
        botsData,
        eventsData,
        auditData,
        configData
      ] = await Promise.all([
        activeSection === 'overview' ? fetchAdminSummary() : Promise.resolve(null),
        activeSection === 'players' ? fetchAdminUsers(nextSearch, { page: nextUserPage, limit: 10 }) : Promise.resolve(null),
        activeSection === 'fairplay' ? fetchAntiCheatReports({ page: nextFairPlayPage, limit: 10, ...nextFairPlayFilters }) : Promise.resolve(null),
        activeSection === 'moderation' ? fetchModerationReports({ page: nextModerationPage, limit: 10 }).catch(() => ({ reports: [], totalPages: 1 })) : Promise.resolve(null),
        activeSection === 'matches' ? fetchAdminMatches({ page: nextMatchesPage, limit: 10 }) : Promise.resolve(null),
        activeSection === 'tournaments' ? fetchAdminTournaments({ page: nextTournamentsPage, limit: 10 }).catch(() => ({ tournaments: [], totalPages: 1 })) : Promise.resolve(null),
        activeSection === 'payments' ? fetchAdminPayments({ page: nextPaymentsPage, limit: 10 }) : Promise.resolve(null),
        activeSection === 'bots' ? fetchAdminBots({ page: nextBotsPage, limit: 10 }).catch(() => ({ bots: [], totalPages: 1 })) : Promise.resolve(null),
        activeSection === 'bots' ? fetchAdminEvents({ page: nextEventsPage, limit: 10 }).catch(() => ({ events: [], totalPages: 1 })) : Promise.resolve(null),
        activeSection === 'audit' ? fetchAdminAuditLogs({ page: nextAuditPage, limit: 20 }) : Promise.resolve(null),
        activeSection === 'config' ? fetchAdminConfig() : Promise.resolve(null)
      ]);
      if (summaryData) setSummary(summaryData.summary);
      if (usersData) {
        setUsers(usersData.users || []);
        setUserTotalPages(usersData.totalPages || 1);
      }
      if (reportsData) {
        setReports(reportsData.reports || []);
        setFairPlayTotalPages(reportsData.totalPages || 1);
      }
      if (moderationData) {
        setModerationReports(moderationData.reports || []);
        setModerationTotalPages(moderationData.totalPages || 1);
      }
      if (matchesData) {
        setMatches(matchesData.matches || []);
        setMatchesTotalPages(matchesData.totalPages || 1);
      }
      if (tournamentsData) {
        setTournaments(tournamentsData.tournaments || []);
        setTournamentsTotalPages(tournamentsData.totalPages || 1);
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
      const text = error.message || 'Không thể tải trang quản trị.';
      setMessage(text);
      setLoginRequired(true);
      notify(text, 'error');
    } finally {
      setLoading(false);
    }
  }, [auditPage, botsPage, eventsPage, fairPlayFilters, fairPlayPage, matchesPage, moderationPage, paymentsPage, search, section, tournamentsPage, userPage]);

  const changeSection = React.useCallback((nextSection) => {
    const nextPath = adminSectionPath(nextSection);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
    if (nextSection === 'players') setUserPage(1);
    if (nextSection === 'matches') setMatchesPage(1);
    if (nextSection === 'tournaments') setTournamentsPage(1);
    if (nextSection === 'fairplay') setFairPlayPage(1);
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
    load(search, nextPage, fairPlayPage, fairPlayFilters);
  }, [fairPlayFilters, fairPlayPage, load, search]);

  const changeFairPlayPage = React.useCallback((nextPage) => {
    setFairPlayPage(nextPage);
    setUrlPage(nextPage, 'page');
    load(search, userPage, nextPage, fairPlayFilters);
  }, [fairPlayFilters, load, search, userPage]);

  const changeMatchesPage = React.useCallback((nextPage) => {
    setMatchesPage(nextPage);
    setUrlPage(nextPage, 'page');
    load(search, userPage, fairPlayPage, fairPlayFilters, nextPage, tournamentsPage);
  }, [fairPlayFilters, fairPlayPage, load, search, tournamentsPage, userPage]);

  const changeTournamentsPage = React.useCallback((nextPage) => {
    setTournamentsPage(nextPage);
    setUrlPage(nextPage, 'page');
    load(search, userPage, fairPlayPage, fairPlayFilters, matchesPage, nextPage);
  }, [fairPlayFilters, fairPlayPage, load, matchesPage, search, userPage]);

  const changeModerationPage = React.useCallback((nextPage) => {
    setModerationPage(nextPage);
    setUrlPage(nextPage, 'page');
    load(search, userPage, fairPlayPage, fairPlayFilters, matchesPage, tournamentsPage, nextPage);
  }, [fairPlayFilters, fairPlayPage, load, matchesPage, search, tournamentsPage, userPage]);

  const changePaymentsPage = React.useCallback((nextPage) => {
    setPaymentsPage(nextPage);
    setUrlPage(nextPage, 'page');
    load(search, userPage, fairPlayPage, fairPlayFilters, matchesPage, tournamentsPage, moderationPage, nextPage);
  }, [fairPlayFilters, fairPlayPage, load, matchesPage, moderationPage, search, tournamentsPage, userPage]);

  const changeBotsPage = React.useCallback((nextPage) => {
    setBotsPage(nextPage);
    setUrlPage(nextPage, 'botPage');
    load(search, userPage, fairPlayPage, fairPlayFilters, matchesPage, tournamentsPage, moderationPage, paymentsPage, nextPage, eventsPage);
  }, [eventsPage, fairPlayFilters, fairPlayPage, load, matchesPage, moderationPage, paymentsPage, search, tournamentsPage, userPage]);

  const changeEventsPage = React.useCallback((nextPage) => {
    setEventsPage(nextPage);
    setUrlPage(nextPage, 'eventPage');
    load(search, userPage, fairPlayPage, fairPlayFilters, matchesPage, tournamentsPage, moderationPage, paymentsPage, botsPage, nextPage);
  }, [botsPage, fairPlayFilters, fairPlayPage, load, matchesPage, moderationPage, paymentsPage, search, tournamentsPage, userPage]);

  const changeAuditPage = React.useCallback((nextPage) => {
    setAuditPage(nextPage);
    setUrlPage(nextPage, 'page');
    load(search, userPage, fairPlayPage, fairPlayFilters, matchesPage, tournamentsPage, moderationPage, paymentsPage, botsPage, eventsPage, nextPage);
  }, [botsPage, eventsPage, fairPlayFilters, fairPlayPage, load, matchesPage, moderationPage, paymentsPage, search, tournamentsPage, userPage]);

  const changeFairPlayFilters = React.useCallback((patch) => {
    const nextFilters = { ...fairPlayFilters, ...patch };
    setFairPlayFilters(nextFilters);
    setFairPlayPage(1);
    setUrlPage(1, 'page');
    load(search, userPage, 1, nextFilters);
  }, [fairPlayFilters, load, search, userPage]);

  React.useEffect(() => {
    const syncSection = () => {
      const nextSection = sectionFromPath();
      setSection(nextSection);
      if (nextSection === 'players') setUserPage(getUrlPage('page'));
      if (nextSection === 'matches') setMatchesPage(getUrlPage('page'));
      if (nextSection === 'tournaments') setTournamentsPage(getUrlPage('page'));
      if (nextSection === 'fairplay') setFairPlayPage(getUrlPage('page'));
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
      return true;
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
      return false;
    }
  };

  const banFromAntiCheat = async (report) => {
    const targetUser = report.users || { id: report.user_id };
    if (!targetUser?.id && !report.user_id) return;
    const reason = `Anti-cheat report ${report.id}: risk ${report.risk_score}/100`;
    const banned = await runUserAction('ban', { ...targetUser, id: targetUser.id || report.user_id }, 'Đã cấm người chơi từ báo cáo anti-cheat.', {
      banType: 'account',
      reason
    });
    if (!banned) return;
    await updateAntiCheatReport(report.id, 'actioned').catch(() => {});
    await load();
  };

  const unbanFromAntiCheat = async (report) => {
    const targetUser = report.users || { id: report.user_id };
    if (!targetUser?.id && !report.user_id) return;
    await runUserAction('unban', { ...targetUser, id: targetUser.id || report.user_id }, 'Đã gỡ cấm người chơi.');
  };

  const scanUser = async (user) => {
    setMessage(`Đang quét ${user.display_name || user.email}...`);
    try {
      const data = await scanUserAntiCheat(user.id);
      const scan = data.summary || {};
      setMessage(`Đã quét ${scan.gamesScanned ?? data.reports?.length ?? 0} ván. Rủi ro cao nhất ${scan.maxRisk ?? 0}/100, ${scan.recommendation || 'không cần xử lý'}.`);
      notify('Quét chống gian lận hoàn tất.', 'success');
      await load();
      changeSection('fairplay');
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

  const submitTournament = async (event) => {
    event.preventDefault();
    try {
      const data = await createAdminTournament(tournamentForm);
      notify(`Đã tạo giải đấu và thông báo cho ${data.notifiedPlayers || 0} người chơi.`, 'success');
      setTournamentForm((form) => ({ ...form, title: 'Giải nhanh ChessArena', startsAt: '' }));
      setTournamentsPage(1);
      if (section === 'tournaments') setUrlPage(1, 'page');
      await load(search, userPage, fairPlayPage, fairPlayFilters, matchesPage, 1);
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const changeTournamentStatus = async (tournament, status) => {
    const labels = { cancelled: 'hủy', open: 'mở đăng ký', running: 'bắt đầu', finished: 'kết thúc' };
    if (!window.confirm(`Xác nhận ${labels[status] || status} giải "${tournament.title}"?`)) return;
    try {
      await updateAdminTournamentStatus(tournament.id, status);
      notify('Đã cập nhật trạng thái giải đấu.', 'success');
      await load(search, userPage, fairPlayPage, fairPlayFilters, matchesPage, tournamentsPage);
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
    }
  };

  const changeMatchStatus = async (match, status) => {
    const label = status === 'abandoned' ? 'đánh dấu bỏ ván' : status === 'draw' ? 'kết thúc hòa' : 'đánh dấu đầu hàng';
    if (!window.confirm(`Xác nhận ${label} trận ${match.white_name || 'Trắng'} vs ${match.black_name || 'Đen'}?`)) return;
    try {
      await updateAdminMatchStatus(match.id, status);
      notify('Đã cập nhật trạng thái trận đấu.', 'success');
      await load(search, userPage, fairPlayPage, fairPlayFilters, matchesPage);
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
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

  const changeAntiCheatStatus = async (reportId, status) => {
    try {
      const data = await updateAntiCheatReport(reportId, status);
      const refund = data.refund?.refundDelta ? ` Refund +${data.refund.refundDelta}.` : '';
      notify(`Anti-cheat report updated.${refund}`, 'success');
      await load();
    } catch (error) {
      setMessage(error.message);
      notify(error.message, 'error');
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
      notify(granted ? 'Da cap quyen admin test.' : 'Da thu hoi quyen admin test.', 'success');
      await load();
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
              <button className={section === item.id ? 'active' : ''} key={item.id} onClick={() => changeSection(item.id)}>
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
            <span><Shield size={18} /> Bảng quản trị</span>
            <h1>Quản lý trận đấu và tạo giải đấu</h1>
            <p>Admin: {admin?.email || 'đang xác thực'} | Vai trò: {admin?.role || 'owner'} | Phiên quản trị riêng.</p>
          </div>
          <button onClick={() => load()} disabled={loading}><RefreshCw size={18} /> Làm mới</button>
        </header>

        {message && <p className="admin-message">{message}</p>}
        {section === 'overview' && <OverviewSection summary={summary} admin={admin} loading={loading} onLoad={() => load()} onSectionChange={changeSection} />}
        {section === 'players' && (
          <PlayersSection
            users={users}
            search={search}
            loading={loading}
            onSearchChange={setSearch}
            onLoad={(nextSearch) => {
              setUserPage(1);
              setUrlPage(1, 'page');
              load(nextSearch, 1);
            }}
            page={userPage}
            totalPages={userTotalPages}
            onPageChange={changeUserPage}
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
        {section === 'matches' && (
          <MatchesSection
            matches={matches}
            page={matchesPage}
            totalPages={matchesTotalPages}
            onPageChange={changeMatchesPage}
            onChangeStatus={changeMatchStatus}
          />
        )}
        {section === 'tournaments' && (
          <TournamentsSection
            tournaments={tournaments}
            tournamentForm={tournamentForm}
            onChangeTournamentForm={(patch) => setTournamentForm((form) => ({ ...form, ...patch }))}
            onSubmitTournament={submitTournament}
            page={tournamentsPage}
            totalPages={tournamentsTotalPages}
            onPageChange={changeTournamentsPage}
            onChangeStatus={changeTournamentStatus}
          />
        )}
        {section === 'fairplay' && (
          <FairPlaySection
            reports={reports}
            filters={fairPlayFilters}
            page={fairPlayPage}
            totalPages={fairPlayTotalPages}
            onFilterChange={changeFairPlayFilters}
            onPageChange={changeFairPlayPage}
            onUpdateReport={changeAntiCheatStatus}
            onBanUser={banFromAntiCheat}
            onUnbanUser={unbanFromAntiCheat}
          />
        )}
        {section === 'moderation' && (
          <ModerationSection
            reports={moderationReports}
            page={moderationPage}
            totalPages={moderationTotalPages}
            onPageChange={changeModerationPage}
            onChangeStatus={changeModerationStatus}
          />
        )}
        {section === 'payments' && (
          <PaymentsSection
            payments={payments}
            page={paymentsPage}
            totalPages={paymentsTotalPages}
            onPageChange={changePaymentsPage}
            paypalDiagnostics={paypalDiagnostics}
            onRunDiagnostics={runPayPalDiagnostics}
            onRunCreateTest={runPayPalCreateTest}
          />
        )}
        {section === 'bots' && (
          <BotsSection
            bots={bots}
            events={events}
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
            onSaveEvent={saveEvent}
            onToggleBot={(bot) => updateAdminBot(bot.id, { ...bot, active: !bot.active }).then(() => load())}
            onToggleEvent={(item) => updateAdminEvent(item.id, { ...item, active: !item.active }).then(() => load())}
          />
        )}
        {section === 'audit' && (
          <AuditSection
            logs={auditLogs}
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
            onGrantTestAdmin={() => changeTestAdminAccess(true)}
            onRevokeTestAdmin={() => changeTestAdminAccess(false)}
          />
        )}
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
