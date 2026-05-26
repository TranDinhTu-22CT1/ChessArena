export const COACH_MODES = [
  { id: 'beginner', label: 'Cơ bản', focus: 'Nền tảng', depth: 'Nhắc quân treo, nhập thành và kiểm soát trung tâm.' },
  { id: 'tactical', label: 'Chiến thuật', focus: 'Đòn phối hợp', depth: 'Tìm đòn đôi, ghim, xiên và mối đe dọa chiếu hết.' },
  { id: 'positional', label: 'Thế trận', focus: 'Kế hoạch', depth: 'Đánh giá không gian, cấu trúc tốt và ô yếu.' },
  { id: 'aggressive', label: 'Tấn công', focus: 'Áp lực vua', depth: 'Ưu tiên thế chủ động và đưa thêm quân vào tấn công vua.' },
  { id: 'endgame', label: 'Tàn cuộc', focus: 'Kỹ thuật', depth: 'Đưa vua lên, tạo tốt thông và đổi quân đúng lúc.' },
  { id: 'silent', label: 'Ít lời', focus: 'Cảnh báo', depth: 'Chỉ nhắc khi có sai lầm hoặc cơ hội lớn.' }
];

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
    '{move} có thể mất quân, mất vua an toàn hoặc mất thế chủ động.',
    'Đây là lỗi lớn. Hãy tìm nước phòng thủ đơn giản nhất.',
    'Sau {move}, mục tiêu là giảm thiệt hại trước.',
    'Nước này để đối thủ có đòn cụ thể. Hãy kiểm tra mọi nước chiếu.',
    '{move} làm thế cờ xấu nhanh. Bình tĩnh và tìm nước cầm máu.',
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

  if (!latestMove) {
    const firstLine = renderCoachLine(pickCoachTemplate('ready', historyLength, latestMove), { move: moveSan });
    const secondLine = renderCoachLine(pickCoachTemplate('plan', historyLength, latestMove, 1), { move: moveSan });
    return {
      tone: 'excellent',
      quality: 'Sẵn sàng',
      evaluation: '0.0',
      messages: [firstLine, secondLine],
      message: firstLine,
      warning: 'Vị trí bắt đầu',
      plan: 'Phát triển quân nhẹ, tranh trung tâm và giữ vua an toàn.',
      difficulty,
      mode
    };
  }

  if (latestMove.color !== playerColor) {
    const firstLine = renderCoachLine(pickCoachTemplate('opponent', historyLength, latestMove), { move: moveSan });
    const secondLine = renderCoachLine(pickCoachTemplate('plan', historyLength, latestMove, 2), { move: moveSan });
    return {
      tone: 'good',
      quality: 'Tới lượt bạn',
      evaluation: scoreText,
      messages: [firstLine, secondLine],
      message: firstLine,
      warning: 'Đối thủ vừa đi',
      plan: mode.id === 'aggressive'
        ? 'Nếu vua đối thủ yếu, hãy đưa thêm một quân tham gia trước khi mở đường tấn công.'
        : 'Quét theo thứ tự: chiếu, ăn quân, đe dọa. Sau đó mới chọn nước yên tĩnh.',
      difficulty,
      mode
    };
  }

  if (!analysis?.tone) {
    const firstLine = renderCoachLine(pickCoachTemplate('pending', historyLength, latestMove), { move: moveSan });
    const secondLine = renderCoachLine(pickCoachTemplate('plan', historyLength, latestMove, 3), { move: moveSan });
    return {
      tone: 'good',
      quality: 'Đợi kết quả',
      evaluation: '',
      messages: [firstLine, secondLine],
      message: firstLine,
      warning: 'Đang chờ phân tích',
      plan: mode.depth,
      difficulty,
      mode
    };
  }

  const tone = analysis.tone;
  const quality = analysis.label ?? 'Ổn';
  const firstLine = renderCoachLine(pickCoachTemplate(tone, historyLength, latestMove), { move: moveSan, detail, best: bestText });
  const bestLine = renderCoachLine(pickCoachTemplate(tone === 'best' ? 'plan' : tone, historyLength, latestMove, 4), { move: moveSan, detail, best: bestText });
  const planLine = renderCoachLine(pickCoachTemplate('plan', historyLength, latestMove, 5), { move: moveSan, detail, best: bestText });

  return {
    tone,
    quality,
    evaluation: scoreText,
    messages: [firstLine, tone === 'best' || tone === 'excellent' ? planLine : bestLine],
    message: firstLine,
    warning: ['mistake', 'blunder', 'miss', 'inaccuracy'].includes(tone) ? 'Thời điểm quan trọng' : 'Thế cờ ổn định',
    plan: mode.depth,
    difficulty,
    mode
  };
}
