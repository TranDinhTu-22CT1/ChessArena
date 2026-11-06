import React from 'react';
import { apiUrl } from '../api/config';
import { apiFetch } from '../api/request';
import { createGameState } from '../game/chessLogic';
import { REVIEW_LEGEND, reviewLabel } from '../data/review';

function moveToLan(move) {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

function buildMissingPositions({ history, initialFen, gameVariant, pendingAnalysis, stockfishReview }) {
  const existing = new Set([
    ...pendingAnalysis.filter((item) => (item.purpose || 'review') === 'review').map((item) => item.ply),
    ...stockfishReview.map((item, index) => (item && !item.analysisError && item.analysisMode !== 'live' ? index + 1 : null)).filter(Boolean)
  ]);

  return history
    .map((move, index) => ({
      ply: index + 1,
      quality: 'quick',
      purpose: 'review',
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
    if (!item || item.analysisError) return;
    const color = item.mover === 'b' ? 'b' : 'w';
    if (stats[color][item.tone] === undefined) stats[color][item.tone] = 0;
    stats[color][item.tone] += 1;
    totals[color] += 1;
    loss[color] += item.accuracy ?? 100 * Math.exp(-0.045 * Number(item.winLoss || 0));
  });

  const accuracy = {
    w: totals.w ? (loss.w / totals.w).toFixed(1) : '--',
    b: totals.b ? (loss.b / totals.b).toFixed(1) : '--'
  };

  return { stats, totals, accuracy };
}

export function useGameReview({ game, history, initialFen, gameVariant, isCoachGame, liveReview = isCoachGame, gameId }) {
  const [reviewMode, setReviewMode] = React.useState(false);
  const [reviewPly, setReviewPly] = React.useState(0);
  const [stockfishReview, setStockfishReview] = React.useState([]);
  const [stockfishStatus, setStockfishStatus] = React.useState('idle');
  const [reviewStarted, setReviewStarted] = React.useState(false);
  const [pendingAnalysis, setPendingAnalysis] = React.useState([]);
  const [reviewSessionId, setReviewSessionId] = React.useState('');

  const queueRef = React.useRef(pendingAnalysis);
  queueRef.current = pendingAnalysis;
  const lastAnalysisRequestRef = React.useRef('');
  const firstPendingKey = pendingAnalysis[0] ? JSON.stringify(pendingAnalysis[0]) : '';
  const [retry, setRetry] = React.useState(0);
  const currentReviewAnalysis = reviewMode ? stockfishReview[reviewPly - 1] : null;
  const reviewBadge = currentReviewAnalysis ? { ...currentReviewAnalysis, label: reviewLabel(currentReviewAnalysis.tone) } : (reviewMode && reviewPly > 0 ? { label: 'Đang phân tích', tone: 'loading' } : null);
  const reviewStats = React.useMemo(() => calculateReviewStats(stockfishReview), [stockfishReview]);

  const ensureReviewSession = React.useCallback(() => {
    if (reviewSessionId) return reviewSessionId;
    const random = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const next = `local:${gameId || 'game'}:${random}`.slice(0, 160);
    setReviewSessionId(next);
    return next;
  }, [gameId, reviewSessionId]);

  const queueMissingReviewAnalysis = React.useCallback((force = false) => {
    if (!force && !reviewStarted) return;
    ensureReviewSession();
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
  }, [ensureReviewSession, gameVariant, history, initialFen, reviewStarted, stockfishReview]);

  const startReview = React.useCallback(() => {
    setReviewMode(true);
    setReviewStarted(true);
    setReviewPly(history.length);
    setStockfishStatus('idle');
    ensureReviewSession();
    queueMissingReviewAnalysis(true);
  }, [ensureReviewSession, history.length, queueMissingReviewAnalysis]);

  const reviewStep = React.useCallback((direction) => {
    setReviewPly((currentPly) => Math.min(history.length, Math.max(0, currentPly + direction)));
  }, [history.length]);

  React.useEffect(() => {
    if (!reviewMode) return undefined;

    const handleKeyDown = (event) => {
      const target = event.target;
      const isEditable = target?.isContentEditable
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
      if (isEditable || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;

      event.preventDefault();
      reviewStep(event.key === 'ArrowLeft' ? -1 : 1);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reviewMode, reviewStep]);

  React.useEffect(() => {
    // Wait until the quota/idempotency key is stable. Starting with an empty
    // session and then updating it can abort and resend the same engine batch.
    if (!firstPendingKey || !reviewSessionId) return undefined;
    const first = queueRef.current[0];
    const quality = first?.quality || 'quick';
    const purpose = first?.purpose || 'review';
    const positions = queueRef.current
      .filter(item => (item.quality || 'quick') === quality && (item.purpose || 'review') === purpose)
      .slice(0, purpose === 'live' ? 1 : 3);
    const requestKey = `${gameId || 'local'}:${reviewSessionId}:${retry}:${purpose}:${quality}:${positions.map(item => `${item.ply}:${item.move}`).join(',')}`;
    if (lastAnalysisRequestRef.current === requestKey) return undefined;
    lastAnalysisRequestRef.current = requestKey;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    setStockfishStatus('loading');
    apiFetch(apiUrl('/api/analysis/review'), {
      timeoutMs: 30000,
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        positions,
        quality,
        movetime: 180,
        analysisMode: purpose,
        reviewSessionId
      })
    })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || 'Stockfish review failed.');
        const results = (data.results || []).filter((item) => positions.some((p) => p.ply === item.ply) && item.tone);
        if (positions.some((p) => !results.some((item) => item.ply === p.ply))) throw new Error('Kết quả phân tích chưa đầy đủ. Hãy thử lại.');
        setStockfishReview((current) => {
          const byPly = [...current];
          results.forEach((item) => { byPly[item.ply - 1] = { ...item, analysisMode: purpose }; });
          return byPly;
        });
        setPendingAnalysis((current) => current.filter((item) => !positions.some((done) => done.ply === item.ply)));
        setStockfishStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setStockfishStatus(error.name === 'AbortError'
          ? 'Phân tích mất quá lâu. Hãy thử lại.'
          : `Chưa phân tích được nước đi.${error.message ? ` ${error.message}` : ''} Hãy thử lại.`);
        // Preserve the failed job so an explicit retry resumes the same move.
      }).finally(() => window.clearTimeout(timeout));

    return () => {
      cancelled = true;
      if (lastAnalysisRequestRef.current === requestKey) lastAnalysisRequestRef.current = '';
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [firstPendingKey, gameId, retry, reviewSessionId]);

  React.useEffect(() => {
    lastAnalysisRequestRef.current = '';
    setReviewSessionId('');
    setReviewStarted(false);
    setPendingAnalysis([]);
    setStockfishReview([]);
    setStockfishStatus('idle');
  }, [gameId]);

  React.useEffect(() => {
    if (!liveReview || history.length === 0) return;

    ensureReviewSession();
    setReviewStarted(true);

    setPendingAnalysis((current) => {
      const existing = new Set([
        ...current.map((item) => item.ply),
        ...stockfishReview.map((item, index) => item ? index + 1 : null).filter(Boolean)
      ]);
      const missing = history.map((move, index) => ({
          ply: index + 1,
          purpose: 'live',
          quality: 'quick',
          fen: createGameState(history.slice(0, index), initialFen).chess.fen(),
          move: moveToLan(move),
          san: move.san,
          piece: move.piece,
          captured: move.captured,
          variant: gameVariant,
          priorMoves: history.slice(0, index).map(moveToLan)
        }))
        .filter((item) => !existing.has(item.ply));
      return missing.length ? [...current, ...missing] : current;
    });
  }, [ensureReviewSession, gameVariant, history, initialFen, liveReview, stockfishReview]);

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
    startReview,
    reviewStep,
    retryReview: () => {
      if (stockfishReview.some(item => item?.analysisError)) {
        queueMissingReviewAnalysis(true);
      }
      setRetry((value) => value + 1);
    }
  };
}
