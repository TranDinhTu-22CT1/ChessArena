import { Chess } from 'chess.js';
import { CHESS_OPENINGS } from '../data/chessOpenings.generated.js';
import {
  CHESS_PLAYERS,
  CHESS_PLAYER_DATA_UPDATED_AT
} from '../data/chessPlayers.js';

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export const CLASSIC_CHESS_GAMES = [
  {
    players: 'Adolf Anderssen - Lionel Kieseritzky',
    event: 'Ván cờ Bất tử, London 1851',
    lesson: 'Thí cả hai xe và hậu để phối hợp các quân nhẹ chiếu hết.'
  },
  {
    players: 'Paul Morphy - Công tước Karl / Bá tước Isouard',
    event: 'Ván Opera, Paris 1858',
    lesson: 'Phát triển quân nhanh, mở cột trung tâm và hy sinh để kết thúc khi vua đối thủ chưa an toàn.'
  },
  {
    players: 'Donald Byrne - Bobby Fischer',
    event: 'Ván cờ của thế kỷ, New York 1956',
    lesson: 'Fischer thí hậu để giành thế chủ động lâu dài và phối hợp quân chính xác.'
  },
  {
    players: 'Boris Spassky - David Bronstein',
    event: 'Leningrad 1960',
    lesson: 'Đòn tấn công trực tiếp lên vua từ Gambit Vua, thường được gọi là ván cờ James Bond.'
  },
  {
    players: 'Garry Kasparov - Veselin Topalov',
    event: 'Wijk aan Zee 1999',
    lesson: 'Chuỗi thí quân sâu và cuộc săn vua kéo dài, nổi tiếng với nước Rxd4.'
  },
  {
    players: 'Magnus Carlsen - Sergey Karjakin',
    event: 'Tranh vô địch thế giới, tie-break ván 4, 2016',
    lesson: 'Đòn kết thúc Qh6+ đẹp mắt, kết hợp ghim quân và mạng chiếu hết.'
  },
  {
    players: 'Hikaru Nakamura - Boris Gelfand',
    event: 'World Team Championship 2010',
    lesson: 'Thế trận chủ động và khả năng tính toán chiến thuật mạnh trong cấu trúc phức tạp.'
  },
  {
    players: 'Lê Quang Liêm - Peter Svidler',
    event: 'World Blitz Championship 2013',
    lesson: 'Ví dụ tiêu biểu cho tốc độ tính toán và kỹ năng thực chiến cờ chớp của Lê Quang Liêm.'
  }
];

function safeChess(fen) {
  try {
    return fen ? new Chess(fen) : new Chess();
  } catch {
    return new Chess();
  }
}

export function describeGameStage(fen) {
  const chess = safeChess(fen);
  const fullmove = Number(chess.fen().split(/\s+/)[5]) || 1;
  let pieces = 0;
  let queens = 0;
  let nonPawnMaterial = 0;

  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue;
      pieces += 1;
      if (piece.type === 'q') queens += 1;
      if (!['p', 'k'].includes(piece.type)) nonPawnMaterial += PIECE_VALUE[piece.type] || 0;
    }
  }

  let id = 'middlegame';
  let label = 'Trung cuộc';
  let focus = 'Tìm nước ép buộc, đánh giá an toàn vua, quân yếu, cột mở, ô yếu và kế hoạch cải thiện quân kém hoạt động.';

  if (fullmove <= 10 && pieces >= 26) {
    id = 'opening';
    label = 'Khai cuộc';
    focus = 'Ưu tiên kiểm soát trung tâm, phát triển quân nhẹ, nhập thành và tránh đi một quân nhiều lần khi chưa cần thiết.';
  } else if (queens === 0 || pieces <= 12 || nonPawnMaterial <= 18) {
    id = 'endgame';
    label = 'Tàn cuộc';
    focus = 'Kích hoạt vua, tạo tốt thông, tính ô phong cấp, đặt xe sau tốt thông và kiểm tra thế đối vua.';
  }

  return { id, label, focus, fullmove, pieces, queens, nonPawnMaterial };
}

export function classicGamesAnswer(question) {
  const text = String(question || '').toLowerCase();
  const gamePhrase = '(van co|ván cờ|van dau|ván đấu|tran co|trận cờ|ban co|bàn cờ)';
  const qualityPhrase = '(hay|noi tieng|nổi tiếng|kinh dien|kinh điển)';
  const asksForGames = new RegExp(`${gamePhrase}.*${qualityPhrase}`).test(text)
    || new RegExp(`${qualityPhrase}.*${gamePhrase}`).test(text);
  if (!asksForGames) return '';

  const surname = ['anderssen', 'morphy', 'fischer', 'spassky', 'bronstein', 'kasparov', 'topalov', 'carlsen', 'karjakin', 'nakamura', 'gelfand', 'le quang liem', 'lê quang liêm', 'svidler']
    .find((name) => text.includes(name));
  const matches = surname
    ? CLASSIC_CHESS_GAMES.filter((game) => game.players.toLowerCase().includes(surname))
    : CLASSIC_CHESS_GAMES.slice(0, 5);
  if (!matches.length) return '';

  return [
    'Một số ván cờ kinh điển bạn có thể tìm và học:',
    ...matches.map((game, index) => `${index + 1}. ${game.players} - ${game.event}\nBài học: ${game.lesson}`)
  ].join('\n');
}

const OPENING_ALIASES = [
  { aliases: ['italy', 'italian', 'italian game', 'khai cuoc y', 'van co y'], query: 'italian game' },
  { aliases: ['sicilian', 'sicilian defense', 'phong thu sicilia'], query: 'sicilian defense' },
  { aliases: ['ruy lopez', 'spanish game', 'khai cuoc tay ban nha'], query: 'ruy lopez' },
  { aliases: ['french defense', 'phong thu phap'], query: 'french defense' },
  { aliases: ['caro kann', 'caro-kann'], query: 'caro-kann defense' },
  { aliases: ['queens gambit', "queen's gambit", 'gambit hau'], query: "queen's gambit" },
  { aliases: ['kings gambit', "king's gambit", 'gambit vua'], query: "king's gambit" },
  { aliases: ['kings indian', "king's indian", 'phong thu an do'], query: "king's indian defense" },
  { aliases: ['nimzo indian', 'nimzo-indian'], query: 'nimzo-indian defense' },
  { aliases: ['london system', 'he thong london'], query: 'london system' },
  { aliases: ['english opening', 'khai cuoc anh'], query: 'english opening' },
  { aliases: ['scotch game', 'khai cuoc scotland'], query: 'scotch game' },
  { aliases: ['vienna game', 'khai cuoc vienna'], query: 'vienna game' },
  { aliases: ['catalan', 'catalan opening'], query: 'catalan opening' },
  { aliases: ['pirc', 'pirc defense'], query: 'pirc defense' },
  { aliases: ['alekhine defense', 'phong thu alekhine'], query: "alekhine's defense" }
];

const OPENING_GUIDANCE = [
  {
    match: 'italian game',
    text: 'Ý tưởng chính: phát triển nhanh Tượng c4, nhập thành sớm và chuẩn bị c3-d4 để tranh trung tâm. Hãy để ý các đòn ...Nf6, ...Bc5 và chiến thuật tại f7.'
  },
  {
    match: 'sicilian defense',
    text: 'Ý tưởng chính: Đen dùng ...c5 để tạo thế bất đối xứng. Trắng thường có không gian và cơ hội tấn công vua; Đen phản công ở cột c và cánh Hậu.'
  },
  {
    match: 'ruy lopez',
    text: 'Ý tưởng chính: Trắng gây sức ép lên Mã c6 và tốt e5, sau đó nhập thành và xây trung tâm. Đây là khai cuộc chiến lược với rất nhiều nhánh sâu.'
  },
  {
    match: 'french defense',
    text: 'Ý tưởng chính: Đen đánh ...e6 và thường phản công trung tâm bằng ...c5. Trắng có nhiều không gian hơn nhưng cần bảo vệ chuỗi tốt d4-e5.'
  },
  {
    match: 'caro-kann defense',
    text: 'Ý tưởng chính: Đen xây trung tâm chắc bằng ...c6 và ...d5, thường đưa Tượng c8 ra ngoài chuỗi tốt trước khi chơi ...e6.'
  },
  {
    match: "queen's gambit",
    text: 'Ý tưởng chính: Trắng dùng tốt c4 gây sức ép lên d5 để chiếm trung tâm. Đây không phải là mất tốt bắt buộc; mục tiêu chính là phát triển và kiểm soát không gian.'
  },
  {
    match: "king's indian defense",
    text: 'Ý tưởng chính: Đen nhường trung tâm trước rồi phản công bằng ...e5 hoặc ...c5. Trắng thường mở rộng cánh Hậu, còn Đen tìm cơ hội tấn công vua.'
  }
];

function normalizeKnowledgeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/gi, 'd')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesPhrase(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\W)${escaped}(?=\\W|$)`, 'i').test(text);
}

function resolvedOpeningQuery(question) {
  const text = normalizeKnowledgeText(question);
  const aliasMatch = OPENING_ALIASES
    .flatMap((entry) => entry.aliases.map((alias) => ({
      alias: normalizeKnowledgeText(alias),
      query: entry.query
    })))
    .filter((entry) => includesPhrase(text, entry.alias))
    .sort((left, right) => right.alias.length - left.alias.length)[0];

  let query = text
    .replace(/\b(khai cuoc|bien the|bien|variation|la gi|nhu the nao|cach choi|gioi thieu|cho toi biet|huong dan|tim hieu|ve)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (aliasMatch) query = query.replace(aliasMatch.alias, aliasMatch.query);
  return query.replace(/\s+/g, ' ').trim();
}

function openingScore(opening, query) {
  const name = normalizeKnowledgeText(opening.name);
  if (!query) return 0;
  if (name === query) return 1000;
  if (name.startsWith(`${query}:`)) return 900;
  if (name.startsWith(query)) return 800;
  if (name.includes(query)) return 650;

  const tokens = query.split(' ').filter((token) => token.length > 2);
  if (!tokens.length) return 0;
  const matchingTokens = tokens.filter((token) => name.includes(token)).length;
  return matchingTokens === tokens.length ? 400 + matchingTokens : 0;
}

export function findOpeningKnowledge(question, limit = 5) {
  const query = resolvedOpeningQuery(question);
  if (!query || query.length < 3) return [];

  const seen = new Set();
  return CHESS_OPENINGS
    .map((opening) => ({ opening, score: openingScore(opening, query) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => (
      right.score - left.score
      || left.opening.name.length - right.opening.name.length
      || left.opening.name.localeCompare(right.opening.name)
    ))
    .filter(({ opening }) => {
      const key = normalizeKnowledgeText(opening.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(1, Math.min(Number(limit) || 5, 8)))
    .map(({ opening }) => opening);
}

export function isOpeningKnowledgeQuestion(question) {
  const text = normalizeKnowledgeText(question);
  if (OPENING_ALIASES.some((entry) => entry.aliases.some((alias) => includesPhrase(text, normalizeKnowledgeText(alias))))) {
    return true;
  }
  if (/\b(khai cuoc|opening|bien the|variation|gambit|defense)\b/.test(text)) {
    return findOpeningKnowledge(question, 1).length > 0;
  }
  return false;
}

export function openingKnowledgeAnswer(question) {
  if (!isOpeningKnowledgeQuestion(question)) return '';
  const matches = findOpeningKnowledge(question, 5);
  if (!matches.length) return '';

  const rootName = normalizeKnowledgeText(matches[0].name).split(':')[0];
  const guidance = OPENING_GUIDANCE.find((entry) => rootName.includes(entry.match))?.text
    || 'Nguyên tắc học: hiểu mục tiêu của từng nước, phát triển quân, kiểm soát trung tâm và giữ vua an toàn thay vì chỉ học thuộc chuỗi nước đi.';

  return [
    `${matches[0].name} là một khai cuộc cờ vua có mã ECO ${matches[0].eco}.`,
    `Nước đi nền tảng: ${matches[0].pgn}`,
    guidance,
    '',
    'Một số biến thể trong dữ liệu:',
    ...matches.slice(1).map((opening, index) => `${index + 1}. ${opening.name} (${opening.eco})\nNước đi: ${opening.pgn}`)
  ].filter(Boolean).join('\n');
}

export function findChessPlayer(question) {
  const text = normalizeKnowledgeText(question);
  if (!text) return null;

  return CHESS_PLAYERS
    .map((player) => ({
      player,
      aliasLength: Math.max(...player.aliases
        .filter((alias) => includesPhrase(text, normalizeKnowledgeText(alias)))
        .map((alias) => alias.length), 0)
    }))
    .filter((entry) => entry.aliasLength > 0)
    .sort((left, right) => right.aliasLength - left.aliasLength)[0]?.player || null;
}

export function playerKnowledgeAnswer(question) {
  const player = findChessPlayer(question);
  if (!player) return '';

  const lifetime = player.died
    ? `Sinh năm ${player.born}, mất năm ${player.died}`
    : `Sinh năm ${player.born}`;
  return [
    `${player.name} là kỳ thủ cờ vua người ${player.country}. ${lifetime}.`,
    `Danh hiệu: ${player.titles.join('; ')}.`,
    `Thành tích nổi bật: ${player.highlights.join('; ')}.`,
    `Phong cách: ${player.style}`,
    player.currentNote || '',
    `Dữ liệu hồ sơ được rà soát đến ${CHESS_PLAYER_DATA_UPDATED_AT}; rating và thứ hạng hiện hành có thể thay đổi theo danh sách FIDE hàng tháng.`
  ].filter(Boolean).join('\n');
}
