import React from 'react';
import { Chess } from 'chess.js';
import { CalendarDays, Check, Crown, Flame, Lock, Puzzle, Swords, Timer, Trophy, X, Zap } from 'lucide-react';
import { checkPuzzleMove, requestPuzzle } from '../../api/puzzles';
import { PIECE_IMAGES } from '../../game/pieces';
import { squareName } from '../../game/chessLogic';
import { formatLimit, hasPremium, membershipPlan } from '../../membership/plans';

const STORAGE_KEY = 'chess-arena-puzzle-progress';
const POOL_VERSION = 'progressive-tactics-v5';
const ROUTE_MODES = {
  puzzles: 'rated',
  'daily-puzzle': 'daily',
  'puzzle-rush': 'rush',
  'puzzle-battle': 'battle',
  'custom-puzzles': 'custom',
  'personal-puzzles': 'personal'
};
const THEMES = [
  { id: 'all', label: 'Táº¥t cáº£' },
  { id: 'mate', label: 'Chiáº¿u háº¿t' },
  { id: 'material', label: 'Tháº¯ng quĂ¢n' },
  { id: 'promotion', label: 'Phong cáº¥p' }
];
const THEME_LABELS = Object.fromEntries(THEMES.map((item) => [item.id, item.label]));
const STAGES = [
  { id: 'all', label: 'Táº¥t cáº£ giai Ä‘oáº¡n' },
  { id: 'middlegame', label: 'Trung cuá»™c' },
  { id: 'endgame', label: 'TĂ n cuá»™c' }
];
const STAGE_LABELS = Object.fromEntries(STAGES.map((item) => [item.id, item.label]));
const MODES = [
  { id: 'rated', route: 'puzzles', label: 'Puzzles', icon: Puzzle },
  { id: 'daily', route: 'daily-puzzle', label: 'Daily Puzzle', icon: CalendarDays },
  { id: 'rush', route: 'puzzle-rush', label: 'Puzzle Rush', icon: Zap },
  { id: 'battle', route: 'puzzle-battle', label: 'Puzzle Battle', icon: Swords },
  { id: 'custom', route: 'custom-puzzles', label: 'Custom Puzzles', icon: Trophy },
  { id: 'personal', route: 'personal-puzzles', label: 'Mistake Lab', icon: Flame }
];

function initialProgress() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved?.poolVersion === POOL_VERSION) {
      return {
        ...saved,
        dailyPuzzleUsage: saved.dailyPuzzleUsage ?? {}
      };
    }
    if (saved) {
      return {
        ...saved,
        poolVersion: POOL_VERSION,
        dailyAssignments: {},
        dailySolved: {},
        dailyPuzzleUsage: {},
        dailyStreak: 0,
        seen: []
      };
    }
  } catch {
    // Ignore invalid local progress and start cleanly.
  }

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

export default function PuzzlePage({ activeRoute, pieceSet, membership, onNavigate }) {
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

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

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
        setFeedback({ correct: true, text: 'Báº¡n Ä‘Ă£ giáº£i Daily Puzzle hĂ´m nay.' });
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
        ? 'Báº¡n Ä‘Ă£ hoĂ n thĂ nh toĂ n bá»™ cĂ¢u Ä‘á»‘ chÆ°a gáº·p trong bá»™ lá»c nĂ y.'
        : 'Stockfish khĂ´ng thá»ƒ táº£i cĂ¢u Ä‘á»‘ lĂºc nĂ y.');
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
    if (mode !== 'battle') loadPuzzle(mode);
  }, [mode]);

  React.useEffect(() => {
    if (!rushActive) return undefined;
    const timer = window.setInterval(() => {
      setRushSeconds((seconds) => {
        if (seconds > 1) return seconds - 1;
        setRushActive(false);
        setFeedback({ correct: false, text: 'Háº¿t giá».' });
        setProgress((current) => ({ ...current, rushBest: Math.max(current.rushBest, rushScore) }));
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [rushActive, rushScore]);

  const showScoreBurst = (value) => {
    setScoreBurst({ id: Date.now(), value });
  };

  const completePuzzle = () => {
    const today = dateKey();
    const reward = mode === 'daily'
      ? 20
      : mode === 'rush'
        ? 1
        : mode === 'custom'
          ? 10
          : Math.max(5, Math.min(24, Math.round((puzzle.rating - progress.rating) / 40) + 12));

    showScoreBurst(reward);
    setFeedback({ correct: true, text: `ChĂ­nh xĂ¡c! +${reward}` });

    if (mode === 'rated') {
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
    } else if (mode === 'custom') {
      setProgress((current) => ({
        ...current,
        correct: current.correct + 1,
        points: current.points + reward,
        seen: current.seen.includes(puzzle.id) ? current.seen : [...current.seen, puzzle.id]
      }));
    }

    window.setTimeout(() => {
      if (mode !== 'rush' || rushActive) loadPuzzle(mode, [puzzle.id]);
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
        setFeedback({ correct: false, text: `Háº¿t lÆ°á»£t: 3 lá»—i. -${penalty}` });
        return;
      }
      setFeedback({ correct: false, text: `Sai. Chuyá»ƒn cĂ¢u tiáº¿p theo. -${penalty}` });
      window.setTimeout(() => loadPuzzle(mode, [puzzle.id]), 520);
      return;
    }
    setFeedback({ correct: false, text: `ChÆ°a Ä‘Ăºng. HĂ£y thá»­ nÆ°á»›c khĂ¡c. -${penalty}` });
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

    const promotion = position.get(selected)?.type === 'p' && ['1', '8'].includes(square[1]) ? 'q' : undefined;
    const lan = `${selected}${square}${promotion ?? ''}`;
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
      solvedPosition.move({ from: selected, to: square, promotion });
      setPosition(solvedPosition);
      completePuzzle();
    } catch {
      setError('Stockfish khĂ´ng thá»ƒ kiá»ƒm tra nÆ°á»›c Ä‘i lĂºc nĂ y.');
    } finally {
      setChecking(false);
    }
  };

  const startRush = () => {
    setRushActive(true);
    setRushSeconds(180);
    setRushScore(0);
    setRushMisses(0);
    loadPuzzle('rush');
  };

  const flipped = puzzle?.sideToMove === 'b';

  return (
    <section className="puzzle-workspace">
      <nav className="puzzle-mode-nav" aria-label="Cháº¿ Ä‘á»™ cĂ¢u Ä‘á»‘">
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
            {mode === 'rush' ? <b><Timer size={17} />{Math.floor(rushSeconds / 60)}:{String(rushSeconds % 60).padStart(2, '0')}</b> : <b><Trophy size={17} />{progress.rating}</b>}
            <b><Flame size={17} />{mode === 'daily' ? progress.dailyStreak : progress.points}</b>
          </div>
        </header>

        {quotaLocked ? (
          <section className="puzzle-unavailable premium-puzzle-lock">
            <Crown size={42} />
            <h2>ÄĂ£ háº¿t {formatLimit(plan.puzzleLimit)} puzzle hĂ´m nay</h2>
            <p>GĂ³i hiá»‡n táº¡i cá»§a báº¡n lĂ  {plan.name}. NĂ¢ng cáº¥p Ä‘á»ƒ má»Ÿ thĂªm quota puzzle, Puzzle Rush vĂ  bĂ i táº­p theo chá»§ Ä‘á».</p>
            <button onClick={() => onNavigate('membership')}>NĂ¢ng cáº¥p Premium</button>
          </section>
        ) : premiumLocked ? (
          <section className="puzzle-unavailable premium-puzzle-lock">
            <Crown size={42} />
            <h2>{mode === 'rush' ? 'Puzzle Rush thuá»™c gĂ³i Plus' : 'Custom Puzzles thuá»™c gĂ³i Pro'}</h2>
            <p>GĂ³i hiá»‡n táº¡i cá»§a báº¡n lĂ  {plan.name}. NĂ¢ng cáº¥p Ä‘á»ƒ má»Ÿ thĂªm puzzle, luyá»‡n theo chá»§ Ä‘á» vĂ  tÄƒng tiáº¿n Ä‘á»™ nhanh hÆ¡n.</p>
            <button onClick={() => onNavigate('membership')}>Xem gĂ³i Premium</button>
          </section>
        ) : mode === 'battle' ? (
          <section className="puzzle-unavailable">
            <Swords size={42} />
            <h2>Puzzle Battle cáº§n Ä‘á»‘i thá»§ realtime</h2>
            <p>Cháº¿ Ä‘á»™ nĂ y cáº§n ghĂ©p tráº­n, Ä‘á»“ng há»“ Ä‘á»“ng bá»™ vĂ  xĂ¡c nháº­n Ä‘iá»ƒm tá»« server. Hiá»‡n táº¡i khĂ´ng táº¡o Ä‘á»‘i thá»§ giáº£ Ä‘á»ƒ trĂ¡nh káº¿t quáº£ sai.</p>
            <button onClick={() => onNavigate('puzzle-rush')}>ChÆ¡i Puzzle Rush</button>
          </section>
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
                  <strong>Luyá»‡n theo chá»§ Ä‘á»</strong>
                  <select value={theme} onChange={(event) => setTheme(event.target.value)}>
                    {THEMES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <select value={stage} onChange={(event) => setStage(event.target.value)}>
                    {STAGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <select value={ratingBand} onChange={(event) => setRatingBand(event.target.value)}>
                    <option value="0-1100">CÆ¡ báº£n (0 - 1100)</option>
                    <option value="1101-1400">Trung cáº¥p (1101 - 1400)</option>
                    <option value="1401-4000">NĂ¢ng cao (1401+)</option>
                    <option value="0-4000">Má»i Ä‘á»™ khĂ³</option>
                  </select>
                  <button onClick={() => loadPuzzle('custom')}>Ăp dá»¥ng</button>
                </div>
              )}
              {mode === 'rush' && !rushActive && (
                <div className="rush-start">
                  <strong>{rushSeconds === 0 || feedback ? `Äiá»ƒm: ${rushScore}` : '3 phĂºt, tá»‘i Ä‘a 3 lá»—i'}</strong>
                  <span>Ká»· lá»¥c: {progress.rushBest}</span>
                  <button onClick={startRush}>Báº¯t Ä‘áº§u Rush</button>
                </div>
              )}
              <div className="puzzle-status">
                {scoreBurst && (
                  <span className={`score-burst ${scoreBurst.value > 0 ? 'gain' : 'loss'}`} key={scoreBurst.id}>
                    {scoreBurst.value > 0 ? '+' : ''}{scoreBurst.value}
                  </span>
                )}
                {loading && <p>Stockfish Ä‘ang táº¡o cĂ¢u Ä‘á»‘...</p>}
                {checking && <p>Stockfish Ä‘ang kiá»ƒm tra nÆ°á»›c Ä‘i...</p>}
                {error && <p className="error">{error}</p>}
                {!loading && !error && puzzle && (
                  <>
                    <strong>{puzzle.sideToMove === 'w' ? 'Tráº¯ng' : 'Äen'} Ä‘i trÆ°á»›c</strong>
                    <span>{THEME_LABELS[puzzle.theme] ?? puzzle.theme} Â· {STAGE_LABELS[puzzle.stage] ?? puzzle.stage} Â· {puzzle.rating}</span>
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
              {mode === 'rated' && <p className="puzzle-note">NÆ°á»›c Ä‘Ăºng cá»™ng Ä‘iá»ƒm vĂ  chuyá»ƒn ngay sang cĂ¢u tiáº¿p theo. KhĂ´ng má»Ÿ review.</p>}
              {mode === 'daily' && progress.dailySolved[dateKey()] && <p className="puzzle-note">Daily Puzzle hĂ´m nay Ä‘Ă£ hoĂ n thĂ nh.</p>}
            </aside>
          </section>
        )}
      </main>
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
              {piece && <img className={`piece ${piece.color}`} src={PIECE_IMAGES[`${piece.color}${piece.type}`]} alt="" draggable="false" />}
              {(row === 7 || col === 0) && <span className="coord">{row === 7 ? square[0] : square[1]}</span>}
            </button>
          );
        })
      ))}
    </section>
  );
}
