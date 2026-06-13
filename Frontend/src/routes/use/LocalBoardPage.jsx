import React from 'react';
import { Chess } from 'chess.js';
import { ChevronLeft, ChevronRight, Flag, History, Play, RotateCcw, Sparkles, Timer, Trophy, X } from 'lucide-react';
import { apiUrl } from '../../api/config';
import MembershipBadge from '../../components/MembershipBadge';
import { getPieceImage } from '../../game/pieces';
import { chessSoundEvent, chessSoundProfile, playChessSound, preloadChessSounds } from '../../game/chessAudio';
import { FILES, PROMOTION_PIECES, TIME_CONTROLS } from '../../game/constants';
import { formatClock } from '../../game/gameView';
import { hasPremium, membershipPlan } from '../../membership/plans';

const SAVED_GAME_KEY = 'chessarena-pass-and-play-last-game';
const LOCAL_STANDARD_PIECE_SET = 'neo';

function squareName(row, column, flipped) {
  const rank = flipped ? row + 1 : 8 - row;
  const file = flipped ? FILES[7 - column] : FILES[column];
  return `${file}${rank}`;
}

function isDarkSquare(square) {
  const fileIndex = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return (fileIndex + rank) % 2 === 1;
}

function resultText(game, timeWinner, resignedColor) {
  if (timeWinner) return `${timeWinner === 'w' ? 'Trắng' : 'Đen'} thắng do hết giờ`;
  if (resignedColor) return `${resignedColor === 'w' ? 'Đen' : 'Trắng'} thắng do đối thủ đầu hàng`;
  if (game.isCheckmate()) return `${game.turn() === 'w' ? 'Đen' : 'Trắng'} thắng chiếu hết`;
  if (game.isStalemate()) return 'Hòa do hết nước đi';
  if (game.isThreefoldRepetition()) return 'Hòa do lặp lại thế cờ';
  if (game.isInsufficientMaterial()) return 'Hòa do thiếu quân chiếu hết';
  if (game.isDraw()) return 'Ván đấu hòa';
  return '';
}

function reviewPositions(moves) {
  const replay = new Chess();
  return moves.map((move, index) => {
    const position = {
      ply: index + 1,
      fen: replay.fen(),
      move: `${move.from}${move.to}${move.promotion || ''}`,
      san: move.san,
      piece: move.piece,
      captured: move.captured,
      variant: 'standard',
      priorMoves: moves.slice(0, index).map((item) => `${item.from}${item.to}${item.promotion || ''}`)
    };
    replay.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    return position;
  });
}

export default function LocalBoardPage({ pieceSet, theme, membership, onReviewGame }) {
  const [game, setGame] = React.useState(() => new Chess());
  const [moves, setMoves] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [targets, setTargets] = React.useState([]);
  const [lastMove, setLastMove] = React.useState(null);
  const [started, setStarted] = React.useState(false);
  const [flipped, setFlipped] = React.useState(false);
  const [timeControlId, setTimeControlId] = React.useState('600+0');
  const [clocks, setClocks] = React.useState({ w: 600, b: 600 });
  const [timeWinner, setTimeWinner] = React.useState(null);
  const [resignedColor, setResignedColor] = React.useState(null);
  const [names, setNames] = React.useState({ w: 'Người chơi Trắng', b: 'Người chơi Đen' });
  const [promotion, setPromotion] = React.useState(null);
  const [review, setReview] = React.useState([]);
  const [reviewBusy, setReviewBusy] = React.useState(false);
  const [reviewMessage, setReviewMessage] = React.useState('');
  const [showResultPopup, setShowResultPopup] = React.useState(false);
  const audioRef = React.useRef(null);

  const activeControl = TIME_CONTROLS.find((item) => item.id === timeControlId) || TIME_CONTROLS[3];
  const plan = membershipPlan(membership);
  const canReview = hasPremium(membership, 'plus');
  const finished = Boolean(timeWinner || resignedColor || game.isGameOver());
  const outcome = resultText(game, timeWinner, resignedColor);
  const currentReview = new Map(review.map((item) => [item.ply, item]));

  React.useEffect(() => {
    if (finished && outcome) setShowResultPopup(true);
  }, [finished, outcome]);

  const ensureAudio = React.useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioRef.current) audioRef.current = new AudioContextClass();
    if (audioRef.current.state === 'suspended') audioRef.current.resume().catch(() => {});
    return audioRef.current;
  }, []);

  React.useEffect(() => {
    if (!started || finished) return undefined;
    let previous = window.performance.now();
    const timer = window.setInterval(() => {
      const now = window.performance.now();
      const elapsed = (now - previous) / 1000;
      previous = now;
      const color = game.turn();
      setClocks((current) => {
        const remaining = Math.max(0, current[color] - elapsed);
        if (remaining <= 0) setTimeWinner(color === 'w' ? 'b' : 'w');
        return { ...current, [color]: remaining };
      });
    }, 50);
    return () => window.clearInterval(timer);
  }, [finished, game, started]);

  React.useEffect(() => {
    if (moves.length === 0) return;
    window.localStorage.setItem(SAVED_GAME_KEY, JSON.stringify({
      pgn: game.pgn(),
      fen: game.fen(),
      moves: moves.map((move) => move.san),
      names,
      timeControl: timeControlId,
      savedAt: new Date().toISOString()
    }));
  }, [game, moves, names, timeControlId]);

  const clearSelection = () => {
    setSelected(null);
    setTargets([]);
  };

  const startGame = () => {
    const context = ensureAudio();
    preloadChessSounds(context);
    const fresh = new Chess();
    setGame(fresh);
    setMoves([]);
    setLastMove(null);
    setClocks({ w: activeControl.baseSeconds, b: activeControl.baseSeconds });
    setTimeWinner(null);
    setResignedColor(null);
    setReview([]);
    setReviewMessage('');
    setPromotion(null);
    setShowResultPopup(false);
    clearSelection();
    setStarted(true);
  };

  const commitMove = (from, to, piece = 'q') => {
    if (!started || finished) return false;
    const next = new Chess();
    moves.forEach((move) => {
      next.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
    });
    const played = next.move({ from, to, promotion: piece });
    if (!played) return false;

    setGame(next);
    setMoves((current) => [...current, played]);
    setLastMove({ from: played.from, to: played.to });
    setClocks((current) => ({
      ...current,
      [played.color]: current[played.color] + activeControl.incrementSeconds
    }));
    playChessSound(ensureAudio(), chessSoundEvent(played), chessSoundProfile(pieceSet, theme));
    setPromotion(null);
    clearSelection();
    return true;
  };

  const requestMove = (from, to) => {
    const candidate = game.moves({ square: from, verbose: true }).find((move) => move.to === to);
    if (!candidate) return false;
    if (candidate.flags?.includes('p')) {
      setPromotion({ from, to, color: candidate.color });
      return true;
    }
    return commitMove(from, to);
  };

  const chooseSquare = (square) => {
    if (!started || finished || promotion) return;
    const piece = game.get(square);
    if (selected && targets.includes(square)) {
      requestMove(selected, square);
      return;
    }
    if (piece?.color === game.turn()) {
      setSelected(square);
      setTargets(game.moves({ square, verbose: true }).map((move) => move.to));
      return;
    }
    clearSelection();
  };

  const handleDrop = (event, square) => {
    event.preventDefault();
    const from = event.dataTransfer.getData('text/chess-square');
    if (from) requestMove(from, square);
  };

  const runReview = async () => {
    if (!canReview || moves.length === 0 || reviewBusy) return;
    setReviewBusy(true);
    setReviewMessage('Stockfish đang đánh giá các nước cờ...');
    try {
      const positions = reviewPositions(moves);
      const results = [];
      for (let index = 0; index < positions.length; index += 24) {
        const response = await fetch(apiUrl('/api/analysis/review'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions: positions.slice(index, index + 24), movetime: 150 })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Không thể đánh giá ván đấu.');
        results.push(...(data.results || []));
      }
      setReview(results.sort((first, second) => first.ply - second.ply));
      setReviewMessage(`Đã đánh giá ${results.length} nước cờ.`);
    } catch (error) {
      setReviewMessage(error.message || 'Stockfish hiện không khả dụng.');
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <>
      <section className="local-board-page">
        <header className="local-board-hero">
          <div>
            <span><Sparkles size={16} /> PASS & PLAY</span>
            <h1>Chơi cờ 2 người</h1>
            <p>Hai người chơi trên một thiết bị. Bàn cờ chuẩn quốc tế, đồng hồ chạy ngay khi bấm Bắt đầu.</p>
          </div>
          <div className="local-plan-chip">
            <MembershipBadge membership={membership} />
            <small>{canReview ? `Đánh giá ván đấu đã mở với gói ${plan.name}` : 'Nâng cấp bất kỳ gói nào để đánh giá ván đấu'}</small>
          </div>
        </header>

        <div className="local-board-layout">
          <section className="local-board-column">
            <LocalPlayerBar name={names.b} color="b" clock={clocks.b} active={started && !finished && game.turn() === 'b'} />
            <div className="local-board-shell">
              {!started && (
                <div className="local-board-cover">
                  <Trophy size={42} />
                  <strong>Bàn cờ đã sẵn sàng</strong>
                  <span>Chọn thời gian và bắt đầu ván đấu.</span>
                </div>
              )}
              <div className={`local-chess-board piece-set-${LOCAL_STANDARD_PIECE_SET}`}>
                {Array.from({ length: 8 }).map((_, row) =>
                  Array.from({ length: 8 }).map((__, column) => {
                    const square = squareName(row, column, flipped);
                    const piece = game.get(square);
                    const target = targets.includes(square);
                    const recent = lastMove && (lastMove.from === square || lastMove.to === square);
                    return (
                      <button
                        type="button"
                        className={`local-square ${isDarkSquare(square) ? 'dark' : 'light'} ${selected === square ? 'selected' : ''} ${target ? 'target' : ''} ${piece ? 'has-piece' : ''} ${recent ? 'last-move' : ''}`}
                        key={square}
                        onClick={() => chooseSquare(square)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDrop(event, square)}
                      >
                        {piece && (
                          <img
                            src={getPieceImage(LOCAL_STANDARD_PIECE_SET, `${piece.color}${piece.type}`)}
                            alt=""
                            draggable={started && !finished && piece.color === game.turn()}
                            onDragStart={(event) => {
                              event.dataTransfer.setData('text/chess-square', square);
                              event.dataTransfer.effectAllowed = 'move';
                            }}
                          />
                        )}
                        {column === 0 && <span className="local-coordinate-rank">{square[1]}</span>}
                        {row === 7 && <span className="local-coordinate-file">{square[0]}</span>}
                      </button>
                    );
                  })
                )}
                {promotion && (
                  <div className="local-promotion-picker">
                    {PROMOTION_PIECES.map((piece) => (
                      <button type="button" key={piece} onClick={() => commitMove(promotion.from, promotion.to, piece)}>
                        <img src={getPieceImage(LOCAL_STANDARD_PIECE_SET, `${promotion.color}${piece}`)} alt={piece} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <LocalPlayerBar name={names.w} color="w" clock={clocks.w} active={started && !finished && game.turn() === 'w'} />
          </section>

          <aside className="local-board-panel">
            <section className="local-setup-card">
              <div className="local-card-title"><Timer size={18} /><strong>Thiết lập ván đấu</strong></div>
              <label>Người chơi Trắng<input value={names.w} disabled={started && !finished} onChange={(event) => setNames((current) => ({ ...current, w: event.target.value }))} /></label>
              <label>Người chơi Đen<input value={names.b} disabled={started && !finished} onChange={(event) => setNames((current) => ({ ...current, b: event.target.value }))} /></label>
              <label>
                Thời gian
                <select value={timeControlId} disabled={started && !finished} onChange={(event) => setTimeControlId(event.target.value)}>
                  {TIME_CONTROLS.map((control) => <option value={control.id} key={control.id}>{control.label}</option>)}
                </select>
              </label>
              <button className="local-primary-action" type="button" onClick={startGame}>{started ? <RotateCcw size={18} /> : <Play size={18} />}{started ? 'Ván mới' : 'Bắt đầu'}</button>
              <div className="local-secondary-actions">
                <button type="button" disabled={!started || finished} onClick={() => setResignedColor(game.turn())}><Flag size={16} /> Đầu hàng</button>
                <button type="button" onClick={() => setFlipped((value) => !value)}><RotateCcw size={16} /> Xoay bàn</button>
              </div>
            </section>

            <section className="local-history-card">
              <div className="local-card-title"><History size={18} /><strong>Biên bản nước cờ</strong><span>{moves.length} ply</span></div>
              <div className="local-move-list">
                {moves.length === 0 && <p>Chưa có nước cờ nào.</p>}
                {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, index) => {
                  const white = moves[index * 2];
                  const black = moves[index * 2 + 1];
                  return (
                    <div key={index}>
                      <b>{index + 1}.</b>
                      <span className={currentReview.get(index * 2 + 1)?.tone || ''}>{white?.san}</span>
                      <span className={currentReview.get(index * 2 + 2)?.tone || ''}>{black?.san || ''}</span>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="local-review-action" disabled={moves.length === 0 || reviewBusy || (!onReviewGame && !canReview)} onClick={() => {
                if (onReviewGame) {
                  onReviewGame({ moves, names });
                  return;
                }
                runReview();
              }}>
                <Sparkles size={17} /> {reviewBusy ? 'Đang đánh giá...' : 'Đánh giá ván đấu'}
              </button>
              <small className="local-review-message">{reviewMessage || (onReviewGame ? 'Mở trang Game Review để phân tích ván đối kháng.' : !canReview ? 'Tính năng dành cho Plus, Pro và Master.' : 'Có thể đánh giá bất kỳ lúc nào sau khi đã đi quân.')}</small>
              {review.length > 0 && <div className="local-review-nav"><ChevronLeft size={15} /><span>Màu nước cờ thể hiện đánh giá Stockfish</span><ChevronRight size={15} /></div>}
            </section>
          </aside>
        </div>
      </section>

      {showResultPopup && outcome && (
        <div className="local-result-backdrop" role="dialog" aria-modal="true" aria-label="Kết thúc ván đấu">
          <div className="local-result-popup">
            <div className="local-result-icon"><Trophy size={34} /></div>
            <h2>Kết thúc ván đấu</h2>
            <p>{outcome}</p>
            <div className="local-result-actions">
              <button type="button" onClick={() => setShowResultPopup(false)}><X size={16} /> Đóng</button>
              <button type="button" className="primary" onClick={startGame}><RotateCcw size={16} /> Ván mới</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LocalPlayerBar({ name, color, clock, active }) {
  return (
    <div className={`local-player-bar ${color} ${active ? 'active' : ''}`}>
      <span className="local-player-piece">{color === 'w' ? '♔' : '♚'}</span>
      <div><small>{color === 'w' ? 'TRẮNG' : 'ĐEN'}</small><strong>{name}</strong></div>
      <b>{formatClock(clock)}</b>
    </div>
  );
}
