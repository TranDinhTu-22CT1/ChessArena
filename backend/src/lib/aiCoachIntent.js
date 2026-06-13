export const SUPPORT_TERMS = [
  'ho tro', 'support', 'tro giup', 'help', 'loi', 'bug', 'ket noi', 'lag',
  'dang nhap', 'dang ky', 'otp', 'email', 'mat khau', 'tai khoan', 'profile',
  'membership', 'premium', 'thanh toan', 'paypal', 'momo', 'hoa don', 'gia han',
  'huy goi', 'refund', 'hoan tien', 'mua goi', 'mua hang', 'nang cap',
  'ban be', 'ket ban', 'loi moi ket ban', 'friend', 'online', 'matchmaking',
  'giai dau', 'tournament', 'puzzle', 'rating', 'lich su', 'lich su dau', 'admin',
  'bao cao', 'report', 'kiem duyet', 'chat', 'chuc nang', 'tinh nang',
  'choi voi bot', 'choi online', 'leaderboard', 'achievement', 'coach lab'
];

const CHESS_BIOGRAPHY_TERMS = [
  'ky thu', 'dai kien tuong', 'kien tuong', 'grandmaster', 'woman grandmaster',
  'world chess champion', 'vo dich co vua', 'nha vo dich co vua', 'fide',
  'chess player', 'gm ', 'wgm ', 'im ', 'wim '
];

const NOTABLE_CHESS_PLAYER_NAMES = [
  'adolf anderssen', 'alexander alekhine', 'viswanathan anand', 'levon aronian',
  'mikhail botvinnik', 'fabiano caruana', 'jose capablanca', 'magnus carlsen',
  'ding liren', 'max euwe', 'reuben fine', 'bobby fischer', 'anand',
  'efim geller', 'anisch giri', 'gukesh', 'dommaraju gukesh',
  'hou yifan', 'ju wenjun', 'garry kasparov', 'sergey karjakin', 'anatoly karpov',
  'viktor korchnoi', 'vladimir kramnik', 'bent larsen', 'le quang liem',
  'paul morphy', 'hikaru nakamura', 'ian nepomniachtchi', 'judit polgar',
  'polgar', 'richard reti', 'samuel reshevsky', 'akiba rubinstein',
  'veselin topalov', 'mikhail tal', 'tigran petrosian', 'vasily smyslov',
  'boris spassky', 'wilhelm steinitz', 'wesley so', 'praggnanandhaa',
  'rameshbabu praggnanandhaa', 'maxime vachier lagrave', 'wei yi'
];
const NOTABLE_CHESS_PLAYER_ALIASES = [
  'alekhine', 'aronian', 'botvinnik', 'caruana', 'capablanca', 'carlsen',
  'euwe', 'fischer', 'geller', 'giri', 'gukesh', 'kasparov', 'karjakin',
  'karpov', 'korchnoi', 'kramnik', 'larsen', 'morphy', 'nakamura',
  'nepomniachtchi', 'petrosian', 'reti', 'reshevsky', 'rubinstein',
  'smyslov', 'spassky', 'steinitz', 'topalov'
];

export function normalizeAiCoachText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .toLowerCase();
}

export function isChessBiographyQuestion(question) {
  const text = normalizeAiCoachText(question);
  if (CHESS_BIOGRAPHY_TERMS.some((term) => text.includes(term))) return true;
  return NOTABLE_CHESS_PLAYER_NAMES.some((name) => text.includes(name))
    || NOTABLE_CHESS_PLAYER_ALIASES.some((name) => (
      new RegExp(`(^|\\W)${name}(\\W|$)`).test(text)
    ));
}

export function isPotentialBiographyLookup(question) {
  const text = normalizeAiCoachText(question).trim();
  return text.includes('tieu su ')
    || text.includes('thong tin ve ')
    || text.includes('who is ')
    || /\b[\p{L}][\p{L} .'-]{1,80}\s+la ai\??$/u.test(text);
}

export function isChessArenaSupportQuestion(question) {
  const text = normalizeAiCoachText(question);
  return SUPPORT_TERMS.some((term) => text.includes(term));
}
