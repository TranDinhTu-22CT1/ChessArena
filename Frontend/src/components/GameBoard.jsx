import React from 'react';
import PlayerCard from './PlayerCard';
import { PIECE_IMAGES } from '../game/pieces';
import { PIECE_NAMES, PROMOTION_PIECES } from '../game/constants';
import { squareName } from '../game/chessLogic';
import { REVIEW_LEGEND, reviewIcon } from '../data/review';

export default function GameBoard({
  blackName,
  whiteName,
  playerColor,
  clocks,
  capturedBlack,
  capturedWhite,
  blackCapturePoints,
  whiteCapturePoints,
  game,
  displayGame,
  displayHistory,
  reviewMode,
  reviewBadge,
  liveCoachBadge,
  liveCoachMove,
  lastMove,
  flipped,
  botOptions,
  advantagePercent,
  pieceSet,
  selected,
  showHints,
  legalTargets,
  visibleHintMove,
  threatMove,
  premoveQueue,
  usesAiOpponent,
  isPlayerTurn,
  dragEnabled,
  gameMode,
  isAiThinking,
  slidingMove,
  promotionRequest,
  reviewArrowFrom,
  reviewArrowTo,
  hintArrowFrom,
  hintArrowTo,
  threatArrowFrom,
  threatArrowTo,
  premoveArrows,
  formatClock,
  squareTopLeft,
  promotionPopoverStyle,
  onSelectSquare,
  onHandleDrop,
  onHandleDragStart,
  onCancelPromotion,
  onPlayMove
}) {
  return (
    <section className="game-stage">
      <PlayerCard
        tone="black"
        name={blackName}
        label={playerColor === 'b' ? 'You' : 'Opponent'}
        clock={formatClock(clocks.b)}
        captures={capturedBlack}
        materialLead={Math.max(0, blackCapturePoints - whiteCapturePoints)}
        active={game.turn() === 'b'}
      />

      {reviewMode && (
        <div className="review-legend" aria-label="Move review legend">
          {REVIEW_LEGEND.map((item) => (
            <span className={`legend-item ${item.tone}`} key={item.tone} title={item.detail}>
              <b>{reviewIcon(item.tone)}</b>
              {item.label}
            </span>
          ))}
        </div>
      )}

      <section className={`board-wrap ${botOptions.evaluationBar ? '' : 'no-eval'}`} aria-label="Chess board">
        {botOptions.evaluationBar && (
          <aside className="advantage-bar" aria-label="Material advantage">
            <span>{blackCapturePoints > whiteCapturePoints ? `+${blackCapturePoints - whiteCapturePoints}` : ''}</span>
            <div>
              <i style={{ height: `${advantagePercent}%` }} />
            </div>
            <span>{whiteCapturePoints > blackCapturePoints ? `+${whiteCapturePoints - blackCapturePoints}` : ''}</span>
          </aside>
        )}
        <div className={`board piece-set-${pieceSet}`}>
          {Array.from({ length: 8 }).map((_, row) =>
            Array.from({ length: 8 }).map((__, col) => {
              const square = squareName(row, col, flipped);
              const piece = displayGame.get(square);
              const isDark = (row + col) % 2 === 1;
              const isSelected = selected === square;
              const isTarget = showHints && legalTargets.includes(square);
              const activeLastMove = reviewMode ? displayHistory.at(-1) : lastMove;
              const isLastMove = activeLastMove && (activeLastMove.from === square || activeLastMove.to === square);
              const isHintFrom = !reviewMode && visibleHintMove?.from === square;
              const isHintTo = !reviewMode && visibleHintMove?.to === square;
              const isThreatFrom = !reviewMode && botOptions.threatArrows && threatMove?.from === square;
              const isThreatTo = !reviewMode && botOptions.threatArrows && threatMove?.to === square;
              const isPremoveFrom = !reviewMode && premoveQueue.some((move) => move.from === square);
              const isPremoveTo = !reviewMode && premoveQueue.some((move) => move.to === square);
              const canPremoveDrag = usesAiOpponent && !isPlayerTurn && piece?.color === playerColor;
              const canDragPiece = !reviewMode && dragEnabled && piece && (gameMode === 'local' || piece.color === playerColor) && ((piece.color === game.turn() && isPlayerTurn && !isAiThinking) || canPremoveDrag);
              const hideForSlide = slidingMove && slidingMove.from === square && slidingMove.pieceKey === `${piece?.color}${piece?.type}`;

              return (
                <button
                  className={`square ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isTarget ? 'target' : ''} ${isLastMove ? 'last-move' : ''} ${isHintFrom ? 'hint-from' : ''} ${isHintTo ? 'hint-to' : ''} ${isThreatFrom ? 'threat-from' : ''} ${isThreatTo ? 'threat-to' : ''} ${isPremoveFrom ? 'premove-from' : ''} ${isPremoveTo ? 'premove-to' : ''}`}
                  key={square}
                  onClick={() => onSelectSquare(square)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onHandleDrop(event, square)}
                  onDragStart={(event) => onHandleDragStart(event, square, piece)}
                  draggable={Boolean(canDragPiece)}
                  aria-label={square}
                >
                  {piece && (
                    <img
                      className={`piece ${piece.color} ${hideForSlide ? 'piece-hidden-for-slide' : ''}`}
                      src={PIECE_IMAGES[`${piece.color}${piece.type}`]}
                      alt={`${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}`}
                      draggable="false"
                    />
                  )}
                  {reviewMode && reviewBadge && activeLastMove?.to === square && (
                    <span className={`move-badge ${reviewBadge.tone}`} title={reviewBadge.label}>
                      {reviewIcon(reviewBadge.tone)}
                    </span>
                  )}
                  {!reviewMode && liveCoachBadge && liveCoachMove?.to === square && (
                    <span className={`move-badge live ${liveCoachBadge.tone}`} title={liveCoachBadge.label}>
                      {reviewIcon(liveCoachBadge.tone)}
                    </span>
                  )}
                  {(row === 7 || col === 0) && <span className="coord">{row === 7 ? square[0] : square[1]}</span>}
                </button>
              );
            })
          )}
          {promotionRequest && (
            <div
              className={`promotion-board-popover ${promotionRequest.color === 'b' ? 'above' : 'below'}`}
              style={promotionPopoverStyle(promotionRequest.to, promotionRequest.color, flipped)}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button className="promotion-close" onClick={onCancelPromotion} aria-label="Cancel promotion">
                x
              </button>
              {PROMOTION_PIECES.map((pieceType) => (
                <button
                  key={pieceType}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onPlayMove({ ...promotionRequest, promotion: pieceType });
                  }}
                  aria-label={`Promote to ${PIECE_NAMES[pieceType]}`}
                >
                  <img
                    src={PIECE_IMAGES[`${promotionRequest.color}${pieceType}`]}
                    alt={PIECE_NAMES[pieceType]}
                    draggable="false"
                  />
                </button>
              ))}
            </div>
          )}
          {reviewMode && reviewArrowFrom && reviewArrowTo && <BoardArrow markerId="best-arrow-head" from={reviewArrowFrom} to={reviewArrowTo} />}
          {!reviewMode && hintArrowFrom && hintArrowTo && <BoardArrow className="hint-arrow" markerId="hint-arrow-head" from={hintArrowFrom} to={hintArrowTo} />}
          {!reviewMode && threatArrowFrom && threatArrowTo && <BoardArrow className="threat-arrow" markerId="threat-arrow-head" from={threatArrowFrom} to={threatArrowTo} />}
          {!reviewMode && premoveArrows.length > 0 && (
            <svg className="best-move-arrow premove-arrow" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <marker id="premove-arrow-head" markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto">
                  <polygon points="0 0, 5 2.5, 0 5" />
                </marker>
              </defs>
              {premoveArrows.map((arrow, index) => (
                <line
                  key={`${arrow.from.x}-${arrow.from.y}-${arrow.to.x}-${arrow.to.y}-${index}`}
                  x1={arrow.from.x}
                  y1={arrow.from.y}
                  x2={arrow.to.x}
                  y2={arrow.to.y}
                  markerEnd="url(#premove-arrow-head)"
                />
              ))}
            </svg>
          )}
          {slidingMove && !reviewMode && (
            <img
              className={`sliding-piece ${slidingMove.color} ${slidingMove.started ? 'active' : ''}`}
              src={PIECE_IMAGES[slidingMove.pieceKey]}
              alt=""
              draggable="false"
              style={{
                left: slidingMove.started ? squareTopLeft(slidingMove.to, flipped).x : squareTopLeft(slidingMove.from, flipped).x,
                top: slidingMove.started ? squareTopLeft(slidingMove.to, flipped).y : squareTopLeft(slidingMove.from, flipped).y
              }}
            />
          )}
        </div>
      </section>

      <PlayerCard
        tone="white"
        name={whiteName}
        label={playerColor === 'w' ? 'You' : 'Opponent'}
        clock={formatClock(clocks.w)}
        captures={capturedWhite}
        materialLead={Math.max(0, whiteCapturePoints - blackCapturePoints)}
        active={game.turn() === 'w'}
      />
    </section>
  );
}

function BoardArrow({ className = '', markerId, from, to }) {
  return (
    <svg className={`best-move-arrow ${className}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <marker id={markerId} markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto">
          <polygon points="0 0, 5 2.5, 0 5" />
        </marker>
      </defs>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd={`url(#${markerId})`} />
    </svg>
  );
}
