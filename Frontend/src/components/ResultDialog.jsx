import React from 'react';
import Modal from './Modal';

export default function ResultDialog({
  outcome,
  activeBotPersona,
  isCoachGame,
  reviewStats,
  onReviewGame,
  onNewBot,
  onRematch
}) {
  if (!outcome) return null;

  return (
    <Modal open className="play-result-modal" aria-label="Kết quả ván đấu">
      <div className="result-dialog compact-result" data-result={outcome.type}>
        <h2>{outcome.title || (outcome.type === 'win' ? `Bạn thắng ${activeBotPersona.name}` : outcome.type === 'loss' ? `${activeBotPersona.name} thắng` : 'Hòa cờ')}</h2>
        <small>{outcome.detail}</small>
        <div className="result-coach">
          <div className="review-coach-avatar">GM</div>
          <p>Xem lại các nước cờ để nhận ra điều đã làm tốt và tìm điểm cần cải thiện cho ván tiếp theo.</p>
        </div>
        <div className="result-stats">
          <span><b>{reviewStats.stats.w.best + reviewStats.stats.b.best}</b>Tốt nhất</span>
          <span><b>{reviewStats.stats.w.excellent + reviewStats.stats.b.excellent}</b>Rất tốt</span>
          <span><b>{reviewStats.stats.w.good + reviewStats.stats.b.good}</b>Tốt</span>
        </div>
        <div className="result-actions">
          <button onClick={onReviewGame}>Đánh giá ván đấu</button>
          <button onClick={onNewBot}>{isCoachGame ? 'Chọn bài học' : 'Chọn bot khác'}</button>
          <button onClick={onRematch}>{isCoachGame ? 'Luyện lại bài này' : 'Chơi lại'}</button>
        </div>
      </div>
    </Modal>
  );
}
