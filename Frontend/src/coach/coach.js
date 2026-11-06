import { reviewLabel } from '../data/review.js';
import { Chess } from 'chess.js';

export const COACH_MODES = [
  { id: 'basic', label: 'Cơ bản', focus: 'Nền tảng', depth: 'Ván đầy đủ: quân treo, nhập thành, trung tâm và nước an toàn.' },
  { id: 'opening', label: 'Khai cuộc', focus: 'Mở ván', depth: 'Bắt đầu từ đầu ván, ưu tiên phát triển quân, trung tâm và vua an toàn.' },
  { id: 'middlegame', label: 'Trung cuộc', focus: 'Chiến thuật', depth: 'Bắt đầu từ một thế trung cuộc ngẫu nhiên để luyện kế hoạch và đòn phối hợp.' },
  { id: 'endgame', label: 'Tàn cuộc', focus: 'Kỹ thuật', depth: 'Bắt đầu từ một thế tàn cuộc ngẫu nhiên để luyện vua, tốt thông và phong cấp.' }
];

export const COACH_MODE_BEHAVIOR = {
  basic: {
    reviewDepth: 8,
    suggestionArrows: true,
    threatArrows: false,
    moveFeedback: true,
    speech: 'normal',
    messageGroups: ['principle', 'safety'],
    start: 'standard'
  },
  opening: {
    reviewDepth: 10,
    suggestionArrows: true,
    threatArrows: false,
    moveFeedback: true,
    speech: 'normal',
    messageGroups: ['opening', 'principle'],
    start: 'standard'
  },
  middlegame: {
    reviewDepth: 12,
    suggestionArrows: true,
    threatArrows: true,
    moveFeedback: true,
    speech: 'normal',
    messageGroups: ['tactics', 'positional', 'forcing'],
    start: 'middlegame'
  },
  endgame: {
    reviewDepth: 14,
    suggestionArrows: true,
    threatArrows: false,
    moveFeedback: true,
    speech: 'normal',
    messageGroups: ['endgame', 'conversion'],
    start: 'endgame'
  }
};

export function coachBehaviorFromMode(coachMode) {
  return COACH_MODE_BEHAVIOR[coachMode] ?? COACH_MODE_BEHAVIOR.basic;
}

export const COACH_LESSON_POSITIONS = {
  middlegame: [
    {
      title: 'Tấn công vua nhập thành',
      fen: 'r2q1rk1/ppp2ppp/2npbn2/3Np3/2B1P3/2NP1Q2/PPP2PPP/R1B2RK1 w - - 0 10',
      goal: 'Tìm nước ép buộc quanh vua đen.'
    },
    {
      title: 'Cột mở và quân ghim',
      fen: 'r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1NBPPP/R2Q1RK1 w - - 0 9',
      goal: 'Cải thiện quân và tranh cột mở.'
    },
    {
      title: 'Trung tâm căng thẳng',
      fen: 'r2q1rk1/pp2bppp/2n1pn2/2pp4/2PP4/2N1PN2/PP2BPPP/R1BQ1RK1 b - - 0 9',
      goal: 'Chọn cách phá trung tâm đúng thời điểm.'
    },
    {
      title: 'Áp lực lên vua chưa an toàn',
      fen: 'r1bqk2r/ppp2ppp/2n2n2/3pp3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w kq - 0 7',
      goal: 'Tìm nước phát triển có tempo.'
    }
  ],
  endgame: [
    {
      title: 'Vua và tốt thông',
      fen: '8/5pk1/6p1/4P2p/5P1P/6K1/8/8 w - - 0 42',
      goal: 'Tạo tốt thông và đưa vua vào đúng ô.'
    },
    {
      title: 'Xe chống tốt xa',
      fen: '8/5pk1/6p1/7p/3R3P/5PK1/8/8 w - - 0 38',
      goal: 'Dùng xe cắt vua và gom tốt.'
    },
    {
      title: 'Hậu hóa tốt',
      fen: '8/2k5/8/2P5/2K5/8/8/8 w - - 0 55',
      goal: 'Tìm đường đưa vua hộ tống tốt phong cấp.'
    },
    {
      title: 'Tượng và tốt cánh vua',
      fen: '8/5pk1/6p1/7p/3B3P/5PK1/8/8 w - - 0 46',
      goal: 'Giữ tốt và cải thiện vua trước khi đẩy.'
    },
    {
      title: 'Xe hoạt động sau lưng tốt',
      fen: '8/5pk1/6p1/3R3p/7P/5PK1/8/8 b - - 0 41',
      goal: 'Phòng thủ chủ động, đừng để vua bị cắt.'
    }
  ]
};

export function coachLessonFromMode(coachMode) {
  const behavior = coachBehaviorFromMode(coachMode);
  const positions = COACH_LESSON_POSITIONS[behavior.start] ?? [];
  if (!positions.length) {
    return {
      kind: behavior.start,
      title: COACH_MODES.find((mode) => mode.id === coachMode)?.label ?? 'Cơ bản',
      fen: null,
      playerColor: 'w',
      variant: 'standard',
      goal: coachMode === 'opening'
        ? 'Đi theo nguyên tắc khai cuộc và so với Stockfish.'
        : 'Chơi ván đầy đủ và để Stockfish sửa từng nước.'
    };
  }

  const lesson = positions[Math.floor(Math.random() * positions.length)];
  return {
    ...lesson,
    kind: behavior.start,
    playerColor: lesson.fen.split(/\s+/)[1] === 'b' ? 'b' : 'w',
    variant: 'lesson'
  };
}

export const COACH_LEVELS = [
  { elo: 1320, label: 'Người dẫn nhập' },
  { elo: 1600, label: 'Người gác chiến thuật' },
  { elo: 2000, label: 'Chuyên gia khai cuộc' },
  { elo: 2400, label: 'Bậc thầy trung cuộc' },
  { elo: 2800, label: 'Đại sư phân tích' },
  { elo: 3190, label: 'Đối thủ 3190 Elo' }
];

function coachAvatarImage() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="shirt" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#e8f0e5"/>
          <stop offset="1" stop-color="#304a39"/>
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="18" fill="#557245"/>
      <circle cx="48" cy="38" r="22" fill="#b98258"/>
      <path d="M24 86c3-19 14-29 24-29s21 10 24 29z" fill="url(#shirt)"/>
      <path d="M27 34c2-17 13-25 22-25 13 0 23 10 21 27-9-8-24-12-43-2z" fill="#5a351f"/>
      <path d="M26 42c3 21 12 31 22 31s19-10 22-31c-8 8-36 8-44 0z" fill="#6b4028"/>
      <circle cx="39" cy="39" r="3" fill="#241a13"/>
      <circle cx="57" cy="39" r="3" fill="#241a13"/>
      <path d="M39 54c5 5 14 5 19 0" fill="none" stroke="#fff4e8" stroke-width="4" stroke-linecap="round"/>
      <path d="M34 31c8-5 20-5 29 0" fill="none" stroke="#3a2216" stroke-width="5" stroke-linecap="round"/>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const COACH_AVATAR = coachAvatarImage();

export function coachDifficultyFromElo(elo) {
  if (elo <= 1320) return 'Dẫn nhập';
  if (elo <= 1600) return 'Chiến thuật';
  if (elo <= 2000) return 'Khai cuộc';
  if (elo <= 2400) return 'Trung cuộc';
  if (elo <= 2800) return 'Phân tích sâu';
  return 'Tối thượng';
}

const PRINCIPLES = {
  basic: 'Trước nước tiếp theo, kiểm tra quân bị tấn công và sự an toàn của vua.',
  opening: 'Hãy phát triển quân nhẹ, kiểm soát trung tâm và chuẩn bị nhập thành.',
  middlegame: 'Thử xét các nước chiếu, ăn quân và đe dọa; tính cả phản ứng của đối thủ.',
  endgame: 'Chú ý đường đi của vua, tốt thông và ô phong cấp trước khi đổi quân.'
};

function finite(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

export function buildCoachInsight({ analysis, latestMove, playerColor, aiElo, coachMode, lesson }) {
  const mode = COACH_MODES.find((item) => item.id === coachMode) || COACH_MODES[0];
  const behavior = coachBehaviorFromMode(coachMode);
  const difficulty = coachDifficultyFromElo(Number(aiElo));
  const plan = lesson?.goal || PRINCIPLES[mode.id];
  const base = { mode, behavior, difficulty, plan, evaluation: '', bestMove: '', loss: '', warning: '' };
  const result = (tone, quality, messages, voiceMessages = messages, extra = {}) => ({
    ...base, tone, quality, messages, voiceMessages, message: messages[0], ...extra
  });
  if (!latestMove) return result('excellent', 'Sẵn sàng', [
    'Mình sẽ cùng bạn luyện tập và nhận xét từng nước đi bằng tiếng Việt.', plan
  ]);
  if (latestMove.color !== playerColor) return result('good', 'Tới lượt bạn', [
    'Đối thủ vừa đi ' + latestMove.san + '. Hãy kiểm tra đe dọa trước khi đáp lại.', PRINCIPLES[mode.id]
  ]);
  if (!analysis?.tone) return result('loading', 'Đang phân tích', [
    'Đang xem xét nước ' + latestMove.san + ' của bạn. Bạn có thể tiếp tục chơi.'
  ], []);
  const quality = reviewLabel(analysis.tone);
  const messages = ['Nước ' + latestMove.san + ': ' + quality.toLowerCase() + ' theo kết quả phân tích.'];
  let bestMove = analysis.bestSan || analysis.bestMove || '';
  if (!analysis.bestSan && (latestMove.before || analysis.fen) && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(bestMove)) {
    try {
      const board = new Chess(latestMove.before || analysis.fen);
      bestMove = board.move({from:bestMove.slice(0,2),to:bestMove.slice(2,4),promotion:bestMove[4]})?.san || bestMove;
    } catch { /* A missing position keeps the engine coordinate notation intact. */ }
  }
  const lan = latestMove.from + latestMove.to + (latestMove.promotion || '');
  const isAlternative = bestMove && bestMove !== latestMove.san && bestMove !== lan;
  const loss = finite(analysis.winLoss)
    ? 'Chỉ số cơ hội thắng giảm khoảng ' + Math.max(0, Number(analysis.winLoss)).toFixed(1) + ' điểm phần trăm.'
    : finite(analysis.centipawnLoss)
      ? 'Đánh giá giảm khoảng ' + (Math.max(0, Number(analysis.centipawnLoss)) / 100).toFixed(2) + ' điểm tốt.' : '';
  if (loss && ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(analysis.tone)) messages.push(loss);
  if (isAlternative) messages.push('Thử so sánh với ' + bestMove + ': đối thủ có thể đáp lại thế nào?');
  else messages.push(PRINCIPLES[mode.id]);
  const score = analysis.whiteScore;
  const evaluation = finite(score) ? Math.abs(Number(score)) > 90000 ? (Number(score) > 0 ? 'Chiếu hết cho Trắng' : 'Chiếu hết cho Đen') : (Number(score) > 0 ? '+' : '') + (Number(score) / 100).toFixed(2) : '';
  return result(analysis.tone, quality, messages, messages, {
    evaluation, bestMove: isAlternative ? bestMove : '', loss,
    warning: ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(analysis.tone) ? 'Nước đáng xem lại' : 'Nhận xét nước đi'
  });
}
