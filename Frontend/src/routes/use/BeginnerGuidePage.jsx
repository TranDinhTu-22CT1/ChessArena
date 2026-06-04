import React from 'react';
import { Chess } from 'chess.js';
import { BookOpen, Brain, CheckCircle2, RotateCcw, Sparkles, Target } from 'lucide-react';
import { requestStockfishMove } from '../../api/stockfish';
import { getPieceImage } from '../../game/pieces';

const LESSONS = [
  {
    id: 'opening',
    title: 'Ván đầu tiên',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    text: 'Mục tiêu đầu ván là chiếm trung tâm, phát triển mã/tượng và nhập thành sớm.'
  },
  {
    id: 'knight',
    title: 'Mã đi chữ L',
    fen: '8/8/8/8/3N4/8/8/4K3 w - - 0 1',
    text: 'Mã nhảy qua quân khác. Bấm quân mã ở d4 để xem toàn bộ ô nó có thể tới.'
  },
  {
    id: 'pawn',
    title: 'Tốt đi và ăn quân',
    fen: '8/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
    text: 'Tốt đi thẳng nhưng ăn chéo. Ở thế này tốt trắng còn có thể bắt tốt qua đường nếu hợp lệ.'
  },
  {
    id: 'castle',
    title: 'Nhập thành',
    fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
    text: 'Nhập thành giúp vua an toàn và đưa xe vào cuộc. Bấm vua để thấy ô nhập thành.'
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

function squareAt(row, col) {
  return `${'abcdefgh'[col]}${8 - row}`;
}

function moveLabel(move) {
  if (!move) return '';
  return `${move.from}-${move.to}${move.promotion ? `=${move.promotion.toUpperCase()}` : ''}`;
}

export default function BeginnerGuidePage({ onNavigate }) {
  const [lessonId, setLessonId] = React.useState('opening');
  const lesson = LESSONS.find((item) => item.id === lessonId) || LESSONS[0];
  const [game, setGame] = React.useState(() => new Chess(lesson.fen));
  const [selected, setSelected] = React.useState('');
  const [legalTargets, setLegalTargets] = React.useState([]);
  const [lastMove, setLastMove] = React.useState(null);
  const [engineMove, setEngineMove] = React.useState(null);
  const [engineStatus, setEngineStatus] = React.useState('');

  React.useEffect(() => {
    setGame(new Chess(lesson.fen));
    setSelected('');
    setLegalTargets([]);
    setLastMove(null);
    setEngineMove(null);
    setEngineStatus('');
  }, [lesson.fen]);

  const selectSquare = (square) => {
    const piece = game.get(square);
    if (selected && legalTargets.includes(square)) {
      const next = new Chess(game.fen());
      const played = next.move({ from: selected, to: square, promotion: 'q' });
      if (played) {
        setGame(next);
        setLastMove({ from: played.from, to: played.to, san: played.san });
        setSelected('');
        setLegalTargets([]);
        setEngineMove(null);
        setEngineStatus(`${played.san}: nước đi hợp lệ.`);
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
    setEngineStatus(`${PIECE_NAMES[piece.type]} ở ${square} có ${moves.length} nước hợp lệ.`);
  };

  const resetLesson = () => {
    setGame(new Chess(lesson.fen));
    setSelected('');
    setLegalTargets([]);
    setLastMove(null);
    setEngineMove(null);
    setEngineStatus('');
  };

  const askStockfish = async () => {
    setEngineStatus('Stockfish đang phân tích thế cờ...');
    setEngineMove(null);
    try {
      const move = await requestStockfishMove(game.fen(), 1600, { variant: 'standard' }, 7000);
      setEngineMove(move);
      setEngineStatus(`Stockfish gợi ý: ${moveLabel(move)}. Bấm quân ở ${move.from} rồi đi tới ${move.to} để thử.`);
    } catch (error) {
      setEngineStatus(error.message || 'Không lấy được gợi ý Stockfish.');
    }
  };

  return (
    <section className="beginner-guide-page">
      <header className="beginner-guide-hero">
        <div>
          <span><BookOpen size={18} /> Hướng dẫn người mới</span>
          <h1>Học trên bàn cờ thật</h1>
          <p>Chọn bài học, bấm quân trên bàn để xem nước hợp lệ, đi thử nước và dùng Stockfish để nhận gợi ý như một huấn luyện viên cơ bản.</p>
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
            <button onClick={askStockfish}><Brain size={17} /> Gợi ý Stockfish</button>
            <button onClick={resetLesson}><RotateCcw size={17} /> Đặt lại</button>
          </div>
          <div className="guide-status">
            <strong>{game.turn() === 'w' ? 'Trắng' : 'Đen'} tới lượt</strong>
            <span>{engineStatus || 'Bấm một quân cùng màu tới lượt để xem cách đi.'}</span>
            {lastMove && <small>Nước vừa đi: {lastMove.san} ({lastMove.from}-{lastMove.to})</small>}
          </div>
          <ul className="guide-check-list">
            <li><CheckCircle2 size={17} /> Ô xanh là nước đi hợp lệ của quân đang chọn.</li>
            <li><CheckCircle2 size={17} /> Mũi tên vàng là nước Stockfish đang gợi ý.</li>
            <li><CheckCircle2 size={17} /> Nếu đi sai luật, bàn cờ sẽ không nhận nước đó.</li>
          </ul>
        </aside>

        <div className="guide-real-board-wrap">
          <div className="guide-real-board" aria-label="Bàn cờ hướng dẫn tương tác">
            {Array.from({ length: 8 }).map((_, row) => (
              Array.from({ length: 8 }).map((__, col) => {
                const square = squareAt(row, col);
                const piece = game.get(square);
                const isDark = (row + col) % 2 === 1;
                const isSelected = selected === square;
                const isTarget = legalTargets.includes(square);
                const isLast = lastMove && (lastMove.from === square || lastMove.to === square);
                const isEngineFrom = engineMove?.from === square;
                const isEngineTo = engineMove?.to === square;
                return (
                  <button
                    className={`guide-square ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isTarget ? 'target' : ''} ${isLast ? 'last' : ''} ${isEngineFrom ? 'engine-from' : ''} ${isEngineTo ? 'engine-to' : ''}`}
                    key={square}
                    onClick={() => selectSquare(square)}
                    aria-label={square}
                  >
                    {piece && <img src={getPieceImage('neo', `${piece.color}${piece.type}`)} alt={`${PIECE_NAMES[piece.type]} ${piece.color}`} draggable="false" />}
                    {(row === 7 || col === 0) && <span>{row === 7 ? square[0] : square[1]}</span>}
                  </button>
                );
              })
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}
