import React from 'react';
import { Chess } from 'chess.js';
import { Brain, Clock, Copy, LogIn, Radio, RefreshCw, RotateCcw, Search, ShieldCheck, Swords, Trophy, UserPlus, Users, X } from 'lucide-react';
import {
  cancelOnlineQueue,
  createFriendGame,
  fetchOnlineGame,
  joinFriendGame,
  joinOnlineQueue,
  onlineGameEventsUrl,
  resignOnlineGame,
  sendOnlineRematch,
  sendOnlineHeartbeat,
  sendOnlineMove
} from '../api/online';
import { apiUrl } from '../api/config';
import { REVIEW_LEGEND, reviewIcon } from '../data/review';
import { PIECE_IMAGES } from '../game/pieces';
import { squareName } from '../game/chessLogic';

const TIME_CONTROLS = [
  { id: '180+0', label: '3+0' },
  { id: '300+0', label: '5+0' },
  { id: '600+0', label: '10+0' },
  { id: '900+10', label: '15+10' }
];
const REMATCH_RESPONSE_MS = 15_000;

function statusText(game) {
  if (!game) return 'Ready';
  if (game.status === 'waiting') return 'Waiting for friend';
  if (game.status === 'checkmate') return `Checkmate ${game.result}`;
  if (game.status === 'draw') return `Draw ${game.result}`;
  if (game.status === 'resigned') return `Resigned ${game.result}`;
  return game.turn === game.playerColor ? 'Your move' : 'Opponent move';
}

function displayName(value, fallback = 'Player') {
  const name = String(value || '').trim();
  return name && name !== 'White' && name !== 'Black' ? name : fallback;
}

function formatSearchTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function parseTimeControl(value) {
  const [base = '600', increment = '0'] = String(value || '600+0').split('+');
  return {
    baseSeconds: Math.max(0, Number(base) || 600),
    incrementSeconds: Math.max(0, Number(increment) || 0)
  };
}

function formatClock(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
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

function computeOnlineClocks(game, now = Date.now()) {
  if (!game) return null;
  const { baseSeconds, incrementSeconds } = parseTimeControl(game.timeControl);
  const clocks = { w: baseSeconds, b: baseSeconds };
  const moves = game.moves || [];
  let previousAt = Date.parse(
    moves.length === 0
      ? game.lastMoveAt || game.createdAt || game.updatedAt || new Date().toISOString()
      : game.createdAt || game.lastMoveAt || game.updatedAt || new Date().toISOString()
  );

  for (const move of moves) {
    const moveAt = Date.parse(move.createdAt || game.lastMoveAt || game.updatedAt || new Date().toISOString());
    if (Number.isFinite(previousAt) && Number.isFinite(moveAt)) {
      clocks[move.color] = Math.max(0, clocks[move.color] - Math.max(0, Math.round((moveAt - previousAt) / 1000)));
    }
    clocks[move.color] += incrementSeconds;
    previousAt = moveAt;
  }

  if (game.status === 'active' && game.turn && Number.isFinite(previousAt)) {
    clocks[game.turn] = Math.max(0, clocks[game.turn] - Math.max(0, Math.round((now - previousAt) / 1000)));
  }

  return clocks;
}

function pendingFirstMoveInfo(game, now = Date.now()) {
  if (!game || game.status !== 'active') return null;
  const moves = game.moves || [];
  const pending = moves.length === 0
    ? { color: 'w', since: game.lastMoveAt || game.createdAt || game.updatedAt }
    : moves.length === 1 && moves[0].color === 'w'
      ? { color: 'b', since: moves[0].createdAt }
      : null;
  const sinceMs = Date.parse(pending?.since || '');
  if (!pending || !Number.isFinite(sinceMs)) return null;
  const elapsedSeconds = Math.max(0, Math.floor((now - sinceMs) / 1000));
  return {
    ...pending,
    elapsedSeconds,
    warn: elapsedSeconds >= 60 && elapsedSeconds < 80,
    timeout: elapsedSeconds >= 80,
    remainingSeconds: Math.max(0, 80 - elapsedSeconds)
  };
}

function onlineOutcome(game) {
  if (!game || !['checkmate', 'draw', 'resigned'].includes(game.status)) return null;
  if (game.status === 'draw') {
    return { type: 'draw', title: 'Draw Game', detail: game.result || '1/2-1/2' };
  }
  const winner = game.result === '1-0' ? 'w' : game.result === '0-1' ? 'b' : null;
  const youWon = winner && winner === game.playerColor;
  const reason = game.status === 'checkmate' ? 'by checkmate' : 'by resignation';
  return {
    type: youWon ? 'win' : 'loss',
    title: youWon ? 'You won' : 'You lost',
    detail: `${winner === 'w' ? 'White' : 'Black'} wins ${reason}`
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
  return ['checkmate', 'draw', 'resigned'].includes(game?.status);
}

function replayOnlineGameAt(moves = [], ply = 0) {
  const chess = new Chess();
  for (const move of moves.slice(0, ply)) {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion || undefined });
  }
  return chess;
}

function moveToLan(move) {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

function buildOnlineReviewPositions(moves = [], stockfishReview = [], pendingAnalysis = []) {
  const existing = new Set([
    ...pendingAnalysis.map((item) => item.ply),
    ...stockfishReview.map((item, index) => (item ? index + 1 : null)).filter(Boolean)
  ]);

  return moves
    .map((move, index) => ({
      ply: index + 1,
      fen: replayOnlineGameAt(moves, index).fen(),
      move: moveToLan(move),
      san: move.san,
      piece: move.piece,
      captured: move.captured,
      variant: 'standard',
      priorMoves: moves.slice(0, index).map(moveToLan)
    }))
    .filter((item) => !existing.has(item.ply));
}

function calculateReviewStats(stockfishReview) {
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

  return {
    stats,
    totals,
    accuracy: {
      w: totals.w ? Math.max(1, Math.min(99, 100 - loss.w / totals.w * 2.4)).toFixed(1) : '--',
      b: totals.b ? Math.max(1, Math.min(99, 100 - loss.b / totals.b * 2.4)).toFixed(1) : '--'
    }
  };
}

function playMoveSound(audioRef) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = audioRef.current || new AudioContext();
  audioRef.current = context;
  if (context.state === 'suspended') context.resume();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(520, context.currentTime);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.1);
}

export default function OnlinePage({ authUser, userName, pieceSet, onLogin }) {
  const [summary, setSummary] = React.useState({ onlineCount: 0, queueCount: 0 });
  const [timeControl, setTimeControl] = React.useState('600+0');
  const [queueing, setQueueing] = React.useState(false);
  const [gameId, setGameId] = React.useState(null);
  const [game, setGame] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [targets, setTargets] = React.useState([]);
  const [inviteCode, setInviteCode] = React.useState('');
  const [inviteLink, setInviteLink] = React.useState('');
  const [friendSide, setFriendSide] = React.useState('random');
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [pgnCopied, setPgnCopied] = React.useState(false);
  const [queueStartedAt, setQueueStartedAt] = React.useState(null);
  const [queueSeconds, setQueueSeconds] = React.useState(0);
  const [myRating, setMyRating] = React.useState(400);
  const [clockNow, setClockNow] = React.useState(Date.now());
  const [showMateBanner, setShowMateBanner] = React.useState(false);
  const [showResultDialog, setShowResultDialog] = React.useState(false);
  const [showFirstMoveWarning, setShowFirstMoveWarning] = React.useState(false);
  const [firstMoveWarningOkKey, setFirstMoveWarningOkKey] = React.useState(null);
  const [realtimeConnected, setRealtimeConnected] = React.useState(false);
  const [rematchBusy, setRematchBusy] = React.useState(false);
  const [rematchNow, setRematchNow] = React.useState(Date.now());
  const [reviewMode, setReviewMode] = React.useState(false);
  const [reviewPly, setReviewPly] = React.useState(0);
  const [stockfishReview, setStockfishReview] = React.useState([]);
  const [stockfishStatus, setStockfishStatus] = React.useState('idle');
  const [pendingAnalysis, setPendingAnalysis] = React.useState([]);
  const inviteHandledRef = React.useRef(false);
  const pendingMoveRef = React.useRef(false);
  const audioRef = React.useRef(null);
  const gameFetchInFlightRef = React.useRef(false);
  const heartbeatInFlightRef = React.useRef(false);
  const lastPlyRef = React.useRef(0);
  const lastTerminalKeyRef = React.useRef(null);

  const applyGameSnapshot = React.useCallback((incomingGame) => {
    if (!incomingGame) return;
    setGame((currentGame) => {
      if (!currentGame || currentGame.id !== incomingGame.id) return incomingGame;
      const currentPly = currentGame.moves?.length || 0;
      const incomingPly = incomingGame.moves?.length || 0;
      if (incomingPly < currentPly) return currentGame;
      if (incomingPly === currentPly) {
        const currentUpdatedAt = Date.parse(currentGame.updatedAt || '');
        const incomingUpdatedAt = Date.parse(incomingGame.updatedAt || '');
        if (Number.isFinite(currentUpdatedAt) && Number.isFinite(incomingUpdatedAt) && incomingUpdatedAt < currentUpdatedAt) {
          return currentGame;
        }
      }
      return incomingGame;
    });
  }, []);

  const moves = game?.moves || [];
  const liveBoard = React.useMemo(() => new Chess(game?.fen), [game?.fen]);
  const reviewBoard = React.useMemo(() => replayOnlineGameAt(moves, reviewPly), [moves, reviewPly]);
  const board = reviewMode ? reviewBoard : liveBoard;
  const flipped = game?.playerColor === 'b';
  const isMyTurn = game?.status === 'active' && game.turn === game.playerColor;
  const terminalGame = isTerminalGame(game);
  const playingView = Boolean(game && game.status !== 'waiting') || reviewMode;
  const terminalKey = terminalGame
    ? `${game.id}:${game.status}:${game.result}:${game.moves?.length || 0}`
    : null;
  const reviewStats = React.useMemo(() => calculateReviewStats(stockfishReview), [stockfishReview]);
  const currentReviewAnalysis = reviewMode ? stockfishReview[reviewPly - 1] : null;
  const reviewBadge = currentReviewAnalysis ?? (reviewMode && reviewPly > 0 ? { label: 'Analyzing', tone: 'loading' } : null);
  const firstMoveInfo = pendingFirstMoveInfo(game, clockNow);
  const firstMoveWarningKey = firstMoveInfo ? `${game?.id}:${firstMoveInfo.color}` : null;
  const reviewedMoveCount = stockfishReview.filter(Boolean).length;
  const reviewProgress = moves.length ? Math.round((reviewedMoveCount / moves.length) * 100) : 0;
  const reviewingLiveGame = reviewMode && !terminalGame;

  const refreshGame = React.useCallback(async (id = gameId) => {
    if (!id || gameFetchInFlightRef.current) return;
    gameFetchInFlightRef.current = true;
    try {
      const data = await fetchOnlineGame(id);
      if (!pendingMoveRef.current) applyGameSnapshot(data.game);
      setGameId(data.game.id);
      setInviteCode(data.game.inviteCode || inviteCode);
      if (data.game.inviteCode) {
        setInviteLink(`${window.location.origin}/play/online?invite=${data.game.inviteCode}`);
      }
    } catch {
      if (game?.status === 'active') setMessage('Connection interrupted. Reconnecting to your game...');
    } finally {
      gameFetchInFlightRef.current = false;
    }
  }, [applyGameSnapshot, game?.status, gameId, inviteCode]);

  React.useEffect(() => {
    if (!authUser) return undefined;

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
          if (data.game && gameId) {
            applyGameSnapshot(data.game);
            setGameId(data.game.id);
          }
          if (queueing && data.currentGameId) {
            setQueueing(false);
            setQueueStartedAt(null);
            setQueueSeconds(0);
            if (data.game) applyGameSnapshot(data.game);
            setGameId(data.currentGameId);
            setMessage('Matched. Loading board...');
          }
        }
      } catch {
        if (!cancelled && queueing) setMessage('Still searching for an opponent. We will keep trying automatically.');
      } finally {
        heartbeatInFlightRef.current = false;
      }
    };
    tick();
    const intervalMs = queueing ? 1000 : gameId && !realtimeConnected ? 1000 : gameId ? 10_000 : 15_000;
    const timer = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyGameSnapshot, authUser, gameId, queueing, realtimeConnected]);

  React.useEffect(() => {
    if (!authUser || inviteHandledRef.current) return;
    const code = new URLSearchParams(window.location.search).get('invite');
    if (!code) return;

    inviteHandledRef.current = true;
    setBusy(true);
    setMessage('Joining friend invite...');
    joinFriendGame(code)
      .then((data) => {
        setInviteCode(data.inviteCode);
        setInviteLink(`${window.location.origin}/play/online?invite=${data.inviteCode}`);
        setGameId(data.gameId);
        if (data.game) applyGameSnapshot(data.game);
        setMessage('Joined friend game.');
        window.history.replaceState(null, '', '/play/online');
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setBusy(false));
  }, [applyGameSnapshot, authUser]);

  React.useEffect(() => {
    if (!gameId) return undefined;
    refreshGame(gameId);
    return undefined;
  }, [gameId, refreshGame]);

  React.useEffect(() => {
    if (!authUser || !gameId || typeof window.EventSource === 'undefined') {
      setRealtimeConnected(false);
      return undefined;
    }

    let closed = false;
    const source = new window.EventSource(onlineGameEventsUrl(gameId), { withCredentials: true });

    source.addEventListener('open', () => {
      if (!closed) setRealtimeConnected(true);
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
          const incomingTerminal = isTerminalGame(data.game);
          if (data.game && (!pendingMoveRef.current || incomingTerminal)) {
            applyGameSnapshot(data.game);
            setGameId(data.game.id);
          }
      } catch {
        // Ignore malformed stream events; manual Refresh remains available.
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
  }, [applyGameSnapshot, authUser, gameId]);

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
    if (!queueing || !queueStartedAt) return undefined;
    const timer = window.setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - queueStartedAt) / 1000));
      setQueueSeconds(elapsed);
      if (elapsed === 15) setMessage('The search is taking a little longer. We are keeping your place in line.');
    }, 1000);
    return () => window.clearInterval(timer);
  }, [queueStartedAt, queueing]);

  React.useEffect(() => {
    if (!game?.id || game.status !== 'active') return undefined;
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [game?.id, game?.status, game?.turn]);

  React.useEffect(() => {
    setShowFirstMoveWarning(Boolean(
      game?.status === 'active'
      && firstMoveInfo?.warn
      && firstMoveInfo.color === game.playerColor
      && game.turn === game.playerColor
      && firstMoveWarningKey !== firstMoveWarningOkKey
    ));
  }, [firstMoveInfo?.color, firstMoveInfo?.warn, firstMoveWarningKey, firstMoveWarningOkKey, game?.playerColor, game?.status, game?.turn]);

  React.useEffect(() => {
    const nextPly = game?.moves?.length || 0;
    if (!game?.id) {
      lastPlyRef.current = 0;
      return;
    }
    if (nextPly > lastPlyRef.current) {
      if (!pendingMoveRef.current) playMoveSound(audioRef);
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
    setShowFirstMoveWarning(false);
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
    if ((!reviewMode && !terminalGame) || moves.length === 0) return;
    const missing = buildOnlineReviewPositions(moves, stockfishReview, pendingAnalysis);
    if (missing.length) setPendingAnalysis((current) => [...current, ...missing]);
  }, [reviewMode, terminalGame, moves, stockfishReview, pendingAnalysis]);

  React.useEffect(() => {
    if (pendingAnalysis.length === 0) return undefined;

    let cancelled = false;
    const currentPosition = pendingAnalysis.find((item) => item.ply === reviewPly);
    const positions = currentPosition
      ? [currentPosition, ...pendingAnalysis.filter((item) => item.ply !== reviewPly).slice(0, 3)]
      : pendingAnalysis.slice(0, 4);
    setStockfishStatus('loading');
    fetch(apiUrl('/api/analysis/review'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions, movetime: 180 })
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
      });

    return () => {
      cancelled = true;
    };
  }, [pendingAnalysis, reviewPly]);

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
    setBusy(true);
    setMessage('');
    setGameId(null);
    setGame(null);
    setReviewMode(false);
    setShowResultDialog(false);
    setShowMateBanner(false);
    setStockfishReview([]);
    setPendingAnalysis([]);
    setSelected(null);
    setTargets([]);
    setInviteCode('');
    setInviteLink('');
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
        setQueueStartedAt(Date.now());
        setQueueSeconds(0);
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
      setMessage('Queue cancelled.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const createInvite = async () => {
    setBusy(true);
    setMessage('');
    try {
      setReviewMode(false);
      setShowResultDialog(false);
      setShowMateBanner(false);
      setStockfishReview([]);
      setPendingAnalysis([]);
      const data = await createFriendGame(timeControl, friendSide);
      setInviteCode(data.inviteCode);
      setInviteLink(`${window.location.origin}/play/online?invite=${data.inviteCode}`);
      setGameId(data.gameId);
      if (data.game) applyGameSnapshot(data.game);
      setMessage('Invite created. Share the link with your friend.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async () => {
    await navigator.clipboard?.writeText(inviteLink || inviteCode).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    setMessage('Invite link copied.');
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
    setInviteCode('');
    setInviteLink('');
    setSelected(null);
    setTargets([]);
    setQueueing(false);
    setQueueStartedAt(null);
    setQueueSeconds(0);
    setMessage('Back to online lobby.');
  };

  const chooseSquare = async (square) => {
    if (!game || reviewMode || terminalGame || !isMyTurn || busy) return;
    const piece = board.get(square);
    if (!selected) {
      if (piece?.color !== game.playerColor) return;
      setSelected(square);
      setTargets(board.moves({ square, verbose: true }).map((move) => move.to));
      return;
    }
    if (piece?.color === game.playerColor) {
      setSelected(square);
      setTargets(board.moves({ square, verbose: true }).map((move) => move.to));
      return;
    }

    const promotion = board.get(selected)?.type === 'p' && ['1', '8'].includes(square[1]) ? 'q' : undefined;
    const optimisticChess = new Chess(game.fen);
    const played = optimisticChess.move({ from: selected, to: square, promotion });
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
      fenAfter: optimisticChess.fen(),
      createdAt: new Date().toISOString()
    };
    setBusy(true);
    setSelected(null);
    setTargets([]);
    pendingMoveRef.current = true;
    playMoveSound(audioRef);
    setGame({
      ...game,
      fen: optimisticChess.fen(),
      pgn: optimisticChess.pgn(),
      turn: optimisticChess.turn(),
      moves: [...moves, optimisticMove]
    });
    try {
      const data = await sendOnlineMove(game.id, { from: selected, to: square, promotion });
      applyGameSnapshot(data.game);
    } catch (error) {
      setGame(previousGame);
      setMessage(error.message);
      refreshGame(game.id);
    } finally {
      pendingMoveRef.current = false;
      setBusy(false);
    }
  };

  const resign = async () => {
    if (!game || game.status !== 'active') return;
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
    if (!game || moves.length === 0) {
      setMessage('No moves to review yet.');
      return;
    }
    setShowResultDialog(false);
    setShowMateBanner(false);
    setReviewMode(true);
    setReviewPly(moves.length);
    setStockfishStatus('loading');
  };

  const reviewStep = (direction) => {
    setReviewPly((current) => Math.min(moves.length, Math.max(0, current + direction)));
  };

  const acknowledgeFirstMoveWarning = async () => {
    if (firstMoveWarningKey) setFirstMoveWarningOkKey(firstMoveWarningKey);
    setShowFirstMoveWarning(false);
    try {
      await sendOnlineHeartbeat(false, gameId, { firstMoveWarningOk: true });
    } catch (error) {
      setMessage(error.message);
    }
  };

  const requestRematch = async (action = 'request') => {
    if (!game || !terminalGame) return;
    setRematchBusy(true);
    try {
      const data = await sendOnlineRematch(game.id, action);
      if (action === 'accept' && data.game?.id !== game.id) {
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
      setMessage(error.message);
    } finally {
      setRematchBusy(false);
    }
  };

  const selfName = displayName(userName || authUser?.displayName, 'Player');
  const opponentPlayer = game?.white?.you ? game.black : game?.black?.you ? game.white : null;
  const topName = displayName(opponentPlayer?.name, 'Player');
  const topRating = opponentPlayer?.rating || 400;
  const topLabel = game?.status === 'active' ? 'Opponent' : game?.status === 'waiting' ? 'Waiting' : 'Waiting';
  const bottomName = selfName;
  const selfPlayer = game?.white?.you ? game.white : game?.black?.you ? game.black : null;
  const bottomRating = selfPlayer?.rating || myRating;
  const playerColorLabel = game?.playerColor === 'w' ? 'White' : game?.playerColor === 'b' ? 'Black' : 'Choose match';
  const pairs = movePairs(moves);
  const topColor = game?.playerColor === 'w' ? 'b' : 'w';
  const bottomColor = game?.playerColor || 'w';
  const { baseSeconds } = parseTimeControl(game?.timeControl || timeControl);
  const clocks = computeOnlineClocks(game, clockNow);
  const topClock = formatClock(clocks?.[topColor] ?? baseSeconds);
  const bottomClock = formatClock(clocks?.[bottomColor] ?? baseSeconds);
  const topClockLow = (clocks?.[topColor] ?? baseSeconds) <= 30;
  const bottomClockLow = (clocks?.[bottomColor] ?? baseSeconds) <= 30;
  const lastMove = reviewMode ? moves[reviewPly - 1] : moves.at(-1);
  const checkedSquare = reviewMode ? null : checkedKingSquare(board);
  const outcome = onlineOutcome(game);
  const rematchRequest = game?.rematch;
  const rematchExpiresAt = Date.parse(rematchRequest?.expiresAt || '');
  const rematchRemainingMs = Number.isFinite(rematchExpiresAt) ? Math.max(0, rematchExpiresAt - rematchNow) : 0;
  const rematchPending = Boolean(rematchRequest && !rematchRequest.response && rematchRemainingMs > 0);
  const rematchFromOpponent = Boolean(terminalGame && rematchRequest && !rematchRequest.requestedByYou && !rematchRequest.response && rematchRemainingMs > 0);
  const rematchSecondsLeft = Math.max(1, Math.ceil(rematchRemainingMs / 1000));

  if (!authUser) {
    return (
      <section className="online-workspace">
        <div className="online-auth-required">
          <ShieldCheck size={46} />
          <h1>Online play requires sign in</h1>
          <p>Every online move is verified by the server and tied to your secure session.</p>
          <button onClick={onLogin}><LogIn size={18} /> Sign in</button>
        </div>
      </section>
    );
  }

  return (
    <section className="online-workspace">
      <header className="online-header">
        <div>
          <span><Radio size={16} /> Live players</span>
          <h1>Online Chess</h1>
        </div>
        {!playingView && (
          <div className="online-metrics">
            <b><Users size={17} />{summary.onlineCount} online</b>
            <b><Search size={17} />{summary.queueCount} searching</b>
          </div>
        )}
      </header>

      <main className="online-layout">
        <section className="online-board-section">
          <div className={`online-player-bar top ${game?.turn === topColor && game?.status === 'active' ? 'active-clock' : ''}`}>
            <strong title={topName}>{topName}</strong>
            <span className="online-player-meta">{topLabel} - {topRating}</span>
            <b className={`online-clock ${topClockLow ? 'low' : ''}`}>{topClock}</b>
          </div>
          <div className="online-board-wrap">
            {showMateBanner && <div className="online-checkmate-banner">Checkmate</div>}
            {terminalGame && !reviewMode && !showResultDialog && (
              <div className="online-ended-overlay">
                <Trophy size={34} />
                <strong>Game finished</strong>
                <span>Open Game Review to inspect the old position.</span>
              </div>
            )}
            <OnlineBoard
              board={board}
              flipped={flipped}
              pieceSet={pieceSet}
              selected={selected}
              targets={targets}
              lastMove={lastMove}
              checkedSquare={checkedSquare}
              reviewBadge={reviewMode ? reviewBadge : null}
              disabled={terminalGame || reviewMode}
              onSelectSquare={chooseSquare}
            />
          </div>
          <div className={`online-player-bar ${game?.turn === bottomColor && game?.status === 'active' ? 'active-clock' : ''}`}>
            <strong title={bottomName}>{bottomName}</strong>
            <span className="online-player-meta">You - {bottomRating}</span>
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
              <b>{reviewMode ? stockfishStatus : `${game?.status || (queueing ? 'searching' : 'lobby')} ${gameId && realtimeConnected ? 'live' : ''}`}</b>
            </div>
            {reviewMode && (
              <div className="online-review-active">
                <span className={`move-badge inline ${reviewBadge?.tone ?? 'loading'}`}>
                  {reviewIcon(reviewBadge?.tone ?? 'loading')}
                </span>
                <p>{reviewPly > 0 ? reviewBadge?.label || 'Analyzing move' : 'Start position'}</p>
              </div>
            )}
            {queueing && (
              <div className="search-timer" aria-live="polite">
                <Search size={17} />
                Searching {formatSearchTime(queueSeconds)}
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
            <strong>Quick match</strong>
            <div className="online-time-grid">
              {TIME_CONTROLS.map((control) => (
                <button className={timeControl === control.id ? 'active' : ''} key={control.id} onClick={() => setTimeControl(control.id)}>
                  {control.label}
                </button>
              ))}
            </div>
            {queueing ? (
              <button className="danger" disabled={busy} onClick={cancelQueue}><X size={18} /> Cancel search</button>
            ) : (
              <button disabled={busy || game?.status === 'active'} onClick={startQueue}><Swords size={18} /> Find player</button>
            )}
          </div>
          )}

          {!playingView && (
          <div className="online-controls">
            <strong>Play with friend</strong>
            <div className="friend-option-grid" aria-label="Friend game options">
              {[
                { id: 'random', label: 'Random' },
                { id: 'white', label: 'White' },
                { id: 'black', label: 'Black' }
              ].map((option) => (
                <button
                  className={friendSide === option.id ? 'active' : ''}
                  key={option.id}
                  onClick={() => setFriendSide(option.id)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button disabled={busy || game?.status === 'active'} onClick={createInvite}><UserPlus size={18} /> Invite friend</button>
            {inviteCode && (
              <div className="invite-share-card">
                <span>Invite ready</span>
                <strong>{inviteCode}</strong>
                <button className="invite-code" onClick={copyInvite}>
                  <Copy size={17} /> {copied ? 'Copied' : 'Copy invite link'}
                </button>
                <small>{inviteLink}</small>
              </div>
            )}
          </div>
          )}

          <div className="online-controls">
            <strong>Game</strong>
            <div className="online-game-actions">
              <button disabled={!game || moves.length === 0 || (reviewMode && reviewPly === 0)} onClick={undoLastMove}><RotateCcw size={18} /> Undo</button>
              <button disabled={!reviewingLiveGame} onClick={redoLastMove}><RefreshCw size={18} /> Redo</button>
              <button className="danger" disabled={!game || game.status !== 'active' || busy} onClick={resign}>Resign</button>
            </div>
            {!playingView && (
              <>
                <button disabled={!gameId || busy} onClick={() => refreshGame(gameId)}><RefreshCw size={18} /> Refresh</button>
                <button disabled={!game || (game?.moves || []).length === 0} onClick={copyGamePgn}><Copy size={18} /> {pgnCopied ? 'PGN copied' : 'Copy PGN'}</button>
                <button disabled={!gameId && !queueing} onClick={leaveGameView}><X size={18} /> Back to lobby</button>
              </>
            )}
          </div>

          {reviewMode && (
            <div className="online-review-panel">
              <strong>Move analysis</strong>
              {reviewedMoveCount < moves.length && (
                <div className="online-review-progress" aria-live="polite">
                  <p>Vui lòng đợi AI của chúng tôi đánh giá ván cờ của bạn</p>
                  <div><span style={{ width: `${reviewProgress}%` }} /></div>
                  <small>{reviewedMoveCount} / {moves.length} moves analyzed</small>
                </div>
              )}
              <div className="online-review-accuracy">
                <span>White <b>{reviewStats.accuracy.w}</b></span>
                <span>Black <b>{reviewStats.accuracy.b}</b></span>
              </div>
              <div className="online-review-controls">
                <button onClick={() => setReviewPly(0)} disabled={reviewPly === 0}>|&lt;</button>
                <button onClick={() => reviewStep(-1)} disabled={reviewPly === 0}>&lt;</button>
                <button onClick={() => reviewStep(1)} disabled={reviewPly >= moves.length}>&gt;</button>
                <button onClick={() => setReviewPly(moves.length)} disabled={reviewPly >= moves.length}>&gt;|</button>
              </div>
              <button onClick={() => {
                setReviewMode(false);
                if (terminalGame) setShowResultDialog(true);
              }}>Close review</button>
            </div>
          )}

          <div className="online-moves">
            <strong>Moves</strong>
            {moves.length === 0 ? <span>No moves yet</span> : pairs.map((pair) => (
              <p className="online-move-row" key={pair.number}>
                <b>{pair.number}.</b>
                <button
                  className={reviewMode && reviewPly === pair.number * 2 - 1 ? 'active' : ''}
                  type="button"
                  disabled={!pair.white}
                  onClick={() => showPositionAt(pair.number * 2 - 1)}
                >
                  {pair.white ? `${pair.white.san} ${reviewMode ? reviewIcon(stockfishReview[pair.number * 2 - 2]?.tone ?? 'loading') : ''}` : ''}
                </button>
                <button
                  className={reviewMode && reviewPly === pair.number * 2 ? 'active' : ''}
                  type="button"
                  disabled={!pair.black}
                  onClick={() => showPositionAt(pair.number * 2)}
                >
                  {pair.black ? `${pair.black.san} ${reviewMode ? reviewIcon(stockfishReview[pair.number * 2 - 1]?.tone ?? 'loading') : ''}` : ''}
                </button>
              </p>
            ))}
          </div>
        </aside>
      </main>
      {showResultDialog && outcome && !rematchFromOpponent && (
        <OnlineResultDialog
          outcome={outcome}
          rematch={rematchRequest}
          rematchPending={rematchPending}
          rematchBusy={rematchBusy}
          onReview={openOnlineReview}
          onNewGame={startQueue}
          onRematch={() => requestRematch('request')}
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
      {showFirstMoveWarning && firstMoveInfo && (
        <FirstMoveWarningDialog
          remainingSeconds={firstMoveInfo.remainingSeconds}
          onClose={acknowledgeFirstMoveWarning}
        />
      )}
    </section>
  );
}

function OnlineBoard({ board, flipped, pieceSet, selected, targets, lastMove, checkedSquare, reviewBadge, disabled, onSelectSquare }) {
  return (
    <section className={`online-board piece-set-${pieceSet} ${disabled ? 'disabled' : ''}`} aria-label="Online chess board">
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
              aria-label={square}
            >
              {piece && <img className={`piece ${piece.color}`} src={PIECE_IMAGES[`${piece.color}${piece.type}`]} alt="" draggable="false" />}
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

function OnlineResultDialog({ outcome, rematch, rematchPending, rematchBusy, onReview, onNewGame, onRematch }) {
  return (
    <div className="result-backdrop" role="dialog" aria-modal="true" aria-label="Online game result">
      <div className="result-dialog compact-result online-result-dialog" data-result={outcome.type}>
        <div className="result-icon"><Trophy size={28} /></div>
        <h2>{outcome.title}</h2>
        <small>{outcome.detail}</small>
        <div className="result-coach">
          <div className="review-coach-avatar">VS</div>
          <p>{outcome.type === 'win' ? 'Game finished. Review the key moves or ask your opponent for a rematch.' : outcome.type === 'loss' ? 'Game over. Review the critical position before playing again.' : 'Balanced result. Review the turning points or start another game.'}</p>
          {rematch?.requestedByYou && rematchPending && <small>Rematch request sent. Waiting for opponent.</small>}
          {rematch?.requestedByYou && !rematch.response && !rematchPending && <small>Rematch request expired.</small>}
          {rematch?.response === 'declined' && <small>Opponent declined the rematch.</small>}
        </div>
        <div className="result-actions">
          <button onClick={onReview}><Brain size={18} /> Game review</button>
          <button onClick={onNewGame}><Search size={18} /> New game</button>
          <button disabled={rematchBusy || (rematch?.requestedByYou && rematchPending)} onClick={onRematch}><RotateCcw size={18} /> Rematch</button>
        </div>
      </div>
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
          <button className="secondary" disabled={busy} onClick={onDecline}>Decline</button>
        </div>
      </div>
    </div>
  );
}

function FirstMoveWarningDialog({ remainingSeconds, onClose }) {
  return (
    <div className="result-backdrop online-warning-backdrop" role="dialog" aria-modal="true" aria-label="First move warning">
      <div className="result-dialog compact-result online-warning-dialog" data-result="draw">
        <div className="result-icon"><Clock size={28} /></div>
        <h2>Your move</h2>
        <small>Anti-cheat warning</small>
        <div className="result-coach">
          <div className="review-coach-avatar">!</div>
          <p>Nếu bạn không di chuyển trong {remainingSeconds}s, thì log trận đấu này sẽ được gửi cho hệ thống anti cheat. Sau 10 lần như này tài khoản của bạn sẽ bị ban vĩnh viễn.</p>
        </div>
        <div className="result-actions">
          <button onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
