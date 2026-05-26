import React from 'react';
import { apiUrl } from '../api/config';
import { createGameState } from '../game/chessLogic';
import { REVIEW_LEGEND } from '../data/review';
import { coachBehaviorFromMode } from '../coach/coach';

function moveToLan(move) {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

function buildMissingPositions({ history, initialFen, gameVariant, pendingAnalysis, stockfishReview }) {
  const existing = new Set([
    ...pendingAnalysis.map((item) => item.ply),
    ...stockfishReview.map((item, index) => (item ? index + 1 : null)).filter(Boolean)
  ]);

  return history
    .map((move, index) => ({
      ply: index + 1,
      fen: createGameState(history.slice(0, index), initialFen).chess.fen(),
      move: moveToLan(move),
      san: move.san,
      piece: move.piece,
      captured: move.captured,
      variant: gameVariant,
      priorMoves: history.slice(0, index).map(moveToLan)
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

  const accuracy = {
    w: totals.w ? Math.max(1, Math.min(99, 100 - loss.w / totals.w * 2.4)).toFixed(1) : '--',
    b: totals.b ? Math.max(1, Math.min(99, 100 - loss.b / totals.b * 2.4)).toFixed(1) : '--'
  };

  return { stats, totals, accuracy };
}

export function useGameReview({ game, history, initialFen, gameVariant, isCoachGame, coachMode }) {
  const [reviewMode, setReviewMode] = React.useState(false);
  const [reviewPly, setReviewPly] = React.useState(0);
  const [stockfishReview, setStockfishReview] = React.useState([]);
  const [stockfishStatus, setStockfishStatus] = React.useState('idle');
  const [reviewStarted, setReviewStarted] = React.useState(false);
  const [pendingAnalysis, setPendingAnalysis] = React.useState([]);

  const pendingAnalysisKey = pendingAnalysis.map((item) => item.ply).join(',');
  const currentReviewAnalysis = reviewMode ? stockfishReview[reviewPly - 1] : null;
  const reviewBadge = currentReviewAnalysis ?? (reviewMode && reviewPly > 0 ? { label: 'Analyzing', tone: 'loading' } : null);
  const reviewStats = React.useMemo(() => calculateReviewStats(stockfishReview), [stockfishReview]);
  const coachReviewDepth = coachBehaviorFromMode(coachMode).reviewDepth;

  const queueMissingReviewAnalysis = React.useCallback(() => {
    setPendingAnalysis((current) => {
      const missing = buildMissingPositions({
        history,
        initialFen,
        gameVariant,
        pendingAnalysis: current,
        stockfishReview
      });

      return missing.length ? [...current, ...missing] : current;
    });
  }, [gameVariant, history, initialFen, stockfishReview]);

  const reviewStep = React.useCallback((direction) => {
    setReviewPly((currentPly) => Math.min(history.length, Math.max(0, currentPly + direction)));
  }, [history.length]);

  React.useEffect(() => {
    if (pendingAnalysis.length === 0) return undefined;

    let cancelled = false;
    const positions = pendingAnalysis.slice(0, isCoachGame ? 4 : 16);

    setStockfishStatus('loading');
    fetch(apiUrl('/api/analysis/review'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions, depth: isCoachGame ? coachReviewDepth : 14 })
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
  }, [coachReviewDepth, isCoachGame, pendingAnalysisKey, stockfishReview]);

  React.useEffect(() => {
    if (!game.isGameOver() || history.length === 0) return;
    queueMissingReviewAnalysis();
  }, [game, history.length, queueMissingReviewAnalysis]);

  React.useEffect(() => {
    if (!isCoachGame || history.length === 0) return;

    const latestIndex = history.length - 1;
    const latest = history[latestIndex];
    if (!latest || stockfishReview[latestIndex] || pendingAnalysis.some((item) => item.ply === history.length)) return;

    setPendingAnalysis((current) => {
      if (current.some((item) => item.ply === history.length)) return current;
      return [
        ...current,
        {
          ply: history.length,
          fen: createGameState(history.slice(0, latestIndex), initialFen).chess.fen(),
          move: moveToLan(latest),
          san: latest.san,
          piece: latest.piece,
          captured: latest.captured,
          variant: gameVariant,
          priorMoves: history.slice(0, latestIndex).map(moveToLan)
        }
      ];
    });
  }, [gameVariant, history, initialFen, isCoachGame, pendingAnalysis, stockfishReview]);

  return {
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
  };
}
