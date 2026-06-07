import { Chess } from 'chess.js';
import { distributedRateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../lib/online';
import { readJsonPayload } from '../../../../lib/validation';

export const runtime = 'nodejs';

const PROVIDER_DEFAULT_ORDER = ['openrouter', 'gemini', 'groq', 'local'];
const OPENROUTER_DEFAULT_MODELS = [
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free'
];
const CHESS_TERMS = [
  'co vua', 'nuoc', 'the co', 'fen', 'pgn', 'chieu', 'het co', 'khai cuoc',
  'trung cuoc', 'tan cuoc', 'tot', 'ma', 'tuong', 'xe', 'hau', 'vua',
  'castle', 'nhap thanh', 'en passant', 'phong cap', 'tactic', 'chien thuat',
  'blunder', 'mistake', 'best move', 'engine', 'stockfish', 'checkmate',
  'stalemate', 'draw', 'hoa', 'pin', 'fork', 'skewer', 'mate', 'elo'
];
const NATURAL_CHESS_PHRASES = [
  'choi co', 'hoc co', 'tap co', 'luyen co', 'cach choi co',
  'moi choi co', 'moi hoc co', 'choi the nao'
];
const SUPPORT_TERMS = [
  'ho tro', 'support', 'tro giup', 'help', 'loi', 'bug', 'ket noi', 'lag',
  'dang nhap', 'dang ky', 'otp', 'email', 'mat khau', 'tai khoan', 'profile',
  'membership', 'premium', 'thanh toan', 'paypal', 'momo', 'hoa don', 'gia han',
  'huy goi', 'refund', 'hoan tien', 'ban be', 'friend', 'online', 'matchmaking',
  'giai dau', 'tournament', 'puzzle', 'rating', 'lich su', 'lich su dau', 'admin',
  'bao cao', 'report', 'kiem duyet', 'chat'
];
const ADMIN_CONTACT_ANSWER = [
  'Ch\u1ee7 s\u1edf h\u1eefu d\u1ef1 \u00e1n ChessArena l\u00e0 Tr\u1ea7n \u0110\u00ecnh T\u00fa.',
  '',
  'N\u1ebfu b\u1ea1n c\u1ea7n x\u00e1c minh th\u00f4ng tin d\u1ef1 \u00e1n ho\u1eb7c li\u00ean h\u1ec7 tr\u1ef1c ti\u1ebfp, h\u00e3y nh\u1eafn qua Zalo theo s\u1ed1 0816931074.',
  'V\u1edbi l\u1ed7i t\u00e0i kho\u1ea3n, thanh to\u00e1n ho\u1eb7c khi\u1ebfu n\u1ea1i, b\u1ea1n n\u00ean t\u1ea1o ticket h\u1ed7 tr\u1ee3 \u0111\u1ec3 admin c\u00f3 \u0111\u1ee7 th\u00f4ng tin x\u1eed l\u00fd.'
].join('\n');
const PAYMENT_GUIDE_ANSWER = [
  'C\u00e1ch thanh to\u00e1n PayPal tr\u00ean ChessArena:',
  '1. V\u00e0o trang Membership v\u00e0 ch\u1ecdn g\u00f3i mu\u1ed1n mua.',
  '2. Ch\u1ecdn chu k\u1ef3 thanh to\u00e1n r\u1ed3i b\u1ea5m thanh to\u00e1n b\u1eb1ng PayPal.',
  '3. Khi PayPal m\u1edf ra, \u0111\u0103ng nh\u1eadp b\u1eb1ng t\u00e0i kho\u1ea3n ng\u01b0\u1eddi mua do ChessArena cung c\u1ea5p. Kh\u00f4ng d\u00f9ng t\u00e0i kho\u1ea3n merchant/seller.',
  '4. X\u00e1c nh\u1eadn thanh to\u00e1n tr\u00ean PayPal, sau \u0111\u00f3 quay l\u1ea1i ChessArena \u0111\u1ec3 h\u1ec7 th\u1ed1ng c\u1eadp nh\u1eadt g\u00f3i.',
  'N\u1ebfu thanh to\u00e1n xong m\u00e0 g\u00f3i ch\u01b0a l\u00ean, h\u00e3y g\u1eedi ticket k\u00e8m email t\u00e0i kho\u1ea3n, g\u00f3i \u0111\u00e3 mua, th\u1eddi \u0111i\u1ec3m v\u00e0 m\u00e3 giao d\u1ecbch PayPal.'
].join('\n');
const SAFE_SMALL_TALK_PATTERNS = [
  /\b(xin chao|hello|hi|chao|cam on)\b/,
  /^(alo|hey|yo)$/
];
const ABUSE_PATTERNS = [
  /phan\s*biet/i,
  /chung\s*toc/i,
  /vung\s*mien/i,
  /ky\s*thi/i,
  /miet\s*thi/i,
  /xuc\s*pham/i,
  /racis[mt]/i,
  /racial/i,
  /hate\s*speech/i,
  /dan\s+\w+\s+(ngu|do|ban|hen)/i,
  /(da\s+den|da\s+trang|da\s+vang)\s+(ngu|do|ban|hen)/i
];
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function cleanText(value, limit = 1200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function cleanProviderAnswer(value) {
  return cleanText(String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/<think>[\s\S]*/gi, ' '), 1600);
}

function normalized(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function cleanMessages(messages) {
  return Array.isArray(messages)
    ? messages.slice(-8).map((message) => ({
      role: message?.role === 'assistant' ? 'assistant' : 'user',
      content: cleanText(message?.content, 900)
    })).filter((message) => message.content)
    : [];
}

function cleanGameContext(context = {}) {
  return {
    route: cleanText(context.route, 80),
    mode: cleanText(context.mode, 80),
    assistantMode: cleanText(context.assistantMode, 40),
    hasBoardContext: Boolean(context.hasBoardContext && context.fen),
    fen: cleanText(context.fen, 160),
    pgn: cleanText(context.pgn, 1800),
    turn: cleanText(context.turn, 20),
    playerColor: cleanText(context.playerColor, 20),
    latestMove: cleanText(context.latestMove, 120),
    recentMoves: Array.isArray(context.recentMoves)
      ? context.recentMoves.slice(-12).map((move) => cleanText(move, 80)).filter(Boolean)
      : [],
    review: {
      label: cleanText(context.review?.label, 80),
      tone: cleanText(context.review?.tone, 80),
      bestMove: cleanText(context.review?.bestMove, 20),
      centipawnLoss: Number.isFinite(Number(context.review?.centipawnLoss)) ? Number(context.review.centipawnLoss) : null,
      winLoss: Number.isFinite(Number(context.review?.winLoss)) ? Number(context.review.winLoss) : null
    }
  };
}

function hasAbuseIntent(text) {
  const plain = normalized(text);
  return ABUSE_PATTERNS.some((pattern) => pattern.test(plain));
}

function isSmallTalk(text) {
  const plain = normalized(text);
  return SAFE_SMALL_TALK_PATTERNS.some((pattern) => pattern.test(plain));
}

function deterministicSupportAnswer(question) {
  const text = normalized(question);
  const asksAdminIdentity = text.includes('admin')
    && (
      text.includes('la ai')
      || text.includes('ai la admin')
      || text.includes('thong tin admin')
      || text.includes('lien he admin')
      || text.includes('sdt admin')
      || text.includes('email admin')
      || text.includes('owner')
      || text.includes('chu web')
    );
  if (asksAdminIdentity) return ADMIN_CONTACT_ANSWER;

  const asksPaymentGuide = (text.includes('thanh toan') || text.includes('paypal') || text.includes('membership'))
    && (
      text.includes('lam sao')
      || text.includes('cach')
      || text.includes('huong dan')
      || text.includes('quy trinh')
      || text.includes('the nao')
      || text.includes('tai khoan nao')
    );
  if (asksPaymentGuide) return PAYMENT_GUIDE_ANSWER;

  return '';
}

function isChessRelated(question, gameContext) {
  const text = normalized(question);
  if (isSmallTalk(text)) return true;
  if (SUPPORT_TERMS.some((term) => text.includes(term))) return true;
  if (gameContext?.assistantMode === 'support') return CHESS_TERMS.some((term) => text.includes(term));
  if (gameContext?.hasBoardContext || gameContext?.fen || gameContext?.pgn || gameContext?.recentMoves?.length) return true;
  return CHESS_TERMS.some((term) => text.includes(term))
    || NATURAL_CHESS_PHRASES.some((phrase) => text.includes(phrase));
}

function refusalMessage(kind = 'offtopic') {
  if (kind === 'abuse') {
    return 'Mình chỉ hỗ trợ trao đổi cờ vua theo hướng tôn trọng. Mình không trả lời nội dung xúc phạm, kỳ thị, phân biệt vùng miền hoặc chủng tộc. Bạn có thể hỏi về thế cờ, nước đi, chiến thuật hoặc luật cờ.';
  }
  return 'Mình là trợ lý ChessArena nên chỉ trả lời câu hỏi liên quan đến cờ vua hoặc hỗ trợ sử dụng ChessArena: ván cờ, luật, chiến thuật, tài khoản, thanh toán, kết nối, bạn bè, giải đấu, puzzle hoặc báo lỗi.';
}

function parseChess(fen) {
  try {
    return fen ? new Chess(fen) : new Chess();
  } catch {
    return new Chess();
  }
}

function materialSummary(chess) {
  const totals = { w: 0, b: 0 };
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue;
      totals[piece.color] += PIECE_VALUES[piece.type] || 0;
    }
  }
  const diff = totals.w - totals.b;
  if (diff > 0) return `Trắng hơn khoảng ${diff} điểm vật chất.`;
  if (diff < 0) return `Đen hơn khoảng ${Math.abs(diff)} điểm vật chất.`;
  return 'Vật chất đang cân bằng hoặc gần cân bằng.';
}

function moveScore(move) {
  let score = 0;
  if (move.flags.includes('c')) score += 8 + (PIECE_VALUES[move.captured] || 0);
  if (move.san.includes('+')) score += 6;
  if (move.san.includes('#')) score += 100;
  if (move.promotion) score += 12;
  if (['e4', 'd4', 'e5', 'd5', 'c4', 'f4', 'c5', 'f5'].includes(move.to)) score += 3;
  if (['n', 'b'].includes(move.piece)) score += 2;
  if (move.san === 'O-O' || move.san === 'O-O-O') score += 4;
  return score;
}

function candidateMoves(chess, count = 3) {
  return chess.moves({ verbose: true })
    .map((move) => ({ san: move.san, score: moveScore(move) }))
    .sort((a, b) => b.score - a.score || a.san.localeCompare(b.san))
    .slice(0, count)
    .map((move) => move.san);
}

function reviewLine(review) {
  if (!review?.tone) return '';
  const best = review.bestMove ? ` Gợi ý tốt hơn: ${review.bestMove}.` : '';
  if (['blunder', 'mistake', 'miss'].includes(review.tone)) {
    return `Review cho thấy nước vừa rồi có vấn đề (${review.label || review.tone}).${best}`;
  }
  if (['best', 'great', 'brilliant', 'excellent', 'book'].includes(review.tone)) {
    return `Review đánh giá nước vừa rồi là ${review.label || review.tone}.${best}`;
  }
  return `Review hiện tại: ${review.label || review.tone}.${best}`;
}

function localCoachAnswer(question, gameContext) {
  const text = normalized(question);
  const deterministicAnswer = deterministicSupportAnswer(question);
  if (deterministicAnswer) return deterministicAnswer;

  if (gameContext.assistantMode === 'support' || SUPPORT_TERMS.some((term) => text.includes(term))) {
    if (text.includes('thanh toan') || text.includes('paypal') || text.includes('momo') || text.includes('membership') || text.includes('premium') || text.includes('refund') || text.includes('hoan tien') || text.includes('huy goi')) {
      return 'Về thanh toán/gói thành viên: hãy kiểm tra trạng thái gói trong trang Membership, lịch sử giao dịch PayPal/MoMo, và email xác nhận. Nếu tiền đã trừ nhưng gói chưa lên, hãy gửi mã giao dịch, email tài khoản và thời điểm thanh toán cho owner/admin để đối soát. Mình không tự xử lý hoàn tiền hoặc thay đổi gói thay bạn.';
    }
    if (text.includes('dang nhap') || text.includes('otp') || text.includes('mat khau') || text.includes('email') || text.includes('tai khoan')) {
      return 'Về đăng nhập/tài khoản: kiểm tra đúng email, thử gửi lại OTP, xem hộp thư spam, rồi đăng xuất và đăng nhập lại. Nếu vẫn lỗi, ghi lại email tài khoản, thời điểm lỗi và ảnh chụp màn hình để owner/admin kiểm tra. Đừng gửi mật khẩu hoặc mã OTP cho bất kỳ ai.';
    }
    if (text.includes('ket noi') || text.includes('lag') || text.includes('online') || text.includes('matchmaking')) {
      return 'Về lỗi kết nối/online: thử refresh trang, kiểm tra mạng, đăng nhập lại, rồi tạo lại phòng hoặc tìm trận mới. Nếu lỗi lặp lại, gửi thời điểm, chế độ chơi, ID ván nếu có, và mô tả nước đi cuối cùng để admin kiểm tra log.';
    }
    if (text.includes('puzzle') || text.includes('rating') || text.includes('lich su')) {
      return 'Về puzzle/rating/lịch sử: hãy kiểm tra lại đúng tài khoản, refresh dữ liệu và xem trang lịch sử. Nếu điểm hoặc lịch sử hiển thị sai, gửi ảnh chụp, thời điểm xảy ra và tên chế độ để admin đối chiếu dữ liệu.';
    }
    if (text.includes('bao cao') || text.includes('report') || text.includes('kiem duyet') || text.includes('chat')) {
      return 'Về báo cáo người chơi/chat: hãy dùng nút report nếu có, kèm tên người chơi, thời điểm, ván đấu và ảnh chụp nội dung vi phạm. Mình có thể hướng dẫn cách mô tả sự việc, nhưng quyết định xử lý thuộc owner/admin.';
    }
    return 'Mình có thể hỗ trợ nhanh về ChessArena: tài khoản/OTP, thanh toán Membership, lỗi kết nối online, bạn bè, giải đấu, puzzle, rating và báo cáo vi phạm. Hãy mô tả cụ thể bạn đang ở trang nào, thao tác nào bị lỗi, thông báo lỗi là gì và thời điểm xảy ra.';
  }

  const wantsBoardContext = text.includes('hien tai')
    || text.includes('the co')
    || text.includes('fen')
    || text.includes('pgn')
    || text.includes('nuoc tiep')
    || text.includes('toi vua sai')
    || text.includes('ke hoach 3');
  if (!gameContext.hasBoardContext && wantsBoardContext) {
    return 'Mình chưa có dữ liệu bàn cờ hiện tại trong ngữ cảnh này. Hãy mở ván cờ hoặc trang Review rồi hỏi lại, hoặc gửi FEN/PGN cụ thể. Nếu chưa có ván, mình có thể hướng dẫn checklist phân tích: an toàn vua, quân đang treo, nước chiếu/ăn quân, rồi kế hoạch cải thiện quân yếu.';
  }

  const chess = parseChess(gameContext.fen);
  const turn = chess.turn() === 'w' ? 'Trắng' : 'Đen';
  const legalMoves = chess.moves();
  const picks = candidateMoves(chess);
  const latest = gameContext.latestMove ? `Nước mới nhất: ${gameContext.latestMove}. ` : '';
  const review = reviewLine(gameContext.review);

  if (isSmallTalk(text)) {
    return 'Chào bạn. Mình là AI Coach miễn phí của ChessArena. Bạn có thể hỏi: phân tích thế cờ, nên đi gì tiếp, nước vừa rồi sai ở đâu, hoặc giải thích luật nhập thành/phong cấp.';
  }

  if (text.includes('phan tich') || text.includes('the co') || text.includes('hien tai') || text.includes('position')) {
    if (chess.isCheckmate()) return `${turn} đã bị chiếu hết. Hãy vào phần review để xem nước quyết định và bài học chính.`;
    if (chess.isDraw()) return 'Ván đang ở trạng thái hòa theo luật hiện tại. Nên kiểm tra xem đó là hết nước đi, lặp lại thế cờ, 50 nước hay thiếu lực chiếu hết.';
    const check = chess.inCheck() ? `${turn} đang bị chiếu, ưu tiên thoát chiếu hợp lệ trước. ` : '';
    return `${latest}${check}${turn} đang đi. ${materialSummary(chess)} Có ${legalMoves.length} nước hợp lệ. Nước ứng viên thực dụng: ${picks.join(', ') || 'không có nước hợp lệ'}. Hướng phân tích: kiểm tra an toàn vua, quân đang bị treo, nước chiếu/ăn quân, rồi mới chọn kế hoạch cải thiện quân yếu nhất.`;
  }

  if (text.includes('luat') || text.includes('rule') || text.includes('nhap thanh') || text.includes('phong cap') || text.includes('en passant')) {
    return 'Về luật cờ: hãy nói rõ luật bạn cần hỏi. Nhập thành cần vua và xe chưa di chuyển, đường đi không bị chặn, vua không đang bị chiếu và không đi qua ô bị kiểm soát. Phong cấp xảy ra khi tốt tới hàng cuối, thường nên phong Hậu nếu không có chiến thuật đặc biệt.';
  }

  if (text.includes('sai') || text.includes('loi') || text.includes('mistake') || text.includes('blunder')) {
    return `${latest}${review || 'Hãy kiểm tra 3 điều: vua có bị yếu không, có quân nào đang treo không, và đối thủ có đòn chiếu/ăn/đe dọa trực tiếp không.'} Nếu muốn sửa, hãy so sánh với các nước ứng viên: ${picks.join(', ') || 'chưa có nước hợp lệ'}.`;
  }

  if (text.includes('tiep') || text.includes('di gi') || text.includes('best') || text.includes('candidate') || text.includes('nen')) {
    if (chess.isGameOver()) return 'Ván đã kết thúc. Hãy chuyển sang review để xem bước ngoặt chính và tạo bài tập từ các lỗi lớn.';
    return `${turn} đang đi. Các nước ứng viên thực dụng: ${picks.join(', ') || 'không có nước hợp lệ'}. Trước khi chọn, ưu tiên: an toàn vua, nước chiếu/ăn quân, quân đang bị tấn công, rồi mới đến kế hoạch dài hạn.`;
  }

  if (text.includes('ke hoach') || text.includes('plan') || text.includes('chien luoc')) {
    return `${materialSummary(chess)} Kế hoạch ngắn hạn: 1) kiểm tra mọi nước chiếu và ăn quân, 2) cải thiện quân kém hoạt động, 3) tránh để vua bị mở. Nếu hơn vật chất, đổi quân và giảm phản công; nếu kém, tìm chiến thuật hoặc tạo đe dọa lên vua đối thủ.`;
  }

  if (text.includes('khai cuoc') || text.includes('opening')) {
    return 'Khai cuộc nên giữ 4 nguyên tắc: chiếm trung tâm, phát triển mã/tượng sớm, nhập thành an toàn, không đi một quân quá nhiều lần. Nếu đối thủ tấn công sớm, đừng tham tốt; hãy hoàn tất phát triển và giữ vua an toàn.';
  }

  if (text.includes('tan cuoc') || text.includes('endgame')) {
    return 'Tàn cuộc: kích hoạt vua, tạo tốt thông, đặt xe sau tốt thông, và tính ô phong cấp. Nếu hơn tốt, đổi quân nhưng không đổi hết tốt. Nếu kém, tìm thế đối vua, chiếu vĩnh viễn hoặc phong cấp đối ứng.';
  }

  if (text.includes('chien thuat') || text.includes('tactic') || text.includes('fork') || text.includes('pin')) {
    return `Checklist chiến thuật: tìm chiếu trước, rồi ăn quân, rồi đe dọa. Với thế hiện tại, hãy soi các nước ứng viên ${picks.join(', ') || 'hợp lệ'} và hỏi: nước đó có tạo fork, ghim quân, xiên, hoặc đòn bắt Hậu/Vua không.`;
  }

  return `${latest}${review ? `${review} ` : ''}${turn} đang đi. ${materialSummary(chess)} Có ${legalMoves.length} nước hợp lệ. Hướng phân tích nhanh: kiểm tra an toàn vua, quân đang treo, các nước chiếu/ăn quân, rồi chọn kế hoạch cải thiện quân yếu nhất.`;
}

function systemPrompt() {
  return [
    'You are ChessArena Assistant, a concise Vietnamese chess coach and product support assistant.',
    'Answer only chess-related questions or ChessArena product support questions. Refuse unrelated topics briefly.',
    'Never produce insults, slurs, hate, regional discrimination, racial discrimination, or demeaning stereotypes.',
    'Answer in Vietnamese with full Vietnamese diacritics. Do not write unaccented Vietnamese.',
    'Keep replies under 140 words unless the user asks for detail.',
    'Chess glossary: "nhập thành" means castling, the special chess move involving the king and a rook; never interpret it as citizenship, entering a city, or a non-chess topic.',
    'Support policy: for account, payment, refund, moderation, or private user data, give safe troubleshooting steps and tell the user what information to send to an owner/admin. Do not claim you created a ticket, changed an account, refunded money, or accessed private data.',
    'Use the provided FEN, PGN, recent moves, and review data when relevant.',
    'If no board context is provided, do not pretend to know the current position; ask the user to open a game/review or provide FEN/PGN.',
    'Do not claim you calculated with an engine. If engine review is provided, explain it as given.',
    'Focus on chess principles, candidate moves, tactical checks, and practical plans.'
  ].join('\n');
}

function userPrompt({ context, gameContext, priorMessages, question }) {
  return [
    `Player: ${context.user.displayName || context.user.username}`,
    `Game context JSON: ${JSON.stringify(gameContext)}`,
    `Recent chat JSON: ${JSON.stringify(priorMessages)}`,
    `Question: ${question}`
  ].join('\n');
}

function chatMessages(args) {
  return [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: userPrompt(args) }
  ];
}

function extractChatCompletion(data) {
  return cleanProviderAnswer(data?.choices?.[0]?.message?.content);
}

async function callOpenAiCompatible({ name, baseUrl, apiKey, model, messages, extraHeaders = {} }) {
  if (!apiKey || !model) throw new Error(`${name} is not configured.`);
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      max_tokens: 420
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `${name} failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  const answer = extractChatCompletion(data);
  if (!answer) throw new Error(`${name} returned an empty answer.`);
  return answer;
}

async function callGemini({ gameContext, priorMessages, question, context }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = cleanText(process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash', 120);
  if (!apiKey) throw new Error('Gemini is not configured.');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt() }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt({ context, gameContext, priorMessages, question }) }]
        }
      ],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 420
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini failed with HTTP ${response.status}.`);
  }
  const answer = cleanProviderAnswer((data?.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('\n'));
  if (!answer) throw new Error('Gemini returned an empty answer.');
  return answer;
}

async function callGroq(args) {
  return callOpenAiCompatible({
    name: 'Groq',
    baseUrl: process.env.GROQ_API_BASE || 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
    model: cleanText(process.env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile', 120),
    messages: chatMessages(args)
  });
}

function openRouterModels() {
  return String(process.env.OPENROUTER_CHAT_MODELS || process.env.OPENROUTER_CHAT_MODEL || OPENROUTER_DEFAULT_MODELS.join(','))
    .split(',')
    .map((model) => cleanText(model, 140))
    .filter(Boolean);
}

async function callOpenRouter(args) {
  let lastError = null;
  for (const model of openRouterModels()) {
    try {
      return await callOpenAiCompatible({
        name: `OpenRouter ${model}`,
        baseUrl: process.env.OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        model,
        messages: chatMessages(args),
        extraHeaders: {
          'HTTP-Referer': process.env.FRONTEND_URL || 'https://chessarena.local',
          'X-Title': 'ChessArena AI Coach'
        }
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('OpenRouter is not configured.');
}

async function callProvider(provider, args) {
  if (provider === 'gemini') return callGemini(args);
  if (provider === 'groq') return callGroq(args);
  if (provider === 'openrouter') return callOpenRouter(args);
  if (provider === 'local') return localCoachAnswer(args.question, args.gameContext);
  throw new Error(`Unknown AI provider: ${provider}`);
}

function providerOrder() {
  return String(process.env.AI_COACH_PROVIDER_ORDER || PROVIDER_DEFAULT_ORDER.join(','))
    .split(',')
    .map((provider) => cleanText(provider, 32).toLowerCase())
    .filter(Boolean);
}

async function answerWithFailover(args) {
  const provider = cleanText(process.env.AI_COACH_PROVIDER || 'multi', 32).toLowerCase();
  const order = provider === 'multi' ? providerOrder() : [provider, 'local'];
  const tried = [];
  let lastError = null;

  for (const item of [...new Set(order)]) {
    try {
      const answer = await callProvider(item, args);
      if (hasAbuseIntent(answer)) return { answer: refusalMessage('abuse'), model: `${item}-guarded`, tried };
      return { answer, model: item === 'local' ? 'local-chess-coach-v1' : item, tried };
    } catch (error) {
      tried.push({ provider: item, error: cleanText(error.message, 180) });
      lastError = error;
    }
  }

  return {
    answer: localCoachAnswer(args.question, args.gameContext),
    model: 'local-chess-coach-v1',
    tried,
    fallbackReason: lastError?.message || 'All configured providers failed.'
  };
}

export async function POST(request) {
  const configuredLimit = Number.parseInt(process.env.AI_COACH_RATE_LIMIT_PER_MINUTE || '20', 10);
  const requestsPerMinute = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 20;
  const blocked = await distributedRateLimit(request, {
    scope: 'ai-coach-chat',
    limit: requestsPerMinute,
    windowMs: 60_000
  });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });

  const question = cleanText(payload.question, 900);
  if (!question) return Response.json({ ok: false, error: 'Question is required.' }, { status: 400 });

  const gameContext = cleanGameContext(payload.context || {});
  const priorMessages = cleanMessages(payload.messages);
  if (hasAbuseIntent(question)) {
    return Response.json({ ok: true, answer: refusalMessage('abuse'), model: 'local-guardrails' });
  }
  if (!isChessRelated(question, gameContext)) {
    return Response.json({ ok: true, answer: refusalMessage('offtopic'), model: 'local-guardrails' });
  }
  const deterministicAnswer = deterministicSupportAnswer(question);
  if (deterministicAnswer) {
    return Response.json({ ok: true, answer: deterministicAnswer, model: 'local-support' });
  }

  const result = await answerWithFailover({ context, gameContext, priorMessages, question });
  return Response.json({ ok: true, ...result });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
