import React from 'react';
import { REVIEW_LEGEND, reviewIcon } from '../data/review';

export default function ReviewPage({
  stockfishStatus,
  reviewStarted,
  reviewBadge,
  currentReviewAnalysis,
  reviewPly,
  history,
  stockfishReview,
  reviewStats,
  whiteName,
  blackName,
  onNavigate,
  onStartNewGame,
  onReviewStep,
  onSetReviewMode,
  onSetReviewStarted,
  onSetResultDismissed,
  onSetReviewPly,
  onQueueMissingReviewAnalysis
}) {
  return (
    <section className="review-dashboard">
      <div className="review-topbar">
        <button onClick={() => onNavigate('bot')}>Back to game</button>
        <h1>Game Review</h1>
        <div className="review-topbar-actions">
          <span>{stockfishStatus === 'loading' ? 'Stockfish analyzing...' : 'Stockfish ready'}</span>
          <button onClick={() => {
            onStartNewGame();
            onNavigate('bot');
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
              <button type="button" onClick={() => onReviewStep(1)} disabled={reviewPly >= history.length}>Next</button>
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
                      onSetReviewMode(true);
                      onSetReviewStarted(true);
                      onSetResultDismissed(true);
                      onSetReviewPly(index * 2 + 1);
                    }}
                  >
                    {history[index * 2]?.san ?? ''}
                  </button>
                  <button
                    className={`${reviewPly === index * 2 + 2 ? 'active' : ''} ${stockfishReview[index * 2 + 1]?.tone ?? ''}`}
                    disabled={!history[index * 2 + 1]}
                    onClick={() => {
                      onSetReviewMode(true);
                      onSetReviewStarted(true);
                      onSetResultDismissed(true);
                      onSetReviewPly(index * 2 + 2);
                    }}
                  >
                    {history[index * 2 + 1]?.san ?? ''}
                  </button>
                </div>
              ))}
            </div>

            <div className="review-controls">
              <button onClick={() => onSetReviewPly(0)} disabled={reviewPly === 0}>|&lt;</button>
              <button onClick={() => onReviewStep(-1)} disabled={reviewPly === 0}>&lt;</button>
              <button onClick={() => onSetReviewPly((ply) => (ply >= history.length ? 0 : history.length))}>
                {reviewPly >= history.length ? '?' : '?'}
              </button>
              <button onClick={() => onReviewStep(1)} disabled={reviewPly >= history.length}>&gt;</button>
              <button onClick={() => onSetReviewPly(history.length)} disabled={reviewPly >= history.length}>&gt;|</button>
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
          onSetReviewMode(true);
          onSetReviewStarted(true);
          onSetReviewPly(history.length ? Math.max(1, Math.min(history.length, reviewPly || 1)) : 0);
          onQueueMissingReviewAnalysis();
        }}>
          {reviewStarted ? 'Restart Review' : 'Start Review'}
        </button>
      </section>

      {reviewStarted && (
        <section className="review-board-section">
          <button onClick={() => onSetReviewStarted(false)}>Summary</button>
        </section>
      )}
    </section>
  );
}
