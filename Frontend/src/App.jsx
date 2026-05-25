import React from 'react';
import {
  Bell,
  Bot,
  Flag,
  Flame,
  Gamepad2,
  GraduationCap,
  Puzzle,
  RotateCcw,
  Search,
  Settings,
  Shield,
  SkipBack,
  Star,
  Swords,
  Timer,
  Trophy,
  Users,
  Wifi,
  WifiOff
} from 'lucide-react';
import './styles.css';
import {
  auth,
  getAdditionalUserInfo,
  githubProvider,
  googleProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from './firebase';
import { PIECE_IMAGES } from './game/pieces';
import {
  AI_LEVELS,
  BOARD_PRESETS,
  DEFAULT_THEME,
  PIECE_NAMES,
  PIECE_SETS,
  PROMOTION_PIECES,
  TIME_CONTROLS
} from './game/constants';
import {
  buildMoveLog,
  createGameState,
  generateChess960Fen,
  gameOutcome,
  newLocalGameId,
  replayGameAt,
  resolvePlayerColor,
  safeUserId,
  squareName,
  statusText
} from './game/chessLogic';
import AuthPage from './components/AuthPage';
import PlayerCard from './components/PlayerCard';
import Sidebar from './components/Sidebar';

const REMEMBER_ACCOUNT_KEY = 'chess-arena-remembered-account';
const DEVICE_ID_KEY = 'chess-arena-device-id';
const THEME_STORAGE_KEY = 'chess-arena-theme';
const REMEMBER_WINDOW_MS = 48 * 60 * 60 * 1000;
const DEFAULT_TIME_CONTROL = TIME_CONTROLS[3];
const MATERIAL_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const REVIEW_LEGEND = [
  { tone: 'brilliant', icon: '!!', label: 'Brilliant', detail: 'Nước xuất sắc hiếm gặp' },
  { tone: 'great', icon: '!', label: 'Great', detail: 'Nước rất mạnh' },
  { tone: 'book', icon: '📖', label: 'Book', detail: 'Nước khai cuộc lý thuyết' },
  { tone: 'best', icon: '★', label: 'Best', detail: 'Nước tốt nhất hoặc gần như tốt nhất' },
  { tone: 'excellent', icon: '👍', label: 'Excellent', detail: 'Rất mạnh, mất rất ít lợi thế' },
  { tone: 'good', icon: '✓', label: 'Good', detail: 'Chơi ổn, vẫn giữ thế trận' },
  { tone: 'inaccuracy', icon: '?!', label: 'Inaccuracy', detail: 'Chưa chính xác, mất một phần lợi thế' },
  { tone: 'mistake', icon: '?', label: 'Mistake', detail: 'Sai lầm rõ ràng' },
  { tone: 'miss', icon: '✕', label: 'Miss', detail: 'Bỏ lỡ cơ hội lớn' },
  { tone: 'blunder', icon: '??', label: 'Blunder', detail: 'Nước đi làm hỏng thế trận nghiêm trọng' }
];
const REVIEW_ICON_BY_TONE = {
  brilliant: '!!',
  great: '!',
  book: 'B',
  best: '★',
  excellent: '↑',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  miss: '×',
  blunder: '??',
  loading: '...'
};
const HOME_IMAGES = {
  hero: chessBoardImage('hero'),
  puzzle: chessBoardImage('puzzle'),
  lesson: chessBoardImage('lesson'),
  review: chessBoardImage('review')
};
function animalAvatar(emoji, background) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <radialGradient id="glow" cx="34%" cy="24%" r="78%">
          <stop offset="0" stop-color="#fff" stop-opacity=".75"/>
          <stop offset=".45" stop-color="${background}"/>
          <stop offset="1" stop-color="#111814"/>
        </radialGradient>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity=".28"/>
        </filter>
      </defs>
      <rect width="96" height="96" rx="18" fill="url(#glow)"/>
      <circle cx="72" cy="20" r="11" fill="#a7c957" opacity=".9"/>
      <circle cx="24" cy="74" r="14" fill="#ffffff" opacity=".18"/>
      <text x="48" y="66" text-anchor="middle" font-size="52" font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif" filter="url(#shadow)">${emoji}</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const BOT_PERSONAS = [
  { elo: 800, avatar: animalAvatar('🐼', '#ffd6df'), name: 'Panda Pipo', mood: 'Dễ thương, hay đi nước an toàn', chat: 'Tớ là Pipo. Đánh nhẹ tay thôi nha, tớ còn đang ôm tre tính biến.' },
  { elo: 1200, avatar: animalAvatar('🦊', '#ffd0a6'), name: 'Fox Rooko', mood: 'Lanh lợi, thích gài mẹo nhỏ', chat: 'Rooko vào bàn rồi. Cẩn thận, cáo không chỉ biết chạy đâu.' },
  { elo: 1600, avatar: animalAvatar('🐱', '#bfe7ff'), name: 'Mèo Nova', mood: 'Tinh nghịch, thích bẫy chiến thuật', chat: 'Meo, nước đầu tiên của bạn làm tớ tỉnh ngủ rồi đó.' },
  { elo: 2000, avatar: animalAvatar('🐰', '#dbc7ff'), name: 'Bunny Aya', mood: 'Nhanh nhẹn, tấn công sắc bén', chat: 'Aya nhảy vào trung tâm đây. Đừng để tớ nhảy luôn vào hậu nhé.' },
  { elo: 2400, avatar: animalAvatar('🦉', '#d8ddff'), name: 'Owl Sage', mood: 'Bình tĩnh, phòng thủ rất chắc', chat: 'Cú Sage đã mở mắt. Giờ thì mỗi nước đều bị soi dưới ánh trăng.' }
];
const BOT_CHAT_LINES = {
  opening: [
    'Mở màn gọn gàng nhé, tớ đang canh trung tâm như canh nồi súp.',
    'Ván này có mùi thú vị rồi đó, chưa biết mùi chiến thuật hay mùi nguy hiểm.',
    'Để xem bạn chọn kế hoạch gì nào, tớ đã chuẩn bị kính lúp rồi.',
    'Khai cuộc này ổn áp đó, tớ tạm chưa cà khịa.'
  ],
  playerMove: [
    'Nước mới rồi, để tớ tính lại, não nhỏ nhưng tham vọng lớn.',
    'Bạn đổi hướng kế hoạch à? Nghe có vẻ nguy hiểm, tớ thích.',
    'Tớ thấy ý tưởng rồi, nhưng tớ cũng thấy vài khe cửa hé hé nha.',
    'Nước này làm bàn cờ vui hơn hẳn, đỡ buồn ngủ rồi.',
    'Ổn đó, cứ giữ nhịp này là tớ phải nghiêm túc lên thật.'
  ],
  botMove: [
    'Tới lượt tớ đáp lễ nhẹ, không đau lắm đâu... chắc vậy.',
    'Tớ đi nước này để giữ áp lực, kiểu đặt deadline lên vua bạn.',
    'Nước này không màu mè, nhưng khá khó chịu đó nha.',
    'Tớ vừa đặt thêm một câu hỏi. Trả lời sai là mất quân đó.',
    'Thử xử lý thế này xem nào, bài kiểm tra nhỏ thôi.'
  ],
  brilliant: [
    'Đỉnh thật, nước đó sáng tới mức tớ phải đeo kính râm!',
    'Ồ, nước này đáng khen. Tớ không ngờ bạn thấy nhanh vậy.',
    'Hay quá, đúng kiểu chiến thuật đẹp, tớ hơi quê rồi nha.'
  ],
  great: [
    'Nước rất mạnh, tớ phải ngồi thẳng lưng rồi.',
    'Bạn vừa tìm được nước đáng gờm đấy, hơi căng cho tớ nha.',
    'Tốt lắm, nước này tạo áp lực rõ ràng, vua tớ bắt đầu nhìn quanh.'
  ],
  best: [
    'Chuẩn bài. Nước này sạch như bàn cờ vừa lau.',
    'Chính xác, bạn chọn đúng hướng rồi, tớ chưa bắt bẻ được.',
    'Không có gì để chê, tớ ghét phải công nhận nhưng nước này hay.'
  ],
  excellent: [
    'Rất ổn, bạn đang giữ thế cờ chắc như đóng cửa trước giờ mưa.',
    'Nước này đẹp và thực dụng, không cần màu mè vẫn hiệu quả.',
    'Tớ thích cách bạn cải thiện quân, nhìn có nghề đó.'
  ],
  good: [
    'Nước ổn, thế trận vẫn còn đủ drama để chơi tiếp.',
    'Không tệ, bạn vẫn giữ được nhịp, tớ chưa có quà miễn phí.',
    'Nước bình tĩnh, tớ chưa bắt lỗi được nhiều đâu.'
  ],
  inaccuracy: [
    'Hơi lệch một chút, nhưng chưa rơi xuống vực đâu.',
    'Nước này chưa tối ưu, nhưng ván cờ vẫn còn đường sửa sai.',
    'Bạn vừa để rơi chút lợi thế, nhặt lại nhanh còn kịp.'
  ],
  mistake: [
    'Ui, nước đó cho tớ chút cơ hội rồi nha, cảm ơn trước nhé.',
    'Cẩn thận, tớ bắt đầu ngửi thấy chiến thuật rồi đó.',
    'Nước này hơi mạo hiểm, tớ sẽ thử khai thác, không hứa nhẹ tay.'
  ],
  miss: [
    'Bạn vừa bỏ lỡ một cơ hội khá ngon đó, miếng bánh bay qua rồi.',
    'Có một nước sắc hơn ở đây, tiếc ghê, tớ vừa thở phào.',
    'Tớ thoát được một phen rồi nha, tim bot cũng biết đập đó.'
  ],
  blunder: [
    'Ôi không, quà này tớ nhận nhé! Gói đẹp quá khó từ chối.',
    'Nước này đau đấy, nhưng đừng bỏ cuộc, comeback vẫn là đặc sản.',
    'Tớ thấy cơ hội lớn rồi, giữ bình tĩnh nào, đừng spam chuột cứu thế.'
  ]
};

function reviewIcon(tone) {
  return REVIEW_ICON_BY_TONE[tone] ?? '✓';
}

function chessBoardImage(type) {
  const setups = {
    hero: { dark: '#789a5f', light: '#f0ead2', accent: '#a7c957', pieces: { 4: '♚', 11: '♛', 18: '♞', 28: '♙', 35: '♗', 44: '♖', 52: '♔', 59: '♕' } },
    puzzle: { dark: '#6c8058', light: '#e9dfc2', accent: '#ffcf5b', pieces: { 2: '♜', 10: '♟', 20: '♔', 27: '♛', 36: '♘', 43: '♙', 54: '♖', 61: '♚' } },
    lesson: { dark: '#607a66', light: '#e7eadb', accent: '#79d2ff', pieces: { 3: '♛', 12: '♞', 25: '♙', 34: '♗', 42: '♘', 51: '♔', 60: '♜' } },
    review: { dark: '#876447', light: '#d7b98c', accent: '#8ee28f', pieces: { 6: '♚', 14: '♟', 23: '♕', 30: '♖', 37: '♘', 45: '♙', 54: '♔' } }
  };
  const config = setups[type] ?? setups.hero;
  const squares = Array.from({ length: 64 }).map((_, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    const fill = (row + col) % 2 === 0 ? config.light : config.dark;
    const piece = config.pieces[index];
    return `
      <rect x="${col * 80}" y="${row * 80}" width="80" height="80" fill="${fill}" />
      ${piece ? `<text x="${col * 80 + 40}" y="${row * 80 + 55}" text-anchor="middle" font-size="54" font-family="Segoe UI" fill="${piece.charCodeAt(0) > 9817 ? '#151711' : '#f8f6ea'}" filter="url(#shadow)">${piece}</text>` : ''}
    `;
  }).join('');
  const marks = type === 'hero'
    ? '<rect x="320" y="320" width="80" height="80" fill="#a7c957" opacity=".34"/><path d="M360 570 L360 360" stroke="#a7c957" stroke-width="26" stroke-linecap="round" opacity=".78" marker-end="url(#arrow)"/>'
    : type === 'review'
      ? '<circle cx="280" cy="360" r="26" fill="#8ee28f" opacity=".86"/><path d="280 520 L360 360" stroke="#8ee28f" stroke-width="20" stroke-linecap="round" opacity=".75" marker-end="url(#arrow)"/>'
      : '<circle cx="360" cy="280" r="25" fill="#ffcf5b" opacity=".78"/><circle cx="440" cy="360" r="25" fill="#ffcf5b" opacity=".46"/>';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
      <defs>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="3" flood-color="#000" flood-opacity=".32"/>
        </filter>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="${config.accent}"/>
        </marker>
      </defs>
      <rect width="640" height="640" fill="#121711"/>
      ${squares}
      ${marks}
      <rect x="0" y="0" width="640" height="640" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="18"/>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function routeFromLocation() {
  if (window.location.pathname === '/review') return 'review';
  if (window.location.pathname === '/game') return 'game';
  return 'home';
}

function getDeviceId() {
  const storedId = window.localStorage.getItem(DEVICE_ID_KEY);
  if (storedId) return storedId;

  const nextId = window.crypto?.randomUUID?.() ?? `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(DEVICE_ID_KEY, nextId);
  return nextId;
}

function getRememberedAccount() {
  try {
    const remembered = JSON.parse(window.localStorage.getItem(REMEMBER_ACCOUNT_KEY) || 'null');
    if (!remembered?.email || remembered.deviceId !== getDeviceId()) return null;
    return remembered;
  } catch {
    return null;
  }
}

function saveRememberedAccount(email) {
  window.localStorage.setItem(
    REMEMBER_ACCOUNT_KEY,
    JSON.stringify({
      email,
      deviceId: getDeviceId(),
      lastSeenAt: Date.now()
    })
  );
}

function displayNameFromUser(user, fallback = 'Player') {
  const rawName = String(user?.displayName || user?.githubLogin || user?.githubName || '').trim();
  if (rawName && !rawName.includes('@')) return rawName;

  const emailName = user?.email ? String(user.email).split('@')[0] : '';
  return String(emailName || fallback).trim();
}

async function requestStockfishMove(fen, elo, timeoutMs = 1400) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/analysis/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, elo }),
    signal: controller.signal
  }).finally(() => window.clearTimeout(timeout));
  const data = await response.json();

  if (!response.ok || !data?.move) {
    throw new Error(data?.error || 'Stockfish move request failed.');
  }

  return data.move;
}

function chooseFastLiveMove(legalMoves) {
  if (!legalMoves.length) return null;

  const scoredMoves = legalMoves.map((move) => {
    const captureScore = move.captured ? (MATERIAL_VALUES[move.captured] ?? 0) * 10 : 0;
    const promotionScore = move.promotion ? (MATERIAL_VALUES[move.promotion] ?? 0) * 12 : 0;
    const checkScore = move.san?.includes('#') ? 1000 : move.san?.includes('+') ? 24 : 0;
    const centerScore = ['d4', 'e4', 'd5', 'e5'].includes(move.to) ? 6 : 0;

    return {
      move,
      score: captureScore + promotionScore + checkScore + centerScore + Math.random()
    };
  });

  scoredMoves.sort((a, b) => b.score - a.score);
  return scoredMoves[0].move;
}

function themeStorageKey(userId) {
  return userId ? `${THEME_STORAGE_KEY}-${safeUserId(userId)}` : THEME_STORAGE_KEY;
}

function loadStoredTheme(userId = null) {
  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey(userId));
    return storedTheme ? { ...DEFAULT_THEME, ...JSON.parse(storedTheme) } : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function formatClock(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function moveToLan(move) {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

function squareCenter(square, flipped) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank - 1 : 8 - rank;

  return {
    x: col * 12.5 + 6.25,
    y: row * 12.5 + 6.25
  };
}

function squareTopLeft(square, flipped) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank - 1 : 8 - rank;

  return {
    x: `${col * 12.5}%`,
    y: `${row * 12.5}%`
  };
}

function promotionPopoverStyle(square, color, flipped) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank - 1 : 8 - rank;
  const x = Math.max(22, Math.min(78, col * 12.5 + 6.25));
  const y = color === 'w'
    ? Math.min(86, (row + 1) * 12.5 + 1.2)
    : Math.max(14, row * 12.5 - 1.2);

  return {
    left: `${x}%`,
    top: `${y}%`
  };
}

function boardMaterialScore(chess) {
  return chess.board().flat().reduce((score, piece) => {
    if (!piece) return score;
    const value = MATERIAL_VALUES[piece.type] ?? 0;
    return score + (piece.color === 'w' ? value : -value);
  }, 0);
}

function capturedPoints(captures) {
  return captures.reduce((total, piece) => total + (MATERIAL_VALUES[piece.type] ?? 0), 0);
}

function engineBarPercent(whiteScore) {
  return Math.max(4, Math.min(96, 50 - Math.tanh((whiteScore || 0) / 650) * 44));
}

export default function App() {
  const [route, setRoute] = React.useState(() => routeFromLocation());
  const [gameState, setGameState] = React.useState(() => createGameState());
  const [selected, setSelected] = React.useState(null);
  const [legalTargets, setLegalTargets] = React.useState([]);
  const [flipped, setFlipped] = React.useState(false);
  const [apiOnline, setApiOnline] = React.useState(null);
  const [gameId, setGameId] = React.useState(() => newLocalGameId());
  const [lastMove, setLastMove] = React.useState(null);
  const [slidingMove, setSlidingMove] = React.useState(null);
  const [isMoveAnimating, setIsMoveAnimating] = React.useState(false);
  const [playerColor, setPlayerColor] = React.useState('w');
  const [sideChoice, setSideChoice] = React.useState('w');
  const [aiElo, setAiElo] = React.useState(1200);
  const [timeControlId, setTimeControlId] = React.useState(DEFAULT_TIME_CONTROL.id);
  const [clocks, setClocks] = React.useState(() => ({ w: DEFAULT_TIME_CONTROL.baseSeconds, b: DEFAULT_TIME_CONTROL.baseSeconds }));
  const [timeWinner, setTimeWinner] = React.useState(null);
  const [pieceSet, setPieceSet] = React.useState('classic');
  const [gameMode, setGameMode] = React.useState('bot');
  const [gameVariant, setGameVariant] = React.useState('standard');
  const [initialFen, setInitialFen] = React.useState(null);
  const [botGameStarted, setBotGameStarted] = React.useState(false);
  const [manualResult, setManualResult] = React.useState(null);
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
  const [showHints, setShowHints] = React.useState(true);
  const [dragEnabled, setDragEnabled] = React.useState(true);
  const [promotionRequest, setPromotionRequest] = React.useState(null);
  const [theme, setTheme] = React.useState(() => loadStoredTheme());
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [resultDismissed, setResultDismissed] = React.useState(false);
  const [reviewMode, setReviewMode] = React.useState(false);
  const [reviewPly, setReviewPly] = React.useState(0);
  const [stockfishReview, setStockfishReview] = React.useState([]);
  const [stockfishStatus, setStockfishStatus] = React.useState('idle');
  const [reviewStarted, setReviewStarted] = React.useState(false);
  const [pendingAnalysis, setPendingAnalysis] = React.useState([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [botChatLine, setBotChatLine] = React.useState(BOT_PERSONAS[1].chat);
  const [userName, setUserName] = React.useState('Player');
  const [authMode, setAuthMode] = React.useState('login');
  const [authUser, setAuthUser] = React.useState(null);
  const [otpState, setOtpState] = React.useState(null);
  const [otpNow, setOtpNow] = React.useState(Date.now());
  const [authForm, setAuthForm] = React.useState(() => {
    const remembered = getRememberedAccount();
    return { email: remembered?.email ?? '', password: '', displayName: '', remember: Boolean(remembered), otp: '', newPassword: '' };
  });
  const [authMessage, setAuthMessage] = React.useState('');
  const aiTimerRef = React.useRef(null);
  const themeSaveTimerRef = React.useRef(null);
  const slideTimerRef = React.useRef(null);
  const botChatHistoryRef = React.useRef([]);
  const botFeedbackPlyRef = React.useRef(0);
  const savedServerLogRef = React.useRef(null);
  const premoveRef = React.useRef([]);

  const game = gameState.chess;
  const history = gameState.moves;
  const gameFen = game.fen();
  const userId = safeUserId(userName);
  const displayGame = reviewMode ? replayGameAt(history, reviewPly, initialFen) : game;
  const displayHistory = displayGame.history({ verbose: true });
  const aiLevel = AI_LEVELS.find((level) => level.elo === Number(aiElo)) ?? AI_LEVELS[2];
  const timeControl = TIME_CONTROLS.find((control) => control.id === timeControlId) ?? DEFAULT_TIME_CONTROL;
  const aiColor = playerColor === 'w' ? 'b' : 'w';
  const isPlayerTurn = gameMode === 'local' || game.turn() === playerColor;
  const timeOutcome = timeWinner
    ? {
        type: timeWinner === playerColor ? 'win' : 'loss',
        title: timeWinner === playerColor ? 'You won on time' : 'You lost on time',
        detail: `${timeWinner === 'w' ? 'White' : 'Black'} wins because the opponent ran out of time`
      }
    : null;
  const outcome = manualResult ?? timeOutcome ?? gameOutcome(game, playerColor);
  const showResultDialog = outcome && !resultDismissed;
  const themeStyle = {
    '--accent': theme.accent,
    '--light-square': theme.lightSquare,
    '--dark-square': theme.darkSquare,
    '--surface': theme.surface,
    '--page': theme.page
  };
  const capturedWhite = displayHistory
    .filter((move) => move.captured && move.color === 'w')
    .map((move) => ({ type: move.captured, src: PIECE_IMAGES[`b${move.captured}`], alt: `Captured black ${move.captured}` }));
  const capturedBlack = displayHistory
    .filter((move) => move.captured && move.color === 'b')
    .map((move) => ({ type: move.captured, src: PIECE_IMAGES[`w${move.captured}`], alt: `Captured white ${move.captured}` }));
  const whiteCapturePoints = capturedPoints(capturedWhite);
  const blackCapturePoints = capturedPoints(capturedBlack);
  const materialScore = boardMaterialScore(displayGame);
  const latestEngineScore = [...stockfishReview].reverse().find(Boolean)?.whiteScore;
  const currentReviewAnalysis = reviewMode ? stockfishReview[reviewPly - 1] : null;
  const reviewEngineScore = currentReviewAnalysis?.whiteScore;
  const advantagePercent = Number.isFinite(reviewEngineScore)
    ? engineBarPercent(reviewEngineScore)
    : Number.isFinite(latestEngineScore)
      ? engineBarPercent(latestEngineScore)
      : Math.max(6, Math.min(94, 50 - materialScore * 3.2));
  const reviewBadge = currentReviewAnalysis ?? (reviewMode && reviewPly > 0 ? { label: 'Analyzing', tone: 'loading' } : null);
  const pendingAnalysisKey = pendingAnalysis.map((item) => item.ply).join(',');
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
  const hasPremove = premoveQueue.length > 0;
  const activeBotPersona = BOT_PERSONAS.reduce((closest, persona) => (
    Math.abs(persona.elo - Number(aiElo)) < Math.abs(closest.elo - Number(aiElo)) ? persona : closest
  ), BOT_PERSONAS[0]);
  const aiDisplayName = `${activeBotPersona.name} (${aiLevel.elo})`;
  const latestMoveAnalysis = stockfishReview[history.length - 1];
  const latestMove = history.at(-1);
  const botChatText = !botOptions.botChat
    ? ''
    : isAiThinking
      ? `${activeBotPersona.name} đang tính nước...`
      : botChatLine;
  const otpSecondsLeft = otpState?.expiresAt
    ? Math.max(0, Math.ceil((new Date(otpState.expiresAt).getTime() - otpNow) / 1000))
    : 0;

  const outcomeResult = outcome
    ? outcome.type === 'draw'
      ? '1/2-1/2'
      : outcome.type === 'win'
        ? playerColor === 'w' ? '1-0' : '0-1'
        : playerColor === 'w' ? '0-1' : '1-0'
    : null;

  React.useEffect(() => {
    const onPopState = () => setRoute(routeFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (nextRoute) => {
    const path = nextRoute === 'review' ? '/review' : nextRoute === 'game' ? '/game' : '/';
    window.history.pushState(null, '', path);
    setRoute(nextRoute);
    setMobileSidebarOpen(false);
  };

  const sayBotLine = React.useCallback((group = 'playerMove') => {
    const lines = BOT_CHAT_LINES[group] ?? BOT_CHAT_LINES.playerMove;
    const recent = botChatHistoryRef.current.slice(-2);
    const candidates = lines.filter((line) => !recent.includes(line));
    const pool = candidates.length ? candidates : lines;
    const nextLine = pool[Math.floor(Math.random() * pool.length)] ?? activeBotPersona.chat;

    botChatHistoryRef.current = [...botChatHistoryRef.current, nextLine].slice(-4);
    setBotChatLine(nextLine);
  }, [activeBotPersona.chat]);

  React.useEffect(() => {
    botChatHistoryRef.current = [];
    setBotChatLine(activeBotPersona.chat);
  }, [activeBotPersona.chat]);

  React.useEffect(() => {
    premoveRef.current = premoveQueue;
  }, [premoveQueue]);

  React.useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
    const remembered = getRememberedAccount();

    if (remembered && Date.now() - remembered.lastSeenAt > REMEMBER_WINDOW_MS) {
      window.localStorage.removeItem(REMEMBER_ACCOUNT_KEY);
      fetch(`${apiUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
      setAuthForm((form) => ({ ...form, remember: false }));
    }

    fetch(`${apiUrl}/api/health`)
      .then((response) => setApiOnline(response.ok))
      .catch(() => setApiOnline(false));

    fetch(`${apiUrl}/api/auth/me`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.user) return;
        setAuthUser(data.user);
        setUserName(displayNameFromUser(data.user));
        setAuthMode(null);
        setTheme(loadStoredTheme(data.user.uid || data.user.email));
        if (remembered?.email) {
          saveRememberedAccount(remembered.email);
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    const key = themeStorageKey(authUser?.uid || authUser?.email);
    window.localStorage.setItem(key, JSON.stringify(theme));

    if (!authUser) return;

    if (themeSaveTimerRef.current) {
      window.clearTimeout(themeSaveTimerRef.current);
    }

    themeSaveTimerRef.current = window.setTimeout(() => {
      fetch(`${import.meta.env.VITE_API_URL}/api/user/preferences`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme })
      }).catch(() => {});
    }, 180);
  }, [authUser, theme]);

  React.useEffect(() => {
    if (!authUser) return;

    fetch(`${import.meta.env.VITE_API_URL}/api/user/preferences`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.preferences?.theme) {
          const nextTheme = { ...DEFAULT_THEME, ...data.preferences.theme };
          setTheme(nextTheme);
          window.localStorage.setItem(themeStorageKey(authUser.uid || authUser.email), JSON.stringify(nextTheme));
        }
      })
      .catch(() => {});
  }, [authUser]);

  React.useEffect(() => {
    if (!otpState) return undefined;

    const timer = window.setInterval(() => setOtpNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [otpState]);

  React.useEffect(() => {
    if (history.length === 0 || game.isGameOver()) return;
    const latest = history.at(-1);
    if (!latest) return;

    if (latest.color === playerColor) {
      sayBotLine('playerMove');
    } else {
      sayBotLine('botMove');
    }
  }, [history.length, playerColor, sayBotLine]);

  React.useEffect(() => {
    if (!botOptions.moveFeedback || history.length === 0) return;
    const latest = history.at(-1);
    const analysis = stockfishReview[history.length - 1];
    if (botFeedbackPlyRef.current === history.length) return;
    if (!latest || latest.color !== playerColor || !analysis?.tone) return;
    botFeedbackPlyRef.current = history.length;
    sayBotLine(analysis.tone);
  }, [botOptions.moveFeedback, history.length, playerColor, sayBotLine, stockfishReview]);

  React.useEffect(() => {
    if (pendingAnalysis.length === 0) return undefined;

    let cancelled = false;
    const positions = pendingAnalysis.slice(0, 16);

    setStockfishStatus('loading');
    fetch(`${import.meta.env.VITE_API_URL}/api/analysis/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions, depth: 12 })
    })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || 'Stockfish review failed.');
        const byPly = [...stockfishReview];
        (data.results ?? []).forEach((item) => {
          byPly[item.ply - 1] = item;
        });
        setStockfishReview(byPly);
        setPendingAnalysis((current) => current.filter((item) => !positions.some((done) => done.ply === item.ply)));
        setStockfishStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setStockfishStatus(error.message || 'Stockfish unavailable');
      });

    return () => {
      cancelled = true;
    };
  }, [pendingAnalysisKey, stockfishReview]);

  React.useEffect(() => {
    if (history.length === 0) return;

    const log = buildMoveLog(game, gameId, playerColor, aiLevel, userId, userName, timeControl, outcomeResult);
    window.localStorage.setItem(`chess-arena-log-${userId}-${gameId}`, JSON.stringify(log));

    if (!outcomeResult || savedServerLogRef.current === gameId) return;

    savedServerLogRef.current = gameId;
    fetch(`${import.meta.env.VITE_API_URL}/api/game/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    })
      .then((response) => setApiOnline(response.ok))
      .catch(() => setApiOnline(false));
  }, [aiLevel, game, gameFen, gameId, history.length, outcomeResult, playerColor, timeControl, userId, userName]);

  React.useEffect(() => {
    if (!game.isGameOver() || history.length === 0) return;

    setPendingAnalysis((current) => {
      const existing = new Set([
        ...current.map((item) => item.ply),
        ...stockfishReview.map((item, index) => (item ? index + 1 : null)).filter(Boolean)
      ]);
      const missing = history
        .map((move, index) => ({
          ply: index + 1,
          fen: createGameState(history.slice(0, index), initialFen).chess.fen(),
          move: moveToLan(move),
          san: move.san
        }))
        .filter((item) => !existing.has(item.ply));

      return missing.length ? [...current, ...missing] : current;
    });
  }, [game, history, stockfishReview]);

  React.useEffect(() => {
    if (reviewMode || game.isGameOver() || timeWinner || history.length === 0) return undefined;

    const activeColor = game.turn();
    const timer = window.setInterval(() => {
      setClocks((currentClocks) => {
        const nextValue = Math.max(0, currentClocks[activeColor] - 1);
        const nextClocks = { ...currentClocks, [activeColor]: nextValue };

        if (nextValue <= 0) {
          setTimeWinner(activeColor === 'w' ? 'b' : 'w');
          setResultDismissed(false);
        }

        return nextClocks;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [game, history.length, reviewMode, timeWinner]);

  React.useEffect(() => {
    if (game.isGameOver() || timeWinner || game.turn() !== aiColor || isAiThinking || isMoveAnimating || gameMode !== 'bot') return;

    let cancelled = false;
    setSelected(null);
    setLegalTargets([]);
    setIsAiThinking(true);

    const fen = game.fen();
    aiTimerRef.current = window.setTimeout(async () => {
      const legalMoves = game.moves({ verbose: true });
      let move = legalMoves[Math.floor(Math.random() * legalMoves.length)];

      if (botOptions.engine) {
        try {
          const engineMove = await requestStockfishMove(fen, aiLevel.elo);
          move = legalMoves.find((legalMove) => legalMove.from === engineMove.from
            && legalMove.to === engineMove.to
            && (legalMove.promotion ?? '') === (engineMove.promotion ?? '')) ?? chooseFastLiveMove(legalMoves);
        } catch {
          move = chooseFastLiveMove(legalMoves);
        }
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
          animateMove(playedMove, () => {
            commitPlayedMove(playedMove);
            setIsAiThinking(false);
            if (premoveRef.current.length > 0) {
              window.setTimeout(() => executePremove(premoveRef.current, [...history, playedMove]), 70);
            }
          });
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
 
  }, [aiColor, aiLevel, botOptions.engine, game, gameMode, history, initialFen, isMoveAnimating, timeWinner]);

  React.useEffect(() => {
    if (!botGameStarted || reviewMode || game.isGameOver() || timeWinner || isMoveAnimating) {
      setSuggestionMove(null);
      setThreatMove(null);
      return;
    }

    if (!botOptions.suggestionArrows && !botOptions.threatArrows) {
      setSuggestionMove(null);
      setThreatMove(null);
      return;
    }

    const bestMove = chooseFastLiveMove(game.moves({ verbose: true }));

    if (game.turn() === playerColor) {
      setSuggestionMove(bestMove ? { from: bestMove.from, to: bestMove.to } : null);
      setThreatMove(null);
    } else {
      setThreatMove(bestMove ? { from: bestMove.from, to: bestMove.to } : null);
      setSuggestionMove(null);
    }
  }, [botGameStarted, botOptions.suggestionArrows, botOptions.threatArrows, gameFen, isMoveAnimating, playerColor, reviewMode, timeWinner]);

  React.useEffect(() => {
    return () => {
      if (aiTimerRef.current) {
        window.clearTimeout(aiTimerRef.current);
      }
      if (themeSaveTimerRef.current) {
        window.clearTimeout(themeSaveTimerRef.current);
      }
      if (slideTimerRef.current) {
        window.clearTimeout(slideTimerRef.current);
      }
    };
  }, []);

  const commitPlayedMove = (move) => {
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

  const animateMove = (move, onComplete) => {
    if (!move) return;

    if (slideTimerRef.current) {
      window.clearTimeout(slideTimerRef.current);
    }

    setIsMoveAnimating(true);
    setSlidingMove({
      id: `${move.from}-${move.to}-${Date.now()}`,
      from: move.from,
      to: move.to,
      pieceKey: `${move.color}${move.piece}`,
      color: move.color,
      started: false
    });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setSlidingMove((current) => (current?.from === move.from && current?.to === move.to ? { ...current, started: true } : current));
      });
    });

    slideTimerRef.current = window.setTimeout(() => {
      onComplete?.();
      setSlidingMove(null);
      setIsMoveAnimating(false);
    }, 170);
  };

  const startNewGame = async ({ nextSideChoice = sideChoice, nextAiElo = aiElo, nextTimeControl = timeControl, nextBotGameStarted = false, nextVariant = gameVariant } = {}) => {
    if (aiTimerRef.current) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }

    const nextPlayerColor = resolvePlayerColor(nextSideChoice);
    const nextInitialFen = nextVariant === 'chess960' ? generateChess960Fen() : null;
    setInitialFen(nextInitialFen);
    setGameVariant(nextVariant);
    setGameState(createGameState([], nextInitialFen));
    setPlayerColor(nextPlayerColor);
    setSideChoice(nextSideChoice);
    setAiElo(Number(nextAiElo));
    setFlipped(nextPlayerColor === 'b');
    setSelected(null);
    setLegalTargets([]);
    setHintMove(null);
    setPremoveQueue([]);
    setSuggestionMove(null);
    setThreatMove(null);
    setLastMove(null);
    setPromotionRequest(null);
    setIsAiThinking(false);
    setSlidingMove(null);
    setIsMoveAnimating(false);
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
    botChatHistoryRef.current = [];
    botFeedbackPlyRef.current = 0;
    savedServerLogRef.current = null;
    setBotChatLine((BOT_PERSONAS.find((persona) => persona.elo === Number(nextAiElo)) ?? activeBotPersona).chat);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/game/new`, {
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
    setGameMode('bot');
    setBotGameStarted(true);
    startNewGame({ nextSideChoice: sideChoice, nextAiElo: aiElo, nextTimeControl: timeControl, nextBotGameStarted: true });
  };

  const resignGame = () => {
    setManualResult({
      type: 'loss',
      title: `${activeBotPersona.name} thắng`,
      detail: 'bằng đầu hàng'
    });
    setResultDismissed(false);
  };

  const showHintMove = () => {
    if (reviewMode || game.isGameOver() || timeWinner || isAiThinking || isMoveAnimating) return;
    const legalMoves = game.moves({ verbose: true });
    const suggestedMove = suggestionMove ?? chooseFastLiveMove(legalMoves) ?? legalMoves[0];
    if (!suggestedMove) return;
    setHintMove({ from: suggestedMove.from, to: suggestedMove.to });
  };

  const updateBotOption = (key) => {
    setBotOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  const changeSideChoice = (choice) => {
    startNewGame({ nextSideChoice: choice });
  };

  const changeAiElo = (elo) => {
    startNewGame({ nextSideChoice: sideChoice, nextAiElo: Number(elo) });
  };

  const changeTimeControl = (controlId) => {
    const nextControl = TIME_CONTROLS.find((control) => control.id === controlId) ?? DEFAULT_TIME_CONTROL;
    setTimeControlId(nextControl.id);
    setClocks({ w: nextControl.baseSeconds, b: nextControl.baseSeconds });
    startNewGame({ nextSideChoice: sideChoice, nextAiElo: aiElo, nextTimeControl: nextControl });
  };

  const changeVariant = (variant) => {
    startNewGame({ nextSideChoice: sideChoice, nextAiElo: aiElo, nextTimeControl: timeControl, nextVariant: variant });
  };

  const applyBoardPreset = (presetId) => {
    const preset = BOARD_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setTheme((currentTheme) => ({
      ...currentTheme,
      lightSquare: preset.lightSquare,
      darkSquare: preset.darkSquare
    }));
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
    setSlidingMove(null);
    setIsMoveAnimating(false);
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
    if (isMoveAnimating || isAiThinking || game.isGameOver() || timeWinner || !isPlayerTurn) return false;

    const nextGame = createGameState(history, initialFen).chess;
    const move = nextGame.move({ from, to, promotion });

    if (!move) return false;

    setSelected(null);
    setLegalTargets([]);
    setPromotionRequest(null);
    animateMove(move, () => commitPlayedMove(move));
    return true;
  };

  const executePremove = (queuedMove, baseHistory) => {
    const nextPremove = Array.isArray(queuedMove) ? queuedMove[0] : queuedMove;
    if (!nextPremove || gameMode !== 'bot' || reviewMode || timeWinner) return false;

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

    animateMove(move, () => commitPlayedMove(move));
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
    if (gameMode !== 'bot' || reviewMode || game.isGameOver() || timeWinner || game.turn() === playerColor) return false;

    const piece = game.get(from);
    if (!piece || piece.color !== playerColor) return false;

    setPremoveQueue([{ from, to, promotion: 'q' }]);
    setSelected(null);
    setLegalTargets([]);
    return true;
  };

  const selectSquare = (square) => {
    if (reviewMode || isMoveAnimating || game.isGameOver() || timeWinner) return;

    const piece = game.get(square);

    if (!isPlayerTurn) {
      if (gameMode !== 'bot') return;

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
    const canPremoveDrag = gameMode === 'bot' && !isPlayerTurn && piece?.color === playerColor;

    if (reviewMode || isMoveAnimating || !dragEnabled || game.isGameOver() || timeWinner || !piece || (gameMode !== 'local' && piece.color !== playerColor) || (!isPlayerTurn && !canPremoveDrag)) {
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

  const updateTheme = (key, value) => {
    setTheme((currentTheme) => ({
      ...currentTheme,
      [key]: value
    }));
  };

  const resetTheme = () => {
    setTheme(DEFAULT_THEME);
  };

  const createBackendSession = async (firebaseUser, providerProfile = {}) => {
    const idToken = await firebaseUser.getIdToken();
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/session`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        remember: Boolean(authForm.remember),
        deviceId: getDeviceId(),
        profile: {
          displayName: providerProfile.displayName || firebaseUser.displayName || '',
          githubLogin: providerProfile.githubLogin || '',
          githubName: providerProfile.githubName || '',
          photoURL: providerProfile.photoURL || firebaseUser.photoURL || ''
        }
      })
    });
    const responseText = await response.text();
    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { error: responseText || 'Backend did not return JSON.' };
    }

    if (!response.ok) {
      throw new Error(data.error || 'Could not create secure session');
    }

    setAuthUser(data.user);
    setUserName(displayNameFromUser(data.user));
    setAuthMode(null);
    setAuthMessage('');
    setOtpState(null);
    setTheme(loadStoredTheme(data.user.uid || data.user.email));

    if (authForm.remember) {
      saveRememberedAccount(data.user.email || authForm.email);
    } else {
      window.localStorage.removeItem(REMEMBER_ACCOUNT_KEY);
    }
  };

  const formatAuthError = (error, provider = '') => {
    const message = error?.message || '';
    const code = error?.code || '';

    if (provider === 'github' && (
      code.includes('auth/unauthorized-domain') ||
      code.includes('auth/operation-not-allowed') ||
      code.includes('auth/popup-closed-by-user') ||
      message.toLowerCase().includes('redirect_uri') ||
      message.toLowerCase().includes('redirect uri')
    )) {
      return 'GitHub OAuth chưa khớp callback URL. Hãy đặt Authorization callback URL trong GitHub OAuth App là https://chess-platform-9120d.firebaseapp.com/__/auth/handler, rồi kiểm tra GitHub provider trong Firebase Authentication.';
    }

    if (code.includes('auth/account-exists-with-different-credential')) {
      return 'Email này đã đăng nhập bằng phương thức khác. Hãy dùng phương thức đăng nhập đã liên kết trước đó.';
    }

    if (code.includes('auth/popup-closed-by-user')) {
      return 'Bạn đã đóng cửa sổ đăng nhập trước khi hoàn tất.';
    }

    return message || 'Không thể đăng nhập. Vui lòng thử lại.';
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setAuthMessage('');

    try {
      if (authMode === 'forgot') {
        await sendOtp('reset');
        return;
      }

      if (authMode === 'register') {
        await sendOtp('register');
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      await createBackendSession(credential.user);
    } catch (error) {
      setAuthMessage(error.message || 'Authentication failed.');
    }
  };

  const sendOtp = async (purpose) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purpose,
        email: authForm.email
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Không thể gửi OTP.');
    }

    setOtpState({ purpose, email: data.email, expiresAt: data.expiresAt });
    setOtpNow(Date.now());
    setAuthForm((form) => ({ ...form, otp: '' }));
    setAuthMessage('Mã OTP đã được gửi. Vui lòng kiểm tra email.');
  };

  const verifyOtp = async () => {
    setAuthMessage('');

    try {
      if (!otpState) return;

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: otpState.purpose,
          email: otpState.email,
          otp: authForm.otp,
          password: authForm.password,
          displayName: authForm.displayName,
          newPassword: authForm.newPassword
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Không thể xác nhận OTP.');
      }

      if (otpState.purpose === 'register') {
        const credential = await signInWithEmailAndPassword(auth, otpState.email, authForm.password);
        await createBackendSession(credential.user);
        return;
      }

      setOtpState(null);
      setAuthMode('login');
      setAuthForm((form) => ({ ...form, password: '', newPassword: '', otp: '' }));
      setAuthMessage('Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới.');
    } catch (error) {
      setAuthMessage(error.message || 'Không thể xác nhận OTP.');
    }
  };

  const resendOtp = async () => {
    if (!otpState) return;
    setAuthMessage('');

    try {
      await sendOtp(otpState.purpose);
    } catch (error) {
      setAuthMessage(error.message || 'Không thể gửi lại OTP.');
    }
  };

  const signInProvider = async (provider) => {
    setAuthMessage('');

    try {
      const authProvider = provider === 'github' ? githubProvider : googleProvider;
      const credential = await signInWithPopup(auth, authProvider);
      const providerInfo = getAdditionalUserInfo(credential);
      const profile = providerInfo?.profile || {};
      await createBackendSession(credential.user, {
        displayName: provider === 'github' ? profile.name || profile.login || '' : credential.user.displayName || '',
        githubLogin: provider === 'github' ? profile.login || '' : '',
        githubName: provider === 'github' ? profile.name || '' : '',
        photoURL: profile.avatar_url || credential.user.photoURL || ''
      });
    } catch (error) {
      setAuthMessage(formatAuthError(error, provider));
    }
  };

  const queueMissingReviewAnalysis = () => {
    setPendingAnalysis((current) => {
      const existing = new Set([
        ...current.map((item) => item.ply),
        ...stockfishReview.map((item, index) => (item ? index + 1 : null)).filter(Boolean)
      ]);
      const missing = history
        .map((move, index) => ({
          ply: index + 1,
          fen: createGameState(history.slice(0, index), initialFen).chess.fen(),
          move: moveToLan(move),
          san: move.san
        }))
        .filter((item) => !existing.has(item.ply));

      return missing.length ? [...current, ...missing] : current;
    });
  };

  const logout = async () => {
    await fetch(`${import.meta.env.VITE_API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    }).catch(() => {});
    await signOut(auth).catch(() => {});
    window.localStorage.removeItem(REMEMBER_ACCOUNT_KEY);
    setAuthUser(null);
    setOtpState(null);
    setAuthMode('login');
    setUserName('Player');
    setAuthForm((form) => ({ ...form, password: '', otp: '', newPassword: '', remember: false }));
  };

  const reviewGame = () => {
    if (aiTimerRef.current) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }

    setReviewMode(true);
    setReviewStarted(false);
    setReviewPly(history.length);
    queueMissingReviewAnalysis();
    setResultDismissed(true);
    setIsAiThinking(false);
    navigate('review');
  };

  const reviewStep = (direction) => {
    setReviewPly((currentPly) => Math.min(history.length, Math.max(0, currentPly + direction)));
  };

  const reviewStats = React.useMemo(() => {
    const stats = {
      w: Object.fromEntries(REVIEW_LEGEND.map((item) => [item.tone, 0])),
      b: Object.fromEntries(REVIEW_LEGEND.map((item) => [item.tone, 0]))
    };
    const totals = { w: 0, b: 0 };
    const loss = { w: 0, b: 0 };

    stockfishReview.forEach((item) => {
      if (!item) return;
      const color = item.mover === 'b' ? 'b' : 'w';
      if (stats[color][item.tone] === undefined) stats[color][item.tone] = 0;
      stats[color][item.tone] += 1;
      totals[color] += 1;
      loss[color] += Number(item.winLoss || 0);
    });

    const accuracy = {
      w: totals.w ? Math.max(1, Math.min(99, 100 - loss.w / totals.w * 2.4)).toFixed(1) : '--',
      b: totals.b ? Math.max(1, Math.min(99, 100 - loss.b / totals.b * 2.4)).toFixed(1) : '--'
    };

    return { stats, totals, accuracy };
  }, [stockfishReview]);

  const whiteName = playerColor === 'w' ? userName : aiDisplayName;
  const blackName = playerColor === 'b' ? userName : aiDisplayName;

  return (
    <main className="app-shell" style={themeStyle}>
      {promotionRequest && <button className="promotion-cancel-layer" aria-label="Cancel promotion" onClick={cancelPromotion} tabIndex={-1} />}
      <Sidebar
        authUser={authUser}
        userName={userName}
        activeRoute={route}
        mobileOpen={mobileSidebarOpen}
        onToggleMobile={() => setMobileSidebarOpen((open) => !open)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onNavigate={(nextRoute) => {
          if (nextRoute === 'game' && (route === 'review' || game.isGameOver() || manualResult || timeWinner)) {
            startNewGame({ nextBotGameStarted: false });
          }
          navigate(nextRoute);
        }}
        onLogin={() => setAuthMode('login')}
        onRegister={() => setAuthMode('register')}
        onLogout={logout}
      />

      <section className={`content-shell ${route === 'review' ? 'review-route-shell' : ''} ${route === 'home' ? 'home-route-shell' : ''} ${route === 'game' ? 'game-route-shell' : ''}`}>
        {authMode && !authUser && (
          <AuthPage
            authMode={authMode}
            authForm={authForm}
            authMessage={authMessage}
            otpState={otpState}
            otpSecondsLeft={otpSecondsLeft}
            onAuthFormChange={(patch) => setAuthForm((form) => ({ ...form, ...patch }))}
            onSubmitAuth={submitAuth}
            onProviderSignIn={signInProvider}
            onSetAuthMode={(mode) => {
              setOtpState(null);
              setAuthMode(mode);
            }}
            onVerifyOtp={verifyOtp}
            onResendOtp={resendOtp}
          />
        )}

        {(!authMode || authUser) && (
        <>
        {route === 'home' && (
          <section className="home-dashboard">
            <div className="home-player">
              <div className="home-avatar">
                <Shield size={22} />
              </div>
              <div>
                <span>Chào mừng trở lại</span>
                <strong>{userName}</strong>
              </div>
            </div>

            <section className="home-hero">
              <div className="home-hero-copy">
                <span className="hero-kicker">Chess Arena Studio</span>
                <h1>Chào mừng, {userName}</h1>
                <p>Vào trận nhanh, luyện chiến thuật và xem lại ván đấu trong một không gian tập trung, hiện đại và dành riêng cho bạn.</p>
                <div className="home-hero-actions">
                  <button onClick={() => {
                    startNewGame();
                    navigate('game');
                  }}>Chơi ngay</button>
                  <button onClick={() => navigate('game')}>Giải câu đố</button>
                </div>
              </div>
              <div className="home-hero-board">
                <img src={HOME_IMAGES.hero} alt="Bàn cờ vua đang sẵn sàng cho ván mới" loading="eager" />
                <span>Rapid 10+0</span>
              </div>
            </section>

            <section className="home-summary">
              <div>
                <Flame size={44} />
                <span>Streak</span>
                <strong>1 Day Streak</strong>
              </div>
              <div>
                <Puzzle size={42} />
                <span>Puzzles</span>
                <strong>{reviewStats.totals.w + reviewStats.totals.b}</strong>
              </div>
              <div>
                <GraduationCap size={46} />
                <span>Next Lesson</span>
                <strong>Learn To Play: The King</strong>
              </div>
              <div>
                <Star size={44} />
                <span>Game Review</span>
                <strong>Learn from your mistakes</strong>
              </div>
            </section>

            <section className="home-grid">
              <div className="home-actions">
                <button onClick={() => {
                  startNewGame({ nextTimeControl: TIME_CONTROLS.find((control) => control.id === '600+0') ?? timeControl });
                  navigate('game');
                }}>
                  <Timer size={25} />
                  Play 10 min
                </button>
                <button onClick={() => {
                  startNewGame();
                  navigate('game');
                }}>
                  <Swords size={25} />
                  New Game
                </button>
                <button onClick={() => {
                  setGameMode('bot');
                  navigate('game');
                }}>
                  <Bot size={25} />
                  Play Bots
                </button>
                <button onClick={() => {
                  setGameMode('local');
                  navigate('game');
                }}>
                  <Users size={25} />
                  Play a Friend
                </button>
              </div>

              {[
                { title: 'Solve Puzzle', tone: 'puzzle', image: HOME_IMAGES.puzzle },
                { title: 'Start Lesson', tone: 'lesson', image: HOME_IMAGES.lesson },
                { title: history.length ? 'Review Last Game' : 'Start Review', tone: 'review', image: HOME_IMAGES.review }
              ].map((card) => (
                <button
                  className="home-feature-card"
                  key={card.title}
                  onClick={() => {
                    if (card.tone === 'review' && history.length) {
                      reviewGame();
                    } else {
                      navigate('game');
                    }
                  }}
                >
                  <div className={`home-mini-board ${card.tone}`}>
                    <img src={card.image} alt={card.title} loading="lazy" />
                  </div>
                  <span>{card.title}</span>
                </button>
              ))}
            </section>

            <p className="home-image-credit">Hình minh họa bàn cờ online được dựng riêng cho Chess Arena.</p>
          </section>
        )}

        {route === 'review' && (
          <section className="review-dashboard">
            <div className="review-topbar">
              <button onClick={() => navigate('game')}>Back to game</button>
              <h1>Game Review</h1>
              <div className="review-topbar-actions">
                <span>{stockfishStatus === 'loading' ? 'Stockfish analyzing...' : 'Stockfish ready'}</span>
                <button onClick={() => {
                  startNewGame();
                  navigate('game');
                }}>New game</button>
              </div>
            </div>

            <section className="review-scorecard">
              {reviewStarted && (
                <div className="review-active-card">
                  <div className="review-coach-row">
                    <div className="review-coach-avatar">GM</div>
                    <div className="review-coach-bubble">
                      <div>
                        <span className={`move-badge inline ${reviewBadge?.tone ?? 'loading'}`}>
                          {reviewIcon(reviewBadge?.tone ?? 'loading')}
                        </span>
                        <strong>
                          {currentReviewAnalysis
                            ? `${currentReviewAnalysis.san} is ${currentReviewAnalysis.label.toLowerCase()}`
                            : reviewPly > 0
                              ? 'Analyzing this move...'
                              : 'Choose a move to review'}
                        </strong>
                        {currentReviewAnalysis?.winLoss !== undefined && (
                          <b>{currentReviewAnalysis.winLoss > 0 ? `-${currentReviewAnalysis.winLoss}%` : '0%'}</b>
                        )}
                      </div>
                      <p>
                        {currentReviewAnalysis?.bestMove && currentReviewAnalysis.bestSan !== currentReviewAnalysis.san
                          ? `Best move: ${currentReviewAnalysis.bestSan || currentReviewAnalysis.bestMove}.`
                          : currentReviewAnalysis
                            ? currentReviewAnalysis.detail || 'Stockfish agrees with the position assessment.'
                            : stockfishStatus === 'loading'
                              ? 'Stockfish is preparing a precise review.'
                              : 'Press Next or choose a move below.'}
                      </p>
                    </div>
                  </div>

                  <div className="review-action-row">
                    <button type="button" disabled={!currentReviewAnalysis}>Explain</button>
                    <button type="button" onClick={() => reviewStep(1)} disabled={reviewPly >= history.length}>Next</button>
                  </div>

                  <div className="review-move-list">
                    {history.length === 0 && <p className="empty-state">No moves to review.</p>}
                    {Array.from({ length: Math.ceil(history.length / 2) }).map((_, index) => (
                      <div className="review-move-row" key={index}>
                        <span>{index + 1}.</span>
                        <button
                          className={`${reviewPly === index * 2 + 1 ? 'active' : ''} ${stockfishReview[index * 2]?.tone ?? ''}`}
                          disabled={!history[index * 2]}
                          onClick={() => {
                            setReviewMode(true);
                            setReviewStarted(true);
                            setResultDismissed(true);
                            setReviewPly(index * 2 + 1);
                          }}
                        >
                          {history[index * 2]?.san ?? ''}
                        </button>
                        <button
                          className={`${reviewPly === index * 2 + 2 ? 'active' : ''} ${stockfishReview[index * 2 + 1]?.tone ?? ''}`}
                          disabled={!history[index * 2 + 1]}
                          onClick={() => {
                            setReviewMode(true);
                            setReviewStarted(true);
                            setResultDismissed(true);
                            setReviewPly(index * 2 + 2);
                          }}
                        >
                          {history[index * 2 + 1]?.san ?? ''}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="review-controls">
                    <button onClick={() => setReviewPly(0)} disabled={reviewPly === 0}>|&lt;</button>
                    <button onClick={() => reviewStep(-1)} disabled={reviewPly === 0}>&lt;</button>
                    <button onClick={() => setReviewPly((ply) => (ply >= history.length ? 0 : history.length))}>
                      {reviewPly >= history.length ? '↻' : '▶'}
                    </button>
                    <button onClick={() => reviewStep(1)} disabled={reviewPly >= history.length}>&gt;</button>
                    <button onClick={() => setReviewPly(history.length)} disabled={reviewPly >= history.length}>&gt;|</button>
                  </div>
                </div>
              )}

              <div className="review-message">
                <strong>{reviewStats.accuracy.w !== '--' && reviewStats.accuracy.b !== '--' && Number(reviewStats.accuracy.w) >= Number(reviewStats.accuracy.b) ? whiteName : blackName}</strong>
                <span>
                  {stockfishReview.filter(Boolean).length < history.length
                    ? `Analyzed ${stockfishReview.filter(Boolean).length}/${history.length} moves. Keep playing or wait a moment.`
                    : 'Review is ready. Start from any move or inspect the summary below.'}
                </span>
              </div>

              <div className="review-players">
                <div>
                  <span>White</span>
                  <strong>{whiteName}</strong>
                  <b>{reviewStats.accuracy.w}</b>
                </div>
                <div>
                  <span>Black</span>
                  <strong>{blackName}</strong>
                  <b>{reviewStats.accuracy.b}</b>
                </div>
              </div>

              <div className="review-breakdown">
                {REVIEW_LEGEND.map((item) => (
                  <div className="review-breakdown-row" key={item.tone}>
                    <span>{reviewStats.stats.w[item.tone] ?? 0}</span>
                    <b className={item.tone}>{reviewIcon(item.tone)}</b>
                    <strong>{item.label}</strong>
                    <span>{reviewStats.stats.b[item.tone] ?? 0}</span>
                  </div>
                ))}
              </div>

              <button className="start-review-button" onClick={() => {
                setReviewMode(true);
                setReviewStarted(true);
                setReviewPly(history.length ? Math.max(1, Math.min(history.length, reviewPly || 1)) : 0);
                queueMissingReviewAnalysis();
              }}>
                {reviewStarted ? 'Restart Review' : 'Start Review'}
              </button>
            </section>

            {reviewStarted && (
              <section className="review-board-section">
                <button onClick={() => setReviewStarted(false)}>Summary</button>
              </section>
            )}
          </section>
        )}

        {route !== 'home' && (
        <>
        <header className="top-header">
          <div className="search-box">
            <Search size={18} />
            <span>Search players, games, openings</span>
          </div>
          <div className="header-actions">
            <span className={`api-pill ${apiOnline ? 'online' : 'offline'}`}>
              {apiOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
              API
            </span>
            <button aria-label="Notifications">
              <Bell size={19} />
            </button>
            <button aria-label="Settings" onClick={() => setSettingsOpen((value) => !value)}>
              <Settings size={19} />
            </button>
          </div>
          {settingsOpen && (
            <div className="theme-panel">
              <div className="theme-panel-head">
                <strong>Cá nhân hóa giao diện</strong>
                <button onClick={resetTheme}>Đặt lại</button>
              </div>
              <label>
                <span>Màu nhấn</span>
                <input type="color" value={theme.accent} onChange={(event) => updateTheme('accent', event.target.value)} />
              </label>
              <label>
                <span>Ô sáng</span>
                <input type="color" value={theme.lightSquare} onChange={(event) => updateTheme('lightSquare', event.target.value)} />
              </label>
              <label>
                <span>Ô tối</span>
                <input type="color" value={theme.darkSquare} onChange={(event) => updateTheme('darkSquare', event.target.value)} />
              </label>
              <label>
                <span>Bảng điều khiển</span>
                <input type="color" value={theme.surface} onChange={(event) => updateTheme('surface', event.target.value)} />
              </label>
              <label>
                <span>Nền trang</span>
                <input type="color" value={theme.page} onChange={(event) => updateTheme('page', event.target.value)} />
              </label>
              <label>
                <span>Preset bàn cờ</span>
                <select onChange={(event) => applyBoardPreset(event.target.value)} defaultValue="">
                  <option value="" disabled>Chọn preset</option>
                  {BOARD_PRESETS.map((preset) => (
                    <option value={preset.id} key={preset.id}>{preset.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Mẫu quân cờ</span>
                <select value={pieceSet} onChange={(event) => setPieceSet(event.target.value)}>
                  {PIECE_SETS.map((set) => (
                    <option value={set.id} key={set.id}>{set.label}</option>
                  ))}
                </select>
              </label>
              <p className="theme-note">
                {authUser ? 'Màu sẽ được lưu theo tài khoản của bạn.' : 'Đăng nhập để đồng bộ màu trên tài khoản.'}
              </p>
            </div>
          )}
        </header>

        <section className={`game-layout ${reviewMode ? 'review-page-layout' : ''}`}>
          <section className="game-stage">
            <PlayerCard
              tone="black"
              name={blackName}
              label={playerColor === 'b' ? 'You' : 'Opponent'}
              clock={formatClock(clocks.b)}
              captures={capturedBlack}
              materialLead={Math.max(0, blackCapturePoints - whiteCapturePoints)}
              active={game.turn() === 'b'}
            />

            {reviewMode && (
              <div className="review-legend" aria-label="Move review legend">
                {REVIEW_LEGEND.map((item) => (
                  <span className={`legend-item ${item.tone}`} key={item.tone} title={item.detail}>
                    <b>{reviewIcon(item.tone)}</b>
                    {item.label}
                  </span>
                ))}
              </div>
            )}

            <section className={`board-wrap ${botOptions.evaluationBar ? '' : 'no-eval'}`} aria-label="Chess board">
              {botOptions.evaluationBar && (
                <aside className="advantage-bar" aria-label="Material advantage">
                  <span>{blackCapturePoints > whiteCapturePoints ? `+${blackCapturePoints - whiteCapturePoints}` : ''}</span>
                  <div>
                    <i style={{ height: `${advantagePercent}%` }} />
                  </div>
                  <span>{whiteCapturePoints > blackCapturePoints ? `+${whiteCapturePoints - blackCapturePoints}` : ''}</span>
                </aside>
              )}
              <div className={`board piece-set-${pieceSet}`}>
                {Array.from({ length: 8 }).map((_, row) =>
                  Array.from({ length: 8 }).map((__, col) => {
                    const square = squareName(row, col, flipped);
                    const piece = displayGame.get(square);
                    const isDark = (row + col) % 2 === 1;
                    const isSelected = selected === square;
                    const isTarget = showHints && legalTargets.includes(square);
                    const activeLastMove = reviewMode ? displayHistory.at(-1) : lastMove;
                    const isLastMove = activeLastMove && (activeLastMove.from === square || activeLastMove.to === square);
                    const isHintFrom = !reviewMode && visibleHintMove?.from === square;
                    const isHintTo = !reviewMode && visibleHintMove?.to === square;
                    const isThreatFrom = !reviewMode && botOptions.threatArrows && threatMove?.from === square;
                    const isThreatTo = !reviewMode && botOptions.threatArrows && threatMove?.to === square;
                    const isPremoveFrom = !reviewMode && premoveQueue.some((move) => move.from === square);
                    const isPremoveTo = !reviewMode && premoveQueue.some((move) => move.to === square);
                    const canPremoveDrag = gameMode === 'bot' && !isPlayerTurn && piece?.color === playerColor;
                    const canDragPiece = !reviewMode && dragEnabled && piece && (gameMode === 'local' || piece.color === playerColor) && ((piece.color === game.turn() && isPlayerTurn && !isAiThinking) || canPremoveDrag);
                    const hideForSlide = slidingMove && slidingMove.from === square && slidingMove.pieceKey === `${piece?.color}${piece?.type}`;

                    return (
                      <button
                        className={`square ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isTarget ? 'target' : ''} ${isLastMove ? 'last-move' : ''} ${isHintFrom ? 'hint-from' : ''} ${isHintTo ? 'hint-to' : ''} ${isThreatFrom ? 'threat-from' : ''} ${isThreatTo ? 'threat-to' : ''} ${isPremoveFrom ? 'premove-from' : ''} ${isPremoveTo ? 'premove-to' : ''}`}
                        key={square}
                        onClick={() => selectSquare(square)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDrop(event, square)}
                        onDragStart={(event) => handleDragStart(event, square, piece)}
                        draggable={Boolean(canDragPiece)}
                        aria-label={square}
                      >
                        {piece && (
                          <img
                            className={`piece ${piece.color} ${hideForSlide ? 'piece-hidden-for-slide' : ''}`}
                            src={PIECE_IMAGES[`${piece.color}${piece.type}`]}
                            alt={`${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}`}
                            draggable="false"
                          />
                        )}
                        {reviewMode && reviewBadge && activeLastMove?.to === square && (
                          <span className={`move-badge ${reviewBadge.tone}`} title={reviewBadge.label}>
                            {reviewIcon(reviewBadge.tone)}
                          </span>
                        )}
                        {(row === 7 || col === 0) && <span className="coord">{row === 7 ? square[0] : square[1]}</span>}
                      </button>
                    );
                  })
                )}
                {promotionRequest && (
                  <div
                    className={`promotion-board-popover ${promotionRequest.color === 'b' ? 'above' : 'below'}`}
                    style={promotionPopoverStyle(promotionRequest.to, promotionRequest.color, flipped)}
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <button className="promotion-close" onClick={cancelPromotion} aria-label="Cancel promotion">
                      x
                    </button>
                    {PROMOTION_PIECES.map((pieceType) => (
                      <button
                        key={pieceType}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          playMove({ ...promotionRequest, promotion: pieceType });
                        }}
                        aria-label={`Promote to ${PIECE_NAMES[pieceType]}`}
                      >
                        <img
                          src={PIECE_IMAGES[`${promotionRequest.color}${pieceType}`]}
                          alt={PIECE_NAMES[pieceType]}
                          draggable="false"
                        />
                      </button>
                    ))}
                  </div>
                )}
                {reviewMode && reviewArrowFrom && reviewArrowTo && (
                  <svg className="best-move-arrow" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <marker id="best-arrow-head" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto">
                        <polygon points="0 0, 5 2.5, 0 5" />
                      </marker>
                    </defs>
                    <line
                      x1={reviewArrowFrom.x}
                      y1={reviewArrowFrom.y}
                      x2={reviewArrowTo.x}
                      y2={reviewArrowTo.y}
                      markerEnd="url(#best-arrow-head)"
                    />
                  </svg>
                )}
                {!reviewMode && hintArrowFrom && hintArrowTo && (
                  <svg className="best-move-arrow hint-arrow" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <marker id="hint-arrow-head" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto">
                        <polygon points="0 0, 5 2.5, 0 5" />
                      </marker>
                    </defs>
                    <line
                      x1={hintArrowFrom.x}
                      y1={hintArrowFrom.y}
                      x2={hintArrowTo.x}
                      y2={hintArrowTo.y}
                      markerEnd="url(#hint-arrow-head)"
                    />
                  </svg>
                )}
                {!reviewMode && threatArrowFrom && threatArrowTo && (
                  <svg className="best-move-arrow threat-arrow" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <marker id="threat-arrow-head" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto">
                        <polygon points="0 0, 5 2.5, 0 5" />
                      </marker>
                    </defs>
                    <line
                      x1={threatArrowFrom.x}
                      y1={threatArrowFrom.y}
                      x2={threatArrowTo.x}
                      y2={threatArrowTo.y}
                      markerEnd="url(#threat-arrow-head)"
                    />
                  </svg>
                )}
                {!reviewMode && premoveArrows.length > 0 && (
                  <svg className="best-move-arrow premove-arrow" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <marker id="premove-arrow-head" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto">
                        <polygon points="0 0, 5 2.5, 0 5" />
                      </marker>
                    </defs>
                    {premoveArrows.map((arrow, index) => (
                      <line
                        key={`${arrow.from.x}-${arrow.from.y}-${arrow.to.x}-${arrow.to.y}-${index}`}
                        x1={arrow.from.x}
                        y1={arrow.from.y}
                        x2={arrow.to.x}
                        y2={arrow.to.y}
                        markerEnd="url(#premove-arrow-head)"
                      />
                    ))}
                  </svg>
                )}
                {slidingMove && !reviewMode && (
                  <img
                    className={`sliding-piece ${slidingMove.color} ${slidingMove.started ? 'active' : ''}`}
                    src={PIECE_IMAGES[slidingMove.pieceKey]}
                    alt=""
                    draggable="false"
                    style={{
                      left: slidingMove.started ? squareTopLeft(slidingMove.to, flipped).x : squareTopLeft(slidingMove.from, flipped).x,
                      top: slidingMove.started ? squareTopLeft(slidingMove.to, flipped).y : squareTopLeft(slidingMove.from, flipped).y
                    }}
                  />
                )}
              </div>
            </section>

            <PlayerCard
              tone="white"
              name={whiteName}
              label={playerColor === 'w' ? 'You' : 'Opponent'}
              clock={formatClock(clocks.w)}
              captures={capturedWhite}
              materialLead={Math.max(0, whiteCapturePoints - blackCapturePoints)}
              active={game.turn() === 'w'}
            />
          </section>

          <aside className={`match-panel compact-bot-panel ${botGameStarted ? 'bot-started' : 'bot-setup'}`}>
            {!botGameStarted ? (
              <section className="bot-setup-panel" aria-label="Choose bot">
                <div className="bot-lobby-title">
                  <Bot size={19} />
                  <strong>Play Bots</strong>
                </div>
                <div className="bot-chat-card">
                  <img src={activeBotPersona.avatar} alt={activeBotPersona.name} />
                  <div>
                    {botOptions.botChat && <p>{botChatText}</p>}
                    <strong>{activeBotPersona.name} <span>{aiLevel.elo}</span></strong>
                  </div>
                </div>
                <div className="bot-family-card">
                  <div>
                    <strong>Pirates</strong>
                    <span>{BOT_PERSONAS.length} bots</span>
                  </div>
                  <div className="bot-avatar-row">
                    {BOT_PERSONAS.map((bot) => (
                      <button
                        className={Number(aiElo) === bot.elo ? 'active' : ''}
                        key={bot.elo}
                        onClick={() => changeAiElo(bot.elo)}
                        title={`${bot.name} - ELO ${bot.elo}`}
                      >
                        <img src={bot.avatar} alt={bot.name} />
                      </button>
                    ))}
                  </div>
                </div>
                <details className="bot-options compact-options">
                  <summary>Options</summary>
                  <div className="time-control-grid">
                    {TIME_CONTROLS.map((control) => (
                      <button
                        className={timeControlId === control.id ? 'active' : ''}
                        key={control.id}
                        type="button"
                        onClick={() => changeTimeControl(control.id)}
                      >
                        {control.label.replace('Rapid ', '').replace('Blitz ', '').replace('Bullet ', '')}
                      </button>
                    ))}
                  </div>
                  <div className="variant-card">
                    <button className={gameVariant === 'standard' ? 'active' : ''} type="button" onClick={() => changeVariant('standard')}>
                      <strong>Standard</strong>
                      <span>Kiểu chơi bình thường</span>
                    </button>
                    <button className={gameVariant === 'chess960' ? 'active' : ''} type="button" onClick={() => changeVariant('chess960')}>
                      <strong>Chess960</strong>
                      <span>Hàng quân sau ngẫu nhiên</span>
                    </button>
                  </div>
                  <div className="bot-toggle-list">
                    {[
                      ['Bot Chat', 'botChat'],
                      ['Evaluation Bar', 'evaluationBar'],
                      ['Threat Arrows', 'threatArrows'],
                      ['Suggestion Arrows', 'suggestionArrows'],
                      ['Move Feedback', 'moveFeedback'],
                      ['Engine', 'engine']
                    ].map(([item, key]) => (
                      <label key={key}>
                        <span>{item}</span>
                        <input type="checkbox" checked={botOptions[key]} onChange={() => updateBotOption(key)} />
                      </label>
                    ))}
                  </div>
                </details>
                <button className="bot-play-button" onClick={startBotMatch}>Play</button>
              </section>
            ) : (
              <section className="bot-live-panel" aria-label="Live bot game">
                <div className="bot-lobby-title">
                  <Bot size={19} />
                  <strong>Play Bots</strong>
                </div>
                <div className="bot-chat-card live">
                  <img src={activeBotPersona.avatar} alt={activeBotPersona.name} />
                  <div>
                    {botOptions.botChat && <p>{botChatText}</p>}
                  </div>
                </div>
                <div className="opening-row">
                  <span>{history.length ? 'Move log' : 'Ready'}</span>
                  <strong>{statusText(game)}</strong>
                </div>
                <div className="compact-move-list">
                  {Array.from({ length: Math.max(1, Math.ceil(history.length / 2)) }).map((_, index) => (
                    <div className="compact-move-row" key={index}>
                      <span>{index + 1}.</span>
                      <b>{history[index * 2]?.san ?? ''}</b>
                      <b>{history[index * 2 + 1]?.san ?? ''}</b>
                    </div>
                  ))}
                </div>
                <div className="bot-live-actions">
                  <button onClick={resignGame} title="Đầu hàng"><Flag size={20} /></button>
                  <button onClick={undoMove} disabled={history.length === 0} title="Undo"><SkipBack size={20} /></button>
                  <button onClick={() => setPremoveQueue([])} className={hasPremove ? 'active' : ''} title={hasPremove ? 'Hủy premove' : 'Premove đang bật'}><Timer size={20} /></button>
                </div>
              </section>
            )}
            <div className="match-heading">
              <p>{reviewMode ? 'Game review' : 'Live game'}</p>
              <h1>{reviewMode ? `${playerColor === 'w' ? userName : `AI ${aiLevel.elo}`} vs ${playerColor === 'b' ? userName : `AI ${aiLevel.elo}`}` : statusText(game)}</h1>
              <span>{reviewMode ? `Stockfish: ${stockfishStatus}` : isAiThinking ? `AI ${aiLevel.elo} is thinking...` : `Game ID: ${gameId}`}</span>
            </div>

            <div className="quick-actions">
              <button onClick={startNewGame}>
                <RotateCcw size={18} />
                New game
              </button>
              <button onClick={undoMove} disabled={history.length === 0}>
                <SkipBack size={18} />
                Undo
              </button>
              <button onClick={() => setFlipped((value) => !value)}>
                <Flag size={18} />
                Flip board
              </button>
              {reviewMode && (
                <button onClick={() => {
                  setReviewMode(false);
                  setReviewPly(history.length);
                }}>
                  <Gamepad2 size={18} />
                  Back
                </button>
              )}
            </div>

            <div className="mode-strip">
              <button className={sideChoice === 'w' ? 'active' : ''} onClick={() => changeSideChoice('w')}>White</button>
              <button className={sideChoice === 'b' ? 'active' : ''} onClick={() => changeSideChoice('b')}>Black</button>
              <button className={sideChoice === 'random' ? 'active' : ''} onClick={() => changeSideChoice('random')}>Random</button>
            </div>

            <div className="mode-strip">
              <button className={gameMode === 'bot' ? 'active' : ''} onClick={() => setGameMode('bot')}>Bot</button>
              <button className={gameMode === 'local' ? 'active' : ''} onClick={() => setGameMode('local')}>Local 2P</button>
              <button disabled title="Cần realtime server hoặc Supabase Realtime">Online</button>
            </div>

            {gameMode === 'bot' && (
              <section className="bot-lobby" aria-label="Play Bots">
                <div className="bot-lobby-title">
                  <Bot size={19} />
                  <strong>Play Bots</strong>
                </div>
                <div className="bot-chat-card">
                  <img src={activeBotPersona.avatar} alt={activeBotPersona.name} />
                  <div>
                    <p>{activeBotPersona.chat}</p>
                    <strong>{activeBotPersona.name} <span>{aiLevel.elo}</span></strong>
                  </div>
                </div>
                <div className="bot-family-card">
                  <div>
                    <strong>Pirates</strong>
                    <span>{BOT_PERSONAS.length} bots</span>
                  </div>
                  <div className="bot-avatar-row">
                    {BOT_PERSONAS.map((bot) => (
                      <button
                        className={Number(aiElo) === bot.elo ? 'active' : ''}
                        key={bot.elo}
                        onClick={() => changeAiElo(bot.elo)}
                        title={`${bot.name} - ELO ${bot.elo}`}
                      >
                        <img src={bot.avatar} alt={bot.name} />
                      </button>
                    ))}
                  </div>
                </div>
                {[
                  ['Beginner', 15],
                  ['Intermediate', 15],
                  ['Advanced', 20],
                  ['Master', 10],
                  ['Adaptive', 5]
                ].map(([label, count], index) => (
                  <button className="bot-category-row" key={label} type="button">
                    <img src={BOT_PERSONAS[index % BOT_PERSONAS.length].avatar} alt="" />
                    <strong>{label}</strong>
                    <span>{count} bots</span>
                  </button>
                ))}
              </section>
            )}

            <details className="bot-options" open>
              <summary>Options</summary>
              <div className="time-control-grid">
                {TIME_CONTROLS.map((control) => (
                  <button
                    className={timeControlId === control.id ? 'active' : ''}
                    key={control.id}
                    type="button"
                    onClick={() => changeTimeControl(control.id)}
                  >
                    {control.label.replace('Rapid ', '').replace('Blitz ', '').replace('Bullet ', '')}
                  </button>
                ))}
              </div>
              <div className="variant-card">
                <button className={gameVariant === 'standard' ? 'active' : ''} type="button" onClick={() => changeVariant('standard')}>
                  <strong>Standard</strong>
                  <span>Kiểu chơi bình thường</span>
                </button>
                <button className={gameVariant === 'chess960' ? 'active' : ''} type="button" onClick={() => changeVariant('chess960')}>
                  <strong>Chess960</strong>
                  <span>Hàng quân sau ngẫu nhiên</span>
                </button>
              </div>
              <div className="bot-toggle-list">
                {['Bot Chat', 'Evaluation Bar', 'Threat Arrows', 'Suggestion Arrows', 'Move Feedback', 'Engine'].map((item, index) => (
                  <label key={item}>
                    <span>{item}</span>
                    <input type="checkbox" defaultChecked={index === 0} />
                  </label>
                ))}
              </div>
            </details>

            <div className="ai-summary">
              <Bot size={20} />
              <div>
                <strong>{gameMode === 'bot' ? `${activeBotPersona.name} đang sẵn sàng` : 'Local 2P đã bật'}</strong>
                <span>{gameMode === 'bot' ? `${activeBotPersona.mood}. Depth ${aiLevel.depth}` : 'Hai người chơi cùng một thiết bị.'}</span>
              </div>
            </div>

            {reviewMode && (
              <div className="review-panel">
                <span>Review current game</span>
                <strong>
                  Move {reviewPly} / {history.length}
                </strong>
                {currentReviewAnalysis && (
                  <p className={`move-grade ${currentReviewAnalysis.tone}`}>
                    {currentReviewAnalysis.label}: {currentReviewAnalysis.san}
                    {currentReviewAnalysis.bestMove ? ` | Best: ${currentReviewAnalysis.bestMove}` : currentReviewAnalysis.bestSan !== currentReviewAnalysis.san ? ` | Best: ${currentReviewAnalysis.bestSan}` : ''}
                    {Number.isFinite(currentReviewAnalysis.winLoss) ? ` | Lost: ${currentReviewAnalysis.winLoss}%` : ''}
                  </p>
                )}
                <div>
                  <button onClick={() => reviewStep(-1)} disabled={reviewPly === 0}>Prev</button>
                  <button onClick={() => reviewStep(1)} disabled={reviewPly === history.length}>Next</button>
                  <button onClick={() => setReviewPly(history.length)}>End</button>
                </div>
              </div>
            )}

            <div className="move-list">
              <div className="move-list-head">
                <span>#</span>
                <span>White</span>
                <span>Black</span>
              </div>
              <div className="move-list-body">
                {history.length === 0 && <p className="empty-state">Make the first move.</p>}
                {Array.from({ length: Math.ceil(history.length / 2) }).map((_, index) => (
                  <div className="move-row" key={index}>
                    <span>{index + 1}</span>
                    <button
                      className={stockfishReview[index * 2]?.tone ?? ''}
                      disabled={!history[index * 2]}
                      onClick={() => {
                        setReviewMode(true);
                        setResultDismissed(true);
                        setReviewPly(index * 2 + 1);
                      }}
                    >
                      {history[index * 2]?.san ?? ''}
                    </button>
                    <button
                      className={stockfishReview[index * 2 + 1]?.tone ?? ''}
                      disabled={!history[index * 2 + 1]}
                      onClick={() => {
                        setReviewMode(true);
                        setResultDismissed(true);
                        setReviewPly(index * 2 + 2);
                      }}
                    >
                      {history[index * 2 + 1]?.san ?? ''}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="analysis-card">
              <Gamepad2 size={20} />
              <div>
                <strong>Move review</strong>
                <span>Best/good/mistake/blunder labels use the local evaluation model.</span>
              </div>
            </div>
          </aside>
        </section>
        </>
        )}
        </>
        )}
      </section>

      {showResultDialog && (
        <div className="result-backdrop" role="dialog" aria-modal="true" aria-label="Game result">
          <div className="result-dialog compact-result" data-result={outcome.type}>
            <button className="result-share" aria-label="Share result">↗</button>
            <button className="result-close" aria-label="Close result" onClick={() => setResultDismissed(true)}>×</button>
            <h2>{outcome.type === 'win' ? `You Beat ${activeBotPersona.name}!` : outcome.type === 'loss' ? `${activeBotPersona.name} Won` : 'Draw Game'}</h2>
            <small>{outcome.detail}</small>
            <div className="result-coach">
              <div className="review-coach-avatar">GM</div>
              <p>{outcome.type === 'win' ? 'You had a nice tactical find in this game. Let’s review!' : outcome.type === 'loss' ? 'Good effort. Review the critical moment and try a rematch.' : 'Balanced game. A review can show where both sides missed chances.'}</p>
            </div>
            <div className="result-stats">
              <span><b>{reviewStats.stats.w.best + reviewStats.stats.b.best}</b>Best</span>
              <span><b>{reviewStats.stats.w.excellent + reviewStats.stats.b.excellent}</b>Excellent</span>
              <span><b>{reviewStats.stats.w.good + reviewStats.stats.b.good}</b>Good</span>
            </div>
            <div className="result-actions">
              <button onClick={reviewGame}>Game Review</button>
              <button onClick={() => {
                setResultDismissed(true);
                setBotGameStarted(false);
                startNewGame();
              }}>New Bot</button>
              <button onClick={() => {
                setResultDismissed(true);
                startBotMatch();
              }}>Rematch</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

