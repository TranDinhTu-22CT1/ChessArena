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
      goal: behavior.start === 'opening'
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
  { elo: 1320, label: 'Stockfish Club' },
  { elo: 1600, label: 'Stockfish Strong' },
  { elo: 2000, label: 'Stockfish Expert' },
  { elo: 2400, label: 'Stockfish Master' },
  { elo: 2800, label: 'Stockfish Elite' },
  { elo: 3190, label: 'Stockfish Maximum' }
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
  if (elo <= 1320) return 'Club';
  if (elo <= 1600) return 'Strong';
  if (elo <= 2000) return 'Expert';
  if (elo <= 2400) return 'Master';
  if (elo <= 2800) return 'Elite';
  return 'Maximum';
}

const COACH_LINE_BANK = {
  brilliant: [
    '{move} là Brilliant: Stockfish xác nhận ý tưởng hy sinh vẫn giữ lợi thế thắng.',
    'Brilliant với {move}. Bạn đã tìm được nước mạnh dù chấp nhận để đối thủ ăn vật chất.'
  ],
  great: [
    '{move} là Great: nước tốt nhất trong một vị trí có lợi thế quyết định.',
    'Great move với {move}. Stockfish cho thấy áp lực của bạn đã rất lớn.'
  ],
  book: [
    '{move} là nước Book, nằm trong kho khai cuộc chuẩn đang được dùng.',
    'Book move: {move}. Bạn vẫn đang đi theo lý thuyết khai cuộc mạnh.'
  ],
  ready: [
    'Mình sẽ dùng Stockfish để soi từng nước của bạn, không đoán mò.',
    'Đi nước đầu tiên đi, mình sẽ đánh giá theo thế cờ thật trên bàn.',
    'Bắt đầu từ trung tâm, phát triển quân nhẹ và giữ vua an toàn.',
    'Mình sẽ nhắc khi có quân treo, nước ép buộc hoặc cơ hội chiến thuật.',
    'Trước mỗi nước hãy quét nhanh: chiếu, ăn quân, đe dọa.',
    'Ván này mình sẽ ưu tiên chỉ ra lý do nước đi tốt hoặc chưa tốt.',
    'Đừng chỉ nhìn nước hay nhất; hãy hiểu vì sao nó hay.',
    'Nếu có sai lầm, mình sẽ nói thẳng điểm yếu vừa xuất hiện.',
    'Nếu bạn đi đúng hướng, mình sẽ chỉ ra điểm mạnh của kế hoạch.',
    'Mục tiêu là chơi chắc hơn sau mỗi nước, không chỉ thắng ván này.',
    'Hãy bắt đầu bằng một nước có mục đích rõ ràng.',
    'Mình đang sẵn sàng phân tích từng nước bằng engine.'
  ],
  opponent: [
    '{move} vừa đổi cấu trúc thế cờ. Trước khi đáp lại, hãy tìm đe dọa trực tiếp nhất.',
    'Sau {move}, kiểm tra xem quân nào của bạn đang bị tấn công hoặc bị ghim.',
    '{move} đặt câu hỏi vào vị trí của bạn. Đừng trả lời bằng cảm tính.',
    'Đối thủ vừa đi {move}. Hãy tìm nước chiếu, nước ăn quân và nước phòng thủ chủ động.',
    'Sau {move}, nếu có thể giành tempo thì ưu tiên nước ép buộc.',
    '{move} có thể mở đường cho một ý đồ mới. Hãy xác định quân nào vừa được kích hoạt.',
    'Đừng vội phản công sau {move}; đầu tiên phải biết mình đang bị dọa gì.',
    '{move} làm thay đổi ô yếu. Nhìn lại các ô quanh vua và trung tâm.',
    'Sau {move}, nước tốt thường là nước vừa hóa giải đe dọa vừa cải thiện quân.',
    'Đối thủ vừa tạo nhịp bằng {move}. Nếu bạn bỏ qua đe dọa, thế cờ có thể xấu nhanh.',
    '{move} không chỉ là một nước đi; nó có thể là bước đầu của kế hoạch.',
    'Hãy hỏi: sau {move}, đối thủ muốn đi gì tiếp theo?',
    'Nếu {move} tấn công quân của bạn, đừng chỉ chạy quân; tìm nước phản công có tempo.',
    'Sau {move}, kiểm tra hàng ngang, đường chéo và cột mở quanh vua.',
    'Nếu thế cờ căng sau {move}, ưu tiên nước đơn giản và chắc.',
    '{move} khiến bạn phải tính cụ thể. Đừng chọn nước đẹp nếu bỏ quên quân treo.',
    'Vị trí sau {move} cần được xử lý bằng thứ tự rõ ràng: vua, quân treo, trung tâm.',
    'Hãy dùng {move} như tín hiệu để rà lại toàn bộ mối đe dọa.'
  ],
  pending: [
    'Hãy so {move} với các nước chiếu, ăn quân và đe dọa trực tiếp.',
    'Câu hỏi chính của {move}: nước này tạo thêm hoạt động hay để lộ điểm yếu?',
    'Sau {move}, hãy tự kiểm tra quân treo trước khi chọn kế hoạch tiếp.',
    'Nếu có nước ép buộc tốt hơn {move}, nó thường bắt đầu bằng chiếu hoặc ăn quân.',
    'Sau {move}, nhìn xem vua của hai bên có an toàn không.',
    'Thử tìm ứng viên khác có tempo thay vì chỉ nhìn một nước.',
    '{move} cần được so với nước phát triển quân hoặc nhập thành.',
    'Hãy xem {move} có làm quân nào bị quá tải không.',
    'Tạm thời đánh giá cấu trúc tốt và ô yếu sau {move}.',
    '{move} có thể liên quan tới chiến thuật, nên hãy rà đường chéo và cột mở.',
    'Nếu điểm số đổi mạnh sau {move}, thường có một đòn chiến thuật bị bỏ sót.',
    'Sau {move}, hãy tìm nước vừa phòng thủ vừa tạo đe dọa.'
  ],
  best: [
    '{move} trùng hướng Stockfish. Nước này giữ thế chủ động và không cho phản công rõ.',
    'Rất chuẩn: {move} xử lý đúng yêu cầu của vị trí.',
    '{move} là lựa chọn sạch. Bạn không tạo điểm yếu mới.',
    'Stockfish đồng ý với {move}; kế hoạch này đáng tin.',
    '{move} giữ nhịp tốt và không bỏ sót đe dọa chính.',
    'Nước {move} rất chính xác, đặc biệt vì nó giữ quân phối hợp.',
    'Bạn chọn đúng nước then chốt với {move}.',
    '{move} là nước có tính kỹ thuật: ít rủi ro, hiệu quả rõ.',
    'Đây là nước tốt nhất hoặc gần nhất với tốt nhất: {move}.',
    '{move} cho thấy bạn đã nhìn đúng trọng tâm thế cờ.',
    'Nước này không màu mè nhưng rất mạnh: {move}.',
    '{move} giữ quyền kiểm soát các ô quan trọng.'
  ],
  excellent: [
    '{move} rất tốt. {detail}',
    'Nước {move} cải thiện vị trí mà không làm yếu vua.',
    '{move} là nước chắc, giữ cấu trúc khỏe và quân phối hợp.',
    'Tốt lắm: {move} giữ thế cờ ổn định.',
    '{move} không hẳn là tuyệt đối nhất, nhưng rất thực chiến.',
    'Bạn đang đi đúng hướng với {move}.',
    '{move} làm quân của bạn hoạt động tốt hơn.',
    'Nước này hợp lý vì nó không cho đối thủ mục tiêu dễ đánh.',
    '{move} giữ áp lực vừa đủ mà không quá mạo hiểm.',
    'Đây là lựa chọn rất lành mạnh: {move}.',
    '{move} giúp thế cờ dễ chơi hơn ở nước tiếp theo.',
    'Stockfish đánh giá {move} là nước mạnh, sai số rất nhỏ.'
  ],
  good: [
    '{move} chơi được. {detail}',
    '{move} giữ thế cờ trong vùng an toàn, nhưng có thể còn nước chủ động hơn.',
    'Nước này ổn, nhưng hãy hỏi xem quân xấu nhất của bạn đã được cải thiện chưa.',
    '{move} không phá thế, tuy nhiên chưa gây nhiều vấn đề cho đối thủ.',
    'Bạn vẫn giữ được nhịp sau {move}.',
    '{move} là nước thực chiến được, miễn là kế hoạch tiếp theo rõ ràng.',
    'Ổn với {move}; bây giờ cần chú ý phản ứng của đối thủ.',
    '{move} không phải lỗi lớn. Hãy tiếp tục quét nước ép buộc.',
    'Nước này giữ thế cân bằng nhưng chưa tối đa hóa áp lực.',
    '{move} là lựa chọn bình tĩnh, phù hợp nếu bạn muốn chơi chắc.',
    'Sau {move}, hãy theo dõi quân nào có thể bị quá tải.',
    'Nước {move} chấp nhận được, nhưng đừng tự động lặp kế hoạch cũ.'
  ],
  inaccuracy: [
    '{move} hơi thiếu chính xác. {detail}',
    'Với {move}, bạn nhường một phần nhịp cho đối thủ.',
    '{move} vẫn chơi được, nhưng có vẻ bỏ qua một nước ép buộc hơn.',
    'Nước này hơi chậm; hãy xem lại các nước chiếu và ăn quân.',
    '{move} cho đối thủ thêm khoảng thở.',
    'Bạn chưa thua gì ngay sau {move}, nhưng lợi thế bị giảm.',
    '{move} làm kế hoạch của bạn kém sắc hơn một chút.',
    'Ở vị trí này, {move} có thể chưa giải quyết đe dọa chính.',
    'Nước {move} cần được kiểm tra lại vì nó không tạo tempo rõ.',
    'Hãy cẩn thận: {move} có thể để lại ô yếu hoặc quân treo.',
    'Sau {move}, đối thủ có nhiều lựa chọn dễ chịu hơn.',
    'Đây là sai số nhỏ, nhưng lặp lại nhiều lần sẽ thành vấn đề.'
  ],
  mistake: [
    '{move} là sai lầm thực chiến. {detail}',
    'Cẩn thận: {move} cho đối thủ cơ hội cụ thể.',
    'Sau {move}, hãy tìm cách giảm thiệt hại thay vì tiếp tục tấn công.',
    'Nước này làm mất kiểm soát một ô hoặc một quân quan trọng.',
    '{move} có vẻ bỏ quên một đe dọa trực tiếp.',
    'Bạn cần dừng lại sau {move} và rà lại quân nào đang bị treo.',
    'Nước {move} làm thế cờ khó phòng thủ hơn.',
    'Đây là lúc nên chọn nước đơn giản để ổn định lại.',
    '{move} cho đối thủ một nhịp rõ ràng. Hãy tìm nước phòng thủ chủ động.',
    'Sai lầm ở đây thường đến từ việc bỏ qua nước ép buộc của đối thủ.',
    'Sau {move}, ưu tiên an toàn vua và quân bị tấn công.',
    'Đừng cố sửa bằng nước đẹp; hãy sửa bằng nước chắc.'
  ],
  miss: [
    '{move} bỏ lỡ cơ hội lớn. {best}',
    'Ở đây bạn có nước mạnh hơn {move}. Hãy tìm nước chiếu, ăn quân hoặc đe dọa trước.',
    '{move} để thời điểm trôi qua; vị trí có ý tưởng sắc hơn.',
    'Bạn vừa bỏ qua một cơ hội tạo áp lực thật sự.',
    'Sau {move}, đối thủ có thể thoát khỏi thế khó.',
    'Nước này không tận dụng hết vấn đề của đối thủ.',
    'Có vẻ bạn đã chọn nước yên tĩnh khi vị trí cần nước ép buộc.',
    '{move} làm mất tempo quan trọng trong một thế cờ đang có cơ hội.',
    'Hãy xem lại ứng viên forcing; Stockfish cho thấy có cơ hội tốt hơn.',
    'Bạn cần luyện thói quen kiểm tra nước mạnh trước nước đẹp.',
    '{move} không tệ về hình thức, nhưng bỏ lỡ trọng tâm chiến thuật.',
    'Đây là kiểu cơ hội cần bắt ngay, vì một nước sau có thể biến mất.'
  ],
  blunder: [
    '{move} là blunder. {detail}',
    'Nước này nguy hiểm: {move} cho đối thủ lợi thế lớn.',
    'Sau {move}, hãy ưu tiên cứu vua hoặc cứu quân quan trọng.',
    'Đừng tiếp tục kế hoạch cũ; vị trí đã đổi nghiêm trọng.',
    '{move} có thể mất quân, vua không an toàn hoặc mất thế chủ động.',
    'Đây là lỗi lớn. Hãy tìm nước phòng thủ tốt hơn.',
    'Sau {move}, mục tiêu là giảm thiệt hại trước.',
    'Hãy kiểm tra mọi nước chiếu.',
    '{move} làm thế cờ xấu nhanh. Bình tĩnh và tìm nước tốt hơn.',
    'Nếu còn cơ hội đổi quân để giảm áp lực, hãy cân nhắc ngay.',
    'Blunder thường đến từ bỏ sót quân không được bảo vệ; hãy rà lại toàn bàn.',
    'Sau lỗi này, đừng đánh theo cảm xúc. Chọn nước chắc nhất.'
  ],
  plan: [
    'Kế hoạch tiếp theo: cải thiện quân kém hoạt động nhất.',
    'Nếu không có chiến thuật, hãy tăng kiểm soát trung tâm.',
    'Nhìn lại an toàn vua trước khi mở thêm đường.',
    'Ưu tiên quân treo và ô yếu hơn là nước tấn công xa.',
    'Nếu đối thủ có vua yếu, hãy đưa thêm quân vào trước khi hy sinh.',
    'Nếu đang hơn vật chất, đổi quân là một kế hoạch hợp lý.',
    'Nếu đang kém thế, tìm phản công có tempo thay vì phòng thủ bị động.',
    'Hãy đặt câu hỏi: nước tiếp theo của đối thủ là gì?',
    'Tìm nước vừa phòng thủ vừa tạo đe dọa.',
    'Đừng di chuyển cùng một quân nhiều lần nếu quân khác chưa phát triển.',
    'Khi vị trí kín, cải thiện quân xấu nhất thường tốt hơn lao vào ăn tốt.',
    'Khi vị trí mở, an toàn vua và đường chéo quan trọng hơn.'
  ],
  opening: [
    'Chế độ khai cuộc: phát triển quân nhẹ, tranh trung tâm và nhập thành đúng lúc.',
    'Đừng đi cùng một quân quá nhiều lần nếu quân khác còn ngủ ở hàng đầu.',
    'Nếu Stockfish chọn nước khai cuộc khác, hãy xem nó kiểm soát trung tâm hay mở đường cho quân nào.'
  ],
  principle: [
    'Ưu tiên phát triển quân nhẹ, nhập thành và tranh trung tâm trước khi săn tốt.',
    'Hãy kiểm tra quân đang bị treo trước; một nước chắc thường tốt hơn một nước đẹp.',
    'Nếu chưa có chiến thuật rõ, cải thiện quân kém hoạt động nhất là lựa chọn đúng.'
  ],
  safety: [
    'Trước nước tiếp theo, rà vua của bạn, quân bị tấn công và các ô quanh vua.',
    'Đừng để một quân không được bảo vệ đứng trên đường mở.',
    'Nếu đối thủ vừa tạo đe dọa, hãy hóa giải bằng nước có tempo nếu có thể.'
  ],
  tactics: [
    'Chế độ chiến thuật: kiểm tra theo thứ tự chiếu, ăn quân, đe dọa trước mọi nước yên tĩnh.',
    'Tìm đòn ghim, xiên, quá tải hoặc nước trung gian trước khi quyết định.',
    'Nếu Stockfish chênh lớn với nước bạn đi, thường có một nước ép buộc bị bỏ sót.'
  ],
  forcing: [
    'Ưu tiên candidate forcing: chiếu, ăn quân, đe dọa trực tiếp.',
    'Hãy tính phản ứng bắt buộc của đối thủ thay vì chỉ nhìn nước đầu tiên.',
    'Một nước mạnh phải khiến đối thủ trả lời câu hỏi cụ thể ngay lập tức.'
  ],
  positional: [
    'Chế độ thế trận: nhìn cấu trúc tốt, ô yếu và quân xấu nhất trước.',
    'Nếu không có chiến thuật, hãy tăng áp lực lên ô yếu hoặc cột mở.',
    'Đừng đổi quân tốt lấy quân xấu nếu điều đó làm kế hoạch dài hạn kém đi.'
  ],
  attack: [
    'Chế độ tấn công: chỉ mở đường khi đã có đủ quân tham gia.',
    'Nếu vua đối thủ yếu, đưa thêm quân vào vùng tấn công trước khi hy sinh.',
    'Tạo đe dọa liên tục quan trọng hơn một nước ăn vật chất chậm.'
  ],
  endgame: [
    'Chế độ tàn cuộc: kích hoạt vua, tạo tốt thông và tính ô phong cấp.',
    'Trong tàn cuộc, mỗi tempo rất đắt; hãy tránh nước quân lặp lại không cần thiết.',
    'Nếu hơn vật chất, đổi quân nhưng giữ tốt; nếu kém, tìm phản công bằng tốt thông.'
  ],
  conversion: [
    'Chuyển lợi thế thành thắng bằng cách giảm phản công trước rồi mới ăn thêm.',
    'Đặt quân sau tốt thông và đưa vua tới trung tâm.',
    'Khi hơn quân, ép đổi hậu thường làm nhiệm vụ dễ hơn.'
  ],
  critical: [
    'Chỉ nhắc điểm quan trọng: nước này cần xem lại ngay.',
    'Có tín hiệu lớn từ Stockfish; hãy dừng và kiểm tra nước ép buộc.',
    'Vị trí vừa đổi mạnh, ưu tiên sửa lỗi cụ thể trước.'
  ]
};

function renderCoachLine(template, values) {
  return template
    .replaceAll('{move}', values.move || 'nước vừa rồi')
    .replaceAll('{detail}', values.detail || '')
    .replaceAll('{best}', values.best || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickCoachTemplate(group, historyLength, latestMove, offset = 0) {
  const lines = COACH_LINE_BANK[group] ?? COACH_LINE_BANK.good;
  const seed = `${historyLength}-${latestMove?.san || ''}-${latestMove?.from || ''}${latestMove?.to || ''}-${group}-${offset}`;
  const hash = Array.from(seed).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 1000003, 17);
  return lines[hash % lines.length];
}

function formatEngineScore(score) {
  if (!Number.isFinite(Number(score))) return '';
  const pawns = Number(score) / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

export function buildCoachInsight({ analysis, latestMove, historyLength, playerColor, aiElo, coachMode }) {
  const mode = COACH_MODES.find((item) => item.id === coachMode) ?? COACH_MODES[0];
  const behavior = coachBehaviorFromMode(coachMode);
  const difficulty = coachDifficultyFromElo(Number(aiElo));
  const moveSan = latestMove?.san || 'nước vừa rồi';
  const bestMove = analysis?.bestMove || analysis?.bestSan || '';
  const loss = Number(analysis?.winLoss ?? analysis?.centipawnLoss);
  const scoreText = formatEngineScore(analysis?.whiteScore ?? analysis?.score);
  const detail = Number.isFinite(loss)
    ? loss < 20
      ? 'Stockfish cho thấy nước này gần như không làm mất chất lượng thế cờ.'
      : `Stockfish ước tính bạn nhường khoảng ${loss.toFixed(loss > 30 ? 0 : 1)}${analysis?.winLoss !== undefined ? '% cơ hội thắng' : ' centipawn'}.`
    : 'Stockfish vẫn xem thế cờ này là có thể chơi được.';
  const bestText = bestMove && latestMove && !String(bestMove).startsWith(`${latestMove.from}${latestMove.to}`)
    ? `Stockfish gợi ý ${bestMove}; hãy so sánh xem nước đó tạo hoặc chặn đe dọa gì.`
    : 'Nước của bạn đáp ứng khá tốt yêu cầu của vị trí.';
  const modeGroup = behavior.messageGroups[historyLength % behavior.messageGroups.length] ?? 'plan';
  const modeLine = renderCoachLine(pickCoachTemplate(modeGroup, historyLength, latestMove, 9), { move: moveSan, detail, best: bestText });
  const isCriticalTone = ['brilliant', 'great', 'miss', 'blunder', 'mistake'].includes(analysis?.tone);
  const shouldShowMessage = behavior.speech !== 'critical' || !latestMove || isCriticalTone;

  if (!latestMove) {
    const firstLine = renderCoachLine(pickCoachTemplate('ready', historyLength, latestMove), { move: moveSan });
    const secondLine = modeLine || renderCoachLine(pickCoachTemplate('plan', historyLength, latestMove, 1), { move: moveSan });
    return {
      tone: 'excellent',
      quality: 'Sẵn sàng',
      evaluation: '0.0',
      messages: shouldShowMessage ? [firstLine, secondLine] : ['Ít lời: mình đang theo dõi và sẽ nhắc khi có lỗi lớn hoặc cơ hội rõ ràng.'],
      voiceMessages: shouldShowMessage ? [firstLine, secondLine] : [],
      message: firstLine,
      warning: 'Vị trí bắt đầu',
      plan: 'Phát triển quân nhẹ, tranh trung tâm và giữ vua an toàn.',
      difficulty,
      mode,
      behavior
    };
  }

  if (latestMove.color !== playerColor) {
    const firstLine = renderCoachLine(pickCoachTemplate('opponent', historyLength, latestMove), { move: moveSan });
    const secondLine = modeLine || renderCoachLine(pickCoachTemplate('plan', historyLength, latestMove, 2), { move: moveSan });
    return {
      tone: 'good',
      quality: 'Tới lượt bạn',
      evaluation: scoreText,
      messages: shouldShowMessage ? [firstLine, secondLine] : ['Ít lời: tới lượt bạn, hãy tự quét chiếu, ăn quân và đe dọa.'],
      voiceMessages: shouldShowMessage ? [firstLine, secondLine] : [],
      message: firstLine,
      warning: 'Đối thủ vừa đi',
      plan: mode.id === 'middlegame'
        ? 'Tìm nước ép buộc trước: chiếu, ăn quân, đe dọa. Sau đó mới chọn kế hoạch yên tĩnh.'
        : mode.depth,
      difficulty,
      mode,
      behavior
    };
  }

  if (!analysis?.tone) {
    const firstLine = renderCoachLine(pickCoachTemplate('pending', historyLength, latestMove), { move: moveSan });
    const secondLine = modeLine || renderCoachLine(pickCoachTemplate('plan', historyLength, latestMove, 3), { move: moveSan });
    return {
      tone: 'good',
      quality: 'Đợi kết quả',
      evaluation: '',
      messages: shouldShowMessage ? [firstLine, secondLine] : ['Ít lời: đang phân tích, mình chỉ báo khi có điểm quan trọng.'],
      voiceMessages: shouldShowMessage ? [firstLine, secondLine] : [],
      message: firstLine,
      warning: 'Đang chờ phân tích',
      plan: mode.depth,
      difficulty,
      mode,
      behavior
    };
  }

  const tone = analysis.tone;
  const quality = analysis.label ?? 'Ổn';
  const firstLine = renderCoachLine(pickCoachTemplate(tone, historyLength, latestMove), { move: moveSan, detail, best: bestText });
  const bestLine = renderCoachLine(pickCoachTemplate(tone === 'best' ? 'plan' : tone, historyLength, latestMove, 4), { move: moveSan, detail, best: bestText });
  const planLine = modeLine || renderCoachLine(pickCoachTemplate('plan', historyLength, latestMove, 5), { move: moveSan, detail, best: bestText });

  return {
    tone,
    quality,
    evaluation: scoreText,
    messages: shouldShowMessage ? [firstLine, tone === 'best' || tone === 'excellent' ? planLine : bestLine] : ['Ít lời: nước ổn, tiếp tục chơi.'],
    voiceMessages: shouldShowMessage ? [firstLine, tone === 'best' || tone === 'excellent' ? planLine : bestLine] : [],
    message: firstLine,
    warning: ['mistake', 'blunder', 'miss', 'inaccuracy'].includes(tone) ? 'Thời điểm quan trọng' : 'Thế cờ ổn định',
    plan: mode.depth,
    difficulty,
    mode,
    behavior
  };
}
