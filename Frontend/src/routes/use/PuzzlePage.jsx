import React from 'react';
import { Chess } from 'chess.js';
import { CalendarDays, Check, Crown, Flame, Lock, Puzzle, Swords, Timer, Trophy, X, Zap } from 'lucide-react';
import {
  answerPuzzleBattle,
  cancelPuzzleBattle,
  checkPuzzleMove,
  fetchPuzzleBattle,
  fetchPuzzleProgress,
  joinPuzzleBattle,
  recordPuzzleSession,
  requestPuzzle,
  savePuzzleProgress
} from '../../api/puzzles';
import { getPieceImage } from '../../game/pieces';
import { squareName } from '../../game/chessLogic';
import { formatLimit, hasPremium, membershipPlan } from '../../membership/plans';

const POOL_VERSION = 'progressive-tactics-v5';
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
  const quotaLocked = puzzleQuotaReached(plan, progress, mode);
  const [puzzle, setPuzzle] = React.useState(null);
  const [position, setPosition] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [targets, setTargets] = React.useState([]);
  const [feedback, setFeedback] = React.useState(null);
  const [scoreBurst, setScoreBurst] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
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
  const progressLoadedRef = React.useRef(false);

  React.useEffect(() => {
    if (!authUser) {
      progressLoadedRef.current = true;
      return;
    }
    let cancelled = false;
    fetchPuzzleProgress().then((data) => {
      if (cancelled || !data.progress) return;
      const dailySolved = Object.fromEntries((data.dailyClaims || []).filter((item) => item.solved_at).map((item) => [item.puzzle_date, true]));
      setProgress((current) => ({
        ...current,
        ...data.progress,
        dailySolved
      }));
    }).catch(() => {}).finally(() => {
      progressLoadedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  React.useEffect(() => {
    if (!authUser || !progressLoadedRef.current) return undefined;
    const timer = window.setTimeout(() => {
      savePuzzleProgress(progress).catch(() => {});
    }, 700);
    return () => window.clearTimeout(timer);
  }, [authUser, progress]);

  const loadPuzzle = React.useCallback(async (nextMode = mode, additionalExcluded = []) => {
    if (nextMode === 'battle') return;
    if (puzzleQuotaReached(plan, progress, nextMode)) return;
    const [minRating, maxRating] = ratingBand.split('-').map(Number);
    setLoading(true);
    setFeedback(null);
    setScoreBurst(null);
    setError('');
    setSelected(null);
    setTargets([]);

    try {
      const nextPuzzle = await requestPuzzle({
        mode: nextMode,
        date: dateKey(),
        preferredId: nextMode === 'daily' ? progress.dailyAssignments?.[dateKey()] : undefined,
        theme: nextMode === 'custom' ? theme : 'all',
        stage: nextMode === 'custom' ? stage : 'all',
        minRating: nextMode === 'custom' ? minRating : 0,
        maxRating: nextMode === 'custom' ? maxRating : 4000,
        excluded: [...progress.seen, ...additionalExcluded]
      });
      setPuzzle(nextPuzzle);
      setPosition(new Chess(nextPuzzle.fen));
      if (nextMode === 'daily' && progress.dailySolved[dateKey()]) {
        setFeedback({ correct: true, text: 'Bạn đã giải Daily Puzzle hôm nay.' });
      }
      setProgress((current) => ({
        ...current,
        dailyAssignments: nextMode === 'daily'
          ? { ...(current.dailyAssignments ?? {}), [dateKey()]: nextPuzzle.id }
          : current.dailyAssignments ?? {}
      }));
    } catch (loadError) {
      setPuzzle(null);
      setPosition(null);
      setError(loadError.exhausted
        ? 'Bạn đã hoàn thành toàn bộ câu đố chưa gặp trong bộ lọc này.'
        : 'Stockfish không thể tải câu đố lúc này.');
    } finally {
      setLoading(false);
    }
  }, [mode, plan, progress.dailyPuzzleUsage, progress.seen, ratingBand, stage, theme]);

  React.useEffect(() => {
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
  }, [mode]);

  React.useEffect(() => {
    if (!rushActive) return undefined;
    const timer = window.setInterval(() => {
      setRushSeconds((seconds) => {
        if (seconds > 1) return seconds - 1;
        setRushActive(false);
        setFeedback({ correct: false, text: 'Hết giờ.' });
        setProgress((current) => ({ ...current, rushBest: Math.max(current.rushBest, rushScore) }));
        saveSession({ mode: 'rush', score: rushScore, correct: rushScore, attempted: rushScore + rushMisses, bestStreak: rushScore, durationSeconds: 180 });
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rushActive, rushScore]);

  const showScoreBurst = (value) => {
    setScoreBurst({ id: Date.now(), value });
  };

  const saveSession = (payload) => {
    recordPuzzleSession({
      startedAt: sessionStartedAtRef.current,
      date: dateKey(),
      puzzleId: puzzle?.id,
      ...payload
    }).catch(() => {});
  };

  const completePuzzle = () => {
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

    window.setTimeout(() => {
      if ((mode === 'rush' && !rushActive) || (mode === 'streak' && !streakActive)) return;
      loadPuzzle(mode, [puzzle.id]);
    }, 620);
  };

  const markIncorrect = () => {
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
      window.setTimeout(() => loadPuzzle(mode, [puzzle.id]), 520);
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

    const fromSquare = selected;
    const promotion = position.get(fromSquare)?.type === 'p' && ['1', '8'].includes(square[1]) ? 'q' : undefined;
    const lan = `${fromSquare}${square}${promotion ?? ''}`;
    setSelected(null);
    setTargets([]);

    setChecking(true);
    try {
      const result = await checkPuzzleMove(puzzle.id, lan);
      if (!result.accepted) {
        markIncorrect();
        return;
      }

      const solvedPosition = new Chess(position.fen());
      solvedPosition.move({ from: fromSquare, to: square, promotion });
      setPosition(solvedPosition);
      completePuzzle();
    } catch {
      setError('Stockfish không thể kiểm tra nước đi lúc này.');
    } finally {
      setChecking(false);
    }
  };

  const startRush = () => {
    sessionStartedAtRef.current = new Date().toISOString();
    setRushActive(true);
    setRushSeconds(180);
    setRushScore(0);
    setRushMisses(0);
    loadPuzzle('rush');
  };

  const startStreak = () => {
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
          </div>
          <div className="puzzle-metrics">
            {mode === 'rush' ? <b><Timer size={17} />{Math.floor(rushSeconds / 60)}:{String(rushSeconds % 60).padStart(2, '0')}</b> : <b><Trophy size={17} />{mode === 'streak' ? streakScore : progress.rating}</b>}
            <b><Flame size={17} />{mode === 'daily' ? progress.dailyStreak : mode === 'rush' ? rushScore : progress.points}</b>
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
          <PuzzleBattle pieceSet={pieceSet} authUser={authUser} />
        ) : (
          <section className={`puzzle-play-layout ${feedback?.correct ? 'puzzle-solved' : feedback && !feedback.correct ? 'puzzle-missed' : ''}`}>
            <PuzzleBoard
              position={position}
              flipped={flipped}
              pieceSet={pieceSet}
              selected={selected}
              targets={targets}
              onSelectSquare={playSquare}
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
                {loading && <p>Stockfish đang tạo câu đố...</p>}
                {checking && <p>Stockfish đang kiểm tra nước đi...</p>}
                {error && <p className="error">{error}</p>}
                {!loading && !error && puzzle && (
                  <>
                    <strong>{puzzle.sideToMove === 'w' ? 'Trắng' : 'Đen'} đi trước</strong>
                    <span>{THEME_LABELS[puzzle.theme] ?? puzzle.theme} · {STAGE_LABELS[puzzle.stage] ?? puzzle.stage} · {puzzle.rating}</span>
                    {mode === 'daily' && <small>{dateKey()}</small>}
                  </>
                )}
                {feedback && (
                  <p className={feedback.correct ? 'correct' : 'wrong'}>
                    {feedback.correct ? <Check size={18} /> : <X size={18} />}
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

function PuzzleBattle({ pieceSet, authUser }) {
  const [battle, setBattle] = React.useState(null);
  const [position, setPosition] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [targets, setTargets] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    if (!battle?.puzzle?.fen) {
      setPosition(null);
      return;
    }
    setPosition(new Chess(battle.puzzle.fen));
    setSelected(null);
    setTargets([]);
  }, [battle?.puzzle?.id, battle?.puzzle?.fen]);

  React.useEffect(() => {
    if (!authUser || !battle?.id || battle.status === 'finished') return undefined;
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await fetchPuzzleBattle(battle.id);
        if (!cancelled) setBattle(data.battle);
      } catch {
        // Keep the current board while a polling request is unavailable.
      }
    };
    const interval = window.setInterval(refresh, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [authUser, battle?.id, battle?.status]);

  const join = async () => {
    setBusy(true);
    setMessage('');
    try {
      const data = await joinPuzzleBattle();
      setBattle(data.battle);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!battle?.id) return;
    setBusy(true);
    try {
      await cancelPuzzleBattle(battle.id);
      setBattle(null);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const playSquare = async (square) => {
    if (!position || !battle?.puzzle || busy) return;
    const piece = position.get(square);
    if (!selected) {
      if (piece?.color !== position.turn()) return;
      setSelected(square);
      setTargets(position.moves({ square, verbose: true }).map((move) => move.to));
      return;
    }
    if (selected === square) {
      setSelected(null);
      setTargets([]);
      return;
    }
    const move = position.moves({ square: selected, verbose: true }).find((item) => item.to === square);
    setSelected(null);
    setTargets([]);
    if (!move) return;
    setBusy(true);
    try {
      const lan = `${move.from}${move.to}${move.promotion || ''}`;
      const data = await answerPuzzleBattle(battle.id, lan);
      setMessage(data.correct ? 'Chính xác. Đã chuyển sang câu tiếp theo.' : 'Chưa đúng. Đã chuyển sang câu tiếp theo.');
      setBattle(data.battle);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (!authUser) {
    return <section className="puzzle-unavailable"><Swords size={42} /><h2>Đăng nhập để chơi Puzzle Battle</h2></section>;
  }
  if (!battle) {
    return (
      <section className="puzzle-unavailable">
        <Swords size={42} />
        <h2>Puzzle Battle realtime</h2>
        <p>Hai người giải cùng một bộ câu đố. Server xác nhận từng nước đi và chốt điểm.</p>
        <button type="button" disabled={busy} onClick={join}>{busy ? 'Đang tìm...' : 'Tìm đối thủ'}</button>
        {message && <small>{message}</small>}
      </section>
    );
  }
  if (battle.status === 'waiting') {
    return (
      <section className="puzzle-unavailable">
        <Swords size={42} />
        <h2>Đang chờ đối thủ</h2>
        <p>Phòng #{String(battle.id).slice(0, 8)}</p>
        <button type="button" disabled={busy} onClick={cancel}>Hủy tìm</button>
      </section>
    );
  }
  if (battle.status === 'finished') {
    return (
      <section className="puzzle-unavailable">
        <Trophy size={42} />
        <h2>{battle.winnerUserId === null ? 'Trận hòa' : battle.won ? 'Bạn thắng' : 'Đối thủ thắng'}</h2>
        <p>{battle.score} - {battle.opponentScore}</p>
        <button type="button" onClick={() => setBattle(null)}>Chơi trận mới</button>
      </section>
    );
  }
  if (!battle.puzzle || !position) {
    return (
      <section className="puzzle-unavailable">
        <Timer size={42} />
        <h2>Đã hoàn thành phần của bạn</h2>
        <p>Điểm hiện tại: {battle.score} - {battle.opponentScore}. Đang chờ đối thủ.</p>
      </section>
    );
  }
  return (
    <section className="puzzle-play-layout puzzle-battle-live">
      <PuzzleBoard
        position={position}
        flipped={position.turn() === 'b'}
        pieceSet={pieceSet}
        selected={selected}
        targets={targets}
        onSelectSquare={playSquare}
      />
      <aside className="puzzle-panel">
        <span>Puzzle Battle</span>
        <h2>{battle.score} - {battle.opponentScore}</h2>
        <p>Câu {battle.index + 1}/{battle.total} | Rating {battle.puzzle.rating}</p>
        <p>{message || 'Tìm nước đi tốt nhất.'}</p>
      </aside>
    </section>
  );
}

function PuzzleBoard({ position, flipped, pieceSet, selected, targets, onSelectSquare }) {
  return (
    <section className={`puzzle-board piece-set-${pieceSet}`} aria-label="Puzzle board">
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
