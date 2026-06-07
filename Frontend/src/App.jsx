import React from 'react';
import { createPortal } from 'react-dom';
import './styles.css';
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
import {
  boardMaterialScore,
  capturedPoints,
  engineBarPercent,
  formatClock,
  promotionPopoverStyle,
  squareCenter
} from './game/gameView';
import AiCoachChat from './components/AiCoachChat';
import GameBoard from './components/GameBoard';
import MatchPanel from './components/MatchPanel';
import ResultDialog from './components/ResultDialog';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import ToastHost, { notify } from './components/ToastHost';
import vietnamFlag from './assets/flags/vietnam.svg';
import unitedKingdomFlag from './assets/flags/united-kingdom.svg';
import {
  buildCoachInsight,
  coachBehaviorFromMode,
  coachLessonFromMode
} from './coach/coach';
import { BOT_PERSONAS, mergeBotPersonas } from './data/bots';
import { useAuthSession } from './hooks/useAuthSession';
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
const ROUTE_CHUNK_RELOAD_KEY = 'chess-arena-route-chunk-reload';

function lazyWithReload(importer) {
  return React.lazy(async () => {
    try {
      const module = await importer();
      window.sessionStorage.removeItem(ROUTE_CHUNK_RELOAD_KEY);
      return module;
    } catch (error) {
      const message = String(error?.message || error || '');
      const chunkLoadFailed = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(message);
      const alreadyReloaded = window.sessionStorage.getItem(ROUTE_CHUNK_RELOAD_KEY) === '1';
      if (chunkLoadFailed && !alreadyReloaded) {
        window.sessionStorage.setItem(ROUTE_CHUNK_RELOAD_KEY, '1');
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });
}

const AdminPage = lazyWithReload(() => import('./routes/Admin/AdminPage'));
const AcademicNoticePage = lazyWithReload(() => import('./routes/use/AcademicNoticePage'));
const AchievementsPage = lazyWithReload(() => import('./routes/use/AchievementsPage'));
const BeginnerGuidePage = lazyWithReload(() => import('./routes/use/BeginnerGuidePage'));
const CoachLabPage = lazyWithReload(() => import('./routes/use/CoachLabPage'));
const HistoryPage = lazyWithReload(() => import('./routes/use/HistoryPage'));
const HomePage = lazyWithReload(() => import('./routes/use/HomePage'));
const FriendsPage = lazyWithReload(() => import('./routes/use/FriendsPage'));
const ForgotPasswordPage = lazyWithReload(() => import('./routes/use/ForgotPasswordPage'));
const LeaderboardPage = lazyWithReload(() => import('./routes/use/LeaderboardPage'));
const LoginPage = lazyWithReload(() => import('./routes/use/LoginPage'));
const LocalBoardPage = lazyWithReload(() => import('./routes/use/LocalBoardPage'));
const MembershipPage = lazyWithReload(() => import('./routes/use/MembershipPage'));
const NotificationsPage = lazyWithReload(() => import('./routes/use/NotificationsPage'));
const NotFoundPage = lazyWithReload(() => import('./routes/use/NotFoundPage'));
const OnlinePage = lazyWithReload(() => import('./routes/use/OnlinePage'));
const ProfilePage = lazyWithReload(() => import('./routes/use/ProfilePage'));
const ReviewPage = lazyWithReload(() => import('./routes/use/ReviewPage'));
const RegisterPage = lazyWithReload(() => import('./routes/use/RegisterPage'));
const PuzzlePage = lazyWithReload(() => import('./routes/use/PuzzlePage'));
const SupportPage = lazyWithReload(() => import('./routes/use/SupportPage'));
const SupportTicketsPage = lazyWithReload(() => import('./routes/use/SupportTicketsPage'));
const TournamentsPage = lazyWithReload(() => import('./routes/use/TournamentsPage'));

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
        <div className="loading-board" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, index) => <span key={index} />)}
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

function OfflineOverlay({ visible }) {
  if (!visible) return null;
  return (
    <div className="offline-overlay" role="status" aria-live="polite">
      <div className="offline-card">
        <div className="offline-king">♔</div>
        <span>Mất kết nối internet</span>
        <h2>Ván cờ đang tạm dừng</h2>
        <p>Kiểm tra mạng của bạn. ChessArena sẽ tự tiếp tục khi kết nối trở lại.</p>
        <div className="offline-loader"><i /><i /><i /><i /></div>
      </div>
    </div>
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

  if (!visible) return null;

  const isVietnamese = language === 'vi';

  return (
    <div className="academic-notice-layer" role="dialog" aria-modal="true" aria-label="Thông báo học thuật">
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
            onClick={() => {
              markAcademicNoticeSeen(authUser);
              onClose();
            }}
          >
            {isVietnamese ? 'Đã hiểu' : 'Got it'}
          </button>
        </div>
        <button type="button" className="academic-notice-image" onClick={() => setImageOpen(true)}>
          <span>{isVietnamese ? 'Ảnh minh họa vị trí mở lại popup' : 'Image: where to reopen this popup'}</span>
        </button>
      </section>
      {imageOpen && createPortal(
        <div className="academic-image-lightbox" role="dialog" aria-modal="true" aria-label="Xem ảnh thông báo">
          <button type="button" className="academic-image-close" onClick={() => setImageOpen(false)} aria-label="Đóng ảnh">
            ×
          </button>
          <div className="academic-image-preview">
            <span>{isVietnamese ? 'Ảnh sẽ được thêm tại đây' : 'Image will be added here'}</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function App() {
  const [gameState, setGameState] = React.useState(() => createGameState());
  const [selected, setSelected] = React.useState(null);
  const [legalTargets, setLegalTargets] = React.useState([]);
  const [flipped, setFlipped] = React.useState(false);
  const [gameId, setGameId] = React.useState(() => newLocalGameId());
  const [lastMove, setLastMove] = React.useState(null);
  const [playerColor, setPlayerColor] = React.useState('w');
  const [sideChoice, setSideChoice] = React.useState('w');
  const [aiElo, setAiElo] = React.useState(1600);
  const [timeControlId, setTimeControlId] = React.useState(DEFAULT_TIME_CONTROL.id);
  const [clocks, setClocks] = React.useState(() => ({ w: DEFAULT_TIME_CONTROL.baseSeconds, b: DEFAULT_TIME_CONTROL.baseSeconds }));
  const [timeWinner, setTimeWinner] = React.useState(null);
  const [gameMode, setGameMode] = React.useState(() => gameModeFromRoute(routeFromPath(window.location.pathname)) ?? 'bot');
  const [coachMode, setCoachMode] = React.useState('basic');
  const [gameVariant, setGameVariant] = React.useState('standard');
  const [initialFen, setInitialFen] = React.useState(null);
  const [coachLesson, setCoachLesson] = React.useState(() => coachLessonFromMode('basic'));
  const [botGameStarted, setBotGameStarted] = React.useState(false);
  const [manualResult, setManualResult] = React.useState(() => storedFinishedOutcome());
  const [membership, setMembership] = React.useState(null);
  const [moderationStatus, setModerationStatus] = React.useState(null);
  const [notificationCount, setNotificationCount] = React.useState(0);
  const previousNotificationCountRef = React.useRef(0);
  const [hintMove, setHintMove] = React.useState(null);
  const [premoveQueue, setPremoveQueue] = React.useState([]);
  const [suggestionMove, setSuggestionMove] = React.useState(null);
  const [threatMove, setThreatMove] = React.useState(null);
  const [botOptions, setBotOptions] = React.useState({
    botChat: true,
    evaluationBar: false,
    threatArrows: false,
    suggestionArrows: false,
    moveFeedback: false,
    engine: true
  });
  const [isAiThinking, setIsAiThinking] = React.useState(false);
  const [engineError, setEngineError] = React.useState('');
  const [coachAudioEnabled, setCoachAudioEnabled] = React.useState(true);
  const [customBots, setCustomBots] = React.useState([]);
  const [showHints, setShowHints] = React.useState(true);
  const [dragEnabled, setDragEnabled] = React.useState(true);
  const [promotionRequest, setPromotionRequest] = React.useState(null);
  const [resultDismissed, setResultDismissed] = React.useState(false);
  const [appSettling, setAppSettling] = React.useState(false);
  const [isOffline, setIsOffline] = React.useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [academicNoticeOpen, setAcademicNoticeOpen] = React.useState(false);
  const {
    userName,
    authMode,
    setAuthMode,
    authUser,
    authReady,
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
  } = useThemeSettings(authUser);
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
  const { ensureAudioContext, playMoveSound, playUiSound, speakCoachText, stopSpeech } = useGameAudio({ pieceSet, theme });

  React.useEffect(() => {
    if (authUser && ['login', 'register', 'forgotPassword'].includes(route)) {
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
    } else if (
      authMode
      && route !== 'login'
      && route !== 'register'
      && route !== 'forgotPassword'
      && route !== 'admin'
      && route !== 'academicNotice'
      && !(route === 'profile' && window.location.pathname.startsWith('/profile/'))
    ) {
      navigate(authMode === 'register' ? 'register' : authMode === 'forgot' ? 'forgotPassword' : 'login');
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
    setAppSettling(true);
    const timer = window.setTimeout(() => setAppSettling(false), 420);
    return () => window.clearTimeout(timer);
  }, [authUser, authMode, route]);

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
    const checkModeration = async () => {
      try {
        const nextModeration = await fetchModerationStatus();
        if (cancelled) return;
        setModerationStatus(nextModeration);
        if (nextModeration?.banned) {
          notify(nextModeration.ban?.reason || 'Tài khoản của bạn đã bị cấm.', 'error');
          await logout();
          navigate('home');
        }
      } catch (error) {
        if (cancelled) return;
        if (/ban|banned|cấm|hạn chế|restricted/i.test(error.message || '')) {
          notify(error.message || 'Tài khoản của bạn đã bị cấm.', 'error');
          await logout();
          navigate('home');
        }
      }
    };
    const timer = window.setInterval(checkModeration, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authUser, logout, navigate]);

  React.useEffect(() => {
    if (!authUser) return undefined;
    let cancelled = false;
    const loadNotificationCount = () => {
      fetchNotifications({ page: 1, limit: 5 })
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
        })
        .catch(() => {
          if (!cancelled) setNotificationCount(0);
        });
    };
    loadNotificationCount();
    const timer = window.setInterval(loadNotificationCount, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authUser]);

  const isActiveGameRoute = isGameRoute(route);
  const isActiveOnlineRoute = route === 'online';
  const isActivePuzzleRoute = isPuzzleRoute(route);
  const isPublicProfileRoute = route === 'profile' && window.location.pathname.startsWith('/profile/');
  const isPublicInfoRoute = route === 'academicNotice';
  const game = gameState.chess;
  const history = gameState.moves;
  const gameFen = game.fen();
  const userId = safeUserId(userName);
  const aiLevel = AI_LEVELS.find((level) => level.elo === Number(aiElo)) ?? AI_LEVELS[2];
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
    reviewStep
  } = useGameReview({ game, history, initialFen, gameVariant, isCoachGame, coachMode });
  const displayGame = reviewMode ? replayGameAt(history, reviewPly, initialFen) : game;
  const displayHistory = displayGame.history({ verbose: true });
  const timeOutcome = timeWinner
    ? {
        type: timeWinner === playerColor ? 'win' : 'loss',
        title: timeWinner === playerColor ? 'You won on time' : 'You lost on time',
        detail: `${timeWinner === 'w' ? 'White' : 'Black'} wins because the opponent ran out of time`
      }
    : null;
  const outcome = manualResult ?? timeOutcome ?? gameOutcome(game, playerColor);
  const gameFinished = Boolean(outcome);
  const showResultDialog = gameFinished && isActiveGameRoute && !isActiveOnlineRoute;
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
  const activeBotPersona = botPersonas.reduce((closest, persona) => (
    Math.abs(persona.elo - Number(aiElo)) < Math.abs(closest.elo - Number(aiElo)) ? persona : closest
  ), botPersonas[0] || BOT_PERSONAS[0]);
  const aiDisplayName = `${activeBotPersona.name} (${aiLevel.elo})`;
  const latestPlayerMoveIndex = history.reduce((foundIndex, move, index) => (
    move.color === playerColor ? index : foundIndex
  ), -1);
  const latestCoachMove = latestPlayerMoveIndex >= 0 ? history[latestPlayerMoveIndex] : null;
  const latestCoachAnalysis = latestPlayerMoveIndex >= 0 ? stockfishReview[latestPlayerMoveIndex] : null;
  const liveCoachBadge = isCoachGame && latestCoachMove
    ? (latestCoachAnalysis ?? { tone: 'loading', label: 'Analyzing' })
    : null;
  const coachInsight = buildCoachInsight({
    analysis: latestCoachAnalysis,
    latestMove: latestCoachMove,
    historyLength: latestPlayerMoveIndex >= 0 ? latestPlayerMoveIndex + 1 : history.length,
    playerColor,
    aiElo,
    coachMode
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
    coachSpeechText: coachAudioEnabled ? coachVoiceText : '',
    latestAnalyzedPlayerMoveIndex: latestPlayerMoveIndex,
    speakCoachText,
    botOptions,
    stockfishReview
  });
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
    clockRunning: route !== 'local' && (gameMode === 'local' || botGameStarted || isCoachGame),
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
    if (gameFinished || game.turn() !== aiColor || isAiThinking || !usesAiOpponent) return;

    let cancelled = false;
    setSelected(null);
    setLegalTargets([]);
    setIsAiThinking(true);

    const fen = game.fen();
    aiTimerRef.current = window.setTimeout(async () => {
      const legalMoves = game.moves({ verbose: true });
      let move = null;

      try {
        const engineMove = await requestStockfishMove(fen, aiLevel.elo, {
          moves: history.map((item) => `${item.from}${item.to}${item.promotion ?? ''}`),
          variant: gameVariant
        });
        move = legalMoves.find((legalMove) => legalMove.from === engineMove.from
          && legalMove.to === engineMove.to
          && (legalMove.promotion ?? '') === (engineMove.promotion ?? '')) ?? null;
        if (!move) throw new Error('Stockfish returned an illegal move.');
        setEngineError('');
      } catch {
        setEngineError('Stockfish unavailable. The bot will not use a weaker fallback move.');
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
      if (aiTimerRef.current) {
        window.clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }
    };
 
  }, [aiColor, aiLevel, game, gameFinished, gameVariant, history, initialFen, usesAiOpponent]);

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
    nextTimeControl = timeControl,
    nextBotGameStarted = false,
    nextVariant = gameVariant,
    nextInitialFen = undefined,
    nextPlayerColor = undefined,
    nextCoachLesson = null
  } = {}) => {
    window.sessionStorage.removeItem(FINISHED_GAME_KEY);
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
    resetBotAssistance((botPersonas.find((persona) => persona.elo === Number(nextAiElo)) ?? activeBotPersona).chat);

    try {
      const response = await fetch(apiUrl('/api/game/new'), {
        method: 'POST'
      });
      const data = await response.json();
      setGameId(data.id ?? 'local');
      setApiOnline(response.ok);
    } catch {
      setGameId('local');
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

  const resetCoachMatch = ({
    nextCoachMode = coachMode,
    nextAiElo = aiElo,
    nextTimeControl = timeControl,
    nextLesson = coachLessonFromMode(nextCoachMode)
  } = {}) => {
    const nextBehavior = coachBehaviorFromMode(nextCoachMode);
    setBotOptions((current) => ({
      ...current,
      botChat: false,
      moveFeedback: nextBehavior.moveFeedback,
      suggestionArrows: nextBehavior.suggestionArrows,
      threatArrows: nextBehavior.threatArrows
    }));
    startNewGame({
      nextSideChoice: nextLesson.playerColor,
      nextAiElo,
      nextTimeControl,
      nextBotGameStarted: true,
      nextVariant: nextLesson.variant,
      nextInitialFen: nextLesson.fen,
      nextPlayerColor: nextLesson.playerColor,
      nextCoachLesson: nextLesson
    });
  };

  const resignGame = () => {
    setManualResult({
      type: 'loss',
      title: `${activeBotPersona.name} thắng`,
      detail: 'bằng đầu hàng'
    });
    setResultDismissed(false);
  };

  const showHintMove = async () => {
    if (reviewMode || gameFinished || isAiThinking) return;
    try {
      const suggestedMove = suggestionMove ?? await requestStockfishMove(game.fen(), aiLevel.elo, {
        moves: history.map((item) => `${item.from}${item.to}${item.promotion ?? ''}`),
        variant: gameVariant,
        fullStrength: true
      });
      const legalMove = game.moves({ verbose: true }).some((move) => (
        move.from === suggestedMove.from
        && move.to === suggestedMove.to
        && (move.promotion ?? '') === (suggestedMove.promotion ?? '')
      ));
      if (!legalMove) throw new Error('Stockfish returned an illegal hint.');
      setHintMove({ from: suggestedMove.from, to: suggestedMove.to });
      setEngineError('');
    } catch {
      setEngineError('Stockfish unavailable. No hint was generated.');
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

  const changeAiElo = (elo) => {
    if (isCoachGame) {
      resetCoachMatch({ nextAiElo: Number(elo), nextLesson: coachLesson });
      return;
    }
    playUiSound('tap');
    startNewGame({ nextSideChoice: sideChoice, nextAiElo: Number(elo) });
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

    setReviewMode(true);
    setReviewStarted(true);
    setReviewPly(history.length);
    queueMissingReviewAnalysis();
    setResultDismissed(true);
    setIsAiThinking(false);
    navigate('review');
  };

  const whiteName = playerColor === 'w' ? userName : aiDisplayName;
  const blackName = playerColor === 'b' ? userName : aiDisplayName;
  const whiteAvatarURL = playerColor === 'w' ? authUser?.photoURL : null;
  const blackAvatarURL = playerColor === 'b' ? authUser?.photoURL : null;
  const aiCoachContext = React.useMemo(() => {
    const hasBoardContext = (isActiveGameRoute && !isActiveOnlineRoute) || route === 'review';
    const safeGame = reviewMode ? displayGame : game;
    const latestMove = history.at(-1);
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
  }, [currentReviewAnalysis, displayGame, game, gameMode, history, isActiveGameRoute, isActiveOnlineRoute, latestCoachAnalysis, playerColor, reviewMode, route]);

  if (route === 'admin') {
    return (
      <React.Suspense fallback={<RouteLoading label="Đang mở bảng quản trị..." />}>
        <ToastHost />
        <OfflineOverlay visible={isOffline} />
        <AdminPage />
      </React.Suspense>
    );
  }

  if (!authReady) {
    return <RouteLoading label="Đang kiểm tra phiên đăng nhập..." />;
  }

  return (
    <main className="app-shell" style={themeStyle} data-color-scheme={colorScheme}>
      <ToastHost />
      <OfflineOverlay visible={isOffline} />
      <ModerationBanner status={moderationStatus} />
      <AcademicNoticeModal
        visible={academicNoticeOpen}
        authUser={authUser}
        onClose={() => setAcademicNoticeOpen(false)}
        onOpenPage={() => {
          setAcademicNoticeOpen(false);
          navigate('academicNotice');
        }}
      />
      {appSettling && <RouteLoading label={authBusy ? 'Đang xác thực tài khoản...' : 'Đang chuyển trang...'} />}
      {promotionRequest && <button className="promotion-cancel-layer" aria-label="Cancel promotion" onClick={cancelPromotion} tabIndex={-1} />}
      <Sidebar
        authUser={authUser}
        userName={userName}
        activeRoute={route}
        membership={membership}
        notificationCount={notificationCount}
        mobileOpen={mobileSidebarOpen}
        onToggleMobile={() => setMobileSidebarOpen((open) => !open)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onSelectPlayMode={(mode) => {
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
          if (nextRoute !== 'coach' && isGameRoute(nextRoute) && (route === 'review' || game.isGameOver() || manualResult || timeWinner)) {
            startNewGame({ nextBotGameStarted: false });
          }
          navigate(nextRoute);
        }}
        onLogin={() => openAuth('login')}
        onRegister={() => openAuth('register')}
        onLogout={logout}
      />

      <section className={`content-shell ${route === 'review' ? 'review-route-shell' : ''} ${route === 'home' ? 'home-route-shell' : ''} ${isActiveGameRoute && !isActiveOnlineRoute && route !== 'local' ? 'game-route-shell' : ''} ${route === 'local' ? 'local-route-shell' : ''} ${isActiveOnlineRoute || route === 'onlineReview' ? 'online-route-shell' : ''} ${isActivePuzzleRoute ? 'puzzle-route-shell' : ''}`}>
        <TopHeader
          activeRoute={route === 'onlineReview' ? 'history' : route}
          apiOnline={apiOnline}
          settingsOpen={settingsOpen}
          theme={theme}
          appearance={appearance}
          pieceSet={pieceSet}
          authUser={authUser}
          notificationCount={notificationCount}
          onOpenAcademicNotice={() => setAcademicNoticeOpen(true)}
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

        {route !== 'login' && route !== 'register' && route !== 'forgotPassword' && (!authMode || authUser || isPublicProfileRoute || isPublicInfoRoute) && (
        <React.Suspense fallback={<RouteLoading />}>
        {route === 'home' && (
          <HomePage
            userName={userName}
            history={history}
            reviewStats={reviewStats}
            timeControl={timeControl}
            onStartNewGame={startNewGame}
            onNavigate={navigate}
            onReviewGame={reviewGame}
          />
        )}

        {route === 'review' && (
          <ReviewPage
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
              window.history.pushState(null, '', `/history/review/${encodeURIComponent(onlineGameId)}`);
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

        {route === 'tournaments' && (
          <TournamentsPage
            authUser={authUser}
            onLogin={() => openAuth('login')}
            onNavigate={navigate}
          />
        )}

        {route === 'support' && (
          <SupportPage
            authUser={authUser}
            onLogin={() => openAuth('login')}
            onNavigate={navigate}
          />
        )}

        {route === 'supportTickets' && (
          <SupportTicketsPage
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
              historyOnly
              historyReviewGameId={decodeURIComponent(window.location.pathname.split('/').filter(Boolean).at(-1) || '')}
            />
          </>
        )}

        {isActiveOnlineRoute && (
          <>
            <OnlinePage authUser={authUser} userName={userName} pieceSet={pieceSet} theme={theme} membership={membership} onLogin={() => openAuth('login')} onNavigate={navigate} />
          </>
        )}

        {isActivePuzzleRoute && (
          <>
            <PuzzlePage activeRoute={route} pieceSet={pieceSet} membership={membership} authUser={authUser} onNavigate={navigate} />
          </>
        )}

        {route !== 'home' && route !== 'profile' && route !== 'friends' && route !== 'notifications' && route !== 'history' && route !== 'leaderboard' && route !== 'achievements' && route !== 'tournaments' && route !== 'support' && route !== 'supportTickets' && route !== 'coachLab' && route !== 'beginnerGuide' && route !== 'membership' && route !== 'academicNotice' && route !== 'local' && route !== 'notFound' && route !== 'onlineReview' && !isActivePuzzleRoute && !isActiveOnlineRoute && (
        <>
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
            promotionPopoverStyle={promotionPopoverStyle}
            onSelectSquare={selectSquare}
            onHandleDrop={handleDrop}
            onHandleDragStart={handleDragStart}
            onCancelPromotion={cancelPromotion}
            onPlayMove={playMove}
          />

          <MatchPanel
            botGameStarted={botGameStarted}
            isCoachGame={isCoachGame}
            coachSpeechText={coachSpeechText}
            coachInsight={coachInsight}
            aiElo={aiElo}
            aiLevel={aiLevel}
            activeBotPersona={activeBotPersona}
            botPersonas={botPersonas}
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
            onStartBotMatch={startBotMatch}
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
        </section>
        </>
        )}
        </React.Suspense>
        )}
      </section>

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
          reviewStats={reviewStats}
          onReviewGame={reviewGame}
          onNewBot={() => {
            setResultDismissed(true);
            setBotGameStarted(false);
            startNewGame();
          }}
          onRematch={() => {
            setResultDismissed(true);
            startBotMatch();
          }}
        />
      )}
    </main>
  );
}
