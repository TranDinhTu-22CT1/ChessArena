import React from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ScanLine, Sparkles, Target, Crown
} from 'lucide-react';
import { moveRows } from '../../game/moveRows';
import { buildCoachInsight } from '../../coach/coach';
import { REVIEW_LEGEND, reviewIcon, reviewLabel } from '../../data/review';
import { hasPremium } from '../../membership/plans';
import { ReviewTimeline, ReviewVariations } from '../../components/ReviewInsights';

export default function ReviewPage({
  stockfishStatus, initialFen, onRetryReview, coachMode, coachLesson,
  currentReviewAnalysis, reviewPly, history, stockfishReview, reviewStats,
  reviewStarted, membership, whiteName, blackName, returnRoute, onNavigate,
  onStartNewGame, onReviewStep, onSetReviewMode, onSetResultDismissed,
  onSetReviewPly, onQueueMissingReviewAnalysis, onStartReview
}) {
  const [tab, setTab] = React.useState('moves');
  const [explanation, setExplanation] = React.useState(false);
  const listRef = React.useRef(null);
  const studioRef = React.useRef(null);
  const [compact, setCompact] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia('(max-width: 1100px)');
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  React.useLayoutEffect(() => {
    const studio = studioRef.current;
    const boardArea = studio?.closest('.review-page-layout')?.querySelector('.board-area');
    if (!studio || !boardArea || typeof window.ResizeObserver === 'undefined') return undefined;
    const syncHeight = () => {
      if (window.matchMedia('(max-width: 1100px)').matches) {
        studio.style.removeProperty('--review-board-height');
        return;
      }
      studio.style.setProperty('--review-board-height', `${Math.round(boardArea.getBoundingClientRect().height)}px`);
    };
    const observer = new window.ResizeObserver(syncHeight);
    observer.observe(boardArea);
    window.addEventListener('resize', syncHeight);
    syncHeight();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncHeight);
    };
  }, []);

  React.useEffect(() => {
    setExplanation(false);
    // Scroll only the move list: scrollIntoView also scrolls the page away from the board.
    const list = listRef.current;
    const selected = list?.querySelector('[aria-current="step"]');
    if (selected && list) {
      const item = selected.getBoundingClientRect(), bounds = list.getBoundingClientRect();
      if (item.top < bounds.top) list.scrollTop -= bounds.top - item.top;
      else if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom;
    }
  }, [reviewPly]);

  React.useEffect(() => {
    if (!reviewStarted && tab !== 'moves') setTab('moves');
  }, [reviewStarted, tab]);

  const partialFailure = stockfishReview.some(item => item?.analysisError);
  const failed = !['idle', 'loading', 'ready'].includes(stockfishStatus);
  const completed = stockfishReview.filter(item => item && !item.analysisError).length;
  const progress = history.length ? Math.round(100 * completed / history.length) : 0;
  const critical = stockfishReview
    .filter((item) => item && ['mistake', 'miss', 'blunder'].includes(item.tone))
    .sort((a, b) => b.winLoss - a.winLoss)
    .slice(0, 5);
  const premium = hasPremium(membership, 'pro');
  const selectedAnalysisFailed = Boolean(currentReviewAnalysis?.analysisError);

  const select = (ply) => {
    onSetReviewMode(true);
    onSetResultDismissed(true);
    onSetReviewPly(ply);
  };

  const analyze = () => {
    select(history.length ? Math.max(1, reviewPly || history.length) : 0);
    if (!reviewStarted) onStartReview?.();
    else onQueueMissingReviewAnalysis?.(true);
    if (failed || partialFailure) onRetryReview?.();
  };

  const statusText = !reviewStarted
    ? 'Đang ở chế độ xem lại · chưa dùng lượt Review'
    : failed
      ? stockfishStatus
      : completed === history.length && history.length
        ? 'Đã phân tích toàn bộ'
        : stockfishStatus === 'loading'
          ? 'Đang chấm nước đi…'
          : partialFailure ? 'Một số nước chưa phân tích được. Hãy thử lại.' : 'Sẵn sàng phân tích';

  return (
    <section className="review-studio" aria-label="Phân tích ván đấu" ref={studioRef}>
      <header className="review-studio-head">
        <div>
          <span>{reviewStarted ? 'STOCKFISH · PHÂN TÍCH' : 'REPLAY · XEM LẠI VÁN ĐẤU'}</span>
          <h1>{reviewStarted ? 'Đọc lại ván cờ' : 'Xem lại từng nước'}</h1>
        </div>
        <button type="button" aria-label="Về ván đấu" onClick={() => {
          onSetReviewMode(false);
          onSetReviewPly(history.length);
          onNavigate(returnRoute);
        }}><ArrowLeft size={18} /></button>
      </header>

      <div className="review-studio-progress">
        <div><span role="status">{statusText}</span><b>{reviewStarted ? `${completed}/${history.length}` : `${reviewPly}/${history.length}`}</b></div>
        <progress value={reviewStarted ? progress : 0} max="100" aria-label={reviewStarted ? 'Tiến độ đánh giá nước đi' : 'Review chưa bắt đầu'} />
        {history.length > 0 && (!reviewStarted || completed < history.length) && (
          <button type="button" onClick={analyze} disabled={stockfishStatus === 'loading'}>
            <ScanLine size={15} />
            {!reviewStarted ? 'Bắt đầu Review' : failed ? 'Thử phân tích lại' : 'Đánh giá các nước còn lại'}
          </button>
        )}
        {!reviewStarted && <small className="review-replay-note">Xem lại và di chuyển giữa các nước không chạy engine, không dùng quota.</small>}
      </div>

      {reviewStarted && (
        <>
          <div className="review-studio-players">
            {[['w', whiteName], ['b', blackName]].map(([side, name]) => (
              <article key={side}>
                <span className={`review-side-dot ${side}`} />
                <div><small>{side === 'w' ? 'Trắng' : 'Đen'}</small><strong>{name}</strong></div>
                <b>{reviewStats.accuracy[side]}<small>độ chính xác</small></b>
              </article>
            ))}
          </div>
          <ReviewTimeline results={stockfishReview} moveCount={history.length} selectedPly={reviewPly} onSelect={select} />
        </>
      )}

      <nav className="review-studio-tabs" aria-label="Nội dung phân tích">
        <button type="button" aria-pressed={tab === 'moves'} onClick={() => setTab('moves')}>Từng nước đi</button>
        {reviewStarted && <button type="button" aria-pressed={tab === 'summary'} onClick={() => setTab('summary')}>Tổng kết & bài học</button>}
      </nav>

      {tab === 'moves' ? (
        <>
          {reviewStarted && (
            <>
              <div className={`review-selected-move ${currentReviewAnalysis?.tone || 'loading'}`}>
                <span className="review-move-symbol">{reviewIcon(currentReviewAnalysis?.tone || 'loading')}</span>
                <div>
                  <small>{reviewPly ? `Nước ${Math.ceil(reviewPly / 2)} · ${history[reviewPly - 1]?.color === 'b' ? 'Đen' : 'Trắng'}` : 'Vị trí ban đầu'}</small>
                  <h2>{currentReviewAnalysis ? `${currentReviewAnalysis.san || history[reviewPly - 1]?.san || `Nước ${reviewPly}`} · ${reviewLabel(currentReviewAnalysis.tone)}` : reviewPly ? 'Chưa có đánh giá nước này' : 'Chọn một nước để khám phá'}</h2>
                  <p>{selectedAnalysisFailed
                    ? currentReviewAnalysis.error || 'Stockfish chưa thể phân tích thế cờ này. Bạn có thể thử lại mà không làm mất những kết quả khác.'
                    : currentReviewAnalysis
                      ? `Stockfish đề xuất ${currentReviewAnalysis.bestSan || currentReviewAnalysis.bestMove}. Mất ${currentReviewAnalysis.centipawnLoss} cp so với nước tốt nhất.`
                      : 'Chọn nước trong danh sách hoặc nhấn phím ← → để di chuyển bàn cờ.'}</p>
                </div>
              </div>
              {!selectedAnalysisFailed && <ReviewVariations analysis={currentReviewAnalysis} />}
              {currentReviewAnalysis && !selectedAnalysisFailed && (
                <div className="review-studio-coach">
                  <button type="button" onClick={() => premium ? setExplanation((value) => !value) : onNavigate('membership')} aria-expanded={explanation}>
                    {premium ? <Sparkles size={15} /> : <Crown size={15} />}Giải thích bằng tiếng Việt{premium ? '' : ' · Pro'}
                  </button>
                  {explanation && <p>{buildCoachInsight({ analysis: currentReviewAnalysis, latestMove: history[reviewPly - 1], playerColor: history[reviewPly - 1]?.color, aiElo: 1600, coachMode, lesson: coachLesson }).messages.join(' ')}</p>}
                </div>
              )}
            </>
          )}

          <div className="review-studio-moves" ref={listRef}>
            {history.length === 0 ? <p>Chưa có nước đi. Hãy chơi một ván hoặc mở ván đã lưu để xem lại.</p> : moveRows(history, initialFen).map((row) => (
              <div key={row.number}>
                <span>{row.number}.</span>
                {['w', 'b'].map((color) => {
                  const move = row[color];
                  const analysis = reviewStarted && move ? stockfishReview[move.ply - 1] : null;
                  return (
                    <button type="button" key={color} disabled={!move} aria-current={move?.ply === reviewPly ? 'step' : undefined} onClick={() => select(move.ply)}>
                      <span>{move?.san || '—'}</span>
                      {analysis && <i className={analysis.tone} title={reviewLabel(analysis.tone)}>{reviewIcon(analysis.tone)}</i>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="review-studio-controls">
            <button type="button" aria-label="Về vị trí đầu" disabled={reviewPly === 0} onClick={() => select(0)}><ChevronsLeft size={20} /></button>
            <button type="button" aria-label="Nước trước" disabled={reviewPly === 0} onClick={() => onReviewStep(-1)}><ChevronLeft size={20} /></button>
            <span>{reviewPly} / {history.length}</span>
            <button type="button" aria-label="Nước tiếp" disabled={reviewPly >= history.length} onClick={() => onReviewStep(1)}><ChevronRight size={20} /></button>
            <button type="button" aria-label="Về nước cuối" disabled={reviewPly >= history.length} onClick={() => select(history.length)}><ChevronsRight size={20} /></button>
          </div>
        </>
      ) : (
        <>
          <div className="review-critical">
            <div className="review-section-label"><span><Target size={15} />Các thời điểm cần xem lại</span></div>
            {critical.length ? critical.map((item) => (
              <button type="button" key={item.ply} onClick={() => { setTab('moves'); select(item.ply); }}>
                <span>{Math.ceil(item.ply / 2)}{item.mover === 'b' ? '…' : '.'} {item.san}</span><b>{reviewLabel(item.tone)}</b><ChevronRight size={16} />
              </button>
            )) : <p>{completed < history.length ? 'Chờ thêm kết quả để xác định các bước ngoặt.' : 'Chưa phát hiện sai lầm lớn trong những nước đã phân tích.'}</p>}
          </div>
          <div className="review-studio-breakdown">
            <div><span>Trắng</span><strong>Chất lượng nước đi</strong><span>Đen</span></div>
            {REVIEW_LEGEND.map((item) => <div key={item.tone}><b>{reviewStats.stats.w[item.tone] || 0}</b><span><i className={item.tone}>{reviewIcon(item.tone)}</i>{item.label}</span><b>{reviewStats.stats.b[item.tone] || 0}</b></div>)}
          </div>
          <button className="review-studio-new-game" type="button" onClick={() => { onStartNewGame(); onNavigate(returnRoute); }}>Áp dụng bài học trong ván mới</button>
        </>
      )}

      {reviewStarted && <p className="review-studio-footnote">Độ chính xác là ước tính từ các nước đã phân tích ({completed}/{history.length}), không phải Elo. Điểm và biến có thể thay đổi khi engine tìm sâu hơn.</p>}
      {compact && createPortal(
        <nav className="review-floating-controls" aria-label="Điều khiển Review nổi">
          <button type="button" aria-label="Về vị trí đầu" disabled={reviewPly === 0} onClick={() => select(0)}><ChevronsLeft size={18} /></button>
          <button type="button" aria-label="Nước trước" disabled={reviewPly === 0} onClick={() => onReviewStep(-1)}><ChevronLeft size={22} /></button>
          <span aria-live="polite">{reviewPly} / {history.length}</span>
          <button type="button" aria-label="Nước tiếp" disabled={reviewPly >= history.length} onClick={() => onReviewStep(1)}><ChevronRight size={22} /></button>
          <button type="button" aria-label="Về nước cuối" disabled={reviewPly >= history.length} onClick={() => select(history.length)}><ChevronsRight size={18} /></button>
        </nav>, document.body
      )}
    </section>
  );
}
