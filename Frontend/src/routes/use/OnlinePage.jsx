import PlayPageHeader from '../../components/PlayPageHeader';
import ReviewPage from './ReviewPage';
import React from 'react';
import { apiFetch } from '../../api/request';
import PromotionPicker from '../../components/PromotionPicker';
import { Chess } from 'chess.js';
import { BarChart3, Brain, Copy, Flag, LogIn, Radio, RefreshCw, RotateCcw, Search, Send, ShieldCheck, Swords, Trophy, UserPlus, UserRound, X } from 'lucide-react';
import {
  cancelOnlineQueue,
  currentMatchmakingSessionId,
  fetchOnlineChat,
  fetchOnlineGame,
  joinOnlineSpectators,
  joinOnlineQueue,
  onlineGameEventsUrl,
  reportOnlineGame,
  resignOnlineGame,
  sendOnlineChat,
  sendOnlineDrawAction,
  sendOnlineRematch,
  sendOnlineHeartbeat,
  sendOnlineMove
} from '../../api/online';
import { subscribeToMatchmakingSession } from '../../api/matchmakingRealtime';
import { apiUrl } from '../../api/config';
import { REVIEW_LEGEND, reviewIcon } from '../../data/review';
import { getPieceImage } from '../../game/pieces';
import { normalizePieceSet } from '../../game/constants';
import { chessSoundEvent, chessSoundProfile, playChessSound, preloadChessSounds } from '../../game/chessAudio';
import { squareName } from '../../game/chessLogic';
import { hasPremium, membershipPlan } from '../../membership/plans';
import MembershipBadge from '../../components/MembershipBadge';
import { chooseNewestGameSnapshot, mergeOnlineChatMessages } from '../../game/realtimeState';
import { computeOnlineClocks, parseOnlineTimeControl } from '../../game/onlineClock';

const TIME_CONTROLS = [
  { id: '180+0', label: '3+0' },
  { id: '300+0', label: '5+0' },
  { id: '600+0', label: '10+0' },
  { id: '900+10', label: '15+10' }
];
const REMATCH_RESPONSE_MS = 15_000;
const REPORT_REASONS = [
  { id: 'stalling', label: 'Stalling / cố tình kéo giờ' },
  { id: 'toxic', label: 'Toxic behavior' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'match_abuse', label: 'Match abuse' },
  { id: 'username', label: 'Username violation' },
  { id: 'avatar', label: 'Avatar violation' },
  { id: 'other', label: 'Other' }
];

function statusText(game) {
  if (!game) return 'Sẵn sàng';
  if (game.status === 'waiting') return 'Đang chờ bạn';
  if (game.status === 'checkmate') return `Chiếu hết · ${game.result}`;
  if (game.status === 'draw') return `Hòa cờ · ${game.result}`;
  if (game.status === 'resigned') return `Đầu hàng · ${game.result}`;
  if (game.status === 'abandoned') return 'Ván đấu đã hủy';
  return game.turn === game.playerColor ? 'Lượt của bạn' : 'Lượt đối thủ';
}

function displayName(value, fallback = 'Chờ đối thủ') {
  const name = String(value || '').trim();
  return name && name !== 'Trắng' && name !== 'Đen' ? name : fallback;
}

function formatSearchTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function modeFromTimeControl(value) {
  const [base = '600'] = String(value || '600+0').split('+');
  const seconds = Number(base) || 600;
  if (seconds < 180) return 'bullet';
  if (seconds < 600) return 'blitz';
  if (seconds < 3600) return 'rapid';
  return 'classical';
}

function clientRatingWindow(seconds) {
  if (seconds < 5) return 50;
  if (seconds < 12) return 100;
  if (seconds < 25) return 150;
  return 200;
}

function signedRating(value) {
  if (!Number.isFinite(value)) return '0';
  return value > 0 ? `+${value}` : String(value);
}

const parseTimeControl = parseOnlineTimeControl;

function formatClock(milliseconds) {
  const safeMs = Math.max(0, Number(milliseconds) || 0);
  if (safeMs <= 10_000) {
    const seconds = Math.floor(safeMs / 1000);
    const tenths = Math.floor((safeMs % 1000) / 100);
    return `00:${String(seconds).padStart(2, '0')}.${tenths}`;
  }
  const safeSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(safeSeconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function checkedKingSquare(chess) {
  if (!chess.isCheck()) return null;
  const turn = chess.turn();
  const rows = chess.board();
  for (let row = 0; row < rows.length; row += 1) {
    for (let col = 0; col < rows[row].length; col += 1) {
      const piece = rows[row][col];
      if (piece?.type === 'k' && piece.color === turn) {
        return `${String.fromCharCode(97 + col)}${8 - row}`;
      }
    }
  }
  return null;
}

function onlineOutcome(game, clocks) {
  if (!game || !['checkmate', 'draw', 'resigned', 'abandoned'].includes(game.status)) return null;
  if (game.status === 'abandoned') {
    return { type: 'draw', aborted: true, title: 'Ván đấu đã hủy', detail: 'Opening move was not played in time. Ratings unchanged.' };
  }
  if (game.status === 'draw') {
    return { type: 'draw', title: 'Draw Game', detail: game.result || '1/2-1/2' };
  }
  const winner = game.result === '1-0' ? 'w' : game.result === '0-1' ? 'b' : null;
  const youWon = winner && winner === game.playerColor;
  const reason = game.endReason === 'timeout' || clocks?.[game.turn] === 0
    ? 'on time'
    : game.status === 'checkmate' ? 'by checkmate' : 'by resignation';
  return {
    type: youWon ? 'win' : 'loss',
    title: youWon ? 'You won' : 'You lost',
    detail: `${winner === 'w' ? 'Trắng' : 'Đen'} wins ${reason}`
  };
}

function movePairs(moves = []) {
  return moves.reduce((pairs, move) => {
    const index = Math.floor((move.ply - 1) / 2);
    if (!pairs[index]) pairs[index] = { number: index + 1, white: null, black: null };
    if (move.color === 'w') pairs[index].white = move;
    else pairs[index].black = move;
    return pairs;
  }, []);
}

function isTerminalGame(game) {
  return ['checkmate', 'draw', 'resigned', 'abandoned'].includes(game?.status);
}

function replayOnlineGameAt(moves = [], ply = 0) {
  const positions = buildReplayCache(moves);
  const index = Math.min(Math.max(0, ply), positions.length - 1);
  return positions[index] || new Chess();
}

function buildReplayCache(moves = []) {
  const positions = [new Chess()];
  let chess = new Chess();
  for (const move of moves) {
    try {
      if (move.fenAfter) {
        chess = new Chess(move.fenAfter);
        positions.push(new Chess(chess.fen()));
        continue;
      }
      const played = chess.move({ from: move.from, to: move.to, promotion: move.promotion || undefined });
      if (!played) break;
      positions.push(new Chess(chess.fen()));
    } catch {
      break;
    }
  }
  return positions;
}

function moveToLan(move) {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

function buildOnlineReviewPositions(moves = [], stockfishReview = [], pendingAnalysis = [], replayBoards = []) {
  const existing = new Set([
    ...pendingAnalysis.map((item) => item.ply),
    ...stockfishReview.map((item, index) => (item ? index + 1 : null)).filter(Boolean)
  ]);

  const positions = [];
  const priorMoves = [];

  moves.forEach((move, index) => {
    const priorBoard = replayBoards[index];
    if (!priorBoard) return;
    const fen = priorBoard.fen();
    const moveLan = moveToLan(move);
    if (existing.has(index + 1)) {
      priorMoves.push(moveLan);
      return;
    }
    positions.push({
      ply: index + 1,
      fen,
      move: moveLan,
      san: move.san,
      piece: priorBoard.get(move.from)?.type,
      captured: move.captured || priorBoard.get(move.to)?.type,
      variant: 'standard',
      priorMoves: [...priorMoves]
    });
    priorMoves.push(moveLan);
  });

  return positions;
}

function calculateReviewStats(stockfishReview) {
  const stats = {
    w: Object.fromEntries(REVIEW_LEGEND.map((item) => [item.tone, 0])),
    b: Object.fromEntries(REVIEW_LEGEND.map((item) => [item.tone, 0]))
  };
  const totals = { w: 0, b: 0 };
  const loss = { w: 0, b: 0 };

  stockfishReview.forEach((item) => {
    if (!item || item.analysisError) return;
    const color = item.mover === 'b' ? 'b' : 'w';
    if (stats[color][item.tone] === undefined) stats[color][item.tone] = 0;
    stats[color][item.tone] += 1;
    totals[color] += 1;
    loss[color] += item.accuracy ?? 100 * Math.exp(-0.045 * Number(item.winLoss || 0));
  });

  return {
    stats,
    totals,
    accuracy: {
      w: totals.w ? (loss.w / totals.w).toFixed(1) : '--',
      b: totals.b ? (loss.b / totals.b).toFixed(1) : '--'
    }
  };
}

function playMoveSound(audioRef, move = {}, pieceSet = 'neo', theme = {}) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = audioRef.current || new AudioContext();
  audioRef.current = context;
  playChessSound(context, chessSoundEvent(move), chessSoundProfile(pieceSet, theme));
}

function onlineGameStorageKey(authUser) {
  return `chessarena:online-game:${authUser?.uid || authUser?.id || 'anonymous'}`;
}

function restoredOnlineGameId(authUser) {
  try {
    const value = window.sessionStorage.getItem(onlineGameStorageKey(authUser));
    return /^[0-9a-f-]{36}$/i.test(value || '') ? value : null;
  } catch { return null; }
}

export default function OnlinePage({ authUser, userName, pieceSet, theme, membership, onLogin, onNavigate, onCoachContextChange, historyOnly = false, historyReviewGameId = '' }) {
  const [summary, setSummary] = React.useState({ onlineCount: 0, queueCount: 0 });
  const [timeControl, setTimeControl] = React.useState('600+0');
  const [queueing, setQueueing] = React.useState(false);
  const [queueJoining, setQueueJoining] = React.useState(false);
  const [gameId, setGameId] = React.useState(() => restoredOnlineGameId(authUser));
  const [game, setGame] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [targets, setTargets] = React.useState([]);




  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const [pgnCopied, setPgnCopied] = React.useState(false);
  const [queueStartedAt, setQueueStartedAt] = React.useState(null);
  const [queueSeconds, setQueueSeconds] = React.useState(0);
  const [myRating, setMyRating] = React.useState(400);
  const [queueRatingWindow, setQueueRatingWindow] = React.useState(50);
  const [queueRatingLimit, setQueueRatingLimit] = React.useState(200);
  const [clockNow, setClockNow] = React.useState(Date.now());
  const [showMateBanner, setShowMateBanner] = React.useState(false);
  const [showResultDialog, setShowResultDialog] = React.useState(false);
  const [realtimeConnected, setRealtimeConnected] = React.useState(false);
  const [rematchBusy, setRematchBusy] = React.useState(false);
  const [rematchNow, setRematchNow] = React.useState(Date.now());
  const [reviewMode, setReviewMode] = React.useState(false);
  const [reviewStarted, setReviewStarted] = React.useState(false);
  const [promotionRequest, setPromotionRequest] = React.useState(null);
  const [reviewPly, setReviewPly] = React.useState(0);
  const [stockfishReview, setStockfishReview] = React.useState([]);
  const [stockfishStatus, setStockfishStatus] = React.useState('idle');
  const [pendingAnalysis, setPendingAnalysis] = React.useState([]);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [reportCategory, setReportCategory] = React.useState('toxic');
  const [reportDescription, setReportDescription] = React.useState('');
  const [reportBusy, setReportBusy] = React.useState(false);
  const [chatMessages, setChatMessages] = React.useState([]);
  const [chatBody, setChatBody] = React.useState('');
  const [chatBusy, setChatBusy] = React.useState(false);
  const [spectatorCount, setSpectatorCount] = React.useState(0);
  const [actionConfirm, setActionConfirm] = React.useState(null);

  const pendingMoveRef = React.useRef(false);
  const audioRef = React.useRef(null);
  const gameFetchInFlightRef = React.useRef(null);
  const activeGameIdRef = React.useRef(gameId);
  activeGameIdRef.current = gameId;
  const heartbeatInFlightRef = React.useRef(false);
  const lastPlyRef = React.useRef(0);
  const lastTerminalKeyRef = React.useRef(null);
  const timeoutRefreshRef = React.useRef(null);
  const openingRefreshRef = React.useRef(null);
  const plan = membershipPlan(membership);
  const premiumReview = hasPremium(membership, 'pro');
  const queryReviewId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('review')
    : null;
  const historyReviewId = historyReviewGameId || queryReviewId;
  const openedFromHistory = historyOnly || Boolean(historyReviewId);
  const onlineIdentity = authUser?.uid || authUser?.id || 'anonymous';
  const onlineIdentityRef = React.useRef(onlineIdentity);

  React.useEffect(() => {
    if (!authUser || openedFromHistory) return;
    if (onlineIdentityRef.current !== onlineIdentity) {
      onlineIdentityRef.current = onlineIdentity;
      setGame(null);
      setGameId(restoredOnlineGameId(authUser));
      setShowResultDialog(false);
      return;
    }
    try {
      const key = onlineGameStorageKey(authUser);
      if (gameId) window.sessionStorage.setItem(key, gameId);
      else window.sessionStorage.removeItem(key);
    } catch {
      // Session storage is an identifier hint only; the server remains authoritative.
    }
  }, [authUser, gameId, onlineIdentity, openedFromHistory]);

  React.useEffect(() => {
    const prepareAudio = () => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioRef.current) audioRef.current = new AudioContextClass();
      preloadChessSounds(audioRef.current);
    };
    window.addEventListener('pointerdown', prepareAudio, { once: true });
    return () => window.removeEventListener('pointerdown', prepareAudio);
  }, []);

  const applyGameSnapshot = React.useCallback((incomingGame) => {
    if (!incomingGame) return;
    setGame((currentGame) => chooseNewestGameSnapshot(currentGame, incomingGame));
  }, []);

  const applySavedReview = React.useCallback((reviewMoves) => {
    if (!Array.isArray(reviewMoves) || reviewMoves.length === 0) return;
    setStockfishReview((current) => {
      const merged = [...current];
      reviewMoves.forEach((item) => { if (item?.ply > 0) merged[item.ply - 1] = item; });
      return merged;
    });
    setReviewStarted(true);
    setStockfishStatus('ready');
  }, []);

  const moves = game?.moves || [];
  const liveBoard = React.useMemo(() => new Chess(game?.fen), [game?.fen]);
  const reviewBoards = React.useMemo(() => buildReplayCache(moves), [moves]);
  const reviewBoard = reviewBoards[Math.min(Math.max(0, reviewPly), reviewBoards.length - 1)] || reviewBoards[0] || new Chess();
  const board = reviewMode ? reviewBoard : liveBoard;
  const flipped = game?.playerColor === 'b';
  const isMyTurn = game?.status === 'active' && game.turn === game.playerColor;
  React.useEffect(() => setPromotionRequest(null), [game?.id, game?.fen, reviewMode]);
  const terminalGame = isTerminalGame(game);
  const playingView = Boolean(game && game.status !== 'waiting') || reviewMode;
  const terminalKey = terminalGame
    ? `${game.id}:${game.status}:${game.result}:${game.moves?.length || 0}`
    : null;
  const reviewStats = React.useMemo(() => calculateReviewStats(stockfishReview), [stockfishReview]);
  const currentReviewAnalysis = reviewMode ? stockfishReview[reviewPly - 1] : null;
  const reviewBadge = currentReviewAnalysis ?? (reviewMode && reviewPly > 0 ? { label: 'Analyzing', tone: 'loading' } : null);
  const reviewingLiveGame = reviewMode && !terminalGame;
  const coachContext = React.useMemo(() => {
    if (!game || !board) return null;
    const visiblePly = reviewMode ? reviewPly : moves.length;
    const visibleMoves = moves.slice(0, visiblePly);
    const latestMove = visibleMoves.at(-1);
    return {
      hasBoardContext: true,
      fen: board.fen(),
      pgn: visibleMoves.map((move,index) => `${index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ''}${move.san || ''}`).join(' '),
      turn: board.turn(),
      playerColor: game.playerColor || '',
      latestMove: latestMove?.san || latestMove?.lan || '',
      previousFen: latestMove ? reviewBoards[visiblePly - 1]?.fen() || '' : '',
      latestLan: latestMove ? moveToLan(latestMove) : '',
      recentMoves: moves.slice(-12).map((move) => `${move.ply}. ${move.color === 'w' ? 'Trắng' : 'Đen'} ${move.san || move.lan}`),
      review: currentReviewAnalysis ? {
        label: currentReviewAnalysis.label,
        tone: currentReviewAnalysis.tone,
        bestMove: currentReviewAnalysis.bestMove || '',
        centipawnLoss: currentReviewAnalysis.centipawnLoss,
        winLoss: currentReviewAnalysis.winLoss
      } : null
    };
  }, [board, currentReviewAnalysis, game, moves, reviewBoards, reviewMode, reviewPly]);

  React.useEffect(() => {
    onCoachContextChange?.(coachContext);
    return () => onCoachContextChange?.(null);
  }, [coachContext, onCoachContextChange]);

  const refreshGame = React.useCallback(async (id = gameId) => {
    if (!id || gameFetchInFlightRef.current?.id === id) return;
    const request = { id };
    gameFetchInFlightRef.current = request;
    try {
      const data = await fetchOnlineGame(id);
      if (activeGameIdRef.current !== id) return;
      if (!pendingMoveRef.current) applyGameSnapshot(data.game);
      setGameId(data.game.id);
      applySavedReview(data.reviewMoves);

    } catch {
      if (game?.status === 'active') setMessage('Connection interrupted. Reconnecting to your game...');
    } finally {
      if (gameFetchInFlightRef.current === request) gameFetchInFlightRef.current = null;
    }
  }, [applyGameSnapshot, applySavedReview, game?.status, gameId]);

  const openPlayerProfile = (player) => {
    if (!player?.id) return;
    window.history.pushState(null, '', `/profile/${encodeURIComponent(player.id)}`);
    window.dispatchEvent(new window.PopStateEvent('popstate'));
  };

  React.useEffect(() => {
    if (!authUser || openedFromHistory) return undefined;
    let disposed = false;
    const openRequestedGame = async () => {
      const id = new URLSearchParams(window.location.search).get('game');
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
      try {
        const data = await fetchOnlineGame(id);
        if (disposed) return;
        setQueueing(false);
        setQueueStartedAt(null);
        setQueueSeconds(0);
        setReviewMode(false);
        setShowResultDialog(false);
        setSelected(null);
        setTargets([]);
        setGame(data.game);
        setGameId(data.game.id);
        applySavedReview(data.reviewMoves);
        setMessage('Đã vào trận. Chúc hai bạn chơi vui!');
      } catch (error) { if (!disposed) setMessage(error.message); }
    };
    openRequestedGame();
    window.addEventListener('popstate', openRequestedGame);
    return () => { disposed = true; window.removeEventListener('popstate', openRequestedGame); };
  }, [applySavedReview, authUser, openedFromHistory]);

  React.useEffect(() => {
    if (!authUser || openedFromHistory) return undefined;

    let cancelled = false;
    const tick = async () => {
      if (heartbeatInFlightRef.current) return;
      heartbeatInFlightRef.current = true;
      try {
        const data = await sendOnlineHeartbeat(queueing, gameId);
        if (data.authenticated === false) {
          if (!cancelled) {
            setQueueing(false);
            setQueueStartedAt(null);
            setQueueSeconds(0);
          }
          return;
        }
        if (!cancelled) {
          setSummary({ onlineCount: data.onlineCount, queueCount: data.queueCount });
          if (data.me?.rating) setMyRating(data.me.rating);
          if (data.ratingWindow != null) setQueueRatingWindow(data.ratingWindow);
          if (data.ratingLimit != null) setQueueRatingLimit(data.ratingLimit);
          if (queueing && data.joinedAt) setQueueStartedAt(current => current ?? Date.parse(data.joinedAt));
          if (data.game && data.currentGameId) {
            const reconnecting = !gameId && !queueing;
            setQueueing(false);
            setQueueStartedAt(null);
            setQueueSeconds(0);
            applyGameSnapshot(data.game);
            setGameId(data.currentGameId);
            setMessage(reconnecting ? 'Đã khôi phục ván đang chơi.' : 'Matched. Loading board...');
          } else if (queueing && !data.queueTicketId) {
            setQueueing(false);
            setQueueStartedAt(null);
            setMessage('Lượt tìm trận đã kết thúc hoặc hết hạn kết nối. Nhấn tìm trận để thử lại.');
          }
        }
      } catch (error) {
        if (!cancelled && error.data?.code === 'DATABASE_UPGRADE_REQUIRED') {
          setQueueing(false);
          setQueueStartedAt(null);
          setMessage(error.message);
        } else if (!cancelled && queueing) setMessage('Kết nối ghép trận đang gián đoạn. Hệ thống đang thử kết nối lại.');
      } finally {
        heartbeatInFlightRef.current = false;
      }
    };
    tick();
    const intervalMs = queueing ? 3000 : gameId && !realtimeConnected ? 2500 : gameId ? 10_000 : 15_000;
    const timer = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyGameSnapshot, authUser, gameId, openedFromHistory, queueing, realtimeConnected]);

  React.useEffect(() => {
    if (!queueing || !authUser) return undefined;
    return subscribeToMatchmakingSession(currentMatchmakingSessionId(), async ({ game_id: matchedGameId }) => {
      try {
        const data = await sendOnlineHeartbeat(true, matchedGameId || null);
        if (!data.currentGameId) return;
        setQueueing(false);
        setQueueStartedAt(null);
        setQueueSeconds(0);
        if (data.game) applyGameSnapshot(data.game);
        setGameId(data.currentGameId);
        setMessage('Matched. Loading board...');
      } catch {
        // The regular heartbeat remains the recovery path.
      }
    });
  }, [applyGameSnapshot, authUser, queueing]);



  React.useEffect(() => {
    if (!authUser) return;
    const reviewGameId = historyReviewId;
    if (!reviewGameId) return;
    let cancelled = false;
    setBusy(true);
    setQueueing(false);
    setQueueStartedAt(null);
    setQueueSeconds(0);
    setGame(null);
    setGameId(null);
    setRealtimeConnected(false);
    setMessage('Đang tải ván đấu từ lịch sử...');
    fetchOnlineGame(reviewGameId)
      .then((data) => {
        if (cancelled) return;
        if (!isTerminalGame(data.game)) throw new Error('Chỉ có thể Review sau khi ván đấu kết thúc.');
        setGameId(data.game.id);
        setGame(data.game);
        setReviewMode(true);
        setReviewStarted(Boolean(data.reviewMoves?.length));
        setReviewPly((data.game.moves || []).length);
        setShowResultDialog(false);
        setShowMateBanner(false);
        setStockfishReview([]);
        applySavedReview(data.reviewMoves);
        setPendingAnalysis([]);
        setMessage('Đang xem lại ván online đã lưu. Dùng mũi tên trái/phải để chuyển nước.');
      })
      .catch((error) => { if (!cancelled) setMessage(error.message); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [applySavedReview, authUser, historyReviewId]);

  React.useEffect(() => {
    if (!gameId || openedFromHistory) return undefined;
    refreshGame(gameId);
    return undefined;
  }, [gameId, openedFromHistory, refreshGame]);

  React.useEffect(() => {
    if (!authUser || !gameId || openedFromHistory || typeof window.EventSource === 'undefined') {
      setRealtimeConnected(false);
      return undefined;
    }

    let closed = false;
    const source = new window.EventSource(onlineGameEventsUrl(gameId), { withCredentials: true });

    source.addEventListener('open', () => {
      if (!closed) setRealtimeConnected(false);
    });

    source.addEventListener('realtime-status', (event) => {
      if (closed) return;
      try {
        const data = JSON.parse(event.data);
        setRealtimeConnected(Boolean(data.connected));
      } catch {
        setRealtimeConnected(false);
      }
    });

    source.addEventListener('game', (event) => {
      if (closed) return;
      try {
        const data = JSON.parse(event.data);
          if (!data.game || activeGameIdRef.current !== gameId || data.game.id !== gameId) return;
          // Version/ply ordering rejects stale snapshots, including while our
          // HTTP response is pending. Do not discard the opponent's quick reply.
          applyGameSnapshot(data.game);
          setGameId(data.game.id);
      } catch {
        // Ignore malformed stream events; manual Refresh remains available.
      }
    });

    source.addEventListener('chat', (event) => {
      if (closed) return;
      try {
        const data = JSON.parse(event.data);
        if (data.message) setChatMessages((current) => mergeOnlineChatMessages(current, data.message));
      } catch {
        // A malformed chat event must not interrupt board updates.
      }
    });

    source.addEventListener('error', () => {
      if (!closed) setRealtimeConnected(false);
    });

    return () => {
      closed = true;
      setRealtimeConnected(false);
      source.close();
    };
  }, [applyGameSnapshot, authUser, gameId, openedFromHistory]);

  React.useEffect(() => {
    const pendingRematch = game?.rematch && !game.rematch.response;
    if (!pendingRematch) return undefined;

    setRematchNow(Date.now());
    const expiresAt = Date.parse(game.rematch.expiresAt || '');
    const remainingMs = Number.isFinite(expiresAt)
      ? Math.max(0, expiresAt - Date.now())
      : REMATCH_RESPONSE_MS;
    const countdown = window.setInterval(() => setRematchNow(Date.now()), 250);
    const expiry = window.setTimeout(async () => {
      setRematchNow(Date.now());
      if (!game.rematch.requestedByYou) {
        try {
          const data = await sendOnlineRematch(game.id, 'decline');
          applyGameSnapshot(data.game);
        } catch {
          // The server may already have expired and broadcast this request.
        }
      }
    }, remainingMs + 20);
    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(expiry);
    };
  }, [applyGameSnapshot, game?.id, game?.rematch?.expiresAt, game?.rematch?.response, game?.rematch?.requestedBy, game?.rematch?.requestedByYou]);

  React.useEffect(() => {
    if ((!queueing && !queueJoining) || !queueStartedAt) return undefined;
    const timer = window.setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - queueStartedAt) / 1000));
      setQueueSeconds(elapsed);
      if (elapsed === 15) setMessage('The search is taking a little longer. We are keeping your place in line.');
    }, 1000);
    return () => window.clearInterval(timer);
  }, [queueStartedAt, queueing, queueJoining]);

  React.useEffect(() => {
    if (!game?.id || game.status !== 'active') return undefined;
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 50);
    return () => window.clearInterval(timer);
  }, [game?.id, game?.status, game?.turn]);

  React.useEffect(() => {
    const nextPly = game?.moves?.length || 0;
    if (!game?.id) {
      lastPlyRef.current = 0;
      return;
    }
    if (nextPly > lastPlyRef.current) {
      if (!pendingMoveRef.current) playMoveSound(audioRef, game.moves?.at(-1), pieceSet, theme);
      lastPlyRef.current = nextPly;
    } else if (nextPly < lastPlyRef.current) {
      lastPlyRef.current = nextPly;
    }
  }, [game?.id, game?.moves?.length]);

  React.useEffect(() => {
    if (!terminalKey) {
      setShowMateBanner(false);
      setShowResultDialog(false);
      lastTerminalKeyRef.current = null;
      return undefined;
    }
    if (reviewMode) return undefined;
    lastTerminalKeyRef.current = terminalKey;
    setShowResultDialog(false);
    setShowMateBanner(game.status === 'checkmate');
    const bannerTimer = window.setTimeout(() => {
      setShowMateBanner(false);
      setShowResultDialog(true);
    }, game.status === 'checkmate' ? 1050 : 150);
    return () => window.clearTimeout(bannerTimer);
  }, [game?.status, reviewMode, terminalKey]);

  React.useEffect(() => {
    if (!openedFromHistory || !terminalGame || !reviewStarted || moves.length === 0) return;
    const missing = buildOnlineReviewPositions(moves, stockfishReview, pendingAnalysis, reviewBoards);
    if (missing.length) setPendingAnalysis((current) => [...current, ...missing]);
  }, [openedFromHistory, terminalGame, reviewStarted, moves, stockfishReview, pendingAnalysis, reviewBoards]);

  const analysisQueueRef=React.useRef(pendingAnalysis);
  analysisQueueRef.current=pendingAnalysis;
  const firstAnalysisKey=pendingAnalysis[0]?JSON.stringify(pendingAnalysis[0]):'';
  const [analysisRetry,setAnalysisRetry]=React.useState(0);
  React.useEffect(() => {
    if (!openedFromHistory || !terminalGame || !firstAnalysisKey) return undefined;
    const pendingAnalysis=analysisQueueRef.current;
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),30000);

    let cancelled = false;
    const positions = pendingAnalysis.slice(0, 3);
    setStockfishStatus('loading');
    apiFetch(apiUrl('/api/analysis/review'), {
      timeoutMs: 30000,
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal:controller.signal,
      body: JSON.stringify({ gameId: game?.id || gameId || historyReviewId || '', positions, quality:'quick' })
    })
      .then(async (response) => {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Analysis API is not returning JSON. Check that the backend API URL points to Next.js, not the frontend page.');
        }
        const data = await response.json();
        return { response, data };
      })
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || 'Stockfish review failed.');
        if (positions.some(position=>!data.results?.some(item=>item.ply===position.ply&&item.tone))) throw new Error('Chưa nhận đủ kết quả. Hãy thử lại.');
        setStockfishReview((current) => {
          const next = [...current];
          (data.results ?? []).forEach((item) => {
            next[item.ply - 1] = item;
          });
          return next;
        });
        setPendingAnalysis((current) => current.filter((item) => !positions.some((done) => done.ply === item.ply)));
        setStockfishStatus('ready');
      })
      .catch((error) => {
        if (!cancelled) setStockfishStatus(error.message || 'Stockfish unavailable');
      }).finally(()=>window.clearTimeout(timeout));

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [openedFromHistory, terminalGame, firstAnalysisKey, game?.id, gameId, historyReviewId, analysisRetry]);

  React.useEffect(() => {
    if (game?.rematch?.response === 'accepted' && game.rematch.gameId && game.rematch.gameId !== game.id) {
      setReviewMode(false);
      setShowResultDialog(false);
      setShowMateBanner(false);
      setSelected(null);
      setTargets([]);
      setStockfishReview([]);
      setPendingAnalysis([]);
      setGameId(game.rematch.gameId);
      setGame(null);
      setMessage('Rematch accepted. Loading new game...');
    } else if (game?.rematch?.response === 'declined') {
      setMessage('Opponent declined the rematch.');
    }
  }, [game]);

  const startQueue = async () => {
    if (busy || queueing || queueJoining) return;
    setBusy(true);
    setQueueJoining(true);
    setQueueStartedAt(Date.now());
    setQueueSeconds(0);
    setMessage('');
    activeGameIdRef.current = null;
    setGameId(null);
    setGame(null);
    setReviewMode(false);
    setShowResultDialog(false);
    setShowMateBanner(false);
    setStockfishReview([]);
    setPendingAnalysis([]);
    setSelected(null);
    setTargets([]);
    try {
      const data = await joinOnlineQueue(timeControl);
      setSummary({ onlineCount: data.onlineCount, queueCount: data.queueCount });
      if (data.status === 'matched') {
        setQueueing(false);
        setQueueStartedAt(null);
        setQueueSeconds(0);
        if (data.game) applyGameSnapshot(data.game);
        setGameId(data.gameId);
        setMessage('Matched. Loading board...');
      } else {
        setQueueing(true);
        setQueueRatingWindow(data.ratingWindow ?? 50);
        setQueueRatingLimit(data.ratingLimit ?? 200);
        setMessage('Finding a real player...');
      }
    } catch (error) {
      const message = error?.message || '';
      setMessage(
        message && !message.toLowerCase().includes('failed to fetch')
          ? message
          : 'Cannot reach matchmaking right now. Please check the connection and try again.'
      );
    } finally {
      setQueueJoining(false);
      setBusy(false);
    }
  };

  const cancelQueue = async () => {
    setBusy(true);
    try {
      const data = await cancelOnlineQueue();
      setSummary({ onlineCount: data.onlineCount, queueCount: data.queueCount });
      setQueueing(false);
      setQueueStartedAt(null);
      setQueueSeconds(0);
      setQueueRatingWindow(50);
      if (data.status === 'matched' && data.gameId) {
        setGameId(data.gameId);
        setMessage('Đối thủ đã được ghép trước khi hủy. Đang vào trận...');
      } else setMessage('Đã hủy tìm trận.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };





  const copyGamePgn = async () => {
    const pgn = game?.pgn || (game?.moves || []).map((move) => move.san).join(' ');
    if (!pgn) {
      setMessage('No PGN to copy yet.');
      return;
    }
    await navigator.clipboard?.writeText(pgn).catch(() => {});
    setPgnCopied(true);
    window.setTimeout(() => setPgnCopied(false), 1800);
    setMessage('PGN copied.');
  };

  const leaveGameView = async () => {
    if (queueing) {
      await cancelQueue();
      return;
    }
    setGameId(null);
    setGame(null);
    setReviewMode(false);
    setShowResultDialog(false);
    setShowMateBanner(false);
    setStockfishReview([]);
    setPendingAnalysis([]);
    setSelected(null);
    setTargets([]);
    setQueueing(false);
    setQueueStartedAt(null);
    setQueueSeconds(0);
    setQueueRatingWindow(50);
    setMessage('Back to online lobby.');
  };

  const playOnlineMove = async (from, to, chosenPromotion) => {
    if (!game || reviewMode || terminalGame || !isMyTurn || busy || !from || !to) return;
    const choices = board.moves({ square: from, verbose: true }).filter((move) => move.to === to);
    if (!choices.length) return;
    if (!chosenPromotion && choices.some((move) => move.promotion)) {
      setPromotionRequest({ from, to, color: board.turn() });
      return;
    }
    const promotion = chosenPromotion;
    if (promotion && !choices.some((move) => move.promotion === promotion)) return;
    setPromotionRequest(null);
    const optimisticChess = new Chess(game.fen);
    const played = optimisticChess.move({ from, to, promotion });
    if (!played) {
      setSelected(null);
      setTargets([]);
      return;
    }

    const previousGame = game;
    const optimisticMove = {
      ply: moves.length + 1,
      color: game.playerColor,
      san: played.san,
      lan: `${played.from}${played.to}${played.promotion ?? ''}`,
      from: played.from,
      to: played.to,
      promotion: played.promotion,
      captured: played.captured,
      flags: played.flags,
      fenAfter: optimisticChess.fen(),
      createdAt: new Date().toISOString()
    };
    setBusy(true);
    setSelected(null);
    setTargets([]);
    pendingMoveRef.current = true;
    playMoveSound(audioRef, played, pieceSet, theme);
    const optimisticClocks = computeOnlineClocks(game, Date.parse(optimisticMove.createdAt));
    optimisticClocks[game.playerColor] += parseOnlineTimeControl(game.timeControl).incrementSeconds * 1000;
    setGame({
      ...game,
      clocks: optimisticClocks,
      clockSnapshotAt: optimisticMove.createdAt,
      fen: optimisticChess.fen(),
      pgn: optimisticChess.pgn(),
      turn: optimisticChess.turn(),
      moves: [...moves, optimisticMove]
    });
    try {
      const data = await sendOnlineMove(game.id, { from, to, promotion });
      applyGameSnapshot(data.game);
    } catch (error) {
      if (error.data?.game) applyGameSnapshot(error.data.game);
      else setGame(current => Number(current?.stateVersion || 0) > Number(previousGame.stateVersion || 0) ? current : previousGame);
      setMessage(error.message);
      refreshGame(game.id);
    } finally {
      pendingMoveRef.current = false;
      setBusy(false);
    }
  };

  const chooseSquare = async (square) => {
    if (!game || reviewMode || terminalGame || !isMyTurn || busy) return;
    const piece = board.get(square);
    if (!selected || piece?.color === game.playerColor) {
      if (piece?.color !== game.playerColor) return;
      setSelected(square);
      setTargets(board.moves({ square, verbose: true }).map((move) => move.to));
      return;
    }
    await playOnlineMove(selected, square);
  };

  const resign = async () => {
    if (!game || game.status !== 'active') return;
    setActionConfirm(null);
    setBusy(true);
    try {
      const data = await resignOnlineGame(game.id);
      applyGameSnapshot(data.game);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const drawAction = async (action) => {
    if (!game?.id || game.status !== 'active') return;
    if (action === 'offer') setActionConfirm(null);
    setBusy(true);
    try {
      const data = await sendOnlineDrawAction(game.id, action);
      applyGameSnapshot(data.game);
      setMessage(data.game?.status !== 'active' && data.game?.status !== 'draw'
        ? 'V?n ??u ?? k?t th?c.'
        : action === 'offer'
        ? 'Đã gửi đề nghị hòa.'
        : action === 'accept'
          ? 'Hai bên đã đồng ý hòa.'
          : 'Đề nghị hòa đã được đóng.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const submitChat = async (event) => {
    event.preventDefault();
    if (!game?.id || !chatBody.trim()) return;
    setChatBusy(true);
    try {
      const data = await sendOnlineChat(game.id, chatBody.trim());
      setChatMessages((current) => mergeOnlineChatMessages(current, data.message));
      setChatBody('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setChatBusy(false);
    }
  };

  const undoLastMove = () => {
    if (!game || moves.length === 0) return;
    setReviewMode(true);
    setReviewPly((current) => reviewMode ? Math.max(0, current - 1) : Math.max(0, moves.length - 1));
    setSelected(null);
    setTargets([]);
    setMessage('Reviewing an earlier position. Your live game continues normally.');
  };

  const redoLastMove = () => {
    if (!reviewMode) return;
    if (reviewPly >= moves.length - 1) {
      setReviewMode(false);
      setReviewPly(moves.length);
      setMessage('Returned to the live position.');
      return;
    }
    setReviewPly((current) => Math.min(moves.length, current + 1));
  };

  const showPositionAt = (ply) => {
    setReviewMode(true);
    setReviewPly(ply);
    setSelected(null);
    setTargets([]);
  };

  const openOnlineReview = () => {
    if (!terminalGame || moves.length === 0) {
      setMessage('Chưa có nước đi để đánh giá.');
      return;
    }
    window.history.pushState(null, '', `/review/${encodeURIComponent(game.id)}`);
    window.dispatchEvent(new window.PopStateEvent('popstate'));
  };

  const queueOnlineReview = React.useCallback(() => {
    if (!openedFromHistory || !terminalGame || !moves.length) return;
    setReviewStarted(true);
    const missing = buildOnlineReviewPositions(moves, stockfishReview, pendingAnalysis, reviewBoards);
    if (missing.length) setPendingAnalysis((current) => {
      const existing = new Set(current.map((item) => item.ply));
      return [...current, ...missing.filter((item) => !existing.has(item.ply))];
    });
  }, [openedFromHistory, terminalGame, moves, pendingAnalysis, reviewBoards, stockfishReview]);

  const reviewStep = (direction) => {
    setReviewPly((current) => Math.min(moves.length, Math.max(0, current + direction)));
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!game?.id) return;
    setReportBusy(true);
    try {
      await reportOnlineGame(game.id, {
        category: reportCategory,
        description: reportDescription
      });
      setReportOpen(false);
      setReportDescription('');
      setMessage('Report đã được gửi tới moderation team.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setReportBusy(false);
    }
  };

  React.useEffect(() => {
    if (!reviewMode) return undefined;

    const handleKeyDown = (event) => {
      const target = event.target;
      const isEditable = target?.isContentEditable
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
      if (isEditable || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;

      event.preventDefault();
      setReviewPly((current) => Math.min(
        moves.length,
        Math.max(0, current + (event.key === 'ArrowLeft' ? -1 : 1))
      ));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moves.length, reviewMode]);

  const requestRematch = async (action = 'request') => {
    if (!game || !terminalGame) return;
    setRematchBusy(true);
    try {
      const data = await sendOnlineRematch(game.id, action);
      if (data.game?.id && data.game.id !== game.id) {
        applyGameSnapshot(data.game);
        setGameId(data.game.id);
        setReviewMode(false);
        setShowResultDialog(false);
        setShowMateBanner(false);
        setMessage('Rematch started.');
      } else if (data.game) {
        applyGameSnapshot(data.game);
        setMessage(action === 'request'
          ? 'Rematch request sent.'
          : action === 'decline'
            ? 'Rematch declined.'
            : 'Rematch accepted.');
      }
    } catch (error) {
      if (error.data?.game) applyGameSnapshot(error.data.game);
      setMessage(error.message);
    } finally {
      setRematchBusy(false);
    }
  };

  const selfName = displayName(userName || authUser?.displayName, 'Chờ đối thủ');
  const isSpectatorView = Boolean(game && !game.white?.you && !game.black?.you);

  React.useEffect(() => {
    if (!game?.id) {
      setChatMessages([]);
      setSpectatorCount(0);
      return undefined;
    }
    let cancelled = false;
    const refreshSideChannel = async () => {
      try {
        const [chatData, spectatorData] = await Promise.all([
          fetchOnlineChat(game.id),
          isSpectatorView ? joinOnlineSpectators(game.id) : Promise.resolve(null)
        ]);
        if (!cancelled) {
          setChatMessages((current) => mergeOnlineChatMessages(current, chatData.messages || []));
          if (spectatorData) setSpectatorCount(spectatorData.spectators || 0);
        }
      } catch {
        // The game stream remains usable when chat or spectator presence is unavailable.
      }
    };
    refreshSideChannel();
    const interval = isSpectatorView ? window.setInterval(async () => {
      try {
        const spectatorData = await joinOnlineSpectators(game.id);
        if (!cancelled) setSpectatorCount(spectatorData.spectators || 0);
      } catch {
        // Spectator counts are non-critical.
      }
    }, 10000) : null;
    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [game?.id, isSpectatorView]);
  const opponentPlayer = game?.white?.you ? game.black : game?.black?.you ? game.white : null;
  const topPlayer = isSpectatorView ? game?.black : opponentPlayer;
  const bottomPlayer = isSpectatorView ? game?.white : (game?.white?.you ? game.white : game?.black?.you ? game.black : null);
  const topName = displayName(topPlayer?.name, 'Chờ đối thủ');
  const topPhotoURL = topPlayer?.photoURL;
  const topRating = topPlayer?.rating ?? '—';
  const topLabel = isSpectatorView ? 'Đen' : game?.status === 'active' ? 'Đối thủ' : game?.status === 'waiting' ? 'Đang chờ' : 'Đối thủ';
  const bottomName = isSpectatorView ? displayName(bottomPlayer?.name, 'Chờ đối thủ') : selfName;
  const selfPlayer = bottomPlayer;
  const bottomPhotoURL = isSpectatorView ? bottomPlayer?.photoURL : selfPlayer?.photoURL || authUser?.photoURL;
  const bottomRating = bottomPlayer?.rating || myRating;
  const activeQueueWindow = queueing ? Math.max(queueRatingWindow, clientRatingWindow(queueSeconds)) : queueRatingWindow;
  const queueMinRating = Math.max(100, myRating - queueRatingLimit);
  const queueMaxRating = Math.min(4000, myRating + queueRatingLimit);
  const activeMode = modeFromTimeControl(timeControl);
  const playerColorLabel = game?.playerColor === 'w' ? 'Trắng' : game?.playerColor === 'b' ? 'Đen' : 'Chọn thời gian';
  const pairs = movePairs(moves);
  const topColor = isSpectatorView ? 'b' : game?.playerColor === 'w' ? 'b' : 'w';
  const bottomColor = isSpectatorView ? 'w' : game?.playerColor || 'w';
  const onlinePieceSets = {
    w: normalizePieceSet(game?.white?.pieceSet || pieceSet),
    b: normalizePieceSet(game?.black?.pieceSet || pieceSet)
  };
  const { baseSeconds } = parseTimeControl(game?.timeControl || timeControl);
  const clocks = computeOnlineClocks(game, clockNow);
  const topClock = formatClock(clocks?.[topColor] ?? baseSeconds * 1000);
  const bottomClock = formatClock(clocks?.[bottomColor] ?? baseSeconds * 1000);
  const topClockLow = (clocks?.[topColor] ?? baseSeconds * 1000) <= 30_000;
  const bottomClockLow = (clocks?.[bottomColor] ?? baseSeconds * 1000) <= 30_000;
  const lastMove = reviewMode ? moves[reviewPly - 1] : moves.at(-1);
  const checkedSquare = reviewMode ? null : checkedKingSquare(board);
  const outcome = onlineOutcome(game, clocks);
  const rematchRequest = game?.rematch;
  const rematchExpiresAt = Date.parse(rematchRequest?.expiresAt || '');
  const rematchRemainingMs = Number.isFinite(rematchExpiresAt) ? Math.max(0, rematchExpiresAt - rematchNow) : 0;
  const rematchPending = Boolean(rematchRequest && !rematchRequest.response && rematchRemainingMs > 0);
  const rematchFromOpponent = Boolean(terminalGame && rematchRequest && !rematchRequest.requestedByYou && !rematchRequest.response && rematchRemainingMs > 0);
  const rematchSecondsLeft = Math.max(1, Math.ceil(rematchRemainingMs / 1000));
  const openingExpiresAt = Date.parse(game?.openingDeadline?.expiresAt || '');
  const openingRemainingMs = game?.status === 'active' && Number.isFinite(openingExpiresAt)
    ? Math.max(0, openingExpiresAt - clockNow)
    : null;
  const openingTurnName = game?.openingDeadline?.color === game?.playerColor ? 'Bạn' : 'Đối thủ';

  React.useEffect(() => {
    if (openedFromHistory || !game?.id || game.status !== 'active' || !game.turn || (clocks?.[game.turn] ?? 1) > 0) {
      if (game?.status !== 'active') timeoutRefreshRef.current = null;
      return;
    }
    const key = `${game.id}:${game.turn}:${moves.length}`;
    if (timeoutRefreshRef.current === key) return;
    timeoutRefreshRef.current = key;
    setBusy(true);
    Promise.resolve(refreshGame(game.id)).finally(() => setBusy(false));
  }, [clocks, game?.id, game?.status, game?.turn, moves.length, openedFromHistory, refreshGame]);

  React.useEffect(() => {
    if (openedFromHistory || !game?.id || game.status !== 'active' || !game.openingDeadline || openingRemainingMs === null || openingRemainingMs > 0) {
      if (game?.status !== 'active') openingRefreshRef.current = null;
      return;
    }
    const key = `${game.id}:opening:${game.openingDeadline.color}`;
    if (openingRefreshRef.current === key) return;
    openingRefreshRef.current = key;
    Promise.resolve(refreshGame(game.id)).catch(() => {});
  }, [game?.id, game?.openingDeadline, game?.status, openedFromHistory, openingRemainingMs, refreshGame]);

  if (!authUser) {
    return (
      <section className="online-workspace">
        <div className="online-auth-required">
          <ShieldCheck size={46} />
          <h1>Đăng nhập để chơi online</h1>
          <p>Tìm đối thủ cùng trình độ hoặc gửi lời mời cho bạn bè của bạn.</p>
          <button onClick={onLogin}><LogIn size={18} /> Đăng nhập</button>
        </div>
      </section>
    );
  }

  if (openedFromHistory && !game) {
    return (
      <section className="online-workspace">
        <div className="online-history-loading">
          <div className="online-history-board" aria-hidden="true">
            {Array.from({ length: 16 }).map((_, index) => <span key={index} />)}
          </div>
          <span>Game Review</span>
          <h1>{busy ? 'Đang mở lại ván đấu' : 'Chưa mở được Review'}</h1>
          <p>{message || 'Đang tải bàn cờ và danh sách nước đi từ lịch sử online.'}</p>
          {!busy && <button type="button" onClick={() => onNavigate?.('history')}>Về lịch sử</button>}
        </div>
      </section>
    );
  }

  if (openedFromHistory && game) {
    return (
      <section className="online-workspace history-review-workspace">
        <main className="online-layout review-page-layout">
          <section className="online-board-section board-area">
            <div className="online-player-bar top">
              <button className="online-player-profile-button" disabled={!topPlayer?.id} onClick={() => openPlayerProfile(topPlayer)} type="button">
                <PlayerAvatar name={topName} photoURL={topPhotoURL} />
                <strong title={topName}>{topName}</strong>
                <MembershipBadge tier={topPlayer?.membershipTier} compact />
              </button>
              <span className="online-player-meta">{topLabel} · {topRating} ELO</span>
              <b className="online-clock">{topClock}</b>
            </div>
            <div className="online-board-wrap">
              <OnlineBoard
                board={reviewBoard}
                flipped={flipped}
                pieceSet={pieceSet}
                pieceSets={onlinePieceSets}
                selected={null}
                targets={[]}
                lastMove={moves[reviewPly - 1]}
                checkedSquare={null}
                reviewBadge={reviewStarted ? reviewBadge : null}
                disabled
                canMove={false}
                onSelectSquare={() => {}}
                onMove={() => {}}
                promotionRequest={null}
                onCancelPromotion={() => {}}
              />
            </div>
            <div className="online-player-bar">
              <button className="online-player-profile-button" disabled={!bottomPlayer?.id} onClick={() => openPlayerProfile(bottomPlayer)} type="button">
                <PlayerAvatar name={bottomName} photoURL={bottomPhotoURL} />
                <strong title={bottomName}>{bottomName}</strong>
                <MembershipBadge tier={bottomPlayer?.membershipTier} compact />
              </button>
              <span className="online-player-meta">{isSpectatorView ? 'Trắng' : 'Bạn'} · {bottomRating} ELO</span>
              <b className="online-clock">{bottomClock}</b>
            </div>
          </section>
          <ReviewPage
            initialFen={null}
            stockfishStatus={stockfishStatus}
            onRetryReview={() => { setStockfishReview(current => current.map(item => item?.analysisError ? null : item)); setAnalysisRetry(value => value + 1); }}
            coachMode="balanced"
            coachLesson={null}
            currentReviewAnalysis={currentReviewAnalysis}
            reviewPly={reviewPly}
            history={moves}
            stockfishReview={stockfishReview}
            reviewStats={reviewStats}
            reviewStarted={reviewStarted}
            membership={membership}
            whiteName={game.white?.name || 'White'}
            blackName={game.black?.name || 'Black'}
            returnRoute="history"
            onNavigate={onNavigate}
            onStartNewGame={() => onNavigate?.('online')}
            onReviewStep={reviewStep}
            onSetReviewMode={setReviewMode}
            onSetResultDismissed={(dismissed) => setShowResultDialog(!dismissed)}
            onSetReviewPly={setReviewPly}
            onQueueMissingReviewAnalysis={queueOnlineReview}
            onStartReview={queueOnlineReview}
          />
        </main>
      </section>
    );
  }

  return (
    <section className="online-workspace">
      <PlayPageHeader mode="online" status={queueing ? 'Đang tìm đối thủ' : game?.status === 'active' ? 'Đang chơi' : 'Sảnh chờ'} />
      <main className="online-layout">
        <section className="online-board-section">
          <div className={`online-player-bar top ${game?.turn === topColor && game?.status === 'active' ? 'active-clock' : ''}`}>
            <button className="online-player-profile-button" disabled={!topPlayer?.id} onClick={() => openPlayerProfile(topPlayer)} type="button">
              <PlayerAvatar name={topName} photoURL={topPhotoURL} />
              <strong title={topName}>{topName}</strong>
              <MembershipBadge tier={topPlayer?.membershipTier} compact />
            </button>
            <span className="online-player-meta">{game ? `${topLabel} · ${topRating} ELO` : 'Chưa ghép trận'}</span>
            <b className={`online-clock ${topClockLow ? 'low' : ''}`}>{topClock}</b>
          </div>
          <div className="online-board-wrap">
            {openingRemainingMs !== null && (
              <div className="online-opening-deadline" aria-live="polite">
                {openingTurnName} cần đi nước đầu trong {Math.ceil(openingRemainingMs / 1000)} giây, nếu không ván sẽ bị hủy.
              </div>
            )}
            {showMateBanner && <div className="online-checkmate-banner">Chiếu hết</div>}
            {terminalGame && !reviewMode && !showResultDialog && (
              <div className="online-ended-overlay">
                <Trophy size={34} />
                <strong>{game.status === 'abandoned' ? 'Ván đấu đã hủy' : 'Ván đấu đã kết thúc'}</strong>
                <span>{game.status === 'abandoned' ? 'Điểm xếp hạng được giữ nguyên. Bạn có thể tìm ván mới.' : 'Mở đánh giá ván đấu để xem lại các nước cờ.'}</span>
              </div>
            )}
            <OnlineBoard
              board={board}
              flipped={flipped}
              pieceSet={pieceSet}
              pieceSets={onlinePieceSets}
              selected={selected}
              targets={targets}
              lastMove={lastMove}
              checkedSquare={checkedSquare}
              reviewBadge={null}
              disabled={terminalGame || reviewMode}
              canMove={isMyTurn && !busy}
              onSelectSquare={chooseSquare}
              onMove={playOnlineMove}
              promotionRequest={promotionRequest}
              onCancelPromotion={() => setPromotionRequest(null)}
            />
          </div>
          <div className={`online-player-bar ${game?.turn === bottomColor && game?.status === 'active' ? 'active-clock' : ''}`}>
            <button className="online-player-profile-button" disabled={!bottomPlayer?.id} onClick={() => openPlayerProfile(bottomPlayer)} type="button">
              <PlayerAvatar name={bottomName} photoURL={bottomPhotoURL} />
              <strong title={bottomName}>{bottomName}</strong>
              <MembershipBadge tier={bottomPlayer?.membershipTier} compact />
            </button>
            <span className="online-player-meta">{isSpectatorView ? 'Trắng' : 'Bạn'} - {bottomRating}</span>
            <b className={`online-clock ${bottomClockLow ? 'low' : ''}`}>{bottomClock}</b>
          </div>
        </section>

        <aside className="online-panel">
          {!playingView && (
          <div className="online-status-card">
            <span>{reviewMode ? 'Game Review' : statusText(game)}</span>
            <strong>{reviewMode ? `Move ${reviewPly} / ${moves.length}` : game?.result && game.result !== '*' ? game.result : game?.timeControl || timeControl}</strong>
            <div className="online-status-row">
              <b>{playerColorLabel}</b>
              <b>{reviewMode ? stockfishStatus : `${game?.status === 'active' ? 'Trong trận' : queueing ? 'Đang tìm' : 'Sảnh chờ'} ${gameId && realtimeConnected ? 'live' : ''}`}</b>
            </div>
          {(queueing || queueJoining) && (
              <div className="search-timer" aria-live="polite">
                <Search size={17} />
                {queueJoining ? 'Đang kết nối' : 'Đang tìm'} {formatSearchTime(queueSeconds)}
              </div>
            )}
            {queueing && (
              <div className="online-search-details">
                <span>Mode <b>{activeMode}</b></span>
                <span>ELO của bạn <b>{myRating}</b></span>
                <span>ELO đối thủ <b>{queueMinRating}-{queueMaxRating}</b></span>
                <span>Gói <b>{plan.name}</b></span>
                <small>Ưu tiên chênh lệch ±{activeQueueWindow} Elo. Ghép ngay khi có đối thủ phù hợp trong giới hạn ±{queueRatingLimit} Elo của cả hai.</small>
              </div>
            )}
            {message && <p>{message}</p>}
          </div>
          )}

          {playingView && message && (
            <div className="online-status-card compact-online-status">
              {message && <p>{message}</p>}
            </div>
          )}

          {!playingView && (
          <div className="online-controls">
            <strong>Tìm trận nhanh</strong>
            <div className="online-time-grid">
              {TIME_CONTROLS.map((control) => (
                <button className={timeControl === control.id ? 'active' : ''} key={control.id} disabled={queueing || busy} onClick={() => setTimeControl(control.id)}>
                  {control.label}
                </button>
              ))}
            </div>
            {queueing ? (
              <button className="danger" disabled={busy} onClick={cancelQueue}><X size={18} /> Hủy tìm trận</button>
            ) : (
              <button disabled={busy || game?.status === 'active'} onClick={startQueue}><Swords size={18} /> Tìm trận</button>
            )}
          </div>
          )}

          {!playingView && (
          <div className="online-controls"><strong>Chơi cùng bạn bè</strong><p>Gửi lời mời trực tiếp và vào trận khi bạn chấp nhận.</p><button type="button" onClick={() => onNavigate?.('friends')}><UserPlus size={18} /> Mời bạn chơi</button></div>
          )}

          {game && <div className="online-controls">
            <strong>Điều khiển ván đấu</strong>
            {terminalGame && moves.length > 0 && <button type="button" onClick={openOnlineReview}><Brain size={18} /> Mở Review ván đấu</button>}
            <div className="online-game-actions">
              <button disabled={!game || moves.length === 0 || (reviewMode && reviewPly === 0)} onClick={undoLastMove}><RotateCcw size={18} /> Nước trước</button>
              <button disabled={!reviewingLiveGame} onClick={redoLastMove}><RefreshCw size={18} /> Nước tiếp</button>
              <button className="danger" disabled={!game || game.status !== 'active' || busy} onClick={() => setActionConfirm('resign')}>Đầu hàng</button>
            </div>
            {game?.status === 'active' && !isSpectatorView && (
              <div className="online-draw-actions">
                {!game.drawOffer && <button type="button" disabled={busy} onClick={() => setActionConfirm('draw')}>Đề nghị hòa</button>}
                {game.drawOffer?.byYou && <button type="button" disabled={busy} onClick={() => drawAction('cancel')}>Rút đề nghị hòa</button>}
                {game.drawOffer && !game.drawOffer.byYou && (
                  <>
                    <button type="button" disabled={busy} onClick={() => drawAction('accept')}>Đồng ý hòa</button>
                    <button type="button" disabled={busy} onClick={() => drawAction('decline')}>Từ chối</button>
                  </>
                )}
              </div>
            )}
            {!playingView && (
              <>
                <button disabled={!gameId || busy} onClick={() => refreshGame(gameId)}><RefreshCw size={18} /> Tải lại</button>
                <button disabled={!game || (game?.moves || []).length === 0} onClick={copyGamePgn}><Copy size={18} /> {pgnCopied ? 'Đã sao chép PGN' : 'Sao chép PGN'}</button>
                <button disabled={!gameId && !queueing} onClick={leaveGameView}><X size={18} /> Về sảnh chờ</button>
              </>
            )}
          </div>}

          {game?.id && (
            <div className="online-controls online-chat-panel">
              <div className="online-chat-head">
                <strong>Trò chuyện trong ván</strong>
                {isSpectatorView && <small><Radio size={14} /> {spectatorCount} watching</small>}
              </div>
              <div className="online-chat-messages" aria-live="polite">
                {chatMessages.length === 0 && <small>Chưa có tin nhắn. Chúc nhau một ván cờ vui nhé.</small>}
                {chatMessages.map((item) => (
                  <p className={item.you ? 'you' : ''} key={item.id}>
                    <b>{item.you ? 'Bạn' : item.name}:</b> {item.body}
                  </p>
                ))}
              </div>
              <form className="online-chat-composer" onSubmit={submitChat}>
                <input
                  value={chatBody}
                  onChange={(event) => setChatBody(event.target.value)}
                  placeholder="Nhắn với đối thủ…"
                  maxLength={500}
                />
                <button type="submit" aria-label="Gửi tin nhắn" disabled={chatBusy || !chatBody.trim()}><Send size={17} /></button>
              </form>
            </div>
          )}


          {game && <div className="online-moves">
            <strong>Biên bản nước cờ</strong>
            {moves.length === 0 ? <span>Chưa có nước đi</span> : pairs.map((pair) => (
              <p className="online-move-row" key={pair.number}>
                <b>{pair.number}.</b>
                <button
                  className={reviewMode && reviewPly === pair.number * 2 - 1 ? 'active' : ''}
                  type="button"
                  disabled={!pair.white}
                  onClick={() => showPositionAt(pair.number * 2 - 1)}
                >
                  {pair.white?.san || ''}
                </button>
                <button
                  className={reviewMode && reviewPly === pair.number * 2 ? 'active' : ''}
                  type="button"
                  disabled={!pair.black}
                  onClick={() => showPositionAt(pair.number * 2)}
                >
                  {pair.black?.san || ''}
                </button>
              </p>
            ))}
          </div>}
        </aside>
      </main>
      {showResultDialog && outcome && !rematchFromOpponent && (
        <OnlineResultDialog
          outcome={outcome}
          game={game}
          selfPlayer={selfPlayer}
          opponentPlayer={opponentPlayer}
          premiumReview={premiumReview}
          rematch={rematchRequest}
          rematchPending={rematchPending}
          rematchBusy={rematchBusy}
          onReview={openOnlineReview}
          onNewGame={startQueue}
          onLobby={leaveGameView}
          onLeaderboard={() => onNavigate?.('leaderboard')}
          onRematch={() => requestRematch('request')}
        />
      )}
      {reportOpen && (
        <ReportPlayerDialog
          category={reportCategory}
          description={reportDescription}
          busy={reportBusy}
          opponentName={topName}
          onCategoryChange={setReportCategory}
          onDescriptionChange={setReportDescription}
          onSubmit={submitReport}
          onClose={() => setReportOpen(false)}
        />
      )}
      {rematchFromOpponent && (
        <RematchRequestDialog
          opponentName={displayName(rematchRequest.requestedByName)}
          remainingSeconds={rematchSecondsLeft}
          busy={rematchBusy}
          onAccept={() => requestRematch('accept')}
          onDecline={() => requestRematch('decline')}
        />
      )}
      {actionConfirm && (
        <GameActionConfirmDialog
          action={actionConfirm}
          busy={busy}
          onCancel={() => setActionConfirm(null)}
          onConfirm={() => actionConfirm === 'resign' ? resign() : drawAction('offer')}
        />
      )}
      {game?.status === 'active' && game.drawOffer && !game.drawOffer.byYou && !isSpectatorView && (
        <DrawOfferDialog
          opponentName={opponentPlayer?.name || 'Đối thủ'}
          busy={busy}
          onAccept={() => drawAction('accept')}
          onDecline={() => drawAction('decline')}
        />
      )}
    </section>
  );
}

function GameActionConfirmDialog({ action, busy, onCancel, onConfirm }) {
  const resigning = action === 'resign';
  return (
    <div className="game-action-modal-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel();
    }}>
      <section className="game-action-confirm" role="dialog" aria-modal="true" aria-labelledby="game-action-title">
        <span>{resigning ? 'Xác nhận đầu hàng' : 'Xác nhận đề nghị hòa'}</span>
        <h2 id="game-action-title">{resigning ? 'Bạn muốn kết thúc ván đấu?' : 'Gửi đề nghị hòa cho đối thủ?'}</h2>
        <p>{resigning ? 'Sau khi xác nhận, kết quả được chốt ngay và không thể hoàn tác.' : 'Đồng hồ vẫn tiếp tục chạy trong lúc chờ đối thủ trả lời.'}</p>
        <div>
          <button type="button" disabled={busy} onClick={onCancel}>Quay lại ván</button>
          <button type="button" className={resigning ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>
            {busy ? 'Đang xử lý…' : resigning ? 'Xác nhận đầu hàng' : 'Gửi đề nghị hòa'}
          </button>
        </div>
      </section>
    </div>
  );
}

function DrawOfferDialog({ opponentName, busy, onAccept, onDecline }) {
  return (
    <div className="draw-offer-modal-layer" role="presentation">
      <section className="draw-offer-dialog" role="dialog" aria-modal="true" aria-live="assertive" aria-labelledby="draw-offer-title">
        <span>ĐỀ NGHỊ HÒA</span>
        <h2 id="draw-offer-title">{opponentName} đề nghị hòa</h2>
        <p>Ván đấu và đồng hồ vẫn tiếp tục. Chọn trả lời ngay hoặc tiếp tục suy nghĩ.</p>
        <div>
          <button type="button" disabled={busy} onClick={onDecline}>Từ chối</button>
          <button type="button" className="primary" disabled={busy} onClick={onAccept}>Đồng ý hòa</button>
        </div>
      </section>
    </div>
  );
}

function OnlineBoard({ board, flipped, pieceSet, pieceSets, selected, targets, lastMove, checkedSquare, reviewBadge, disabled, canMove, onSelectSquare, onMove, promotionRequest, onCancelPromotion }) {
  const handleDragStart = (event, square, piece) => {
    if (disabled || !canMove || piece?.color !== board.turn()) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', square);
  };

  return (
    <section className={`online-board piece-set-${pieceSet} ${disabled ? 'disabled' : ''}`} aria-label="Online chess board">
      <PromotionPicker request={promotionRequest} pieceSet={pieceSet} flipped={flipped} onClose={onCancelPromotion}
        onChoose={(piece) => onMove(promotionRequest.from, promotionRequest.to, piece)} />
      {Array.from({ length: 8 }).map((_, row) => (
        Array.from({ length: 8 }).map((__, col) => {
          const square = squareName(row, col, flipped);
          const piece = board.get(square);
          const dark = (row + col) % 2 === 1;
          const isLastFrom = lastMove?.from === square;
          const isLastTo = lastMove?.to === square;
          return (
            <button
              className={`square ${dark ? 'dark' : 'light'} ${selected === square ? 'selected' : ''} ${targets.includes(square) ? 'target' : ''} ${isLastFrom || isLastTo ? 'last-move' : ''} ${checkedSquare === square ? 'king-check' : ''}`}
              key={square}
              onClick={() => {
                if (!disabled) onSelectSquare(square);
              }}
              onDragOver={(event) => {
                if (!disabled && canMove) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = event.dataTransfer.getData('text/plain');
                if (!disabled && canMove && from) onMove(from, square);
              }}
              aria-label={square}
            >
              {piece && (
                <img
                  className={`piece ${piece.color} piece-set-${normalizePieceSet(pieceSets?.[piece.color] || pieceSet)}`}
                  src={getPieceImage(pieceSets?.[piece.color] || pieceSet, `${piece.color}${piece.type}`)}
                  alt=""
                  draggable={!disabled && canMove && piece.color === board.turn()}
                  onDragStart={(event) => handleDragStart(event, square, piece)}
                />
              )}
              {reviewBadge && isLastTo && (
                <span className={`move-badge ${reviewBadge.tone}`} title={reviewBadge.label}>
                  {reviewIcon(reviewBadge.tone)}
                </span>
              )}
              {(row === 7 || col === 0) && <span className="coord">{row === 7 ? square[0] : square[1]}</span>}
            </button>
          );
        })
      ))}
    </section>
  );
}

function OnlineResultDialog({ outcome, game, selfPlayer, opponentPlayer, premiumReview, rematch, rematchPending, rematchBusy, onReview, onNewGame, onLobby, onLeaderboard, onRematch }) {
  const ratingDelta = selfPlayer?.ratingDelta;
  const hasRatingDelta = Number.isFinite(ratingDelta) && game?.rated !== false;
  const ratingAfter = selfPlayer?.ratingAfter ?? selfPlayer?.rating;
  const ratingBefore = selfPlayer?.ratingBefore;
  return (
    <div className="result-backdrop" role="dialog" aria-modal="true" aria-label="Online game result">
      <div className="result-dialog compact-result online-result-dialog" data-result={outcome.type}>
        <div className="result-icon"><Trophy size={28} /></div>
        <h2>{outcome.title}</h2>
        <small>{outcome.detail}</small>
        <div className="online-rating-result">
          <div>
            <span>Your rating</span>
            <strong>{hasRatingDelta ? ratingAfter : ratingBefore ?? selfPlayer?.rating ?? '-'}</strong>
            <b className={ratingDelta > 0 ? 'up' : ratingDelta < 0 ? 'down' : 'same'}>
              {outcome.aborted || !hasRatingDelta ? 'unchanged' : signedRating(ratingDelta)}
            </b>
          </div>
          <div>
            <span>Opponent</span>
            <strong>{opponentPlayer?.rating ?? '-'}</strong>
            <b>{opponentPlayer?.name || 'Chờ đối thủ'}</b>
          </div>
        </div>
        <div className="result-coach">
          <div className="review-coach-avatar">VS</div>
          <p>{outcome.aborted ? 'This game was cancelled before both players completed an opening move.' : outcome.type === 'win' ? 'Game finished. Review the key moves or ask your opponent for a rematch.' : outcome.type === 'loss' ? 'Game over. Review the critical position before playing again.' : 'Balanced result. Review the turning points or start another game.'}</p>
        </div>
        <div className="result-notices" aria-live="polite">
          {rematch?.requestedByYou && rematchPending && <small>Rematch sent. Waiting for opponent.</small>}
          {rematch?.requestedByYou && !rematch.response && !rematchPending && <small>Rematch request expired.</small>}
          {rematch?.response === 'declined' && <small>Opponent declined the rematch.</small>}
          {!outcome.aborted && !premiumReview && <small>Pro unlocks unlimited deep game review.</small>}
          {!outcome.aborted && premiumReview && <small>Premium active. Deep review is ready.</small>}
        </div>
        <div className="result-actions">
          {!outcome.aborted && <button onClick={onReview}><Brain size={18} /> Game review</button>}
          <button onClick={onNewGame}><Search size={18} /> New game</button>
          <button onClick={onLobby}><X size={18} /> Về sảnh tìm trận</button>
          {!outcome.aborted && <button onClick={onLeaderboard}><BarChart3 size={18} /> Leaderboard</button>}
          {!outcome.aborted && <button disabled={rematchBusy || (rematch?.requestedByYou && rematchPending)} onClick={onRematch}><RotateCcw size={18} /> Rematch</button>}
        </div>
      </div>
    </div>
  );
}

function ReportPlayerDialog({ category, description, busy, opponentName, onCategoryChange, onDescriptionChange, onSubmit, onClose }) {
  return (
    <div className="result-backdrop report-player-backdrop" role="dialog" aria-modal="true" aria-label="Report player">
      <form className="result-dialog report-player-dialog" data-result="draw" onSubmit={onSubmit}>
        <div className="result-icon"><Flag size={28} /></div>
        <h2>Report player</h2>
        <small>Report {opponentName || 'opponent'} for moderation review. False reports can be ignored by admins.</small>
        <label>
          Reason
          <select value={category} onChange={(event) => onCategoryChange(event.target.value)}>
            {REPORT_REASONS.map((reason) => (
              <option value={reason.id} key={reason.id}>{reason.label}</option>
            ))}
          </select>
        </label>
        <label>
          Evidence note
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            minLength={8}
            maxLength={1200}
            placeholder="Ví dụ: đối thủ đi rất nhanh toàn nước engine ở nước 18-35, hoặc cố tình kéo giờ..."
            required
          />
        </label>
        <div className="result-actions">
          <button type="submit" disabled={busy || description.trim().length < 8}>
            <Send size={18} /> {busy ? 'Sending...' : 'Send report'}
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function RematchRequestDialog({ opponentName, remainingSeconds, busy, onAccept, onDecline }) {
  return (
    <div className="result-backdrop online-rematch-backdrop" role="dialog" aria-modal="true" aria-label="Rematch request">
      <div className="result-dialog compact-result online-rematch-dialog" data-result="draw">
        <div className="result-icon"><RotateCcw size={28} /></div>
        <h2>Rematch request</h2>
        <small>{remainingSeconds}s remaining</small>
        <div className="result-coach">
          <p><strong>{opponentName}</strong> wants to play another game.</p>
        </div>
        <div className="result-actions">
          <button disabled={busy} onClick={onAccept}>Accept</button>
          <button className="secondary" disabled={busy} onClick={onDecline}>Từ chối</button>
        </div>
      </div>
    </div>
  );
}

function PlayerAvatar({ name, photoURL }) {
  return (
    <span className="online-player-avatar">
      {photoURL ? <img src={photoURL} alt="" /> : <UserRound size={19} aria-label={name} />}
    </span>
  );
}
