import React from 'react';
import Modal from './components/Modal';
import GameInvitationHost from './components/GameInvitationHost';
import { pollWhileActive } from './api/polling';
import { apiUrl } from './api/config';
import { fetchPublicBots } from './api/bots';
import { fetchMembership } from './api/membership';
import { fetchModerationStatus } from './api/moderation';
import { fetchNotifications } from './api/notifications';
import { requestStockfishMove } from './api/stockfish';
import { getPieceImage } from './game/pieces';
import {
  AI_LEVELS,
  TIME_CONTROLS
} from './game/constants';
import {
  createGameState,
  generateChess960Fen,
  gameOutcome,
  newLocalGameId,
  replayGameAt,
  resolvePlayerColor,
  safeUserId
} from './game/chessLogic';
import { clearAiGame, loadAiGame, saveAiGame } from './game/gamePersistence';
import {
  boardMaterialScore,
  capturedPoints,
  engineBarPercent,
  formatClock,
  squareCenter
} from './game/gameView';
import AiCoachChat from './components/AiCoachChat';
import GameBoard from './components/GameBoard';
import MatchPanel from './components/MatchWorkspace';
import PlayPageHeader from './components/PlayPageHeader';
import ResultDialog from './components/ResultDialog';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import ToastHost, { notify } from './components/ToastHost';
import SystemStatePage from './components/SystemStatePage';
import vietnamFlag from './assets/flags/vietnam.svg';
import unitedKingdomFlag from './assets/flags/united-kingdom.svg';
import {
  COACH_AVATAR,
  buildCoachInsight,
  coachBehaviorFromMode,
  coachLessonFromMode
} from './coach/coach';
import { BOT_PERSONAS, groupBotPersonas, mergeBotPersonas } from './data/bots';
import { useAuthSession } from './hooks/useAuthSession';
import { useSitePresence } from './hooks/useSitePresence';
import AccountBanNotice from './components/AccountBanNotice';
import { useApiGameLog } from './hooks/useApiGameLog';
import { useAppRoute } from './hooks/useAppRoute';
import { useBotAssistance } from './hooks/useBotAssistance';
import { useGameClock } from './hooks/useGameClock';
import { useGameAudio } from './hooks/useGameAudio';
import { useGameReview } from './hooks/useGameReview';
import { useMoveGuidance } from './hooks/useMoveGuidance';
import { useThemeSettings } from './hooks/useThemeSettings';
import { gameModeFromRoute, isGameRoute, isPuzzleRoute, routeFromPath } from './routes/routeConfig';

const DEFAULT_TIME_CONTROL = TIME_CONTROLS[3];
const FINISHED_GAME_KEY = 'chess-arena-finished-game';
const DEFAULT_BOT_OPTIONS = Object.freeze({
  botChat: true,
  evaluationBar: false,
  threatArrows: false,
  suggestionArrows: false,
  moveFeedback: false,
  engine: true
});
const AUTH_ROUTES = new Set(['login', 'register', 'forgotPassword']);
const GUEST_ROUTES = new Set(['home', 'login', 'register', 'forgotPassword', 'admin', 'notFound']);

function isGuestAccessibleRoute(route, pathname = '') {
  return GUEST_ROUTES.has(route) || (route === 'profile' && pathname.startsWith('/profile/'));
}

function LoginRequiredNotice({ onLogin }) {
  return (
    <section className="login-required-route">
      <div>
        <span>ChessArena</span>
        <h1>Đăng nhập</h1>
        <p>Bạn cần đăng nhập để sử dụng chức năng này.</p>
        <button type="button" onClick={onLogin}>Đăng nhập</button>
      </div>
    </section>
  );
}

function lazyWithRetry(importer) {
  return React.lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      const message = String(error?.message || error || '');
      const chunkLoadFailed = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(message);
      if (chunkLoadFailed) {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        return importer();
      }
      throw error;
    }
  });
}

const AdminPage = lazyWithRetry(() => import('./routes/Admin/AdminPage'));
const AcademicNoticePage = lazyWithRetry(() => import('./routes/use/AcademicNoticePage'));
const AchievementsPage = lazyWithRetry(() => import('./routes/use/AchievementsPage'));
const BeginnerGuidePage = lazyWithRetry(() => import('./routes/use/BeginnerGuidePage'));
const CoachLabPage = lazyWithRetry(() => import('./routes/use/CoachLabPage'));
const HistoryPage = lazyWithRetry(() => import('./routes/use/HistoryPage'));
const HomePage = lazyWithRetry(() => import('./routes/use/HomePage'));
const FriendsPage = lazyWithRetry(() => import('./routes/use/FriendsPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('./routes/use/ForgotPasswordPage'));
const LeaderboardPage = lazyWithRetry(() => import('./routes/use/LeaderboardPage'));
const LoginPage = lazyWithRetry(() => import('./routes/use/LoginPage'));
const LocalBoardPage = lazyWithRetry(() => import('./routes/use/LocalBoardPage'));
const MembershipPage = lazyWithRetry(() => import('./routes/use/MembershipPage'));
const NotificationsPage = lazyWithRetry(() => import('./routes/use/NotificationsPage'));
const NotFoundPage = lazyWithRetry(() => import('./routes/use/NotFoundPage'));
const OnlinePage = lazyWithRetry(() => import('./routes/use/OnlinePage'));
const ProfilePage = lazyWithRetry(() => import('./routes/use/ProfilePage'));
const ReviewPage = lazyWithRetry(() => import('./routes/use/ReviewPage'));
const RegisterPage = lazyWithRetry(() => import('./routes/use/RegisterPage'));
const PuzzlePage = lazyWithRetry(() => import('./routes/use/PuzzlePage'));
const SupportHubPage = lazyWithRetry(() => import('./routes/use/SupportHubPage'));
const SupportPage = lazyWithRetry(() => import('./routes/use/SupportPage'));

function storedFinishedOutcome() {
  const currentRoute = routeFromPath(window.location.pathname);
  if (!isGameRoute(currentRoute)) return null;

  try {
    const saved = JSON.parse(window.sessionStorage.getItem(FINISHED_GAME_KEY) ?? 'null');
    return saved?.route === currentRoute ? saved.outcome ?? null : null;
  } catch {
    return null;
  }
}

function RouteLoading({ label = 'Đang tải bàn cờ...' }) {
  return (
    <div className="route-loading chess-loading">
      <div className="route-loading-card">
        <div className="loading-orbit" aria-hidden="true">
          <span className="loading-piece">♞</span>
          <span className="loading-dot one" />
          <span className="loading-dot two" />
          <span className="loading-dot three" />
        </div>
        <div className="loading-copy">
          <small>ChessArena</small>
          <strong>{label}</strong>
          <p>Đang chuẩn bị bàn cờ, dữ liệu ván và giao diện cho bạn.</p>
        </div>
        <div className="loading-progress" aria-hidden="true"><i /></div>
      </div>
    </div>
  );
}

function OfflineOverlay({ visible, onRecovered }) {
  if (!visible) return null;
  return (
    <SystemStatePage
      variant="offline"
      eyebrow="Kết nối bị gián đoạn"
      title="ChessArena đang chờ mạng trở lại"
      description="Ván hiện tại được giữ nguyên trên thiết bị. Kiểm tra Wi-Fi hoặc dữ liệu di động, sau đó thử kết nối lại."
      icon="wifi"
      primaryLabel="Kiểm tra lại"
      onPrimary={() => {
        if (navigator.onLine) onRecovered?.();
      }}
      overlay
    />
  );
}

function ModerationBanner({ status }) {
  if (!status?.muted && !status?.banned) return null;
  const item = status.banned ? status.ban : status.mute;
  return (
    <div className={`moderation-banner ${status.banned ? 'danger' : 'warning'}`} role="status">
      <strong>{status.banned ? 'Tài khoản đang bị hạn chế' : 'Bạn đang bị mute'}</strong>
      <span>{item?.reason || 'Moderation action active.'}</span>
      {item?.expiresAt && <small>Hết hạn: {new Date(item.expiresAt).toLocaleString()}</small>}
    </div>
  );
}

const ACADEMIC_NOTICE_KEY = 'chessarena-academic-notice-seen';
const MODERATION_POLL_INTERVAL_MS = 45_000;

function academicNoticeUserKey(user) {
  return String(user?.uid || user?.id || user?.email || 'guest');
}

function hasSeenAcademicNotice(user) {
  try {
    return window.localStorage.getItem(`${ACADEMIC_NOTICE_KEY}:${academicNoticeUserKey(user)}`) === '1';
  } catch {
    return false;
  }
}

function markAcademicNoticeSeen(user) {
  try {
    window.localStorage.setItem(`${ACADEMIC_NOTICE_KEY}:${academicNoticeUserKey(user)}`, '1');
  } catch {
    // localStorage may be unavailable; showing the notice again is safer than hiding it globally.
  }
}

function AcademicNoticeModal({ visible, authUser, onClose, onOpenPage }) {
  const [language, setLanguage] = React.useState('vi');
  const [imageOpen, setImageOpen] = React.useState(false);
  const dismiss = () => {
    setImageOpen(false);
    markAcademicNoticeSeen(authUser);
    onClose();
  };

  if (!visible) return null;

  const isVietnamese = language === 'vi';

  return (
    <Modal open={visible} onClose={dismiss} className="academic-notice-layer" aria-label="Thông báo học thuật">
      <section className="academic-notice-modal">
        <div className="academic-notice-language" aria-label="Chọn ngôn ngữ">
          <button type="button" className={isVietnamese ? 'active' : ''} onClick={() => setLanguage('vi')}>
            <span><img src={vietnamFlag} alt="" /></span> VI
          </button>
          <button type="button" className={!isVietnamese ? 'active' : ''} onClick={() => setLanguage('en')}>
            <span><img src={unitedKingdomFlag} alt="" /></span> EN
          </button>
        </div>
        <span>Academic Notice</span>
        <h2>{isVietnamese ? 'Trước khi tiếp tục, bạn nên biết rõ ChessArena được dùng trong phạm vi nào.' : 'Before continuing, here is what ChessArena is built for.'}</h2>
        {isVietnamese ? (
          <>
            <p>
              ChessArena là sản phẩm học thuật do cá nhân phát triển để thử nghiệm giao diện, ghép trận, phân tích ván
              và luồng thanh toán sandbox. Website không phải dịch vụ thương mại chính thức.
            </p>
            <p>
              Một số bộ quân, màu bàn cờ hoặc tài sản tham khảo liên quan đến Chess.com thuộc quyền sở hữu của Chess.com.
              Hãy bấm <strong>Xem trang thông báo</strong> để xem thông tin chủ sở hữu, bản quyền và hướng dẫn kiểm thử thanh toán.
            </p>
          </>
        ) : (
          <>
            <p>
              ChessArena is a personal academic project built to test UI, matchmaking, game review, and sandbox payment flows.
              It is not an official commercial service.
            </p>
            <p>
              Some referenced Chess.com-related piece sets, board themes, or interface assets remain the property of Chess.com.
              Press <strong>View notice page</strong> to see ownership, copyright, and sandbox payment details.
            </p>
          </>
        )}
        <div className="academic-notice-actions">
          <button
            type="button"
            className="academic-notice-primary"
            onClick={() => {
              markAcademicNoticeSeen(authUser);
              onOpenPage();
            }}
          >
            {isVietnamese ? 'Xem trang thông báo' : 'View notice page'}
          </button>
          <button
            type="button"
            className="academic-notice-close"
            onClick={dismiss}
          >
            {isVietnamese ? 'Đã hiểu' : 'Got it'}
          </button>
        </div>
        <button type="button" className="academic-notice-image" onClick={() => setImageOpen(true)}>
          <img src="/Hình ảnh mở lại popup.png" alt="" />
          <span>
            <strong>{isVietnamese ? 'Mở lại thông báo bất cứ lúc nào' : 'Reopen this notice at any time'}</strong>
            <small>{isVietnamese ? 'Nhấn để xem vị trí nút Thông tin trên thanh đầu trang.' : 'Open the image showing the Information button in the header.'}</small>
          </span>
        </button>
      </section>
      <Modal
          open={imageOpen}
          className="academic-image-lightbox"
          aria-label="Xem ảnh thông báo"
          onClose={() => setImageOpen(false)}
        >
          <button type="button" className="academic-image-close" onClick={() => setImageOpen(false)} aria-label="Đóng ảnh">
            ×
          </button>
          <figure className="academic-image-preview" onClick={(event) => event.stopPropagation()}>
            <img
              src="/Hình ảnh mở lại popup.png"
              alt={isVietnamese ? 'Vị trí nút mở lại thông báo học thuật' : 'Location of the academic notice button'}
            />
            <figcaption>
              <strong>{isVietnamese ? 'Nút Thông tin' : 'Information button'}</strong>
              <span>{isVietnamese ? 'Nằm trên thanh đầu trang, cạnh trạng thái kết nối.' : 'Located in the header beside the connection status.'}</span>
            </figcaption>
          </figure>
      </Modal>
    </Modal>
  );
}

export default function App() {
  const initialGameMode = gameModeFromRoute(routeFromPath(window.location.pathname)) ?? 'bot';
  const restoredAiGame = React.useMemo(() => loadAiGame(window.localStorage, initialGameMode), []);
  const [gameState, setGameState] = React.useState(() => createGameState(restoredAiGame?.moves, restoredAiGame?.initialFen));
  const [selected, setSelected] = React.useState(null);
  const [legalTargets, setLegalTargets] = React.useState([]);
  const [flipped, setFlipped] = React.useState(() => restoredAiGame?.playerColor === 'b');
  const [gameId, setGameId] = React.useState(() => restoredAiGame?.gameId || newLocalGameId());
  const [lastMove, setLastMove] = React.useState(() => restoredAiGame?.lastMove || null);
  const [playerColor, setPlayerColor] = React.useState(() => restoredAiGame?.playerColor || 'w');
  const [sideChoice, setSideChoice] = React.useState(() => restoredAiGame?.sideChoice || 'w');
  const [aiElo, setAiElo] = React.useState(() => restoredAiGame?.aiElo || 1600);
  const [selectedBotId, setSelectedBotId] = React.useState(() => restoredAiGame?.selectedBotId || '');
  const [timeControlId, setTimeControlId] = React.useState(() => restoredAiGame?.timeControlId || DEFAULT_TIME_CONTROL.id);
  const [clocks, setClocks] = React.useState(() => ({ w: DEFAULT_TIME_CONTROL.baseSeconds, b: DEFAULT_TIME_CONTROL.baseSeconds }));
  const [timeWinner, setTimeWinner] = React.useState(null);
  const [gameMode, setGameMode] = React.useState(initialGameMode);
  const [coachMode, setCoachMode] = React.useState(() => restoredAiGame?.coachMode || 'basic');
  const [gameVariant, setGameVariant] = React.useState(() => restoredAiGame?.gameVariant || 'standard');
  const [initialFen, setInitialFen] = React.useState(() => restoredAiGame?.initialFen || null);
  const [coachLesson, setCoachLesson] = React.useState(() => restoredAiGame?.coachLesson || coachLessonFromMode(restoredAiGame?.coachMode || 'basic'));
  const [botGameStarted, setBotGameStarted] = React.useState(() => restoredAiGame?.started === true);
  const [localReviewNames, setLocalReviewNames] = React.useState({ w: 'White', b: 'Black' });
  const [manualResult, setManualResult] = React.useState(() => restoredAiGame?.manualResult || storedFinishedOutcome());
  const [membership, setMembership] = React.useState(null);
  const [moderationStatus, setModerationStatus] = React.useState(null);
  const [notificationCount, setNotificationCount] = React.useState(0);
  const [websiteSettings, setWebsiteSettings] = React.useState(null);
  const [onlineCoachContext, setOnlineCoachContext] = React.useState(null);
  const previousNotificationCountRef = React.useRef(0);
  const [hintMove, setHintMove] = React.useState(null);
  const [premoveQueue, setPremoveQueue] = React.useState([]);
  const [suggestionMove, setSuggestionMove] = React.useState(null);
  const [threatMove, setThreatMove] = React.useState(null);
  const [botOptions, setBotOptions] = React.useState(() => ({ ...DEFAULT_BOT_OPTIONS, ...(restoredAiGame?.botOptions || {}) }));
  const [isAiThinking, setIsAiThinking] = React.useState(false);
  const [engineError, setEngineError] = React.useState('');
  const [coachAudioEnabled, setCoachAudioEnabled] = React.useState(true);
  const [customBots, setCustomBots] = React.useState([]);
  const [showHints, setShowHints] = React.useState(true);
  const [dragEnabled, setDragEnabled] = React.useState(true);
  const [promotionRequest, setPromotionRequest] = React.useState(null);
  const [resultDismissed, setResultDismissed] = React.useState(() => restoredAiGame?.resultDismissed === true);
  const [isOffline, setIsOffline] = React.useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [academicNoticeOpen, setAcademicNoticeOpen] = React.useState(false);
  const {
    userName,
    authMode,
    setAuthMode,
    authUser,
    authReady,
    banNotice,
    dismissBanNotice,
    otpState,
    setOtpState,
    otpSecondsLeft,
    authForm,
    setAuthForm,
    authMessage,
    authMessageTone,
    clearAuthMessage,
    authBusy,
    submitAuth,
    signInProvider,
    verifyOtp,
    resendOtp,
    logout,
    updateSessionProfile
  } = useAuthSession();
  useSitePresence(authUser);
  const {
    theme,
    themeStyle,
    appearance,
    colorScheme,
    settingsOpen,
    setSettingsOpen,
    pieceSet,
    setPieceSet,
    updateTheme,
    setAppearance,
    resetTheme,
    applyBoardPreset
  } = useThemeSettings(authUser, websiteSettings);
  const {
    route,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    navigate
  } = useAppRoute({ gameMode, setGameMode });
  const openAuth = React.useCallback((mode = 'login') => {
    const nextMode = mode === 'register' ? 'register' : mode === 'forgot' ? 'forgot' : 'login';
    clearAuthMessage();
    setOtpState(null);
    setAuthMode(nextMode);
    navigate(nextMode === 'register' ? 'register' : nextMode === 'forgot' ? 'forgotPassword' : 'login');
  }, [clearAuthMessage, navigate, setAuthMode, setOtpState]);
  const handleVerifyOtp = React.useCallback(async () => {
    const result = await verifyOtp();
    if (result?.ok && result.purpose === 'reset') {
      navigate('login');
    }
  }, [navigate, verifyOtp]);
  const aiTimerRef = React.useRef(null);
  const premoveRef = React.useRef([]);
  const { ensureAudioContext, playMoveSound, playUiSound, speakCoachText, stopSpeech, coachVoiceAvailable } = useGameAudio({ pieceSet, theme });

  React.useEffect(() => {
    const controller=new AbortController();
    const refreshSettings = () => fetch(apiUrl('/api/config/public'),{signal:controller.signal,credentials:'include',cache:'no-store'})
      .then(response=>response.ok?response.json():null)
      .then(data=>{
        if(!data?.settings)return;
        if (controller.signal.aborted) return;
        setWebsiteSettings(current => JSON.stringify(current) === JSON.stringify(data.settings) ? current : data.settings);
        if(data.settings.siteTitle)document.title=data.settings.siteTitle;
        let description = document.querySelector('meta[name="description"]');
        if (!description) { description = document.createElement('meta'); description.name = 'description'; document.head.appendChild(description); }
        description.content = data.settings.siteDescription || '';
      })
      .catch(()=>{});
    void refreshSettings();
    const timer = window.setInterval(() => { if (!document.hidden) void refreshSettings(); }, 30000);
    return()=>{ window.clearInterval(timer); controller.abort(); };
  },[]);

  React.useEffect(() => {
    if (authUser && AUTH_ROUTES.has(route)) {
      navigate('home');
      return;
    }
    if (authUser) return;

    if (route === 'register' && authMode !== 'register' && !otpState) {
      clearAuthMessage();
      setAuthMode('register');
    } else if (route === 'forgotPassword' && authMode !== 'forgot' && !otpState) {
      clearAuthMessage();
      setAuthMode('forgot');
    } else if (route === 'login' && authMode !== 'login' && !otpState) {
      clearAuthMessage();
      setAuthMode('login');
    }
  }, [authMode, authUser, clearAuthMessage, navigate, otpState, route, setAuthMode]);

  React.useEffect(() => {
    if (!authUser || hasSeenAcademicNotice(authUser)) return;
    setAcademicNoticeOpen(true);
  }, [authUser]);

  React.useEffect(() => {
    let cancelled = false;
    fetchPublicBots()
      .then((data) => {
        if (!cancelled) setCustomBots(data.bots || []);
      })
      .catch(() => {
        if (!cancelled) setCustomBots([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  React.useEffect(() => {
    if (!authUser) {
      setMembership(null);
      setModerationStatus(null);
      setNotificationCount(0);
      return undefined;
    }
    let cancelled = false;
    Promise.allSettled([fetchMembership(), fetchModerationStatus()])
      .then(([membershipResult, moderationResult]) => {
        if (cancelled) return;
        setMembership(membershipResult.status === 'fulfilled' ? membershipResult.value : null);
        const nextModeration = moderationResult.status === 'fulfilled' ? moderationResult.value : null;
        setModerationStatus(nextModeration);
        if (nextModeration?.banned) {
          notify(nextModeration.ban?.reason || 'Tài khoản của bạn đã bị cấm.', 'error');
          logout();
          navigate('home');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authUser, logout, navigate]);

  React.useEffect(() => {
    if (!authUser) return undefined;
    let cancelled = false;
    let inFlight = false;
    let timer = null;

    const scheduleNextCheck = (delay = MODERATION_POLL_INTERVAL_MS) => {
      if (cancelled) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(checkModeration, delay);
    };

    const checkModeration = async () => {
      if (cancelled || inFlight) return;
      if (document.hidden || !navigator.onLine) {
        scheduleNextCheck();
        return;
      }

      inFlight = true;
      try {
        const nextModeration = await fetchModerationStatus();
        if (cancelled) return;
        setModerationStatus(nextModeration);
        if (nextModeration?.banned) {
          cancelled = true;
          window.clearTimeout(timer);
          notify(nextModeration.ban?.reason || 'Tài khoản của bạn đã bị cấm.', 'error');
          await logout();
          navigate('home');
        }
      } catch (error) {
        if (cancelled) return;
        if (/ban|banned|cấm|hạn chế|restricted/i.test(error.message || '')) {
          cancelled = true;
          window.clearTimeout(timer);
          notify(error.message || 'Tài khoản của bạn đã bị cấm.', 'error');
          await logout();
          navigate('home');
        }
      } finally {
        inFlight = false;
        scheduleNextCheck();
      }
    };

    const checkWhenActive = () => {
      if (document.hidden || !navigator.onLine || cancelled || inFlight) return;
      window.clearTimeout(timer);
      void checkModeration();
    };

    scheduleNextCheck();
    window.addEventListener('online', checkWhenActive);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('online', checkWhenActive);
    };
  }, [authUser, logout, navigate]);

  React.useEffect(() => {
    if (!authUser) return undefined;
    let cancelled = false;
    const stop = pollWhileActive((signal) => {
      return fetchNotifications({ page: 1, limit: 5, signal })
        .then((data) => {
          if (cancelled) return;
          const nextCount = data.unreadCount || 0;
          if (
            nextCount > previousNotificationCountRef.current
            && typeof window.Notification !== 'undefined'
            && window.Notification.permission === 'granted'
          ) {
            const latest = data.notifications?.find((item) => !item.readAt);
            const browserNotification = new window.Notification(latest?.title || 'ChessArena', {
              body: latest?.body || `Bạn có ${nextCount} thông báo chưa đọc.`,
              icon: '/chessarena-mark.svg',
              tag: latest?.id || 'chessarena-notifications'
            });
            browserNotification.onclick = () => {
              window.focus();
              navigate('notifications');
              browserNotification.close();
            };
          }
          previousNotificationCountRef.current = nextCount;
          setNotificationCount(nextCount);
        });
    }, { interval: 45_000, maxDelay: 180_000 });
    return () => {
      cancelled = true;
      stop();
    };
  }, [authUser, navigate]);

  const isActiveGameRoute = isGameRoute(route);
  const isActiveOnlineRoute = route === 'online';
  const isActivePuzzleRoute = isPuzzleRoute(route);
  const isPublicProfileRoute = route === 'profile' && window.location.pathname.startsWith('/profile/');
  const isGuestRoute = isGuestAccessibleRoute(route, window.location.pathname);
  const routeRequiresLogin = !authUser && !isGuestRoute && !isPublicProfileRoute;
  const game = gameState.chess;
  const history = gameState.moves;
  const gameFen = game.fen();
  const userId = safeUserId(userName);
  const aiLevel = React.useMemo(() => (
    AI_LEVELS.find((level) => level.elo === Number(aiElo)) ?? {
      elo: Number(aiElo) || 1320,
      label: `${Number(aiElo) || 1320} Custom Stockfish`,
      search: 'UCI limited strength'
    }
  ), [aiElo]);
  const timeControl = TIME_CONTROLS.find((control) => control.id === timeControlId) ?? DEFAULT_TIME_CONTROL;
  const aiColor = playerColor === 'w' ? 'b' : 'w';
  const isCoachGame = gameMode === 'coach';
  const usesAiOpponent = gameMode === 'bot' || isCoachGame;
  const isPlayerTurn = gameMode === 'local' || game.turn() === playerColor;
  const coachBehavior = coachBehaviorFromMode(coachMode);
  const {
    reviewMode,
    setReviewMode,
    reviewPly,
    setReviewPly,
    stockfishReview,
    setStockfishReview,
    stockfishStatus,
    setStockfishStatus,
    reviewStarted,
    setReviewStarted,
    pendingAnalysis,
    setPendingAnalysis,
    currentReviewAnalysis,
    reviewBadge,
    reviewStats,
    queueMissingReviewAnalysis,
    startReview,
    reviewStep,
    retryReview
  } = useGameReview({
    game,
    history,
    initialFen,
    gameVariant,
    isCoachGame,
    liveReview: usesAiOpponent && (isCoachGame || botOptions.moveFeedback),
    gameId
  });
  const displayGame = reviewMode ? replayGameAt(history, reviewPly, initialFen) : game;
  const displayHistory = displayGame.history({ verbose: true });
  const timeOutcome = timeWinner
    ? {
        type: timeWinner === playerColor ? 'win' : 'loss',
        title: timeWinner === playerColor ? 'Bạn thắng do hết giờ' : 'Bạn thua do hết giờ',
        detail: `${timeWinner === 'w' ? 'Trắng' : 'Đen'} thắng vì đối thủ hết thời gian`
      }
    : null;
  const outcome = manualResult ?? timeOutcome ?? gameOutcome(game, playerColor);
  const gameFinished = Boolean(outcome);
  const showResultDialog = gameFinished && !resultDismissed && isActiveGameRoute && !isActiveOnlineRoute;
  React.useEffect(() => {
    if (!['bot', 'coach'].includes(route) || route !== gameMode || !botGameStarted) return;
    saveAiGame(window.localStorage, {
      mode: gameMode,
      started: true,
      gameId,
      moves: history,
      initialFen,
      playerColor,
      sideChoice,
      aiElo,
      selectedBotId,
      timeControlId,
      gameVariant,
      coachMode,
      coachLesson,
      botOptions,
      lastMove,
      manualResult,
      resultDismissed
    });
  }, [aiElo, botGameStarted, botOptions, coachLesson, coachMode, gameId, gameMode, gameVariant,
    history, initialFen, lastMove, manualResult, playerColor, resultDismissed, route, selectedBotId,
    sideChoice, timeControlId]);
  React.useEffect(() => {
    if (!outcome || !isActiveGameRoute) return;

    window.sessionStorage.setItem(FINISHED_GAME_KEY, JSON.stringify({
      route: gameMode,
      outcome
    }));
  }, [gameMode, isActiveGameRoute, outcome]);
  const capturedWhite = displayHistory
    .filter((move) => move.captured && move.color === 'w')
    .map((move) => ({ type: move.captured, src: getPieceImage(pieceSet, `b${move.captured}`), alt: `Captured black ${move.captured}` }));
  const capturedBlack = displayHistory
    .filter((move) => move.captured && move.color === 'b')
    .map((move) => ({ type: move.captured, src: getPieceImage(pieceSet, `w${move.captured}`), alt: `Captured white ${move.captured}` }));
  const whiteCapturePoints = capturedPoints(capturedWhite);
  const blackCapturePoints = capturedPoints(capturedBlack);
  const materialScore = boardMaterialScore(displayGame);
  const latestEngineScore = [...stockfishReview].reverse().find(Boolean)?.whiteScore;
  const reviewEngineScore = currentReviewAnalysis?.whiteScore;
  const advantagePercent = Number.isFinite(reviewEngineScore)
    ? engineBarPercent(reviewEngineScore)
    : Number.isFinite(latestEngineScore)
      ? engineBarPercent(latestEngineScore)
      : Math.max(6, Math.min(94, 50 - materialScore * 3.2));
  const reviewArrow = currentReviewAnalysis?.bestMove
    ? {
        from: currentReviewAnalysis.bestMove.slice(0, 2),
        to: currentReviewAnalysis.bestMove.slice(2, 4)
      }
    : null;
  const reviewArrowFrom = reviewArrow ? squareCenter(reviewArrow.from, flipped) : null;
  const reviewArrowTo = reviewArrow ? squareCenter(reviewArrow.to, flipped) : null;
  const visibleHintMove = hintMove ?? (botOptions.suggestionArrows ? suggestionMove : null);
  const hintArrowFrom = visibleHintMove ? squareCenter(visibleHintMove.from, flipped) : null;
  const hintArrowTo = visibleHintMove ? squareCenter(visibleHintMove.to, flipped) : null;
  const threatArrowFrom = botOptions.threatArrows && threatMove ? squareCenter(threatMove.from, flipped) : null;
  const threatArrowTo = botOptions.threatArrows && threatMove ? squareCenter(threatMove.to, flipped) : null;
  const premoveArrows = premoveQueue
    .map((move) => ({
      from: squareCenter(move.from, flipped),
      to: squareCenter(move.to, flipped)
    }))
    .filter((arrow) => arrow.from && arrow.to);
  const botPersonas = React.useMemo(() => mergeBotPersonas(customBots), [customBots]);
  const botGroups = React.useMemo(() => groupBotPersonas(botPersonas), [botPersonas]);
  const activeBotPersona = botPersonas.find((persona) => selectedBotId && persona.id === selectedBotId)
    ?? botPersonas.reduce((closest, persona) => (
      Math.abs(persona.elo - Number(aiElo)) < Math.abs(closest.elo - Number(aiElo)) ? persona : closest
    ), botPersonas[0] || BOT_PERSONAS[0]);
  const aiDisplayName = `${isCoachGame ? 'Huấn luyện viên' : activeBotPersona.name} (${aiLevel.elo})`;
  const latestPlayerMoveIndex = history.reduce((foundIndex, move, index) => (
    move.color === playerColor ? index : foundIndex
  ), -1);
  const latestCoachMove = latestPlayerMoveIndex >= 0 ? history[latestPlayerMoveIndex] : null;
  const latestCoachAnalysis = latestPlayerMoveIndex >= 0 ? stockfishReview[latestPlayerMoveIndex] : null;
  const liveCoachBadge = usesAiOpponent && latestCoachMove && botOptions.moveFeedback
    ? (latestCoachAnalysis ?? { tone: 'loading', label: 'Đang phân tích' })
    : null;
  const coachInsight = buildCoachInsight({
    analysis: latestCoachAnalysis,
    latestMove: latestCoachMove,
    historyLength: latestPlayerMoveIndex >= 0 ? latestPlayerMoveIndex + 1 : history.length,
    playerColor,
    aiElo,
    coachMode,
    lesson: coachLesson
  });
  const coachSpeechText = coachInsight.messages.filter(Boolean).join(' ');
  const coachVoiceText = (coachInsight.voiceMessages ?? coachInsight.messages).filter(Boolean).join(' ');
  const { botChatLine, resetBotAssistance } = useBotAssistance({
    activeBotPersona,
    history,
    game,
    playerColor,
    isCoachGame,
    botGameStarted,
    coachSpeechText: coachAudioEnabled && isActiveGameRoute && !reviewMode ? coachVoiceText : '',
    latestAnalyzedPlayerMoveIndex: latestPlayerMoveIndex,
    speakCoachText,
    botOptions,
    stockfishReview
  });
  React.useEffect(() => {
    if (!isCoachGame || !isActiveGameRoute || reviewMode || !coachAudioEnabled) stopSpeech();
  }, [isCoachGame, isActiveGameRoute, reviewMode, coachAudioEnabled, stopSpeech]);
  const [hintBusy, setHintBusy] = React.useState(false);
  const hintRequestRef = React.useRef(null);
  const livePositionRef = React.useRef('');
  livePositionRef.current = gameId + ':' + game.fen();
  React.useEffect(() => () => { hintRequestRef.current?.abort(); }, [gameId]);
  const [aiRetry, setAiRetry] = React.useState(0);
  const botChatText = !botOptions.botChat
    ? ''
    : isAiThinking
      ? `${activeBotPersona.name} đang tính nước...`
      : botChatLine;

  const outcomeResult = outcome
    ? outcome.type === 'draw'
      ? '1/2-1/2'
      : outcome.type === 'win'
        ? playerColor === 'w' ? '1-0' : '0-1'
        : playerColor === 'w' ? '0-1' : '1-0'
    : null;
  const { apiOnline, setApiOnline, resetSavedGameLog } = useApiGameLog({
    ownerId: authUser?.uid || 'guest',
    game,
    gameFen,
    historyLength: history.length,
    gameId,
    playerColor,
    aiLevel,
    userId,
    userName,
    timeControl,
    outcomeResult
  });
  useGameClock({
    reviewMode,
    game,
    gameFinished,
    timeWinner,
    clockRunning: false,
    setClocks,
    setTimeWinner,
    setResultDismissed
  });
  useMoveGuidance({
    botGameStarted,
    reviewMode,
    game,
    gameFen,
    gameFinished,
    timeWinner,
    botOptions,
    playerColor,
    aiElo: aiLevel.elo,
    isCoachGame,
    coachMode,
    history,
    gameVariant,
    setSuggestionMove,
    setThreatMove
  });

  React.useEffect(() => {
    premoveRef.current = premoveQueue;
  }, [premoveQueue]);

  React.useEffect(() => {
    if (reviewMode || gameFinished || game.turn() !== aiColor || !usesAiOpponent || !botGameStarted) {
      setIsAiThinking(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setSelected(null);
    setLegalTargets([]);
    setIsAiThinking(true);

    const fen = game.fen();
    aiTimerRef.current = window.setTimeout(async () => {
      const legalMoves = game.moves({ verbose: true });
      let move = null;

      try {
        const engineMove = await requestStockfishMove(fen, aiLevel.elo, {
          initialFen: initialFen || history[0]?.before || fen,
          botId: isCoachGame ? undefined : selectedBotId || undefined,
          moves: history.map((item) => `${item.from}${item.to}${item.promotion ?? ''}`),
          variant: gameVariant,
          signal: controller.signal
        });
        move = legalMoves.find((legalMove) => legalMove.from === engineMove.from
          && legalMove.to === engineMove.to
          && (legalMove.promotion ?? '') === (engineMove.promotion ?? '')) ?? null;
        if (!move) throw new Error('Stockfish returned an illegal move.');
        setEngineError('');
      } catch {
        if (cancelled) return;
        setEngineError('Đối thủ chưa trả lời được. Hãy kiểm tra kết nối và thử lại.');
        setIsAiThinking(false);
        return;
      }

      if (cancelled) return;

      const playBotMove = () => {
        if (cancelled || !move) {
          setIsAiThinking(false);
          return;
        }

        const nextGame = createGameState(history, initialFen).chess;
        const playedMove = nextGame.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion ?? 'q'
        });

        if (playedMove) {
          commitPlayedMove(playedMove);
          setIsAiThinking(false);
          if (premoveRef.current.length > 0) {
            window.setTimeout(() => executePremove(premoveRef.current, [...history, playedMove]), 70);
          }
          return;
        }

        setIsAiThinking(false);
      };

      playBotMove();
    }, 40);

    return () => {
      cancelled = true;
      controller.abort();
      if (aiTimerRef.current) {
        window.clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }
    };

  }, [aiColor, aiLevel, botGameStarted, game, gameFinished, gameVariant, history, initialFen, usesAiOpponent, aiRetry, reviewMode, isCoachGame, selectedBotId]);

  React.useEffect(() => {
    return () => {
      if (aiTimerRef.current) {
        window.clearTimeout(aiTimerRef.current);
      }
      stopSpeech();
    };
  }, []);

  const commitPlayedMove = (move) => {
    playMoveSound(move);
    setHintMove(null);
    setSuggestionMove(null);
    setThreatMove(null);
    if (move.color === playerColor) {
      setPremoveQueue([]);
    }
    setGameState((currentState) => {
      return createGameState([...currentState.moves, move], initialFen);
    });
    setLastMove({ from: move.from, to: move.to });
    setClocks((currentClocks) => ({
      ...currentClocks,
      [move.color]: currentClocks[move.color] + timeControl.incrementSeconds
    }));
    setResultDismissed(false);
  };

  const startNewGame = async ({
    nextSideChoice = sideChoice,
    nextAiElo = aiElo,
    nextBotId = selectedBotId,
    nextTimeControl = timeControl,
    nextBotGameStarted = false,
    nextVariant = gameVariant,
    nextInitialFen = undefined,
    nextPlayerColor = undefined,
    nextCoachLesson = null
  } = {}) => {
    window.sessionStorage.removeItem(FINISHED_GAME_KEY);
    if (['bot', 'coach'].includes(gameMode)) clearAiGame(window.localStorage, gameMode);
    if (aiTimerRef.current) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }

    const resolvedInitialFen = nextInitialFen !== undefined
      ? nextInitialFen
      : nextVariant === 'chess960' ? generateChess960Fen() : null;
    const resolvedPlayerColor = nextPlayerColor ?? resolvePlayerColor(nextSideChoice);
    setInitialFen(resolvedInitialFen);
    setGameVariant(nextVariant);
    setCoachLesson(nextCoachLesson ?? (nextVariant === 'lesson' ? coachLesson : coachLessonFromMode(coachMode)));
    setGameState(createGameState([], resolvedInitialFen));
    setPlayerColor(resolvedPlayerColor);
    setSideChoice(nextSideChoice);
    setAiElo(Number(nextAiElo));
    setSelectedBotId(nextBotId || '');
    setFlipped(resolvedPlayerColor === 'b');
    setSelected(null);
    setLegalTargets([]);
    setHintMove(null);
    setPremoveQueue([]);
    setSuggestionMove(null);
    setThreatMove(null);
    setLastMove(null);
    setPromotionRequest(null);
    setIsAiThinking(false);
    setEngineError('');
    setTimeWinner(null);
    setManualResult(null);
    setBotGameStarted(nextBotGameStarted);
    setClocks({ w: nextTimeControl.baseSeconds, b: nextTimeControl.baseSeconds });
    setResultDismissed(false);
    setReviewMode(false);
    setReviewPly(0);
    setStockfishReview([]);
    setPendingAnalysis([]);
    setStockfishStatus('idle');
    setGameId(newLocalGameId());
    resetSavedGameLog();
    stopSpeech();
    resetBotAssistance((botPersonas.find((persona) => (nextBotId && persona.id === nextBotId) || persona.elo === Number(nextAiElo)) ?? activeBotPersona).chat);

    try {
      const response = await fetch(apiUrl('/api/game/new'), {
        method: 'POST'
      });

      setApiOnline(response.ok);
    } catch {

      setApiOnline(false);
    }
  };

  const startBotMatch = () => {
    ensureAudioContext();
    playUiSound('start');
    setGameMode('bot');
    if (route !== 'bot') navigate('bot');
    setBotGameStarted(true);
    startNewGame({ nextSideChoice: sideChoice, nextAiElo: aiElo, nextTimeControl: timeControl, nextBotGameStarted: true });
  };

  const startCoachMatch = () => {
    ensureAudioContext();
    playUiSound('start');
    setGameMode('coach');
    if (route !== 'coach') navigate('coach');
    resetCoachMatch({ nextLesson: coachLesson, startImmediately: true });
  };

  const resetCoachMatch = ({
    nextCoachMode = coachMode,
    nextAiElo = aiElo,
    nextTimeControl = timeControl,
    nextLesson = coachLessonFromMode(nextCoachMode),
    startImmediately = false
  } = {}) => {
    startNewGame({
      nextSideChoice: nextLesson.playerColor,
      nextAiElo,
      nextTimeControl,
      nextBotGameStarted: startImmediately,
      nextVariant: nextLesson.variant,
      nextInitialFen: nextLesson.fen,
      nextPlayerColor: nextLesson.playerColor,
      nextCoachLesson: nextLesson
    });
  };

  const resignGame = () => {
    setManualResult({
      type: 'loss',
      title: `${isCoachGame ? 'Huấn luyện viên' : activeBotPersona.name} thắng`,
      detail: 'bằng đầu hàng'
    });
    setResultDismissed(false);
  };

  const showHintMove = async () => {
    if (reviewMode || gameFinished || isAiThinking || hintRequestRef.current || !isPlayerTurn) return;
    const position = livePositionRef.current;
    const controller = new AbortController();
    hintRequestRef.current = controller;
    setHintBusy(true);
    try {
      const suggestedMove = suggestionMove ?? await requestStockfishMove(game.fen(), aiLevel.elo, {
        moves: history.map((item) => `${item.from}${item.to}${item.promotion ?? ''}`),
        variant: gameVariant,
        fullStrength: true,
        signal: controller.signal
      });
      if (livePositionRef.current !== position || controller.signal.aborted) return;
      const legalMove = game.moves({ verbose: true }).some((move) => (
        move.from === suggestedMove.from
        && move.to === suggestedMove.to
        && (move.promotion ?? '') === (suggestedMove.promotion ?? '')
      ));
      if (!legalMove) throw new Error('Stockfish returned an illegal hint.');
      setHintMove({ from: suggestedMove.from, to: suggestedMove.to });
      setEngineError('');
    } catch {
      if (livePositionRef.current === position && !controller.signal.aborted) setEngineError('Chưa lấy được gợi ý. Hãy thử lại.');
    } finally {
      if (hintRequestRef.current === controller) hintRequestRef.current = null;
      setHintBusy(false);
    }
  };

  const updateBotOption = (key) => {
    setBotOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleCoachAudio = () => {
    setCoachAudioEnabled((enabled) => {
      if (enabled) stopSpeech();
      return !enabled;
    });
  };

  const changeCoachMode = (nextCoachMode) => {
    const nextBehavior = coachBehaviorFromMode(nextCoachMode);
    const nextLesson = coachLessonFromMode(nextCoachMode);
    setCoachMode(nextCoachMode);
    setCoachLesson(nextLesson);
    setBotOptions((current) => ({
      ...current,
      moveFeedback: nextBehavior.moveFeedback,
      suggestionArrows: nextBehavior.suggestionArrows,
      threatArrows: nextBehavior.threatArrows
    }));
    if (isCoachGame) {
      resetCoachMatch({ nextCoachMode, nextAiElo: aiElo, nextLesson });
    }
  };

  const changeSideChoice = (choice) => {
    if (isCoachGame) {
      resetCoachMatch({
        nextLesson: {
          ...coachLesson,
          playerColor: resolvePlayerColor(choice)
        }
      });
      return;
    }
    startNewGame({ nextSideChoice: choice });
  };

  const changeAiElo = (elo, botId = '') => {
    if (isCoachGame) {
      resetCoachMatch({ nextAiElo: Number(elo), nextLesson: coachLesson });
      return;
    }
    playUiSound('tap');
    startNewGame({ nextSideChoice: sideChoice, nextAiElo: Number(elo), nextBotId: botId });
  };

  const changeTimeControl = (controlId) => {
    const nextControl = TIME_CONTROLS.find((control) => control.id === controlId) ?? DEFAULT_TIME_CONTROL;
    setTimeControlId(nextControl.id);
    setClocks({ w: nextControl.baseSeconds, b: nextControl.baseSeconds });
    if (isCoachGame) {
      resetCoachMatch({ nextTimeControl: nextControl, nextLesson: coachLesson });
      return;
    }
    startNewGame({ nextSideChoice: sideChoice, nextAiElo: aiElo, nextTimeControl: nextControl });
  };

  const changeVariant = (variant) => {
    startNewGame({ nextSideChoice: sideChoice, nextAiElo: aiElo, nextTimeControl: timeControl, nextVariant: variant });
  };

  const undoMove = () => {
    if (reviewMode) return;

    if (aiTimerRef.current) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }

    const removeCount = history.length > 1 && history.at(-1)?.color !== playerColor ? 2 : 1;
    const nextMoves = history.slice(0, Math.max(0, history.length - removeCount));
    const nextGameState = createGameState(nextMoves, initialFen);
    const previousMove = nextGameState.moves.at(-1);
    setGameState(nextGameState);
    setSelected(null);
    setLegalTargets([]);
    setLastMove(previousMove ? { from: previousMove.from, to: previousMove.to } : null);
    setPromotionRequest(null);
    setIsAiThinking(false);
    setPendingAnalysis([]);
    setStockfishReview([]);
    setStockfishStatus('idle');
    setResultDismissed(false);
  };

  const selectPiece = (square) => {
    setSelected(square);
    setLegalTargets(game.moves({ square, verbose: true }).map((move) => move.to));
  };

  const needsPromotionChoice = (from, to) => {
    const piece = game.get(from);
    if (!piece || piece.type !== 'p') return false;

    return game.moves({ square: from, verbose: true }).some((move) => move.to === to && move.promotion);
  };

  const playMove = ({ from, to, promotion = 'q' }) => {
    if (isAiThinking || gameFinished || !isPlayerTurn) return false;

    const nextGame = createGameState(history, initialFen).chess;
    const move = nextGame.move({ from, to, promotion });

    if (!move) return false;

    if (usesAiOpponent && !botGameStarted) {
      ensureAudioContext();
      playUiSound('start');
      setBotGameStarted(true);
    }

    setSelected(null);
    setLegalTargets([]);
    setPromotionRequest(null);
    commitPlayedMove(move);
    return true;
  };

  const executePremove = (queuedMove, baseHistory) => {
    const nextPremove = Array.isArray(queuedMove) ? queuedMove[0] : queuedMove;
    if (!nextPremove || !usesAiOpponent || reviewMode || gameFinished) return false;

    const nextGame = createGameState(baseHistory, initialFen).chess;
    if (nextGame.isGameOver() || nextGame.turn() !== playerColor) {
      setPremoveQueue([]);
      return false;
    }

    const move = nextGame.move({
      from: nextPremove.from,
      to: nextPremove.to,
      promotion: nextPremove.promotion ?? 'q'
    });

    setPremoveQueue([]);
    setSelected(null);
    setLegalTargets([]);

    if (!move) return false;

    commitPlayedMove(move);
    return true;
  };

  const requestOrPlayMove = (from, to) => {
    if (needsPromotionChoice(from, to)) {
      setPromotionRequest({ from, to, color: playerColor });
      return true;
    }

    return playMove({ from, to });
  };

  const queuePremove = (from, to) => {
    if (!usesAiOpponent || reviewMode || gameFinished || game.turn() === playerColor) return false;

    const piece = game.get(from);
    if (!piece || piece.color !== playerColor) return false;

    setPremoveQueue([{ from, to, promotion: 'q' }]);
    setSelected(null);
    setLegalTargets([]);
    return true;
  };

  const selectSquare = (square) => {
    if (reviewMode || gameFinished) return;

    const piece = game.get(square);

    if (!isPlayerTurn) {
      if (!usesAiOpponent) return;

      if (piece && piece.color === playerColor) {
        setSelected(square);
        setLegalTargets([]);
        return;
      }

      if (selected) {
        queuePremove(selected, square);
      }
      return;
    }

    if (piece && (gameMode === 'local' || piece.color === playerColor) && piece.color === game.turn()) {
      selectPiece(square);
      return;
    }

    if (selected) {
      requestOrPlayMove(selected, square);
      return;
    }

    setSelected(null);
    setLegalTargets([]);
  };

  const cancelPromotion = () => {
    setPromotionRequest(null);
    setSelected(null);
    setLegalTargets([]);
  };

  const handleDragStart = (event, square, piece) => {
    const canPremoveDrag = usesAiOpponent && !isPlayerTurn && piece?.color === playerColor;

    if (reviewMode || !dragEnabled || gameFinished || !piece || (gameMode !== 'local' && piece.color !== playerColor) || (!isPlayerTurn && !canPremoveDrag)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', square);
    selectPiece(square);
  };

  const handleDrop = (event, square) => {
    event.preventDefault();
    if (reviewMode) return;
    const from = event.dataTransfer.getData('text/plain');

    if (!from) return;

    if (!isPlayerTurn) {
      queuePremove(from, square);
      return;
    }

    requestOrPlayMove(from, square);
  };

  const reviewGame = () => {
    if (aiTimerRef.current) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }

    startReview();
    setResultDismissed(true);
    setIsAiThinking(false);
    navigate('review');
  };

  const reviewLocalGame = ({ moves = [], names = {} } = {}) => {
    const safeMoves = Array.isArray(moves) ? moves : [];
    if (safeMoves.length === 0) return;
    if (aiTimerRef.current) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }

    const nextState = createGameState(safeMoves, null);
    setGameMode('local');
    setInitialFen(null);
    setGameVariant('standard');
    setCoachLesson(null);
    setGameState(nextState);
    setPlayerColor('w');
    setSideChoice('w');
    setFlipped(false);
    setSelected(null);
    setLegalTargets([]);
    setHintMove(null);
    setPremoveQueue([]);
    setSuggestionMove(null);
    setThreatMove(null);
    setLastMove(safeMoves.at(-1) ? { from: safeMoves.at(-1).from, to: safeMoves.at(-1).to } : null);
    setPromotionRequest(null);
    setIsAiThinking(false);
    setTimeWinner(null);
    setManualResult(null);
    setBotGameStarted(false);
    setReviewMode(true);
    setReviewStarted(false);
    setReviewPly(safeMoves.length);
    setStockfishReview([]);
    setPendingAnalysis([]);
    setStockfishStatus('idle');
    setResultDismissed(true);
    setGameId(newLocalGameId());
    setLocalReviewNames({
      w: names.w || 'White',
      b: names.b || 'Black'
    });
    navigate('review');
  };

  const whiteName = gameMode === 'local' ? localReviewNames.w : playerColor === 'w' ? userName : aiDisplayName;
  const blackName = gameMode === 'local' ? localReviewNames.b : playerColor === 'b' ? userName : aiDisplayName;
  const whiteAvatarURL = playerColor === 'w' ? authUser?.photoURL : isCoachGame ? COACH_AVATAR : activeBotPersona.avatar;
  const blackAvatarURL = playerColor === 'b' ? authUser?.photoURL : isCoachGame ? COACH_AVATAR : activeBotPersona.avatar;
  const aiCoachContext = React.useMemo(() => {
    if ((isActiveOnlineRoute || route === 'onlineReview') && onlineCoachContext?.hasBoardContext) {
      return { route, mode: 'online', ...onlineCoachContext };
    }
    const hasBoardContext = (isActiveGameRoute && !isActiveOnlineRoute) || route === 'review';
    const safeGame = reviewMode ? displayGame : game;
    const latestMove = safeGame.history({ verbose: true }).at(-1);
    const activeReview = currentReviewAnalysis || latestCoachAnalysis || null;

    return {
      route,
      mode: gameMode,
      hasBoardContext,
      fen: hasBoardContext ? safeGame.fen() : '',
      pgn: hasBoardContext ? safeGame.pgn() : '',
      turn: hasBoardContext ? safeGame.turn() : '',
      playerColor: hasBoardContext ? playerColor : '',
      latestMove: hasBoardContext && latestMove ? `${latestMove.san || `${latestMove.from || ''}${latestMove.to || ''}`}` : '',
      previousFen: hasBoardContext ? latestMove?.before || '' : '',
      latestLan: hasBoardContext ? latestMove?.lan || '' : '',
      recentMoves: hasBoardContext ? history.slice(-12).map((move, index) => {
        const ply = history.length - Math.min(12, history.length) + index + 1;
        return `${ply}. ${move.color === 'w' ? 'White' : 'Black'} ${move.san || `${move.from}${move.to}`}`;
      }) : [],
      review: hasBoardContext && activeReview ? {
        label: activeReview.label,
        tone: activeReview.tone,
        bestMove: activeReview.bestMove || activeReview.bestSan || '',
        centipawnLoss: activeReview.centipawnLoss,
        winLoss: activeReview.winLoss
      } : null
    };
  }, [currentReviewAnalysis, displayGame, game, gameMode, history, isActiveGameRoute, isActiveOnlineRoute, latestCoachAnalysis, onlineCoachContext, playerColor, reviewMode, route]);

  if (route === 'admin') {
    return (
      <React.Suspense fallback={<RouteLoading label="Đang mở bảng quản trị..." />}>
        <ToastHost />
        <OfflineOverlay visible={isOffline} onRecovered={() => setIsOffline(false)} />
        <AdminPage />
      </React.Suspense>
    );
  }

  if (!authReady) {
    return <RouteLoading label="Đang kiểm tra phiên đăng nhập..." />;
  }

  const isAuthRoute = route === 'login' || route === 'register' || route === 'forgotPassword';

  return (
    <main className={`app-shell ${isAuthRoute ? 'auth-layout-shell' : ''}`} style={themeStyle} data-color-scheme={colorScheme}>
      <ToastHost />
      <OfflineOverlay visible={isOffline} onRecovered={() => setIsOffline(false)} />
      <ModerationBanner status={moderationStatus} />
      {banNotice && <AccountBanNotice key={banNotice.ban.id} notice={banNotice} onClose={dismissBanNotice} />}
      <AcademicNoticeModal
        visible={academicNoticeOpen}
        authUser={authUser}
        onClose={() => setAcademicNoticeOpen(false)}
        onOpenPage={() => {
          setAcademicNoticeOpen(false);
          navigate('academicNotice');
        }}
      />
      {promotionRequest && <button className="promotion-cancel-layer" aria-label="Cancel promotion" onClick={cancelPromotion} tabIndex={-1} />}
      {!isAuthRoute && (
      <Sidebar
        siteTitle={websiteSettings?.siteTitle}
        authUser={authUser}
        userName={userName}
        activeRoute={route}
        membership={membership}
        notificationCount={notificationCount}
        mobileOpen={mobileSidebarOpen}
        onToggleMobile={() => setMobileSidebarOpen((open) => !open)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onSelectPlayMode={(mode) => {
          if (!authUser) return;
          setGameMode(mode);
          setReviewMode(false);
          if (mode === 'coach') {
            ensureAudioContext();
            resetCoachMatch();
            return;
          }
          if (mode === 'bot') {
            startNewGame({
              nextSideChoice: sideChoice,
              nextAiElo: aiElo,
              nextTimeControl: timeControl,
              nextBotGameStarted: false,
              nextVariant: 'standard',
              nextInitialFen: null
            });
            return;
          }
          setBotGameStarted(false);
        }}
        onNavigate={(nextRoute) => {
          if (authUser && nextRoute !== 'coach' && isGameRoute(nextRoute) && (route === 'review' || game.isGameOver() || manualResult || timeWinner)) {
            startNewGame({ nextBotGameStarted: false });
          }
          navigate(nextRoute);
        }}
        onLogin={() => openAuth('login')}
        onRegister={() => openAuth('register')}
        onLogout={logout}
      />
      )}

      <section className={`content-shell ${isAuthRoute ? 'auth-route-shell' : ''} ${route === 'review' || route === 'onlineReview' ? 'review-route-shell' : ''} ${route === 'home' ? 'home-route-shell' : ''} ${route === 'profile' ? 'profile-route-shell' : ''} ${route === 'history' ? 'history-route-shell' : ''} ${isActiveGameRoute && !isActiveOnlineRoute && route !== 'local' ? 'game-route-shell' : ''} ${route === 'local' ? 'local-route-shell' : ''} ${isActiveOnlineRoute || route === 'onlineReview' ? 'online-route-shell' : ''} ${isActivePuzzleRoute ? 'puzzle-route-shell' : ''}`}>
        {!isAuthRoute && (
        <TopHeader
          activeRoute={route === 'onlineReview' ? 'history' : route}
          apiOnline={apiOnline}
          settingsOpen={settingsOpen}
          theme={theme}
          appearance={appearance}
          pieceSet={pieceSet}
          authUser={authUser}
          notificationCount={notificationCount}
          onNotificationCountChange={setNotificationCount}
          onOpenAcademicNotice={() => {
            if (authUser) {
              setAcademicNoticeOpen(true);
              return;
            }
            navigate('academicNotice');
          }}
          onOpenNotifications={() => navigate('notifications')}
          onOpenSupport={() => navigate('support')}
          onToggleSettings={() => setSettingsOpen((value) => !value)}
          onCloseSettings={() => setSettingsOpen(false)}
          onResetTheme={resetTheme}
          onUpdateTheme={updateTheme}
          onSetAppearance={setAppearance}
          onApplyBoardPreset={applyBoardPreset}
          onSetPieceSet={setPieceSet}
        />
        )}

        {websiteSettings?.showMaintenanceBanner && websiteSettings.maintenanceMessage && (
          <div className="website-maintenance-banner" role="status">{websiteSettings.maintenanceMessage}</div>
        )}
        {route==='home' && websiteSettings?.homepageAnnouncement && (
          <div className="website-announcement" role="status">{websiteSettings.homepageAnnouncement}</div>
        )}

        {route === 'login' && !authUser && (
          <LoginPage
            authMode={authMode}
            authForm={authForm}
            authMessage={authMessage}
            authMessageTone={authMessageTone}
            authBusy={authBusy}
            otpState={otpState}
            otpSecondsLeft={otpSecondsLeft}
            onAuthFormChange={(patch) => setAuthForm((form) => ({ ...form, ...patch }))}
            onSubmitAuth={submitAuth}
            onProviderSignIn={signInProvider}
            onSetAuthMode={(mode) => {
              openAuth(mode);
            }}
            onVerifyOtp={handleVerifyOtp}
            onResendOtp={resendOtp}
          />
        )}

        {route === 'register' && !authUser && (
          <RegisterPage
            authForm={authForm}
            authMessage={authMessage}
            authMessageTone={authMessageTone}
            authBusy={authBusy}
            otpState={otpState}
            otpSecondsLeft={otpSecondsLeft}
            onAuthFormChange={(patch) => setAuthForm((form) => ({ ...form, ...patch }))}
            onSubmitAuth={submitAuth}
            onProviderSignIn={signInProvider}
            onSetAuthMode={(mode) => openAuth(mode)}
            onVerifyOtp={handleVerifyOtp}
            onResendOtp={resendOtp}
          />
        )}

        {route === 'forgotPassword' && !authUser && (
          <ForgotPasswordPage
            authForm={authForm}
            authMessage={authMessage}
            authMessageTone={authMessageTone}
            authBusy={authBusy}
            otpState={otpState}
            otpSecondsLeft={otpSecondsLeft}
            onAuthFormChange={(patch) => setAuthForm((form) => ({ ...form, ...patch }))}
            onSubmitAuth={submitAuth}
            onProviderSignIn={signInProvider}
            onSetAuthMode={(mode) => openAuth(mode)}
            onVerifyOtp={handleVerifyOtp}
            onResendOtp={resendOtp}
          />
        )}

        {route !== 'login' && route !== 'register' && route !== 'forgotPassword' && (!authMode || authUser || isGuestRoute || isPublicProfileRoute || routeRequiresLogin) && (
        <React.Suspense fallback={<RouteLoading />}>
        {routeRequiresLogin ? (
          <LoginRequiredNotice onLogin={() => openAuth('login')} />
        ) : (
        <>
        {route === 'home' && (
          <HomePage
            userName={userName}
            authUser={authUser}
            history={history}
            reviewStats={reviewStats}
            timeControl={timeControl}
            onStartNewGame={(options) => {
              if (authUser) startNewGame(options);
            }}
            onNavigate={navigate}
            onReviewGame={() => {
              if (authUser) reviewGame();
            }}
          />
        )}

        {route === 'profile' && (
          <ProfilePage
            authUser={authUser}
            profileUserId={window.location.pathname.startsWith('/profile/')
              ? decodeURIComponent(window.location.pathname.split('/').filter(Boolean).at(-1) || '')
              : ''}
            onLogin={() => openAuth('login')}
            onNavigate={navigate}
            onProfileUpdated={updateSessionProfile}
          />
        )}

        {route === 'history' && (
          <HistoryPage
            authUser={authUser}
            onLogin={() => openAuth('login')}
            onOpenReview={(onlineGameId) => {
              window.history.pushState(null, '', `/review/${encodeURIComponent(onlineGameId)}`);
              window.dispatchEvent(new window.PopStateEvent('popstate'));
            }}
          />
        )}

        {route === 'friends' && (
          <FriendsPage
            authUser={authUser}
            onLogin={() => openAuth('login')}
          />
        )}

        {route === 'notifications' && (
          <NotificationsPage
            authUser={authUser}
            onLogin={() => openAuth('login')}
            onNavigate={() => {}}
            onUnreadChange={setNotificationCount}
          />
        )}

        {route === 'leaderboard' && (
          <LeaderboardPage
            authUser={authUser}
            onLogin={() => openAuth('login')}
          />
        )}

        {route === 'achievements' && (
          <AchievementsPage
            authUser={authUser}
            onLogin={() => openAuth('login')}
            onNavigate={navigate}
          />
        )}

        {route === 'support' && (
          <SupportPage authUser={authUser} supportEmail={websiteSettings?.supportEmail} onLogin={() => openAuth('login')} onNavigate={navigate} />
        )}
        {route === 'supportTickets' && (
          <SupportHubPage
            authUser={authUser}
            onLogin={() => openAuth('login')}
            onNavigate={navigate}
          />
        )}

        {route === 'coachLab' && (
          <CoachLabPage
            authUser={authUser}
            onLogin={() => openAuth('login')}
            onNavigate={navigate}
          />
        )}

        {route === 'beginnerGuide' && (
          <BeginnerGuidePage onNavigate={navigate} />
        )}

        {route === 'membership' && (
          <MembershipPage
            authUser={authUser}
            membership={membership}
            onLogin={() => openAuth('login')}
            onMembershipUpdated={setMembership}
          />
        )}

        {route === 'local' && (
          <LocalBoardPage
            pieceSet={pieceSet}
            theme={theme}
            membership={membership}
            onReviewGame={reviewLocalGame}
          />
        )}

        {route === 'academicNotice' && (
          <AcademicNoticePage onNavigate={navigate} />
        )}

        {route === 'notFound' && (
          <NotFoundPage onNavigate={navigate} />
        )}

        {route === 'onlineReview' && (
          <>
            <OnlinePage
              authUser={authUser}
              userName={userName}
              pieceSet={pieceSet}
              theme={theme}
              membership={membership}
              onLogin={() => openAuth('login')}
              onNavigate={navigate}
              onCoachContextChange={setOnlineCoachContext}
              historyOnly
              historyReviewGameId={decodeURIComponent(window.location.pathname.split('/').filter(Boolean).at(-1) || '')}
            />
          </>
        )}

        {isActiveOnlineRoute && (
          <>
            <OnlinePage authUser={authUser} userName={userName} pieceSet={pieceSet} theme={theme} membership={membership} onLogin={() => openAuth('login')} onNavigate={navigate} onCoachContextChange={setOnlineCoachContext} />
          </>
        )}

        {isActivePuzzleRoute && (
          <>
            <PuzzlePage activeRoute={route} pieceSet={pieceSet} membership={membership} authUser={authUser} onNavigate={navigate} />
          </>
        )}

        {route !== 'home' && route !== 'profile' && route !== 'friends' && route !== 'notifications' && route !== 'history' && route !== 'leaderboard' && route !== 'achievements' && route !== 'support' && route !== 'supportTickets' && route !== 'coachLab' && route !== 'beginnerGuide' && route !== 'membership' && route !== 'academicNotice' && route !== 'local' && route !== 'notFound' && route !== 'onlineReview' && !isActivePuzzleRoute && !isActiveOnlineRoute && (
        <>
        {!reviewMode && <PlayPageHeader mode={isCoachGame ? 'coach' : 'bot'} status={botGameStarted ? 'Đang chơi' : 'Sẵn sàng'} />}
        <section className={`game-layout ${reviewMode ? 'review-page-layout' : ''}`}>
          <GameBoard
            blackName={blackName}
            whiteName={whiteName}
            blackAvatarURL={blackAvatarURL}
            whiteAvatarURL={whiteAvatarURL}
            blackMembership={playerColor === 'b' ? membership : null}
            whiteMembership={playerColor === 'w' ? membership : null}
            playerColor={playerColor}
            clocks={clocks}
            capturedBlack={capturedBlack}
            capturedWhite={capturedWhite}
            blackCapturePoints={blackCapturePoints}
            whiteCapturePoints={whiteCapturePoints}
            game={game}
            displayGame={displayGame}
            displayHistory={displayHistory}
            reviewMode={reviewMode}
            reviewBadge={reviewBadge}
            liveCoachBadge={liveCoachBadge}
            liveCoachMove={latestCoachMove}
            lastMove={lastMove}
            flipped={flipped}
            botOptions={botOptions}
            advantagePercent={advantagePercent}
            pieceSet={pieceSet}
            selected={selected}
            showHints={showHints}
            legalTargets={legalTargets}
            visibleHintMove={visibleHintMove}
            threatMove={threatMove}
            premoveQueue={premoveQueue}
            usesAiOpponent={usesAiOpponent}
            isPlayerTurn={isPlayerTurn}
            dragEnabled={dragEnabled}
            gameMode={gameMode}
            isAiThinking={isAiThinking}
            promotionRequest={promotionRequest}
            reviewArrowFrom={reviewArrowFrom}
            reviewArrowTo={reviewArrowTo}
            hintArrowFrom={hintArrowFrom}
            hintArrowTo={hintArrowTo}
            threatArrowFrom={threatArrowFrom}
            threatArrowTo={threatArrowTo}
            premoveArrows={premoveArrows}
            formatClock={formatClock}
            untimed={usesAiOpponent}
            onSelectSquare={selectSquare}
            onHandleDrop={handleDrop}
            onHandleDragStart={handleDragStart}
            onCancelPromotion={cancelPromotion}
            onPlayMove={playMove}
          />

        {route === 'review' && (
          <ReviewPage
            initialFen={initialFen}
            onRetryReview={retryReview}
            coachMode={coachMode}
            coachLesson={coachLesson}
            stockfishStatus={stockfishStatus}
            reviewStarted={reviewStarted}
            reviewBadge={reviewBadge}
            currentReviewAnalysis={currentReviewAnalysis}
            reviewPly={reviewPly}
            history={history}
            stockfishReview={stockfishReview}
            reviewStats={reviewStats}
            membership={membership}
            whiteName={whiteName}
            blackName={blackName}
            returnRoute={gameMode}
            onNavigate={navigate}
            onStartNewGame={isCoachGame ? () => resetCoachMatch({ nextLesson: coachLesson }) : startNewGame}
            onReviewStep={reviewStep}
            onSetReviewMode={setReviewMode}
            onSetReviewStarted={setReviewStarted}
            onSetResultDismissed={setResultDismissed}
            onSetReviewPly={setReviewPly}
            onQueueMissingReviewAnalysis={queueMissingReviewAnalysis}
            onStartReview={startReview}
          />
        )}

          {route !== 'review' && (
          <MatchPanel
            key={gameId}
            initialFen={initialFen}
            gameFinished={gameFinished}
            hintBusy={hintBusy}
            coachVoiceAvailable={coachVoiceAvailable}
            onReplayCoachAudio={() => speakCoachText(coachSpeechText)}
            onRetryReview={retryReview}
            onRetryAi={() => setAiRetry((value) => value + 1)}
            botGameStarted={botGameStarted}
            isCoachGame={isCoachGame}
            coachSpeechText={coachSpeechText}
            coachInsight={coachInsight}
            aiElo={aiElo}
            aiLevel={aiLevel}
            activeBotPersona={activeBotPersona}
            botPersonas={botPersonas}
            botGroups={botGroups}
            botOptions={botOptions}
            botChatText={botChatText}
            coachMode={coachMode}
            coachLesson={coachLesson}
            coachAudioEnabled={coachAudioEnabled}
            timeControlId={timeControlId}
            gameVariant={gameVariant}
            history={history}
            game={game}
            reviewMode={reviewMode}
            playerColor={playerColor}
            userName={userName}
            stockfishStatus={stockfishStatus}
            engineError={engineError}
            isAiThinking={isAiThinking}
            gameId={gameId}
            sideChoice={sideChoice}
            gameMode={gameMode}
            usesAiOpponent={usesAiOpponent}
            isPlayerTurn={isPlayerTurn}
            currentReviewAnalysis={currentReviewAnalysis}
            reviewPly={reviewPly}
            stockfishReview={stockfishReview}
            onChangeAiElo={changeAiElo}
            onSetCoachMode={changeCoachMode}
            onToggleCoachAudio={toggleCoachAudio}
            onChangeTimeControl={changeTimeControl}
            onChangeVariant={changeVariant}
            onUpdateBotOption={updateBotOption}
            onStartBotMatch={isCoachGame ? startCoachMatch : startBotMatch}
            onResignGame={resignGame}
            onShowHintMove={showHintMove}
            onUndoMove={undoMove}
            onReviewGame={reviewGame}
            onStartNewGame={isCoachGame ? () => resetCoachMatch({ nextLesson: coachLesson }) : startNewGame}
            onSetFlipped={setFlipped}
            onSetReviewMode={setReviewMode}
            onSetReviewPly={setReviewPly}
            onChangeSideChoice={changeSideChoice}
            onNavigate={navigate}
            onSetResultDismissed={setResultDismissed}
          />
          )}
        </section>
        </>
        )}
        </>
        )}
        </React.Suspense>
        )}
        {route === 'home' && websiteSettings && (
          <footer className="website-public-info">
            <strong>{websiteSettings.siteTitle}</strong>
            <p>{websiteSettings.siteDescription}</p>
            {websiteSettings.ownerName && <span>Chủ sở hữu: {websiteSettings.ownerName}</span>}
            {websiteSettings.developerName && <span>Phát triển: {websiteSettings.developerName}</span>}
            {websiteSettings.supportEmail && <a href={`mailto:${websiteSettings.supportEmail}`}>Hỗ trợ: {websiteSettings.supportEmail}</a>}
          </footer>
        )}
      </section>

      <GameInvitationHost authUser={authUser} />
      <AiCoachChat
        authUser={authUser}
        context={aiCoachContext}
        onLogin={() => openAuth('login')}
        onNavigate={navigate}
      />

      {showResultDialog && (
        <ResultDialog
          outcome={outcome}
          activeBotPersona={activeBotPersona}
          isCoachGame={isCoachGame}
          reviewStats={reviewStats}
          onReviewGame={reviewGame}
          onNewBot={() => {
            setResultDismissed(true);
            setBotGameStarted(false);
            if (isCoachGame) resetCoachMatch({ nextLesson: coachLesson });
            else startNewGame();
          }}
          onRematch={() => {
            setResultDismissed(true);
            if (isCoachGame) startCoachMatch();
            else startBotMatch();
          }}
        />
      )}
    </main>
  );
}
