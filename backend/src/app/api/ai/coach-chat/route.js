import { Chess } from 'chess.js';
import { rateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../lib/online';
import { readJsonPayload } from '../../../../lib/validation';

export const runtime = 'nodejs';

const PROVIDER_DEFAULT_ORDER = ['gemini', 'groq', 'openrouter', 'local'];
const OPENROUTER_DEFAULT_MODELS = [
  'deepseek/deepseek-chat-v3-0324:free',
  'google/gemma-3-27b-it:free',
  'qwen/qwen3-32b:free'
];
const CHESS_TERMS = [
  'co vua', 'nuoc', 'the co', 'fen', 'pgn', 'chieu', 'het co', 'khai cuoc',
  'trung cuoc', 'tan cuoc', 'tot', 'ma', 'tuong', 'xe', 'hau', 'vua',
  'castle', 'nhap thanh', 'en passant', 'phong cap', 'tactic', 'chien thuat',
  'blunder', 'mistake', 'best move', 'engine', 'stockfish', 'checkmate',
  'stalemate', 'draw', 'hoa', 'pin', 'fork', 'skewer', 'mate', 'elo'
];
const SAFE_SMALL_TALK = ['xin chao', 'hello', 'hi', 'chao', 'cam on'];
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

function isChessRelated(question, gameContext) {
  const text = normalized(question);
  if (SAFE_SMALL_TALK.some((term) => text.includes(term))) return true;
  if (gameContext?.fen || gameContext?.pgn || gameContext?.recentMoves?.length) return true;
  return CHESS_TERMS.some((term) => text.includes(term));
}

function refusalMessage(kind = 'offtopic') {
  if (kind === 'abuse') {
    return 'Minh chi ho tro trao doi co vua theo huong ton trong. Minh khong tra loi noi dung xuc pham, ky thi, phan biet vung mien hoac chung toc. Hay hoi ve the co, nuoc di, chien thuat hoac luat co.';
  }
  return 'Minh la AI Coach cua ChessArena nen chi tra loi cau hoi lien quan den co vua: the co, nuoc di, luat, chien thuat, khai cuoc, trung cuoc, tan cuoc hoac review van.';
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
  if (diff > 0) return `Trang hon khoang ${diff} diem vat chat.`;
  if (diff < 0) return `Den hon khoang ${Math.abs(diff)} diem vat chat.`;
  return 'Vat chat dang can bang hoac gan can bang.';
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
  const best = review.bestMove ? ` Goi y tot hon: ${review.bestMove}.` : '';
  if (['blunder', 'mistake', 'miss'].includes(review.tone)) {
    return `Review cho thay nuoc vua roi co van de (${review.label || review.tone}).${best}`;
  }
  if (['best', 'great', 'brilliant', 'excellent', 'book'].includes(review.tone)) {
    return `Review danh gia nuoc vua roi la ${review.label || review.tone}.${best}`;
  }
  return `Review hien tai: ${review.label || review.tone}.${best}`;
}

function localCoachAnswer(question, gameContext) {
  const text = normalized(question);
  const chess = parseChess(gameContext.fen);
  const turn = chess.turn() === 'w' ? 'Trang' : 'Den';
  const legalMoves = chess.moves();
  const picks = candidateMoves(chess);
  const latest = gameContext.latestMove ? `Nuoc moi nhat: ${gameContext.latestMove}. ` : '';
  const review = reviewLine(gameContext.review);

  if (SAFE_SMALL_TALK.some((term) => text.includes(term))) {
    return 'Chao ban. Minh la AI Coach mien phi cua ChessArena. Ban co the hoi: phan tich the co, nen di gi tiep, nuoc vua roi sai o dau, hoac giai thich luat nhap thanh/phong cap.';
  }

  if (text.includes('luat') || text.includes('rule') || text.includes('nhap thanh') || text.includes('phong cap') || text.includes('en passant')) {
    return 'Ve luat co: hay noi ro luat ban can hoi. Nhap thanh can vua va xe chua di chuyen, duong di khong bi chan, vua khong dang bi chieu va khong di qua o bi kiem soat. Phong cap xay ra khi tot toi hang cuoi, thuong nen phong Hau neu khong co tactic dac biet.';
  }

  if (text.includes('sai') || text.includes('loi') || text.includes('mistake') || text.includes('blunder')) {
    return `${latest}${review || 'Hay kiem tra 3 dieu: vua co bi yeu khong, co quan nao dang treo khong, va doi thu co don chieu/an/de doa truc tiep khong.'} Neu muon sua, hay so sanh voi cac nuoc ung vien: ${picks.join(', ') || 'chua co nuoc hop le'}.`;
  }

  if (text.includes('tiep') || text.includes('di gi') || text.includes('best') || text.includes('candidate') || text.includes('nen')) {
    if (chess.isGameOver()) return 'Van da ket thuc. Hay chuyen sang review de xem buoc ngoat chinh va tao bai tap tu cac loi lon.';
    return `${turn} dang di. Cac nuoc ung vien thuc dung: ${picks.join(', ') || 'khong co nuoc hop le'}. Truoc khi chon, uu tien: an toan vua, nuoc chieu/an quan, quan dang bi tan cong, roi moi den ke hoach dai han.`;
  }

  if (text.includes('ke hoach') || text.includes('plan') || text.includes('chien luoc')) {
    return `${materialSummary(chess)} Ke hoach ngan han: 1) kiem tra moi nuoc chieu va an quan, 2) cai thien quan kem hoat dong, 3) tranh de vua bi mo. Neu hon vat chat, doi quan va giam phan cong; neu kem, tim tactic hoac tao de doa len vua doi thu.`;
  }

  if (text.includes('khai cuoc') || text.includes('opening')) {
    return 'Khai cuoc nen giu 4 nguyen tac: chiem trung tam, phat trien ma/tuong som, nhap thanh an toan, khong di mot quan qua nhieu lan. Neu doi thu tan cong som, dung tham tot; hay hoan tat phat trien va giu vua an toan.';
  }

  if (text.includes('tan cuoc') || text.includes('endgame')) {
    return 'Tan cuoc: kich hoat vua, tao tot thong, dat xe sau tot thong, va tinh o phong cap. Neu hon tot, doi quan nhung khong doi het tot. Neu kem, tim the doi vua, chieu vinh vien hoac phong cap doi ung.';
  }

  if (text.includes('chien thuat') || text.includes('tactic') || text.includes('fork') || text.includes('pin')) {
    return `Checklist chien thuat: tim chieu truoc, roi an quan, roi de doa. Voi the hien tai, hay soi cac nuoc ung vien ${picks.join(', ') || 'hop le'} va hoi: nuoc do co tao fork, ghim quan, xien, hoac don bat Hau/Vua khong.`;
  }

  return `${latest}${review ? `${review} ` : ''}${turn} dang di. ${materialSummary(chess)} Co ${legalMoves.length} nuoc hop le. Huong phan tich nhanh: kiem tra an toan vua, quan dang treo, cac nuoc chieu/an quan, roi chon ke hoach cai thien quan yeu nhat.`;
}

function systemPrompt() {
  return [
    'You are ChessArena AI Coach, a concise Vietnamese chess coach.',
    'Answer only chess-related questions. Refuse off-topic questions briefly.',
    'Never produce insults, slurs, hate, regional discrimination, racial discrimination, or demeaning stereotypes.',
    'Answer in Vietnamese. Keep replies under 140 words unless the user asks for detail.',
    'Use the provided FEN, PGN, recent moves, and review data when relevant.',
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
  return cleanText(data?.choices?.[0]?.message?.content, 1600);
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
  const model = cleanText(process.env.GEMINI_CHAT_MODEL || 'gemini-1.5-flash', 120);
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
  const answer = cleanText((data?.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('\n'), 1600);
  if (!answer) throw new Error('Gemini returned an empty answer.');
  return answer;
}

async function callGroq(args) {
  return callOpenAiCompatible({
    name: 'Groq',
    baseUrl: process.env.GROQ_API_BASE || 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
    model: cleanText(process.env.GROQ_CHAT_MODEL || 'deepseek-r1-distill-llama-70b', 120),
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
  const blocked = rateLimit(request, { scope: 'ai-coach-chat', limit: 20, windowMs: 60_000 });
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

  const result = await answerWithFailover({ context, gameContext, priorMessages, question });
  return Response.json({ ok: true, ...result });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
