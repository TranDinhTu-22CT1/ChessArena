import { CHESS_PLAYERS } from '../data/chessPlayers.js';
import { normalizeKnowledgeText as norm } from './chessKnowledge.js';
import { knowledgeReply } from './coachKnowledge.js';

const source = { title:'Danh sách và hồ sơ FIDE', url:'https://ratings.fide.com/' };
const numbers = { mot:1, hai:2, ba:3, bon:4, nam:5, sau:6, bay:7, tam:8, chin:9, muoi:10, one:1, two:2, three:3, four:4, five:5 };
const countries = [
  ['Việt Nam', ['viet nam', 'vietnam']], ['Hoa Kỳ', ['hoa ky', 'my', 'usa', 'united states']],
  ['Na Uy', ['na uy', 'norway']], ['Hà Lan', ['ha lan', 'netherlands']],
  ['Pháp', ['phap', 'france']], ['Trung Quốc', ['trung quoc', 'china']],
  ['Ấn Độ', ['an do', 'india']], ['Nga', ['nga', 'russia']], ['Hungary', ['hungary']],
];
const has = (text, words) => words.some(word => (` ${text} `).includes(` ${word} `));
// Preserve the distinction between Vietnamese “năm” (five) and “nam” (male).
const listText = text => norm(String(text).replace(/\bnăm\s+(?=(?:đại kiện tướng|kỳ thủ|GM|người)(?:\s|[?.!,]|$))/giu, '5 '))
  .replace(/\bnam (?=(?:ky thu|dai kien tuong|gm)\b)/g, 'male ');

function listIntent(question) {
  const text = norm(question);
  if (!/\b(dai kien tuong|grandmasters?|gm|ky thu|chess players?|wgm|kien tuong)\b/.test(text)) return false;
  return /\b(ke ten|neu|gioi thieu|biet .*nao|liet ke|danh sach|cho .*ten|vi du|nhung ai|nhung nguoi|mot so|vai|list|name|give me|top)\b/.test(text)
    || /\b(\d+|mot|hai|ba|bon|nam|three|two|five) (?:nu |nam )?(?:dai kien tuong|grandmasters?|gm|ky thu|chess players?|wgm)\b/.test(text);
}

export function listAnswer(question, offset = 0, excludedIds = []) {
  const text = listText(question);
  if (!listIntent(text)) return null;
  if (/\b(top|elo|rating|xep hang|thu hang|manh nhat|gioi nhat|hang dau|tot nhat|tre nhat|moi duoc|moi phong|dang thi dau|dang hoat dong|active|best|highest|youngest|ranked)\b/.test(text)) {
    return knowledgeReply('Để trả lời danh sách theo thứ hạng, Elo, độ tuổi hoặc tình trạng thi đấu, cần nguồn đúng thời điểm và tiêu chí. Mình chưa có kết nối bảng xếp hạng trực tiếp. Bạn muốn xem cờ tiêu chuẩn, nhanh hay chớp, và tháng/năm nào? Có thể đối chiếu tại FIDE; mình vẫn có thể kể tên các GM trong kho hồ sơ.', [source], 'insufficient', {suggestions:['Kể tên 3 đại kiện tướng', 'GM là gì?']});
  }
  if (/\b(wgm|im|wim|fm|cm|woman grandmasters?)\b/.test(text) || /\bdai kien tuong nu\b/.test(text)) {
    return knowledgeReply('Bạn muốn nữ kỳ thủ có danh hiệu GM, hay người có danh hiệu WGM? Đây là hai danh hiệu khác nhau. Kho danh sách hiện hỗ trợ GM; hãy chọn rõ để tránh gán nhầm danh hiệu.', [source], 'clarify', {suggestions:['Kể tên nữ kỳ thủ có danh hiệu GM', 'GM là gì?']});
  }
  const countMatch = [...text.matchAll(/\b(\d+|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|one|two|three|four|five)\s+(?:(?:nu|male|nam)\s+)?(?:nguoi|dai kien tuong|grandmasters?|gm|ky thu|chess players?)\b/g)].at(-1);
  const requested = countMatch ? (numbers[countMatch[1]] ?? Number(countMatch[1]))
    : /\b(bat ky|bat ki|ngau nhien|any|random|nao khong)\b/.test(text) ? 1 : 3;
  if (requested < 1) return knowledgeReply('Bạn muốn mình kể tên bao nhiêu kỳ thủ? Hãy chọn từ 1 đến 10 người mỗi lần.', [], 'clarify', {suggestions:['Kể tên 3 đại kiện tướng']});
  const count = Math.min(requested, 10);
  const country = countries.filter(([, aliases]) => has(text, aliases)).sort((a,b)=>Math.max(...b[1].map(alias=>text.lastIndexOf(alias)))-Math.max(...a[1].map(alias=>text.lastIndexOf(alias))))[0];
  let withoutCountries = text;
  for (const [, aliases] of countries) for (const alias of aliases) withoutCountries = withoutCountries.replace(new RegExp(`\\b${alias}\\b`, 'g'), ' ');
  // Do not silently drop an unknown nationality, era or other qualifying condition.
  const qualifiers = withoutCountries.replace(/\b(bat ky|bat ki|ngau nhien|any|random|neu|gioi thieu|ban co biet|nao khong|duoc khong|giup|hien tai|bay gio|noi tieng|tren the gioi|the gioi|co danh hieu|danh hieu|gm|nu|nam|male|fide|chess players?|grandmasters?|dai kien tuong|ky thu|ke ten|liet ke|danh sach|cho toi|cho minh|cho|toi|minh|ten|mot so|mot vai|vai|nhung ai|nhung nguoi|vi du|list|name|give me|current|currently|please|ke them|con ai nua|them|nguoi|con|o|cua|thuoc|la|thi sao|nhe|nha)\b/g, ' ')
    .replace(/\b\d+\b/g, ' ').replace(new RegExp(`\\b(${Object.keys(numbers).join('|')})\\b`, 'g'), ' ');
  if (qualifiers.trim()) return knowledgeReply('Mình hiểu bạn muốn một danh sách kỳ thủ, nhưng chưa có bộ lọc đủ tin cậy cho điều kiện bổ sung này. Bạn có thể hỏi tên GM nói chung, hoặc nêu quốc gia và tiêu chí cụ thể; mình sẽ nói rõ nếu kho chưa đủ.', [source], 'clarify', {suggestions:['Kể tên 3 đại kiện tướng', 'Kể tên GM Việt Nam']});
  const female = /\bnu\b/.test(text);
  const male = /\b(?:male|ky thu nam|gm nam)\b/.test(withoutCountries);
  const unique = [...new Map(CHESS_PLAYERS.filter(p => p.fideId && p.gmYear && !p.died).map(p => [p.fideId, p])).values()]
    .sort((a,b)=>b.factsCheckedAt.localeCompare(a.factsCheckedAt));
  const pool = unique.filter(p => (!country || p.country === country[0]) && (!female || p.gender === 'female') && (!male || p.gender === 'male'));
  const available = pool.filter(p => !excludedIds.includes(p.fideId));
  const players = available.slice(offset, offset + count);
  if (!players.length) return knowledgeReply('Mình đã giới thiệu hết các hồ sơ GM phù hợp trong kho hiện có cho danh sách này. Mình không lặp tên hoặc tự thêm người chưa xác minh. Bạn có thể đổi quốc gia/tiêu chí hoặc bắt đầu Chat mới để xem lại.', [source], 'insufficient', {suggestions:['Kể tên GM Việt Nam', 'GM là gì?', 'Tôi muốn hỏi câu khác']});
  const limited = players.length < requested;
  const answer = `${limited ? `Mình có ${players.length} hồ sơ phù hợp để giới thiệu` : `Ví dụ ${players.length} kỳ thủ có danh hiệu GM`}${country ? `, hồ sơ ghi ${country[0]}` : ''}:\n`
    + players.map((p, i) => `${i + 1}. ${p.name} — GM năm ${p.gmYear}.`).join('\n')
    + `\nĐây là danh sách ví dụ từ hồ sơ đã lưu, không phải xếp hạng Elo hay xác nhận đang thi đấu hôm nay. Mốc kiểm tra: ${[...new Set(players.map(p=>p.factsCheckedAt))].join(', ')}.`
    + (limited ? '\nKho hiện chưa đủ số lượng bạn yêu cầu; mình không thêm tên chưa xác minh.' : '')
    + (requested > 10 ? '\nMỗi lần mình hiển thị tối đa 10 hồ sơ.' : '');
  return knowledgeReply(answer, players.map(p => ({title:`FIDE · ${p.name}`,url:`https://ratings.fide.com/profile/${p.fideId}`})), limited ? 'insufficient' : 'grounded', {
    playerList:{names:players.map(p=>p.name),ids:players.map(p=>p.fideId),count:players.length,requested,country:country ? norm(country[0]) : '',gender:female ? 'nu' : male ? 'male' : ''},
    suggestions:[`${players[0].name} là ai?`, ...(offset + players.length < available.length ? ['Kể thêm'] : ['GM là gì?']), 'Tôi muốn hỏi câu khác']
  });
}
