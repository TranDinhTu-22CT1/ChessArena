import React from 'react';
import { Chess } from 'chess.js';
import { BookOpen, Brain, CheckCircle2, Eye, RotateCcw, Sparkles, Target } from 'lucide-react';
import { requestStockfishMove } from '../../api/stockfish';
import { getPieceImage } from '../../game/pieces';
import { squareCenter } from '../../game/gameView';
import { squareName } from '../../game/chessLogic';

const LESSONS = [
  {
    id: 'king',
    title: '1. Vua',
    focus: 'e3',
    fen: '8/8/8/3k4/8/4K3/8/8 w - - 0 1',
    text: 'Vua đi 1 ô theo mọi hướng, nhưng không được đi vào ô đang bị tấn công.'
  },
  {
    id: 'knight',
    title: '2. Mã',
    focus: 'd4',
    fen: '4k3/8/8/8/3N4/8/8/4K3 w - - 0 1',
    text: 'Mã đi hình chữ L và có thể nhảy qua quân khác.'
  },
  {
    id: 'pawn',
    title: '3. Tốt',
    focus: 'd2',
    fen: '4k3/8/8/8/8/4p3/3P4/4K3 w - - 0 1',
    text: 'Tốt đi thẳng, ăn chéo. Ở bài này tốt trắng có thể đi lên hoặc ăn quân ở e3.'
  },
  {
    id: 'rook',
    title: '4. Xe',
    focus: 'd4',
    fen: '4k3/8/8/8/3R4/8/8/4K3 w - - 0 1',
    text: 'Xe đi ngang hoặc dọc bao nhiêu ô cũng được nếu đường đi không bị chặn.'
  },
  {
    id: 'bishop',
    title: '5. Tượng',
    focus: 'd4',
    fen: '4k3/8/8/8/3B4/8/8/4K3 w - - 0 1',
    text: 'Tượng đi chéo và luôn ở cùng màu ô từ đầu tới cuối.'
  },
  {
    id: 'queen',
    title: '6. Hậu',
    focus: 'd4',
    fen: '4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1',
    text: 'Hậu kết hợp cách đi của xe và tượng: ngang, dọc, chéo.'
  }
];

const PIECE_NAMES = {
  k: 'Vua',
  q: 'Hậu',
  r: 'Xe',
  b: 'Tượng',
  n: 'Mã',
  p: 'Tốt'
};

function moveLabel(move) {
  if (!move) return '';
  return `${move.from}-${move.to}${move.promotion ? `=${move.promotion.toUpperCase()}` : ''}`;
}

function emptyHandlers() {}

export default function BeginnerGuidePage({ onNavigate }) {
  const [lessonId, setLessonId] = React.useState('king');
  const lesson = LESSONS.find((item) => item.id === lessonId) || LESSONS[0];
  const [game, setGame] = React.useState(() => new Chess(lesson.fen));
  const [selected, setSelected] = React.useState('');
  const [legalTargets, setLegalTargets] = React.useState([]);
  const [lastMove, setLastMove] = React.useState(null);
  const [engineMove, setEngineMove] = React.useState(null);
  const [engineStatus, setEngineStatus] = React.useState('');
  const pieceSet = 'neo';

  React.useEffect(() => {
    const next = new Chess(lesson.fen);
    setGame(next);
    setSelected('');
    setLegalTargets([]);
    setLastMove(null);
    setEngineMove(null);
    setEngineStatus('Bấm "Xem nước đi" để thấy quân này được đi tới đâu.');
  }, [lesson.fen]);

  const showFocusMoves = React.useCallback(() => {
    const piece = game.get(lesson.focus);
    if (!piece) return;
    const moves = game.moves({ square: lesson.focus, verbose: true });
    setSelected(lesson.focus);
    setLegalTargets(moves.map((move) => move.to));
    setEngineMove(null);
    setEngineStatus(`${PIECE_NAMES[piece.type]} ở ${lesson.focus} có ${moves.length} nước hợp lệ trong thế cờ này.`);
  }, [game, lesson.focus]);

  const selectSquare = (square) => {
    const piece = game.get(square);
    if (selected && legalTargets.includes(square)) {
      const next = new Chess(game.fen());
      const promotion = next.get(selected)?.type === 'p' && ['1', '8'].includes(square[1]) ? 'q' : undefined;
      const played = next.move({ from: selected, to: square, promotion });
      if (played) {
        setGame(next);
        setLastMove({ from: played.from, to: played.to, san: played.san });
        setSelected('');
        setLegalTargets([]);
        setEngineMove(null);
        setEngineStatus(`${played.san}: nước đi hợp lệ. Bấm "Đặt lại" để học lại bài này.`);
        return;
      }
    }

    if (!piece || piece.color !== game.turn()) {
      setSelected('');
      setLegalTargets([]);
      return;
    }

    const moves = game.moves({ square, verbose: true });
    setSelected(square);
    setLegalTargets(moves.map((move) => move.to));
    setEngineMove(null);
    setEngineStatus(`${PIECE_NAMES[piece.type]} ở ${square} có ${moves.length} nước hợp lệ.`);
  };

  const resetLesson = () => {
    setGame(new Chess(lesson.fen));
    setSelected('');
    setLegalTargets([]);
    setLastMove(null);
    setEngineMove(null);
    setEngineStatus('Bấm "Xem nước đi" để thấy quân này được đi tới đâu.');
  };

  const askStockfish = async () => {
    setEngineStatus('Stockfish đang phân tích thế cờ nhỏ này...');
    setEngineMove(null);
    try {
      const move = await requestStockfishMove(game.fen(), 1200, { variant: 'standard' }, 7000);
      setEngineMove(move);
      setEngineStatus(`Stockfish gợi ý: ${moveLabel(move)}. Đây là gợi ý luyện tập, không bắt buộc phải đi theo.`);
    } catch (error) {
      setEngineStatus(error.message || 'Không lấy được gợi ý Stockfish.');
    }
  };

  const hintFrom = engineMove?.from ? squareCenter(engineMove.from, false) : null;
  const hintTo = engineMove?.to ? squareCenter(engineMove.to, false) : null;

  return (
    <section className="beginner-guide-page">
      <header className="beginner-guide-hero">
        <div>
          <span><BookOpen size={18} /> Hướng dẫn người mới</span>
          <h1>Học từng quân trên bàn cờ chuẩn</h1>
          <p>Mỗi bài chỉ đặt vài quân cần thiết trên bàn cờ tiêu chuẩn. Người mới bấm một quân để xem nước hợp lệ, thử đi, rồi dùng Stockfish để xem gợi ý.</p>
        </div>
        <button onClick={() => onNavigate?.('bot')}><Sparkles size={18} /> Luyện với bot</button>
      </header>

      <section className="guide-live-layout">
        <aside className="guide-live-panel">
          <div className="guide-section-title">
            <Target size={22} />
            <h2>Bài học</h2>
          </div>
          <div className="guide-lesson-tabs">
            {LESSONS.map((item) => (
              <button className={item.id === lessonId ? 'active' : ''} onClick={() => setLessonId(item.id)} key={item.id}>
                {item.title}
              </button>
            ))}
          </div>
          <p>{lesson.text}</p>
          <div className="guide-action-row">
            <button onClick={showFocusMoves}><Eye size={17} /> Xem nước đi</button>
            <button onClick={askStockfish}><Brain size={17} /> Hỏi Stockfish</button>
            <button onClick={resetLesson}><RotateCcw size={17} /> Đặt lại</button>
          </div>
          <div className="guide-status">
            <strong>{game.turn() === 'w' ? 'Trắng' : 'Đen'} tới lượt</strong>
            <span>{engineStatus}</span>
            {lastMove && <small>Nước vừa đi: {lastMove.san} ({lastMove.from}-{lastMove.to})</small>}
          </div>
          <ul className="guide-check-list">
            <li><CheckCircle2 size={17} /> Ô xanh là nước hợp lệ của quân đang chọn.</li>
            <li><CheckCircle2 size={17} /> Mũi tên vàng là gợi ý Stockfish.</li>
            <li><CheckCircle2 size={17} /> Bài học tăng dần từ một quân tới nhiều quân hơn.</li>
          </ul>
        </aside>

        <div className="guide-standard-board-wrap">
          <div className={`board guide-standard-board piece-set-${pieceSet}`}>
            {Array.from({ length: 8 }).map((_, row) =>
              Array.from({ length: 8 }).map((__, col) => {
                const square = squareName(row, col, false);
                const piece = game.get(square);
                const isDark = (row + col) % 2 === 1;
                const isSelected = selected === square;
                const isTarget = legalTargets.includes(square);
                const isLast = lastMove && (lastMove.from === square || lastMove.to === square);
                const isHintFrom = engineMove?.from === square;
                const isHintTo = engineMove?.to === square;

                return (
                  <button
                    className={`square ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isTarget ? 'target' : ''} ${isLast ? 'last-move' : ''} ${isHintFrom ? 'hint-from' : ''} ${isHintTo ? 'hint-to' : ''}`}
                    key={square}
                    onClick={() => selectSquare(square)}
                    onDragOver={emptyHandlers}
                    onDrop={emptyHandlers}
                    onDragStart={emptyHandlers}
                    aria-label={square}
                  >
                    {piece && (
                      <img
                        className={`piece ${piece.color} piece-set-${pieceSet}`}
                        src={getPieceImage(pieceSet, `${piece.color}${piece.type}`)}
                        alt={`${piece.color === 'w' ? 'Trắng' : 'Đen'} ${PIECE_NAMES[piece.type]}`}
                        draggable="false"
                      />
                    )}
                    {(row === 7 || col === 0) && <span className="coord">{row === 7 ? square[0] : square[1]}</span>}
                  </button>
                );
              })
            )}
            {hintFrom && hintTo && <GuideArrow from={hintFrom} to={hintTo} />}
          </div>
        </div>
      </section>
    </section>
  );
}

function GuideArrow({ from, to }) {
  return (
    <svg className="best-move-arrow hint-arrow" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <marker id="guide-hint-arrow-head" markerWidth="4.2" markerHeight="4.2" refX="3.7" refY="2.1" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L4.2,2.1 L0,4.2 Z" />
        </marker>
      </defs>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd="url(#guide-hint-arrow-head)" />
    </svg>
  );
}
