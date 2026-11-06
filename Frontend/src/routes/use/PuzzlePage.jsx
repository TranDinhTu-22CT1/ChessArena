import React from 'react';
import { Chess } from 'chess.js';
import { CalendarDays, Check, Crown, Flame, Lock, Puzzle, Swords, Timer, Trophy, X, Zap } from 'lucide-react';
import {
  checkPuzzleMove,
  fetchPuzzleProgress,
  recordPuzzleSession,
  requestPuzzle
} from '../../api/puzzles';
import { getPieceImage } from '../../game/pieces';
import { squareName } from '../../game/chessLogic';
import { formatLimit, hasPremium, membershipPlan } from '../../membership/plans';
import PromotionPicker from '../../components/PromotionPicker';
import PuzzleBattle from '../../components/PuzzleBattle';

const POOL_VERSION = 'verified-tactics-v6';
const ROUTE_MODES = {
  puzzles: 'rated',
  'daily-puzzle': 'daily',
  'puzzle-rush': 'rush',
  'puzzle-streak': 'streak',
  'puzzle-battle': 'battle',
  'custom-puzzles': 'custom',
  'personal-puzzles': 'personal'
};
const THEMES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'mate', label: 'Chiếu hết' },
  { id: 'material', label: 'Thắng quân' },
  { id: 'promotion', label: 'Phong cấp' }
];
const THEME_LABELS = Object.fromEntries(THEMES.map((item) => [item.id, item.label]));
const STAGES = [
  { id: 'all', label: 'Tất cả giai đoạn' },
  { id: 'middlegame', label: 'Trung cuộc' },
  { id: 'endgame', label: 'Tàn cuộc' }
];
const STAGE_LABELS = Object.fromEntries(STAGES.map((item) => [item.id, item.label]));
const MODES = [
  { id: 'rated', route: 'puzzles', label: 'Puzzles', icon: Puzzle },
  { id: 'daily', route: 'daily-puzzle', label: 'Daily Puzzle', icon: CalendarDays },
  { id: 'rush', route: 'puzzle-rush', label: 'Puzzle Rush', icon: Zap },
  { id: 'streak', route: 'puzzle-streak', label: 'Puzzle Streak', icon: Flame },
  { id: 'battle', route: 'puzzle-battle', label: 'Puzzle Battle', icon: Swords },
  { id: 'custom', route: 'custom-puzzles', label: 'Custom Puzzles', icon: Trophy },
  { id: 'personal', route: 'personal-puzzles', label: 'Mistake Lab', icon: Flame }
];
const MODE_HELP = {
  rated: 'Luyện chiến thuật theo trình độ. Hoàn thành toàn bộ chuỗi nước để nhận điểm.',
  daily: 'Một thử thách chung mỗi ngày UTC. Giải đúng để duy trì chuỗi ngày luyện tập.',
  rush: 'Giải nhanh trong 3 phút. Sai 3 câu hoặc hết giờ sẽ kết thúc lượt chơi.',
  streak: 'Không giới hạn thời gian. Giải liên tiếp đến khi sai một câu.',
  battle: 'Hai người, cùng bộ câu đố. Theo dõi đối thủ, điểm số và đồng hồ ngay trên bàn.',
  custom: 'Chọn chủ đề, giai đoạn và độ khó để luyện đúng phần bạn cần.',
  personal: 'Luyện lại các thế cờ rút từ sai lầm trong những ván đã Review.'
};

function initialProgress() {
  return {
    poolVersion: POOL_VERSION,
    rating: 800,
    points: 0,
    correct: 0,
    attempted: 0,
    rushBest: 0,
    dailySolved: {},
    dailyAssignments: {},
    dailyPuzzleUsage: {},
    dailyStreak: 0,
    seen: []
  };
}

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

function updateDailyStreak(progress, key) {
  if (progress.dailySolved[key]) return progress.dailyStreak;
  const yesterday = new Date(`${key}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const previousKey = yesterday.toISOString().slice(0, 10);
  return progress.dailySolved[previousKey] ? progress.dailyStreak + 1 : 1;
}

function puzzleUsage(progress) {
  return progress.dailyPuzzleUsage?.[dateKey()] ?? 0;
}

function puzzleQuotaReached(plan, progress, mode) {
  return mode === 'rated' && Number.isFinite(plan.puzzleLimit) && puzzleUsage(progress) >= plan.puzzleLimit;
}

export default function PuzzlePage({ activeRoute, pieceSet, membership, authUser, onNavigate }) {
  const mode = ROUTE_MODES[activeRoute] ?? 'rated';
  const plan = membershipPlan(membership);
  const rushLocked = mode === 'rush' && !hasPremium(membership, 'plus');
  const customLocked = mode === 'custom' && !hasPremium(membership, 'pro');
  const premiumLocked = rushLocked || customLocked;
  const [progress, setProgress] = React.useState(initialProgress);
  const [puzzle, setPuzzle] = React.useState(null);
  const [position, setPosition] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [targets, setTargets] = React.useState([]);
  const [feedback, setFeedback] = React.useState(null);
  const quotaLocked = puzzleQuotaReached(plan, progress, mode) && (!puzzle || feedback?.correct);
  const [scoreBurst, setScoreBurst] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [playedMoves, setPlayedMoves] = React.useState([]);
  const [promotion, setPromotion] = React.useState(null);
  const [error, setError] = React.useState('');
  const [theme, setTheme] = React.useState('all');
  const [stage, setStage] = React.useState('all');
  const [ratingBand, setRatingBand] = React.useState('0-4000');
  const [rushActive, setRushActive] = React.useState(false);
  const [rushSeconds, setRushSeconds] = React.useState(180);
  const [rushScore, setRushScore] = React.useState(0);
  const [rushMisses, setRushMisses] = React.useState(0);
  const [streakActive, setStreakActive] = React.useState(false);
  const [streakScore, setStreakScore] = React.useState(0);
  const sessionStartedAtRef = React.useRef(null);
  const [progressReady, setProgressReady] = React.useState(!authUser);
  const progressRef = React.useRef(progress);
  progressRef.current = progress;
  const requestRef = React.useRef(null);
  const attemptRef = React.useRef(null);
  const generationRef = React.useRef(0);
  const nextTimerRef = React.useRef(null);
  const loadRef = React.useRef(null);
  const rushDeadlineRef = React.useRef(0);
  const runRef = React.useRef(null);
  const puzzleVersionRef = React.useRef(0);

  React.useEffect(() => {
    setProgress(initialProgress());
    setProgressReady(!authUser);
    if (!authUser) {
      return;
    }
    let cancelled = false;
    fetchPuzzleProgress().then((data) => {
      if (cancelled) return;
      if (!data.progress) return;
      const dailySolved = Object.fromEntries((data.dailyClaims || []).filter((item) => item.solved_at).map((item) => [item.puzzle_date, true]));
      setProgress((current) => ({
        ...current,
        ...data.progress,
        dailySolved
      }));
    }).catch(() => {}).finally(() => {
      if (!cancelled) setProgressReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [authUser?.uid]);

  const loadPuzzle = React.useCallback(async (nextMode = mode, additionalExcluded = []) => {
    if (nextMode === 'battle') return;
    const currentProgress = progressRef.current;
    if (!authUser && puzzleQuotaReached(plan, currentProgress, nextMode)) return;
    requestRef.current?.abort();
    attemptRef.current?.abort();
    attemptRef.current = null;
    window.clearTimeout(nextTimerRef.current);
    const controller = new AbortController();
    requestRef.current = controller;
    const generation = ++generationRef.current;
    const [minRating, maxRating] = ratingBand.split('-').map(Number);
    setLoading(true);
    setFeedback(null);
    setScoreBurst(null);
    setError('');
    setSelected(null);
    setTargets([]);
    setChecking(false);
    setPlayedMoves([]);
    setPromotion(null);

    try {
      const nextPuzzle = await requestPuzzle({
        mode: nextMode,
        runId: ['rush','streak'].includes(nextMode) ? runRef.current?.id : undefined,
        date: dateKey(),
        signal: controller.signal,
        rating: currentProgress.rating,
        theme: nextMode === 'custom' ? theme : 'all',
        stage: nextMode === 'custom' ? stage : 'all',
        minRating: nextMode === 'custom' ? minRating : 0,
        maxRating: nextMode === 'custom' ? maxRating : 4000,
        excluded: [...currentProgress.seen, ...additionalExcluded]
      });
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setPuzzle(nextPuzzle);
      const board = new Chess(nextPuzzle.fen);
      for (const lan of nextPuzzle.playedMoves || []) board.move({from:lan.slice(0,2),to:lan.slice(2,4),promotion:lan[4]});
      setPosition(board);
      setPlayedMoves(nextPuzzle.playedMoves || []);
      puzzleVersionRef.current = nextPuzzle.version || 0;
      if(nextPuzzle.run) {
        runRef.current=nextPuzzle.run;
        if(nextMode==='rush')rushDeadlineRef.current=Date.now()+Math.max(0,Date.parse(nextPuzzle.run.expires_at)-Date.parse(nextPuzzle.run.serverNow || new Date().toISOString()));
        if(nextMode==='rush') { setRushScore(nextPuzzle.run.score);setRushMisses(nextPuzzle.run.misses); }
        if(nextMode==='streak')setStreakScore(nextPuzzle.run.score);
      }
      if(nextPuzzle.progress)setProgress(current=>({...current,...nextPuzzle.progress}));
      if (nextMode === 'daily' && currentProgress.dailySolved[dateKey()]) {
        setFeedback({ correct: true, text: 'Bạn đã giải Daily Puzzle hôm nay.' });
      }
      setProgress((current) => ({
        ...current,
        dailyAssignments: nextMode === 'daily'
          ? { ...(current.dailyAssignments ?? {}), [dateKey()]: nextPuzzle.id }
          : current.dailyAssignments ?? {}
      }));
    } catch (loadError) {
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setPuzzle(null);
      setPosition(null);
      setError(loadError.message || 'Chưa tải được câu đố. Hãy thử lại.');
      if(loadError.data?.progress)setProgress(current=>({...current,...loadError.data.progress}));
      if(loadError.exhausted || loadError.data?.run?.status==='finished') {
        setRushActive(false);setStreakActive(false);
        if(loadError.data?.run)runRef.current=loadError.data.run;
      }
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [mode, plan, authUser, progress.dailyPuzzleUsage, progress.seen, ratingBand, stage, theme]);
  loadRef.current = loadPuzzle;

  React.useEffect(() => () => {
    generationRef.current += 1;
    requestRef.current?.abort();
    attemptRef.current?.abort();
    window.clearTimeout(nextTimerRef.current);
    runRef.current=null;
  }, [mode, authUser?.uid]);

  React.useEffect(() => {
    if (!progressReady) return;
    setPuzzle(null);
    setPosition(null);
    setFeedback(null);
    setScoreBurst(null);
    setError('');
    if (mode === 'rush') {
      setRushActive(false);
      setRushSeconds(180);
      setRushScore(0);
      setRushMisses(0);
      return;
    }
    if (mode === 'streak') {
      setStreakActive(false);
      setStreakScore(0);
      return;
    }
    if (mode !== 'battle') loadPuzzle(mode);
  }, [mode, progressReady]);

  React.useEffect(() => {
    if (!rushActive) return undefined;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((rushDeadlineRef.current - Date.now()) / 1000));
      setRushSeconds(remaining);
      if (remaining === 0) {
        generationRef.current += 1;
        attemptRef.current?.abort();
        attemptRef.current = null;
        requestRef.current?.abort();
        window.clearTimeout(nextTimerRef.current);
        setChecking(false);
        setLoading(false);
        setRushActive(false);
        setFeedback({ correct: false, text: 'Hết giờ.' });
        setProgress((current) => ({ ...current, rushBest: Math.max(current.rushBest, rushScore) }));
        saveSession({ mode: 'rush', score: rushScore, correct: rushScore, attempted: rushScore + rushMisses, bestStreak: rushScore, durationSeconds: 180 });
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [rushActive, rushScore, rushMisses]);

  const showScoreBurst = (value) => {
    setScoreBurst({ id: Date.now(), value });
  };

  const saveSession = (payload) => {
    if (!authUser || !runRef.current?.id) return;
    const generation=generationRef.current;
    recordPuzzleSession({
      runId:runRef.current.id,
      startedAt: sessionStartedAtRef.current,
      date: dateKey(),
      puzzleId: puzzle?.id,
      ...payload
    }).then(data=>{ if(generation===generationRef.current && data.progress)setProgress(current=>({...current,...data.progress})); })
      .catch(error=>{if(generation===generationRef.current)setError(error.message || 'Chưa lưu được phiên câu đố.');});
  };

  const completePuzzle = (serverResult) => {
    if(serverResult?.progress) {
      const reward=serverResult.reward || 0;
      setProgress(current=>({...current,...serverResult.progress}));
      showScoreBurst(reward);
      setFeedback({correct:true,text:reward ? `Chính xác! +${reward}` : 'Chính xác! Bài này đã được tính điểm hôm nay.'});
      if(mode==='rush')setRushScore(serverResult.run.score);
      if(mode==='streak')setStreakScore(serverResult.run.score);
      if(!['rush','streak'].includes(mode))saveSession({});
      if(mode!=='daily')nextTimerRef.current=window.setTimeout(()=>loadRef.current(mode,[puzzle.id]),620);
      return;
    }
    const today = dateKey();
    const reward = mode === 'daily'
      ? 20
      : mode === 'rush'
        ? 1
        : mode === 'streak'
          ? 1
        : mode === 'custom'
          ? 10
          : Math.max(5, Math.min(24, Math.round((puzzle.rating - progress.rating) / 40) + 12));

    showScoreBurst(reward);
    setFeedback({ correct: true, text: `Chính xác! +${reward}` });

    if (mode === 'rated') {
      saveSession({ mode: 'rated', score: reward, correct: 1, attempted: 1, bestStreak: 1, durationSeconds: 0 });
      setProgress((current) => ({
        ...current,
        attempted: current.attempted + 1,
        correct: current.correct + 1,
        points: current.points + reward,
        rating: current.rating + reward,
        dailyPuzzleUsage: {
          ...(current.dailyPuzzleUsage ?? {}),
          [today]: (current.dailyPuzzleUsage?.[today] ?? 0) + 1
        },
        seen: current.seen.includes(puzzle.id) ? current.seen : [...current.seen, puzzle.id]
      }));
    } else if (mode === 'daily') {
      saveSession({ mode: 'daily', score: reward, correct: 1, attempted: 1, bestStreak: 1, durationSeconds: 0 });
      setProgress((current) => ({
        ...current,
        correct: current.correct + (current.dailySolved[today] ? 0 : 1),
        points: current.points + (current.dailySolved[today] ? 0 : reward),
        dailyStreak: updateDailyStreak(current, today),
        dailySolved: { ...current.dailySolved, [today]: true },
        seen: current.seen.includes(puzzle.id) ? current.seen : [...current.seen, puzzle.id]
      }));
      return;
    } else if (mode === 'rush') {
      const nextScore = rushScore + 1;
      setRushScore(nextScore);
      setProgress((current) => ({
        ...current,
        seen: current.seen.includes(puzzle.id) ? current.seen : [...current.seen, puzzle.id]
      }));
    } else if (mode === 'streak') {
      const nextScore = streakScore + 1;
      setStreakScore(nextScore);
      setProgress((current) => ({
        ...current,
        seen: current.seen.includes(puzzle.id) ? current.seen : [...current.seen, puzzle.id]
      }));
    } else if (mode === 'custom') {
      saveSession({ mode: 'custom', score: reward, correct: 1, attempted: 1, bestStreak: 1, durationSeconds: 0 });
      setProgress((current) => ({
        ...current,
        correct: current.correct + 1,
        points: current.points + reward,
        seen: current.seen.includes(puzzle.id) ? current.seen : [...current.seen, puzzle.id]
      }));
    } else if (mode === 'personal') {
      saveSession({ mode: 'personal', score: reward, correct: 1, attempted: 1, bestStreak: 1, durationSeconds: 0 });
      setProgress((current) => ({
        ...current,
        correct: current.correct + 1,
        points: current.points + reward,
        seen: current.seen.includes(puzzle.id) ? current.seen : [...current.seen, puzzle.id]
      }));
    }

    nextTimerRef.current = window.setTimeout(() => {
      if ((mode === 'rush' && !rushActive) || (mode === 'streak' && !streakActive)) return;
      loadRef.current(mode, [puzzle.id]);
    }, 620);
  };

  const markIncorrect = (serverResult) => {
    if(serverResult?.progress) {
      setProgress(current=>({...current,...serverResult.progress}));
      showScoreBurst(serverResult.reward || 0);
      if(mode==='rush') { setRushMisses(serverResult.run.misses);setRushScore(serverResult.run.score); }
      if(serverResult.run.status==='finished') {
        setRushActive(false);setStreakActive(false);
        setFeedback({correct:false,text:`Lượt chơi kết thúc. Điểm: ${serverResult.run.score}.`});
        saveSession({});
      } else {
        setFeedback({correct:false,text:'Chưa đúng. Hãy thử lại.'});
        if(mode==='rush')nextTimerRef.current=window.setTimeout(()=>loadRef.current(mode,[puzzle.id]),520);
      }
      return;
    }
    const penalty = mode === 'rush' ? 1 : mode === 'rated' ? 8 : 4;
    showScoreBurst(-penalty);

    if (mode === 'rush') {
      const nextMisses = rushMisses + 1;
      setRushMisses(nextMisses);
      setProgress((current) => ({
        ...current,
        seen: current.seen.includes(puzzle.id) ? current.seen : [...current.seen, puzzle.id]
      }));
      if (nextMisses >= 3) {
        setRushActive(false);
        setProgress((current) => ({ ...current, rushBest: Math.max(current.rushBest, rushScore) }));
        setFeedback({ correct: false, text: `Hết lượt: 3 lỗi. -${penalty}` });
        saveSession({ mode: 'rush', score: rushScore, correct: rushScore, attempted: rushScore + nextMisses, bestStreak: rushScore, durationSeconds: 180 - rushSeconds });
        return;
      }
      setFeedback({ correct: false, text: `Sai. Chuyển câu tiếp theo. -${penalty}` });
      nextTimerRef.current = window.setTimeout(() => loadRef.current(mode, [puzzle.id]), 520);
      return;
    }
    if (mode === 'streak') {
      setStreakActive(false);
      saveSession({ mode: 'streak', score: streakScore, correct: streakScore, attempted: streakScore + 1, bestStreak: streakScore, durationSeconds: Math.max(1, Math.floor((Date.now() - new Date(sessionStartedAtRef.current || Date.now()).getTime()) / 1000)) });
      setFeedback({ correct: false, text: `Chuỗi dừng ở ${streakScore}.` });
      return;
    }
    setFeedback({ correct: false, text: `Chưa đúng. Hãy thử nước khác. -${penalty}` });
    setProgress((current) => ({
      ...current,
      attempted: mode === 'rated' ? current.attempted + 1 : current.attempted,
      points: Math.max(0, current.points - penalty),
      rating: mode === 'rated' ? Math.max(100, current.rating - penalty) : current.rating
    }));
  };

  const playSquare = async (square) => {
    if (!position || !puzzle || feedback?.correct || loading || checking) return;
    if (mode === 'rush' && !rushActive) return;
    if (mode === 'streak' && !streakActive) return;
    if (mode === 'daily' && progress.dailySolved[dateKey()]) return;
    const piece = position.get(square);
    if (!selected) {
      if (piece?.color !== position.turn()) return;
      setSelected(square);
      setTargets(position.moves({ square, verbose: true }).map((move) => move.to));
      return;
    }
    if (piece?.color === position.turn()) {
      setSelected(square);
      setTargets(position.moves({ square, verbose: true }).map((move) => move.to));
      return;
    }

    const choices = position.moves({ square: selected, verbose: true }).filter((move) => move.to === square);
    setSelected(null);
    setTargets([]);
    if (!choices.length) return;
    if (choices.some((move) => move.promotion)) { setPromotion(choices); return; }
    await submitMove(choices[0]);
  };

  const submitMove = async (move) => {
    if (attemptRef.current || loading) return;
    const controller = new AbortController();
    attemptRef.current = controller;
    const generation = generationRef.current;
    setPromotion(null);
    setChecking(true);
    setError('');
    try {
      const result = await checkPuzzleMove(puzzle.id, move.lan, { playedMoves, attemptId:puzzle.attemptId,version:puzzleVersionRef.current,signal: controller.signal });
      if (controller.signal.aborted || generation !== generationRef.current) return;
      if(result.version!==undefined)puzzleVersionRef.current=result.version;
      if(result.run)runRef.current=result.run;
      if(result.expired) { if(result.progress)setProgress(current=>({...current,...result.progress}));setRushActive(false);setStreakActive(false);setFeedback({correct:false,text:'Phiên đã hết hạn. Hãy bắt đầu lại.'});return; }
      if (!result.accepted) {
        markIncorrect(result);
        return;
      }

      const solvedPosition = new Chess(position.fen());
      solvedPosition.move(move);
      if (result.reply) solvedPosition.move(result.reply);
      setPosition(solvedPosition);
      setPlayedMoves(result.playedMoves || [...playedMoves, move.lan]);
      if (result.complete === false) {
        setFeedback({ correct: false, continuing: true, text: 'Đúng hướng rồi. Hãy đi tiếp để hoàn thành bài.' });
        return;
      }
      completePuzzle(result);
    } catch (checkError) {
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setError(checkError.message || 'Stockfish không thể kiểm tra nước đi lúc này.');
    } finally {
      if (attemptRef.current === controller) { attemptRef.current = null; setChecking(false); }
    }
  };

  const startRush = () => {
    runRef.current=null;
    sessionStartedAtRef.current = new Date().toISOString();
    setRushActive(true);
    rushDeadlineRef.current = Date.now() + 180000;
    setRushSeconds(180);
    setRushScore(0);
    setRushMisses(0);
    loadPuzzle('rush');
  };

  const startStreak = () => {
    runRef.current=null;
    sessionStartedAtRef.current = new Date().toISOString();
    setStreakActive(true);
    setStreakScore(0);
    loadPuzzle('streak');
  };

  const flipped = puzzle?.sideToMove === 'b';

  return (
    <section className="puzzle-workspace">
      <nav className="puzzle-mode-nav" aria-label="Chế độ câu đố">
        {MODES.map((item) => {
          const Icon = item.icon;
          const locked = (item.id === 'rush' && !hasPremium(membership, 'plus'))
            || (item.id === 'custom' && !hasPremium(membership, 'pro'));
          return (
            <button
              className={`${mode === item.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
              key={item.id}
              aria-current={mode === item.id ? 'page' : undefined}
              onClick={() => locked ? onNavigate('membership') : onNavigate(item.route)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
              {locked && <Lock size={15} />}
            </button>
          );
        })}
      </nav>

      <main className="puzzle-main">
        <header className="puzzle-header">
          <div>
            <span>Tactics Trainer</span>
            <h1>{MODES.find((item) => item.id === mode)?.label}</h1>
            <p className="puzzle-mode-help">{MODE_HELP[mode]}</p>
          </div>
          <div className="puzzle-metrics">
            {mode === 'rush' ? <b><Timer size={17} />{Math.floor(rushSeconds / 60)}:{String(rushSeconds % 60).padStart(2, '0')}</b> : <b><Trophy size={17} /><span>{mode === 'streak' ? 'Chuỗi' : 'Elo câu đố'}: {mode === 'streak' ? streakScore : progress.rating}</span></b>}
            <b><Flame size={17} /><span>{mode === 'daily' ? 'Ngày liên tiếp' : 'Điểm'}: {mode === 'daily' ? progress.dailyStreak : mode === 'rush' ? rushScore : progress.points}</span></b>
            {mode === 'rush' && <b><X size={17}/>{rushMisses}/3 lỗi</b>}
          </div>
        </header>

        {quotaLocked ? (
          <section className="puzzle-unavailable premium-puzzle-lock">
            <Crown size={42} />
            <h2>Đã hết {formatLimit(plan.puzzleLimit)} puzzle hôm nay</h2>
            <p>Gói hiện tại của bạn là {plan.name}. Nâng cấp để mở thêm quota puzzle, Puzzle Rush và bài tập theo chủ đề.</p>
            <button onClick={() => onNavigate('membership')}>Nâng cấp Premium</button>
          </section>
        ) : premiumLocked ? (
          <section className="puzzle-unavailable premium-puzzle-lock">
            <Crown size={42} />
            <h2>{mode === 'rush' ? 'Puzzle Rush thuộc gói Plus' : 'Custom Puzzles thuộc gói Pro'}</h2>
            <p>Gói hiện tại của bạn là {plan.name}. Nâng cấp để mở thêm puzzle, luyện theo chủ đề và tăng tiến độ nhanh hơn.</p>
            <button onClick={() => onNavigate('membership')}>Xem gói Premium</button>
          </section>
        ) : mode === 'battle' ? (
          <PuzzleBattle key={authUser?.uid || authUser?.id || "guest"} pieceSet={pieceSet} authUser={authUser} Board={PuzzleBoard} />
        ) : (
          <section className={`puzzle-play-layout ${feedback?.correct ? 'puzzle-solved' : feedback && !feedback.continuing ? 'puzzle-missed' : ''}`}>
            <PuzzleBoard
              position={position}
              flipped={flipped}
              pieceSet={pieceSet}
              selected={selected}
              targets={targets}
              onSelectSquare={playSquare}
              disabled={loading || checking || !progressReady || Boolean(promotion)}
              promotion={promotion} onPromote={submitMove} onCancelPromotion={() => setPromotion(null)}
            />
            <aside className="puzzle-panel">
              {mode === 'custom' && (
                <div className="puzzle-filters">
                  <strong>Luyện theo chủ đề</strong>
                  <select value={theme} onChange={(event) => setTheme(event.target.value)}>
                    {THEMES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <select value={stage} onChange={(event) => setStage(event.target.value)}>
                    {STAGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <select value={ratingBand} onChange={(event) => setRatingBand(event.target.value)}>
                    <option value="0-1100">Cơ bản (0 - 1100)</option>
                    <option value="1101-1400">Trung cấp (1101 - 1400)</option>
                    <option value="1401-4000">Nâng cao (1401+)</option>
                    <option value="0-4000">Mọi độ khó</option>
                  </select>
                  <button onClick={() => loadPuzzle('custom')}>Áp dụng</button>
                </div>
              )}
              {mode === 'rush' && !rushActive && (
                <div className="rush-start">
                  <strong>{rushSeconds === 0 || feedback ? `Điểm: ${rushScore}` : '3 phút, tối đa 3 lỗi'}</strong>
                  <span>Kỷ lục: {progress.rushBest}</span>
                  <button onClick={startRush}>Bắt đầu Rush</button>
                </div>
              )}
              {mode === 'streak' && !streakActive && (
                <div className="rush-start">
                  <strong>{feedback ? `Chuỗi vừa rồi: ${streakScore}` : 'Sai là kết thúc'}</strong>
                  <span>Luyện chính xác trước khi luyện tốc độ.</span>
                  <button onClick={startStreak}>Bắt đầu Streak</button>
                </div>
              )}
              <div className="puzzle-status">
                {scoreBurst && (
                  <span className={`score-burst ${scoreBurst.value > 0 ? 'gain' : 'loss'}`} key={scoreBurst.id}>
                    {scoreBurst.value > 0 ? '+' : ''}{scoreBurst.value}
                  </span>
                )}
                {loading && <p>Đang tải câu đố...</p>}
                {checking && <p>Stockfish đang kiểm tra nước đi...</p>}
                {error && <p role="alert" className="error">{error}</p>}
                {error && !puzzle && <button type="button" disabled={loading} onClick={() => loadPuzzle(mode)}>Tải lại câu đố</button>}
                {!loading && !error && puzzle && (
                  <>
                    <strong>{puzzle.sideToMove === 'w' ? 'Trắng' : 'Đen'} đi trước</strong>
                    <span>{THEME_LABELS[puzzle.theme] ?? puzzle.theme} · {STAGE_LABELS[puzzle.stage] ?? puzzle.stage} · {puzzle.rating}</span>
                    <small>{puzzle.playerMoves > 1 ? `Hoàn thành chuỗi ${puzzle.playerMoves} nước của bạn` : 'Tìm nước đi quyết định'}</small>
                    {mode === 'daily' && <small>{dateKey()}</small>}
                  </>
                )}
                {feedback && (
                  <p role="status" className={feedback.correct || feedback.continuing ? 'correct' : 'wrong'}>
                    {feedback.correct || feedback.continuing ? <Check size={18} /> : <X size={18} />}
                    {feedback.text}
                  </p>
                )}
              </div>
              {mode === 'rated' && <p className="puzzle-note">Nước đúng cộng điểm và chuyển ngay sang câu tiếp theo. Không mở review.</p>}
              {mode === 'daily' && progress.dailySolved[dateKey()] && <p className="puzzle-note">Daily Puzzle hôm nay đã hoàn thành.</p>}
            </aside>
          </section>
        )}
      </main>
    </section>
  );
}

function PuzzleBoard({ position, flipped, pieceSet, selected, targets, onSelectSquare, disabled = false, promotion, onPromote, onCancelPromotion }) {
  return (
    <section className={`puzzle-board piece-set-${pieceSet}`} aria-label="Puzzle board">
      <PromotionPicker request={promotion?.[0]} pieceSet={pieceSet} flipped={flipped} onClose={onCancelPromotion}
        onChoose={(piece) => onPromote(promotion.find((move) => move.promotion === piece))} />
      {Array.from({ length: 8 }).map((_, row) => (
        Array.from({ length: 8 }).map((__, col) => {
          const square = squareName(row, col, flipped);
          const piece = position?.get(square);
          const dark = (row + col) % 2 === 1;
          return (
            <button
              className={`square ${dark ? 'dark' : 'light'} ${selected === square ? 'selected' : ''} ${targets.includes(square) ? 'target' : ''}`}
              key={square}
              onClick={() => onSelectSquare(square)}
              aria-label={square}
              disabled={disabled || !position}
            >
              {piece && <img className={`piece ${piece.color} piece-set-${pieceSet}`} src={getPieceImage(pieceSet, `${piece.color}${piece.type}`)} alt="" draggable="false" />}
              {(row === 7 || col === 0) && <span className="coord">{row === 7 ? square[0] : square[1]}</span>}
            </button>
          );
        })
      ))}
    </section>
  );
}
