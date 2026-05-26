import React from 'react';

export default function ResultDialog({
  outcome,
  activeBotPersona,
  reviewStats,
  onClose,
  onReviewGame,
  onNewBot,
  onRematch
}) {
  if (!outcome) return null;

  return (
    <div className="result-backdrop" role="dialog" aria-modal="true" aria-label="Game result">
      <div className="result-dialog compact-result" data-result={outcome.type}>
        <button className="result-share" aria-label="Share result">?</button>
        <button className="result-close" aria-label="Close result" onClick={onClose}>x</button>
        <h2>{outcome.type === 'win' ? `You Beat ${activeBotPersona.name}!` : outcome.type === 'loss' ? `${activeBotPersona.name} Won` : 'Draw Game'}</h2>
        <small>{outcome.detail}</small>
        <div className="result-coach">
          <div className="review-coach-avatar">GM</div>
          <p>{outcome.type === 'win' ? 'You had a nice tactical find in this game. Let us review!' : outcome.type === 'loss' ? 'Good effort. Review the critical moment and try a rematch.' : 'Balanced game. A review can show where both sides missed chances.'}</p>
        </div>
        <div className="result-stats">
          <span><b>{reviewStats.stats.w.best + reviewStats.stats.b.best}</b>Best</span>
          <span><b>{reviewStats.stats.w.excellent + reviewStats.stats.b.excellent}</b>Excellent</span>
          <span><b>{reviewStats.stats.w.good + reviewStats.stats.b.good}</b>Good</span>
        </div>
        <div className="result-actions">
          <button onClick={onReviewGame}>Game Review</button>
          <button onClick={onNewBot}>New Bot</button>
          <button onClick={onRematch}>Rematch</button>
        </div>
      </div>
    </div>
  );
}
