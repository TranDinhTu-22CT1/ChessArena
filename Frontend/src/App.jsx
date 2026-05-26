import React from 'react';
import './styles.css';
import { requestStockfishMove } from './api/stockfish';
import { PIECE_IMAGES } from './game/pieces';
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
  squareCenter,
  squareTopLeft
} from './game/gameView';
import AuthPage from './components/AuthPage';
import GameBoard from './components/GameBoard';
import MatchPanel from './components/MatchPanel';
import ResultDialog from './components/ResultDialog';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import {
  buildCoachInsight
} from './coach/coach';
import { BOT_PERSONAS } from './data/bots';
import { useAuthSession } from './hooks/useAuthSession';
import { useApiGameLog } from './hooks/useApiGameLog';
import { useAppRoute } from './hooks/useAppRoute';
import { useBotAssistance } from './hooks/useBotAssistance';
import { useGameClock } from './hooks/useGameClock';
import { useGameAudio } from './hooks/useGameAudio';
import { useGameReview } from './hooks/useGameReview';
import { useMoveGuidance } from './hooks/useMoveGuidance';
import { useThemeSettings } from './hooks/useThemeSettings';
import HomePage from './routes/HomePage';
import ReviewPage from './routes/ReviewPage';
import { gameModeFromRoute, isGameRoute, routeFromPath } from './routes/routeConfig';

const DEFAULT_TIME_CONTROL = TIME_CONTROLS[3];

export default function App() {
  const [gameState, setGameState] = React.useState(() => createGameState());
  const [selected, setSelected] = React.useState(null);
  const [legalTargets, setLegalTargets] = React.useState([]);
  const [flipped, setFlipped] = React.useState(false);
  const [gameId, setGameId] = React.useState(() => newLocalGameId());
  const [lastMove, setLastMove] = React.useState(null);
  const [slidingMove, setSlidingMove] = React.useState(null);
  const [isMoveAnimating, setIsMoveAnimating] = React.useState(false);
  const [playerColor, setPlayerColor] = React.useState('w');
  const [sideChoice, setSideChoice] = React.useState('w');
  const [aiElo, setAiElo] = React.useState(1600);
  const [timeControlId, setTimeControlId] = React.useState(DEFAULT_TIME_CONTROL.id);
  const [clocks, setClocks] = React.useState(() => ({ w: DEFAULT_TIME_CONTROL.baseSeconds, b: DEFAULT_TIME_CONTROL.baseSeconds }));
  const [timeWinner, setTimeWinner] = React.useState(null);
  const [gameMode, setGameMode] = React.useState(() => gameModeFromRoute(routeFromPath(window.location.pathname)) ?? 'bot');
  const [coachMode, setCoachMode] = React.useState('beginner');
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
  const [engineError, setEngineError] = React.useState('');
  const [showHints, setShowHints] = React.useState(true);
  const [dragEnabled, setDragEnabled] = React.useState(true);
  const [promotionRequest, setPromotionRequest] = React.useState(null);
  const [resultDismissed, setResultDismissed] = React.useState(false);
  const {
    userName,
    authMode,
    setAuthMode,
    authUser,
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
    logout
  } = useAuthSession();
  const {
    theme,
    themeStyle,
    settingsOpen,
    setSettingsOpen,
    pieceSet,
    setPieceSet,
    updateTheme,
    resetTheme,
    applyBoardPreset
  } = useThemeSettings(authUser);
  const {
    route,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    navigate
  } = useAppRoute({ gameMode, setGameMode });
  const aiTimerRef = React.useRef(null);
  const slideTimerRef = React.useRef(null);
  const premoveRef = React.useRef([]);
  const { ensureAudioContext, playMoveSound, speakCoachText, stopSpeech } = useGameAudio();

  const isActiveGameRoute = isGameRoute(route);
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
  } = useGameReview({ game, history, initialFen, gameVariant, isCoachGame });
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
  const showResultDialog = outcome && !resultDismissed;
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
  const activeBotPersona = BOT_PERSONAS.reduce((closest, persona) => (
    Math.abs(persona.elo - Number(aiElo)) < Math.abs(closest.elo - Number(aiElo)) ? persona : closest
  ), BOT_PERSONAS[0]);
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
  const { botChatLine, resetBotAssistance } = useBotAssistance({
    activeBotPersona,
    history,
    game,
    playerColor,
    isCoachGame,
    botGameStarted,
    coachSpeechText,
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
    timeWinner,
    historyLength: history.length,
    setClocks,
    setTimeWinner,
    setResultDismissed
  });
  useMoveGuidance({
    botGameStarted,
    reviewMode,
    game,
    gameFen,
    timeWinner,
    isMoveAnimating,
    botOptions,
    playerColor,
    aiElo: aiLevel.elo,
    history,
    gameVariant,
    setSuggestionMove,
    setThreatMove
  });

  React.useEffect(() => {
    premoveRef.current = premoveQueue;
  }, [premoveQueue]);

  React.useEffect(() => {
    if (game.isGameOver() || timeWinner || game.turn() !== aiColor || isAiThinking || isMoveAnimating || !usesAiOpponent) return;

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
 
  }, [aiColor, aiLevel, game, gameVariant, history, initialFen, isMoveAnimating, timeWinner, usesAiOpponent]);

  React.useEffect(() => {
    return () => {
      if (aiTimerRef.current) {
        window.clearTimeout(aiTimerRef.current);
      }
      if (slideTimerRef.current) {
        window.clearTimeout(slideTimerRef.current);
      }
      stopSpeech();
    };
  }, []);

  const commitPlayedMove = (move) => {
    playMoveSound();
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
    setEngineError('');
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
    resetSavedGameLog();
    stopSpeech();
    resetBotAssistance((BOT_PERSONAS.find((persona) => persona.elo === Number(nextAiElo)) ?? activeBotPersona).chat);

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
    ensureAudioContext();
    setGameMode('bot');
    if (route !== 'bot') navigate('bot');
    setBotGameStarted(true);
    startNewGame({ nextSideChoice: sideChoice, nextAiElo: aiElo, nextTimeControl: timeControl, nextBotGameStarted: true });
  };

  const startCoachMatch = () => {
    ensureAudioContext();
    setGameMode('coach');
    if (route !== 'coach') navigate('coach');
    setBotGameStarted(true);
    setBotOptions((current) => ({
      ...current,
      botChat: false,
      moveFeedback: true,
      suggestionArrows: true,
      threatArrows: true,
      engine: true
    }));
    startNewGame({ nextSideChoice: sideChoice, nextAiElo: 3190, nextTimeControl: timeControl, nextBotGameStarted: true });
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
    if (reviewMode || game.isGameOver() || timeWinner || isAiThinking || isMoveAnimating) return;
    try {
      const suggestedMove = suggestionMove ?? await requestStockfishMove(game.fen(), aiLevel.elo, {
        moves: history.map((item) => `${item.from}${item.to}${item.promotion ?? ''}`),
        variant: gameVariant
      });
      setHintMove({ from: suggestedMove.from, to: suggestedMove.to });
      setEngineError('');
    } catch {
      setEngineError('Stockfish unavailable. No hint was generated.');
    }
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
    if (!nextPremove || !usesAiOpponent || reviewMode || timeWinner) return false;

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
    if (!usesAiOpponent || reviewMode || game.isGameOver() || timeWinner || game.turn() === playerColor) return false;

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
        onSelectPlayMode={(mode) => {
          setGameMode(mode);
          setBotGameStarted(false);
          setReviewMode(false);
        }}
        onNavigate={(nextRoute) => {
          if (isGameRoute(nextRoute) && (route === 'review' || game.isGameOver() || manualResult || timeWinner)) {
            startNewGame({ nextBotGameStarted: false });
          }
          navigate(nextRoute);
        }}
        onLogin={() => setAuthMode('login')}
        onRegister={() => setAuthMode('register')}
        onLogout={logout}
      />

      <section className={`content-shell ${route === 'review' ? 'review-route-shell' : ''} ${route === 'home' ? 'home-route-shell' : ''} ${isActiveGameRoute ? 'game-route-shell' : ''}`}>
        {authMode && !authUser && (
          <AuthPage
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
              clearAuthMessage();
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
            whiteName={whiteName}
            blackName={blackName}
            onNavigate={navigate}
            onStartNewGame={startNewGame}
            onReviewStep={reviewStep}
            onSetReviewMode={setReviewMode}
            onSetReviewStarted={setReviewStarted}
            onSetResultDismissed={setResultDismissed}
            onSetReviewPly={setReviewPly}
            onQueueMissingReviewAnalysis={queueMissingReviewAnalysis}
          />
        )}

        {route !== 'home' && (
        <>
        <TopHeader
          apiOnline={apiOnline}
          settingsOpen={settingsOpen}
          theme={theme}
          pieceSet={pieceSet}
          authUser={authUser}
          onToggleSettings={() => setSettingsOpen((value) => !value)}
          onResetTheme={resetTheme}
          onUpdateTheme={updateTheme}
          onApplyBoardPreset={applyBoardPreset}
          onSetPieceSet={setPieceSet}
        />

        <section className={`game-layout ${reviewMode ? 'review-page-layout' : ''}`}>
          <GameBoard
            blackName={blackName}
            whiteName={whiteName}
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
            slidingMove={slidingMove}
            promotionRequest={promotionRequest}
            reviewArrowFrom={reviewArrowFrom}
            reviewArrowTo={reviewArrowTo}
            hintArrowFrom={hintArrowFrom}
            hintArrowTo={hintArrowTo}
            threatArrowFrom={threatArrowFrom}
            threatArrowTo={threatArrowTo}
            premoveArrows={premoveArrows}
            formatClock={formatClock}
            squareTopLeft={squareTopLeft}
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
            botOptions={botOptions}
            botChatText={botChatText}
            coachMode={coachMode}
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
            onSetCoachMode={setCoachMode}
            onChangeTimeControl={changeTimeControl}
            onChangeVariant={changeVariant}
            onUpdateBotOption={updateBotOption}
            onStartCoachMatch={startCoachMatch}
            onStartBotMatch={startBotMatch}
            onResignGame={resignGame}
            onShowHintMove={showHintMove}
            onUndoMove={undoMove}
            onStartNewGame={startNewGame}
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
        </>
        )}
      </section>

      {showResultDialog && (
        <ResultDialog
          outcome={outcome}
          activeBotPersona={activeBotPersona}
          reviewStats={reviewStats}
          onClose={() => setResultDismissed(true)}
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
