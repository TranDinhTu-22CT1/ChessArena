import React from 'react';
import { createPortal } from 'react-dom';
import { Chess } from 'chess.js';
import { BookOpen, CheckCircle2, Eye, PlayCircle, RotateCcw, Sparkles, Target, X } from 'lucide-react';
import { getPieceImage } from '../../game/pieces';
import { squareName } from '../../game/chessLogic';

const STARTING_FEN = 'start';
const GUIDE_VIDEO_ID = 'jT_AeMzuhxA';
const GUIDE_VIDEO_EMBED_URL = `https://www.youtube.com/embed/${GUIDE_VIDEO_ID}`;

const LESSONS = [
  {
    id: 'king',
    title: '1. Vua',
    focus: 'e3',
    fen: '4k3/8/8/3p4/8/4K3/8/8 w - - 0 1',
    text: 'Vua đi 1 ô theo mọi hướng. Vua là quân quan trọng nhất, nên mọi nước đi làm vua bị chiếu đều không hợp lệ.'
  },
  {
    id: 'knight',
    title: '2. Mã',
    focus: 'd4',
    fen: '4k3/8/8/2p1p3/3N4/2P1P3/8/4K3 w - - 0 1',
    text: 'Mã đi hình chữ L: 2 ô theo một hướng rồi 1 ô ngang. Mã là quân duy nhất có thể nhảy qua quân khác.'
  },
  {
    id: 'pawn',
    title: '3. Tốt',
    focus: 'd2',
    fen: '4k3/8/8/8/8/4p3/3P4/4K3 w - - 0 1',
    text: 'Tốt đi thẳng, ăn chéo. Ở nước đầu, tốt có thể đi 2 ô nếu cả hai ô phía trước đều trống.'
  },
  {
    id: 'rook',
    title: '4. Xe',
    focus: 'd4',
    fen: '4k3/8/3p4/8/1p1R1P2/8/3P4/4K3 w - - 0 1',
    text: 'Xe đi ngang hoặc dọc bao nhiêu ô cũng được nếu đường đi không bị chặn.'
  },
  {
    id: 'bishop',
    title: '5. Tượng',
    focus: 'd4',
    fen: '4k3/8/1p3p2/8/3B4/2P5/8/4K3 w - - 0 1',
    text: 'Tượng đi chéo. Một tượng bắt đầu ở ô sáng sẽ luôn ở ô sáng; tượng ở ô tối sẽ luôn ở ô tối.'
  },
  {
    id: 'queen',
    title: '6. Hậu',
    focus: 'd4',
    fen: '4k3/8/3p4/1p6/3Q4/2P3p1/8/4K3 w - - 0 1',
    text: 'Hậu kết hợp sức mạnh của xe và tượng: đi ngang, dọc, chéo bao nhiêu ô cũng được nếu không bị chặn.'
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

const PRACTICE_SCENARIOS = [
  {
    id: 'center-e4',
    chapter: '01',
    phase: 'Khai cuộc',
    title: 'Chiếm trung tâm',
    fen: STARTING_FEN,
    selected: 'e2',
    hints: ['e4'],
    goals: ['e2e4'],
    reply: 'e7e5',
    prompt: 'Đi e4. Đây là nước mở trung tâm, mở đường cho tượng f1 và hậu.',
    success: 'Đúng. Bạn đã lấy không gian ở trung tâm và mở quân sau.',
    mistake: 'Nước đó đi được, nhưng bài này muốn bạn mở trung tâm bằng e4.',
    tip: 'Khai cuộc tốt: trung tâm trước, quân nhẹ sau, vua an toàn.',
    concept: 'Tốt e4 kiểm soát d5 và f5.'
  },
  {
    id: 'develop-knight',
    chapter: '02',
    phase: 'Khai cuộc',
    title: 'Phát triển mã',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    selected: 'g1',
    hints: ['f3'],
    goals: ['g1f3'],
    reply: 'b8c6',
    prompt: 'Đi Nf3. Mã ra ô tốt và tấn công tốt e5.',
    success: 'Đúng. Một quân được phát triển và trung tâm bị gây áp lực.',
    mistake: 'Nước đó chưa giúp phát triển nhanh. Hãy đưa mã g1 lên f3.',
    tip: 'Đừng đi một quân quá nhiều lần khi các quân khác còn ở nhà.',
    concept: 'Mã thường mạnh ở f3/c3/f6/c6.'
  },
  {
    id: 'develop-bishop',
    chapter: '03',
    phase: 'Khai cuộc',
    title: 'Mở đường nhập thành',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
    selected: 'f1',
    hints: ['c4'],
    goals: ['f1c4'],
    reply: 'g8f6',
    prompt: 'Đi Bc4. Tượng ra đường chéo tốt và dọn ô f1 cho nhập thành.',
    success: 'Đúng. Bạn vừa phát triển tượng vừa chuẩn bị đưa vua vào an toàn.',
    mistake: 'Nước đó hợp lệ, nhưng chưa giải quyết mục tiêu mở đường nhập thành.',
    tip: 'Tượng nên ra các đường chéo nhìn vào trung tâm hoặc vua đối thủ.',
    concept: 'Bc4 nhìn vào f7, điểm yếu đầu ván của Đen.'
  },
  {
    id: 'castle',
    chapter: '04',
    phase: 'Khai cuộc',
    title: 'Đưa vua vào an toàn',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    selected: 'e1',
    hints: ['g1'],
    goals: ['e1g1'],
    prompt: 'Nhập thành ngắn. Bấm vua e1 rồi chọn g1.',
    success: 'Đúng. Vua an toàn hơn và xe h1 được kéo gần trung tâm.',
    mistake: 'Bài này muốn bạn nhập thành. Chọn vua e1 rồi đi tới g1.',
    tip: 'Trong nhiều ván, nhập thành sớm giúp bạn tránh bị tấn công giữa bàn.',
    concept: 'Nhập thành là nước đặc biệt: vua đi 2 ô, xe tự nhảy qua.'
  },
  {
    id: 'knight-capture',
    chapter: '05',
    phase: 'Trung cuộc',
    title: 'Mã ăn tốt yếu',
    fen: '4k3/ppp2ppp/8/1p3p2/3N4/8/PPP2PPP/4K3 w - - 0 1',
    selected: 'd4',
    hints: ['b5'],
    goals: ['d4b5'],
    prompt: 'Stockfish chọn Nxb5. Mã trắng ở d4 ăn tốt b5 và tạo áp lực lên c7/a7.',
    success: 'Đúng. Mã lấy tốt cánh hậu và đứng ở ô khó bị đuổi ngay.',
    mistake: 'Nước Stockfish chọn là Nxb5: dùng mã d4 ăn tốt b5.',
    tip: 'Mã mạnh khi nhảy vào ô có mục tiêu mà đối thủ không thể đuổi ngay.',
    concept: 'Đây là nước Stockfish chọn trong thế có đủ bối cảnh tốt hai bên.'
  },
  {
    id: 'bishop-capture',
    chapter: '06',
    phase: 'Trung cuộc',
    title: 'Tượng ăn hậu trên đường chéo',
    fen: '4k3/1q3ppp/8/8/8/8/PPP2PBP/4K3 w - - 0 1',
    selected: 'g2',
    hints: ['b7'],
    goals: ['g2b7'],
    prompt: 'Stockfish chọn Bxb7. Tượng g2 đi theo đường chéo mở để ăn hậu đen ở b7.',
    success: 'Đúng. Tượng ăn hậu mà Đen không có quân nào bắt lại ngay.',
    mistake: 'Nước Stockfish chọn là Bxb7: dùng tượng g2 ăn hậu b7.',
    tip: 'Tượng rất mạnh trên đường chéo dài khi không còn tốt chắn đường.',
    concept: 'Đây là tactic trung cuộc thật: khai thác đường chéo mở để thắng hậu.'
  },
  {
    id: 'rook-open-file',
    chapter: '07',
    phase: 'Trung cuộc',
    title: 'Xe ăn hậu trên cột mở',
    fen: '3q2k1/ppp2pp1/8/8/8/8/PPP2PPP/3R2K1 w - - 0 1',
    selected: 'd1',
    hints: ['d8'],
    goals: ['d1d8'],
    prompt: 'Stockfish chọn Rxd8+. Cột d đang mở, xe trắng ăn hậu đen trên d8 kèm chiếu.',
    success: 'Đúng. Xe ăn hậu và Đen không thể ăn lại; sau đó Đen chỉ còn chạy vua.',
    mistake: 'Nước đúng là Rxd8+: dùng xe trên cột d ăn hậu đen.',
    tip: 'Xe trên cột mở mạnh khi có mục tiêu thật ở cuối cột, nhất là hậu hoặc vua.',
    concept: 'Đây là nước Stockfish chọn: thắng hậu bằng một nước chiếu, không phải thí xe.'
  },
  {
    id: 'promotion',
    chapter: '08',
    phase: 'Tàn cuộc',
    title: 'Phong cấp tốt',
    fen: '4k3/P7/8/8/8/8/8/6K1 w - - 0 1',
    selected: 'a7',
    hints: ['a8'],
    goals: ['a7a8q'],
    prompt: 'Đẩy tốt a7 lên a8. Hệ thống sẽ tự phong hậu cho bài này.',
    success: 'Đúng. Một tốt qua tới hàng cuối có thể đổi thành quân mạnh.',
    mistake: 'Tàn cuộc này thắng nhờ tốt. Hãy đẩy a7-a8.',
    tip: 'Tàn cuộc: tốt thông càng gần hàng cuối càng nguy hiểm.',
    concept: 'Phong cấp thường chọn hậu vì hậu là quân mạnh nhất.'
  },
  {
    id: 'escape-check',
    chapter: '09',
    phase: 'Phòng thủ',
    title: 'Chạy vua khỏi chiếu',
    fen: '4r1k1/6pp/8/8/8/8/8/4KB2 w - - 0 1',
    selected: 'e1',
    hints: ['d2'],
    goals: ['e1d2'],
    prompt: 'Stockfish chọn Kd2. Vua trắng rời khỏi cột e đang bị xe đen chiếu.',
    success: 'Đúng. Vua thoát khỏi đường chiếu và không đi vào ô bị kiểm soát.',
    mistake: 'Nước Stockfish chọn là Kd2: đưa vua e1 sang d2.',
    tip: 'Ba cách thoát chiếu: chạy vua, chặn đường chiếu, hoặc ăn quân đang chiếu.',
    concept: 'Khi bị chiếu, ưu tiên nước hợp lệ giúp vua thoát nguy hiểm ngay.'
  },
  {
    id: 'mate-one',
    chapter: '10',
    phase: 'Chiếu hết',
    title: 'Chiếu hết hàng cuối',
    fen: '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1',
    selected: 'e1',
    hints: ['e8'],
    goals: ['e1e8'],
    prompt: 'Đi Re8#. Xe trắng chiếu ngang hàng 8, các tốt đen f7-g7-h7 tự chặn đường vua.',
    success: 'Chiếu hết. Vua Đen bị xe chiếu và không có ô thoát vì hàng tốt phía trước đã khóa đường.',
    mistake: 'Bài này cần nước chiếu hết hàng cuối: đưa xe từ e1 lên e8.',
    tip: 'Back-rank mate thường xảy ra khi vua bị chính các tốt trước mặt chặn đường chạy.',
    concept: 'Chiếu hết = đang bị chiếu, không ăn được quân chiếu, không chặn được và không còn ô chạy.'
  },
  {
    id: 'stalemate-one',
    chapter: '11',
    phase: 'Chiếu hòa',
    title: 'Thế hòa đã xảy ra',
    fen: '7k/5K2/6Q1/8/8/8/8/8 b - - 0 1',
    selected: 'h8',
    hints: [],
    blockedSquares: ['h7', 'g8', 'g7'],
    goals: [],
    locked: true,
    result: {
      type: 'stalemate',
      title: 'Chiếu hòa',
      text: 'Đen tới lượt, không bị chiếu, nhưng mọi ô thoát đều bị khóa.'
    },
    prompt: 'Đây đã là stalemate. Không cần đi thêm quân: Đen tới lượt nhưng không có nước hợp lệ.',
    success: 'Chiếu hòa. Đen không bị chiếu nhưng không còn nước hợp lệ, nên ván cờ hòa.',
    mistake: 'Thế này đã hòa, không cần di chuyển thêm.',
    tip: 'Khi hơn quân lớn ở tàn cuộc, phải để vua đối phương còn ô đi hoặc tạo chiếu hết rõ ràng.',
    concept: 'Stalemate = không bị chiếu, nhưng tới lượt và không có nước hợp lệ.'
  },
  {
    id: 'en-passant',
    chapter: '12',
    phase: 'Luật đặc biệt',
    title: 'Bắt tốt qua đường',
    introFen: '4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1',
    introMove: 'd7d5',
    introMessage: 'Quan sát trước: Đen vừa đẩy tốt từ d7 xuống d5, đi ngang qua ô d6.',
    fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2',
    selected: 'e5',
    hints: ['d6'],
    goals: ['e5d6'],
    prompt: 'Tốt đen vừa đi d7-d5. Tốt trắng e5 được ăn qua đường sang d6.',
    success: 'Đúng. Đây là en passant: ăn tốt như thể nó chỉ vừa đi một ô.',
    mistake: 'Bài này là bắt tốt qua đường. Chọn tốt e5 rồi đi tới d6.',
    tip: 'En passant chỉ được thực hiện ngay lượt kế tiếp sau khi tốt đối phương đi 2 ô.',
    concept: 'Đây là luật đặc biệt duy nhất mà quân bị ăn không nằm trên ô đích.'
  }
];

const SPECIAL_RULES = [
  {
    title: 'Chiếu hết',
    body: 'Vua đang bị chiếu và bên bị chiếu không còn nước hợp lệ để thoát. Khi chiếu hết, ván cờ kết thúc ngay.'
  },
  {
    title: 'Chiếu hòa',
    body: 'Bên tới lượt không bị chiếu nhưng không còn nước hợp lệ nào. Đây là hòa, kể cả khi bên kia đang hơn rất nhiều quân.'
  },
  {
    title: 'Nhập thành',
    body: 'Vua đi 2 ô về phía xe, xe nhảy qua đứng cạnh vua. Chỉ hợp lệ khi vua và xe chưa từng đi, giữa hai quân không có quân nào, vua không bị chiếu và không đi qua ô bị kiểm soát.'
  },
  {
    title: 'Phong cấp',
    body: 'Tốt tới hàng cuối sẽ đổi thành hậu, xe, tượng hoặc mã. Thực tế thường chọn hậu vì đó là quân mạnh nhất.'
  },
  {
    title: 'Bắt tốt qua đường',
    body: 'Nếu tốt đối phương vừa đi 2 ô và đi ngang qua ô tốt của bạn có thể ăn, bạn được ăn như thể nó chỉ đi 1 ô. Nước này chỉ có hiệu lực ngay lượt kế tiếp.'
  },
  {
    title: 'Các kiểu hòa khác',
    body: 'Ván cờ cũng có thể hòa do lặp lại thế cờ, luật 50 nước, thỏa thuận hòa, hoặc hai bên không còn đủ lực chiếu hết.'
  }
];

const BASIC_STRATEGY = [
  'Kiểm soát trung tâm bằng tốt và quân nhẹ.',
  'Phát triển mã, tượng sớm thay vì đi một quân quá nhiều lần.',
  'Nhập thành để đưa vua vào nơi an toàn.',
  'Đừng mất quân miễn phí: tốt = 1, mã/tượng = 3, xe = 5, hậu = 9.',
  'Luôn hỏi: quân đối phương đang đe dọa gì ở nước tiếp theo?'
];

const LEARNING_PATH = [
  'Xem bàn cờ đầy đủ và nhớ vị trí xuất phát.',
  'Học từng quân bằng bàn tương tác bên dưới.',
  'Tập nhận biết chiếu, chiếu hết và stalemate.',
  'Sau đó mới học nhập thành, phong cấp và bắt tốt qua đường.',
  'Chơi nhiều ván ngắn, rồi xem lại các nước làm mất quân.'
];

function emptyHandlers() {}

function createChess(fen) {
  return fen === STARTING_FEN ? new Chess() : new Chess(fen);
}

function GuideBoard({
  game,
  selected = '',
  legalTargets = [],
  blockedTargets = [],
  lastMove = null,
  onSelectSquare,
  interactive = true,
  className = ''
}) {
  const pieceSet = 'neo';

  return (
    <div className={`board guide-standard-board piece-set-${pieceSet} ${className}`}>
      {Array.from({ length: 8 }).map((_, row) =>
        Array.from({ length: 8 }).map((__, col) => {
          const square = squareName(row, col, false);
          const piece = game.get(square);
          const isDark = (row + col) % 2 === 1;
          const isSelected = selected === square;
          const isTarget = legalTargets.includes(square);
          const isBlocked = blockedTargets.includes(square);
          const isLast = lastMove && (lastMove.from === square || lastMove.to === square);

          return (
            <button
              className={`square ${isDark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isTarget ? 'target' : ''} ${isBlocked ? 'blocked-target' : ''} ${isLast ? 'last-move' : ''}`}
              key={square}
              onClick={() => interactive && onSelectSquare?.(square)}
              onDragOver={emptyHandlers}
              onDrop={emptyHandlers}
              onDragStart={emptyHandlers}
              aria-label={square}
              type="button"
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
    </div>
  );
}

export default function BeginnerGuidePage({ onNavigate }) {
  const [lessonId, setLessonId] = React.useState('king');
  const [practiceId, setPracticeId] = React.useState(PRACTICE_SCENARIOS[0].id);
  const [videoOpen, setVideoOpen] = React.useState(false);
  const lesson = LESSONS.find((item) => item.id === lessonId) || LESSONS[0];
  const practiceIndex = Math.max(0, PRACTICE_SCENARIOS.findIndex((item) => item.id === practiceId));
  const practice = PRACTICE_SCENARIOS[practiceIndex] || PRACTICE_SCENARIOS[0];
  const [game, setGame] = React.useState(() => createChess(lesson.fen));
  const [practiceGame, setPracticeGame] = React.useState(() => createChess(practice.fen));
  const [practiceSelected, setPracticeSelected] = React.useState(practice.selected);
  const [practiceTargets, setPracticeTargets] = React.useState(practice.hints);
  const [practiceLastMove, setPracticeLastMove] = React.useState(null);
  const [practiceMessage, setPracticeMessage] = React.useState(practice.prompt);
  const [practiceSolved, setPracticeSolved] = React.useState(false);
  const [practiceIntroActive, setPracticeIntroActive] = React.useState(false);
  const [practiceResult, setPracticeResult] = React.useState(null);
  const [selected, setSelected] = React.useState('');
  const [legalTargets, setLegalTargets] = React.useState([]);
  const [lastMove, setLastMove] = React.useState(null);
  const [status, setStatus] = React.useState('');

  React.useEffect(() => {
    setGame(createChess(lesson.fen));
    setSelected('');
    setLegalTargets([]);
    setLastMove(null);
    setStatus('Bấm "Xem nước đi" hoặc chọn quân trên bàn để thấy các ô hợp lệ.');
  }, [lesson.fen]);

  React.useEffect(() => {
    let introTimer;
    setPracticeSolved(Boolean(practice.locked));
    setPracticeResult(null);

    if (practice.introFen && practice.introMove) {
      const introGame = createChess(practice.introFen);
      setPracticeGame(introGame);
      setPracticeSelected('');
      setPracticeTargets([]);
      setPracticeLastMove(null);
      setPracticeMessage(practice.introMessage || practice.prompt);
      setPracticeIntroActive(true);

      introTimer = window.setTimeout(() => {
        const next = createChess(practice.introFen);
        const move = next.move({
          from: practice.introMove.slice(0, 2),
          to: practice.introMove.slice(2, 4),
          promotion: practice.introMove[4]
        });
        setPracticeGame(next);
        setPracticeSelected(practice.selected);
        setPracticeTargets(practice.hints);
        setPracticeLastMove(move ? { from: move.from, to: move.to, san: move.san } : null);
        setPracticeMessage(practice.prompt);
        setPracticeIntroActive(false);
      }, 900);

      return () => window.clearTimeout(introTimer);
    }

    setPracticeGame(createChess(practice.fen));
    setPracticeSelected(practice.selected);
    setPracticeTargets(practice.hints);
    setPracticeLastMove(null);
    setPracticeMessage(practice.prompt);
    setPracticeIntroActive(false);
    setPracticeResult(practice.result || null);
  }, [practice]);

  const showFocusMoves = React.useCallback(() => {
    const piece = game.get(lesson.focus);
    if (!piece) return;
    const moves = game.moves({ square: lesson.focus, verbose: true });
    setSelected(lesson.focus);
    setLegalTargets(moves.map((move) => move.to));
    setStatus(`${PIECE_NAMES[piece.type]} ở ${lesson.focus} có ${moves.length} nước hợp lệ trong thế cờ này.`);
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
        setStatus(`${played.san}: nước đi hợp lệ. Bấm "Đặt lại" để học lại bài này.`);
        return;
      }
    }

    if (!piece || piece.color !== game.turn()) {
      setSelected('');
      setLegalTargets([]);
      setStatus('Chọn quân đúng màu đang tới lượt để xem nước hợp lệ.');
      return;
    }

    const moves = game.moves({ square, verbose: true });
    setSelected(square);
    setLegalTargets(moves.map((move) => move.to));
    setStatus(`${PIECE_NAMES[piece.type]} ở ${square} có ${moves.length} nước hợp lệ.`);
  };

  const resetLesson = () => {
    setGame(createChess(lesson.fen));
    setSelected('');
    setLegalTargets([]);
    setLastMove(null);
    setStatus('Bấm "Xem nước đi" hoặc chọn quân trên bàn để thấy các ô hợp lệ.');
  };

  const resetPractice = () => {
    setPracticeSolved(Boolean(practice.locked));
    setPracticeResult(null);

    if (practice.introFen && practice.introMove) {
      setPracticeGame(createChess(practice.introFen));
      setPracticeSelected('');
      setPracticeTargets([]);
      setPracticeLastMove(null);
      setPracticeMessage(practice.introMessage || practice.prompt);
      setPracticeIntroActive(true);
      window.setTimeout(() => {
        const next = createChess(practice.introFen);
        const move = next.move({
          from: practice.introMove.slice(0, 2),
          to: practice.introMove.slice(2, 4),
          promotion: practice.introMove[4]
        });
        setPracticeGame(next);
        setPracticeSelected(practice.selected);
        setPracticeTargets(practice.hints);
        setPracticeLastMove(move ? { from: move.from, to: move.to, san: move.san } : null);
        setPracticeMessage(practice.prompt);
        setPracticeIntroActive(false);
      }, 900);
      return;
    }

    setPracticeGame(createChess(practice.fen));
    setPracticeSelected(practice.selected);
    setPracticeTargets(practice.hints);
    setPracticeLastMove(null);
    setPracticeMessage(practice.prompt);
    setPracticeIntroActive(false);
    setPracticeResult(practice.result || null);
  };

  const goToNextPractice = () => {
    const next = PRACTICE_SCENARIOS[practiceIndex + 1] || PRACTICE_SCENARIOS[0];
    setPracticeId(next.id);
  };

  const playPracticeReply = (afterMoveGame) => {
    if (!practice.reply) return afterMoveGame;
    const replyGame = new Chess(afterMoveGame.fen());
    const reply = replyGame.move(practice.reply);
    if (!reply) return afterMoveGame;
    setPracticeLastMove({ from: reply.from, to: reply.to, san: reply.san });
    setPracticeMessage(`${practice.success} Đen đáp ${reply.san}; hãy nhìn cách thế cờ thay đổi.`);
    return replyGame;
  };

  const selectPracticeSquare = (square) => {
    if (practiceSolved || practiceIntroActive || practice.locked) return;

    if (practiceSelected && practiceTargets.includes(square)) {
      const next = new Chess(practiceGame.fen());
      const movingPiece = next.get(practiceSelected);
      const promotion = movingPiece?.type === 'p' && ['1', '8'].includes(square[1]) ? 'q' : undefined;
      const played = next.move({ from: practiceSelected, to: square, promotion });
      if (!played) return;

      const uci = `${played.from}${played.to}${played.promotion ?? ''}`;
      const isGoal = practice.goals.includes(uci);
      setPracticeLastMove({ from: played.from, to: played.to, san: played.san });
      setPracticeSelected('');
      setPracticeTargets([]);

      if (isGoal) {
        setPracticeSolved(true);
        const finalGame = playPracticeReply(next);
        setPracticeGame(finalGame);
        if (!practice.reply) {
          const result = next.isCheckmate()
            ? { type: 'mate', title: 'Chiếu hết', text: 'Vua bị chiếu và không còn nước hợp lệ để thoát.' }
            : next.isStalemate()
              ? { type: 'stalemate', title: 'Chiếu hòa', text: 'Không bị chiếu nhưng không còn nước hợp lệ nào.' }
              : next.inCheck()
                ? { type: 'check', title: 'Đang chiếu', text: 'Vua đối phương đang bị tấn công.' }
                : null;
          const ending = result ? ` Trạng thái: ${result.title.toLowerCase()}.` : '';
          setPracticeResult(result);
          setPracticeMessage(`${practice.success}${ending}`);
        }
      } else {
        setPracticeGame(next);
        setPracticeResult(null);
        setPracticeMessage(practice.mistake || 'Nước này hợp lệ, nhưng chưa đúng mục tiêu bài học. Bấm Đặt lại và thử theo chấm gợi ý.');
      }
      return;
    }

    const piece = practiceGame.get(square);
    if (!piece || piece.color !== practiceGame.turn()) {
      setPracticeSelected(practice.selected);
      setPracticeTargets(practice.hints);
      setPracticeMessage('Chọn quân đang được viền sáng, hoặc bấm thẳng vào chấm xanh để đi nước chính.');
      return;
    }

    const moves = practiceGame.moves({ square, verbose: true });
    setPracticeSelected(square);
    setPracticeTargets(moves.map((move) => move.to));
    setPracticeMessage(`${PIECE_NAMES[piece.type]} ở ${square}: chọn một chấm xanh để đi. Chấm đúng của bài này nằm trong lời nhắc.`);
  };

  return (
    <section className="beginner-guide-page">
      <header className="beginner-guide-hero">
        <div>
          <span><BookOpen size={18} /> Hướng dẫn người mới</span>
          <h1>Học cách cả bàn cờ hoạt động</h1>
          <p>Trang này đi từ video tổng quan tới bài thực hành: khai cuộc, phát triển quân, ăn quân, chiếu hết, chiếu hòa và các luật đặc biệt dễ nhầm.</p>
        </div>
        <aside className="beginner-guide-hero-aside">
          <div className="beginner-guide-highlights">
            <span><strong>{PRACTICE_SCENARIOS.length}</strong> bài thực hành</span>
            <span><strong>{LESSONS.length}</strong> bài học quân cờ</span>
            <span><strong>3</strong> chặng nền tảng</span>
          </div>
          <button onClick={() => onNavigate?.('bot')} type="button"><Sparkles size={18} /> Luyện với bot</button>
        </aside>
      </header>

      <section className="guide-video-section">
        <div className="guide-video-copy">
          <span><PlayCircle size={18} /> Video hướng dẫn chi tiết</span>
          <h2>Xem bài tổng quan trước khi luyện từng quân</h2>
          <p>
            Cấu trúc học ở đây đi theo hướng của Chess.com: setup bàn cờ, cách quân di chuyển,
            luật đặc biệt, cách thắng và luyện nhiều ván. Nội dung trong ChessArena được viết lại
            và tối giản cho người mới.
          </p>
          <button type="button" onClick={() => setVideoOpen(true)}>Xem video trong web</button>
        </div>
        <button className="guide-video-frame" type="button" onClick={() => setVideoOpen(true)}>
          <PlayCircle size={64} />
          <strong>Phát video hướng dẫn</strong>
          <span>Video sẽ mở trong popup ngay trên ChessArena</span>
        </button>
      </section>

      <section className="guide-walkthrough-section">
        <div className="guide-section-title">
          <Target size={22} />
          <h2>Khóa học nhanh trên bàn cờ</h2>
        </div>
        <div className="guide-walkthrough-layout">
          <div className="guide-standard-board-wrap">
            {practiceIntroActive && (
              <div className="guide-result-banner intro">
                <strong>Đen vừa đi</strong>
                <span>{practice.introMove?.slice(0, 2)}-{practice.introMove?.slice(2, 4)}</span>
              </div>
            )}
            {practiceResult && (
              <div className={`guide-result-banner ${practiceResult.type}`}>
                <strong>{practiceResult.title}</strong>
                <span>{practiceResult.text}</span>
              </div>
            )}
            <GuideBoard
              game={practiceGame}
              selected={practiceSelected}
              legalTargets={practiceTargets}
              blockedTargets={practice.blockedSquares || []}
              lastMove={practiceLastMove}
              onSelectSquare={selectPracticeSquare}
              interactive={!practiceIntroActive && !practice.locked}
              className="guide-walkthrough-board"
            />
          </div>
          <aside className="guide-walkthrough-panel">
            <div className="guide-course-topline">
              <span>{practice.phase}</span>
              <small>{practiceIndex + 1}/{PRACTICE_SCENARIOS.length}</small>
            </div>
            <h2>{practice.title}</h2>
            <div className="guide-course-objective">
              <b>Mục tiêu</b>
              <p>{practice.prompt}</p>
            </div>
            <div className={`guide-course-feedback ${practiceSolved ? 'solved' : ''}`}>
              <strong>{practiceSolved ? 'Hoàn thành' : 'Đến lượt bạn'}</strong>
              <span>{practiceMessage}</span>
            </div>
            <div className="guide-course-concept">
              <b>Ý chính</b>
              <span>{practice.concept}</span>
            </div>
            <div className="guide-walkthrough-controls">
              <button type="button" onClick={resetPractice}>
                <RotateCcw size={18} /> Thử lại
              </button>
              <button type="button" onClick={goToNextPractice} disabled={!practiceSolved} className="guide-next-lesson">
                Bài tiếp theo
              </button>
            </div>
            <div className="guide-step-list">
              {PRACTICE_SCENARIOS.map((item, index) => (
                <button
                  type="button"
                  className={item.id === practiceId ? 'active' : ''}
                  onClick={() => setPracticeId(item.id)}
                  key={item.id}
                  title={item.title}
                >
                  <span>{item.chapter}</span>
                  <small>{item.phase}</small>
                </button>
              ))}
            </div>
            <div className="guide-practice-note">
              <b>{practice.tip}</b>
              <span>Chấm xanh là nước cần thử. Đi sai vẫn được phản hồi ngay, không phải đọc lại cả đoạn dài.</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="guide-live-layout">
        <aside className="guide-live-panel">
          <div className="guide-section-title">
            <Target size={22} />
            <h2>Học từng quân</h2>
          </div>
          <div className="guide-lesson-tabs">
            {LESSONS.map((item) => (
              <button className={item.id === lessonId ? 'active' : ''} onClick={() => setLessonId(item.id)} key={item.id} type="button">
                {item.title}
              </button>
            ))}
          </div>
          <p>{lesson.text}</p>
          <div className="guide-action-row">
            <button onClick={showFocusMoves} type="button"><Eye size={17} /> Xem nước đi</button>
            <button onClick={resetLesson} type="button"><RotateCcw size={17} /> Đặt lại</button>
          </div>
          <div className="guide-status">
            <strong>{game.turn() === 'w' ? 'Trắng' : 'Đen'} tới lượt</strong>
            <span>{status}</span>
            {lastMove && <small>Nước vừa đi: {lastMove.san} ({lastMove.from}-{lastMove.to})</small>}
          </div>
          <ul className="guide-check-list">
            <li><CheckCircle2 size={17} /> Ô xanh là nước hợp lệ của quân đang chọn.</li>
            <li><CheckCircle2 size={17} /> Nếu một nước làm vua mình bị chiếu, nước đó không hợp lệ.</li>
            <li><CheckCircle2 size={17} /> Bài học tăng dần từ một quân tới nhiều quân hơn.</li>
          </ul>
        </aside>

        <div className="guide-standard-board-wrap">
          <GuideBoard
            game={game}
            selected={selected}
            legalTargets={legalTargets}
            lastMove={lastMove}
            onSelectSquare={selectSquare}
          />
        </div>
      </section>

      <section className="guide-rules-section">
        <div className="guide-section-title">
          <BookOpen size={22} />
          <h2>Luật đặc biệt cần nhớ</h2>
        </div>
        <div className="guide-rules-grid guide-special-grid">
          {SPECIAL_RULES.map((section) => (
            <article className="guide-rule-card" key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-two-column">
        <article className="guide-rules-section">
          <div className="guide-section-title">
            <BookOpen size={22} />
            <h2>Chiến lược cơ bản</h2>
          </div>
          <ul className="guide-check-list">
            {BASIC_STRATEGY.map((item) => <li key={item}><CheckCircle2 size={17} /> {item}</li>)}
          </ul>
        </article>

        <article className="guide-learning-path">
          <div>
            <span><Target size={18} /> Lộ trình học đề xuất</span>
            <h2>Đừng học tất cả cùng lúc</h2>
          </div>
          <ol>
            {LEARNING_PATH.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </article>
      </section>
      {videoOpen && createPortal(
        <div className="guide-video-modal-layer" role="dialog" aria-modal="true" aria-label="Video hướng dẫn chi tiết">
          <button className="guide-video-modal-backdrop" type="button" onClick={() => setVideoOpen(false)} aria-label="Đóng video" />
          <section className="guide-video-modal">
            <div className="guide-video-modal-head">
              <strong>Video hướng dẫn bàn cờ chi tiết</strong>
              <button type="button" onClick={() => setVideoOpen(false)} aria-label="Đóng video">
                <X size={20} />
              </button>
            </div>
            <div className="guide-video-modal-frame">
              <iframe
                title="Video hướng dẫn bàn cờ chi tiết"
                src={`${GUIDE_VIDEO_EMBED_URL}?autoplay=1`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </section>
        </div>,
        document.body
      )}
    </section>
  );
}
