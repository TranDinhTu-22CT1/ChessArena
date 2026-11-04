import { CHESS_PLAYERS } from '../data/chessPlayers.js';
import { normalizeKnowledgeText as norm } from './chessKnowledge.js';
import { knowledgeReply, resolveCoachKnowledge } from './coachKnowledge.js';

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
  return /\b(ke ten|liet ke|danh sach|cho .*ten|vi du|nhung ai|nhung nguoi|mot so|vai|list|name|give me|top)\b/.test(text)
    || /\b(\d+|mot|hai|ba|bon|nam|three|two|five) (?:nu |nam )?(?:dai kien tuong|grandmasters?|gm|ky thu|chess players?|wgm)\b/.test(text);
}

const acknowledgements = text => /^(?:cam on(?: ban| nhieu)?|thanks|ok|okay|vang|da|hieu roi)(?: nhe| nha)?$/.test(norm(text));
function listFollowup(text) {
  if (/^(?:ke them|con ai nua|tiep tuc danh sach)$/.test(text)) return {kind:'next'};
  const more = text.match(/^(?:ke |cho toi |cho minh )?them (\d+|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|vai) (?:nguoi|ky thu)(?: nua)?$/);
  if (more) return {kind:'next',count:more[1] === 'vai' ? 3 : numbers[more[1]] ?? Number(more[1])};
  const filter = text.match(/^con (?:o )?(.+?)(?: thi sao)?$/);
  if (filter) return {kind:'filter',value:filter[1]};
  return null;
}

function userHistory(messages) {
  return messages.filter(m => m.role === 'user').slice(-12).filter(m => !acknowledgements(m.content));
}

export function playerListReply(question, { messages = [] } = {}) {
  const current = listText(question);
  if (!listFollowup(current)) return listAnswer(current);
  // Replay only a contiguous sequence of user list requests. Assistant content
  // is not evidence, and an unrelated user question resets the list context.
  const prior = userHistory(messages).map(m => listText(m.content));
  const base = prior.findLastIndex(text => !listFollowup(text));
  if (base < 0 || !listIntent(prior[base])) return null;
  let text = prior[base], offset = 0, result = listAnswer(text);
  if (!result?.playerList) return null;
  for (const followup of [...prior.slice(base + 1), current]) {
    const operation = listFollowup(followup);
    const previous = result.playerList;
    if (!previous) return result; // A failed filter must never revive an earlier list.
    if (operation.kind === 'filter') {
      offset = 0;
      const gender = operation.value === 'nu' ? 'nu' : operation.value === 'nam' ? 'male' : previous.gender;
      const country = ['nu','nam'].includes(operation.value) ? previous.country : operation.value;
      text = `ke ten ${previous.requested} ${gender || ''} gm ${country || ''}`;
    } else {
      offset += previous.count;
      text = `ke ten ${operation.count ?? previous.requested} ${previous.gender || ''} gm ${previous.country || ''}`;
    }
    result = listAnswer(text, offset);
  }
  return result;
}

function listedReference(question, messages) {
  const text = norm(question);
  const ordinal = text.match(/^(?:nguoi|ky thu) (?:(?:thu|so) )?(\d+|nhat|hai|ba|tu|bon|nam|sau|bay|tam|chin|muoi|dau tien|cuoi cung)(?: |$)/);
  const pronoun = /^(?:ong ay|anh ay|co ay|ba ay|nguoi do)(?: |$)/.test(text);
  if (!ordinal && !pronoun) return null;
  const history = userHistory(messages), last = history.at(-1);
  let result = last ? playerListReply(last.content, {messages:history.slice(0,-1)}) : null;
  // A pronoun can follow a previously resolved ordinal without trusting an
  // assistant-supplied name or guessing which of several listed people it means.
  if (!result && pronoun && last) {
    const referenced = listedReference(last.content, history.slice(0,-1));
    if (referenced?.name) return referenced;
    return null;
  }
  if (!result?.playerList) return ordinal ? {reply:knowledgeReply('Mình chưa có danh sách gần nhất để xác định người bạn nói tới. Bạn hãy ghi tên kỳ thủ hoặc yêu cầu một danh sách trước nhé.',[], 'clarify',{suggestions:['Kể tên 3 đại kiện tướng']})} : null;
  const names = result.playerList.names;
  const number = ordinal ? ({nhat:1,tu:4,'dau tien':1,'cuoi cung':names.length,...numbers}[ordinal[1]] ?? Number(ordinal[1])) : names.length === 1 ? 1 : 0;
  if (number < 1 || number > names.length) return {reply:knowledgeReply(`Danh sách vừa rồi có ${names.length} người. Bạn muốn hỏi về ai?`, [], 'clarify', {suggestions:names.slice(0,3).map(name=>`${name} là ai?`)})};
  return {name:names[number-1]};
}

export function playerListReferenceReply(question, {messages = []} = {}) {
  const reference = listedReference(question,messages);
  if (reference?.reply) return reference.reply;
  if (!reference?.name) return null;
  return resolveCoachKnowledge(`${question} (${reference.name})`);
}

function listAnswer(text, offset = 0) {
  if (!listIntent(text)) return null;
  if (/\b(top|elo|rating|xep hang|thu hang|manh nhat|gioi nhat|hang dau|tot nhat|tre nhat|moi duoc|moi phong|dang thi dau|dang hoat dong|active|best|highest|youngest|ranked)\b/.test(text)) {
    return knowledgeReply('Để trả lời danh sách theo thứ hạng, Elo, độ tuổi hoặc tình trạng thi đấu, cần nguồn đúng thời điểm và tiêu chí. Mình chưa có kết nối bảng xếp hạng trực tiếp. Bạn muốn xem cờ tiêu chuẩn, nhanh hay chớp, và tháng/năm nào? Có thể đối chiếu tại FIDE; mình vẫn có thể kể tên các GM trong kho hồ sơ.', [source], 'insufficient', {suggestions:['Kể tên 3 đại kiện tướng', 'GM là gì?']});
  }
  if (/\b(wgm|im|wim|fm|cm|woman grandmasters?)\b/.test(text) || /\bdai kien tuong nu\b/.test(text)) {
    return knowledgeReply('Bạn muốn nữ kỳ thủ có danh hiệu GM, hay người có danh hiệu WGM? Đây là hai danh hiệu khác nhau. Kho danh sách hiện hỗ trợ GM; hãy chọn rõ để tránh gán nhầm danh hiệu.', [source], 'clarify', {suggestions:['Kể tên nữ kỳ thủ có danh hiệu GM', 'GM là gì?']});
  }
  const countMatch = [...text.matchAll(/\b(\d+|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|one|two|three|four|five)\s+(?:(?:nu|male|nam)\s+)?(?:nguoi|dai kien tuong|grandmasters?|gm|ky thu|chess players?)\b/g)].at(-1);
  const requested = countMatch ? (numbers[countMatch[1]] ?? Number(countMatch[1])) : 3;
  if (requested < 1) return knowledgeReply('Bạn muốn mình kể tên bao nhiêu kỳ thủ? Hãy chọn từ 1 đến 10 người mỗi lần.', [], 'clarify', {suggestions:['Kể tên 3 đại kiện tướng']});
  const count = Math.min(requested, 10);
  const country = countries.filter(([, aliases]) => has(text, aliases)).sort((a,b)=>Math.max(...b[1].map(alias=>text.lastIndexOf(alias)))-Math.max(...a[1].map(alias=>text.lastIndexOf(alias))))[0];
  let withoutCountries = text;
  for (const [, aliases] of countries) for (const alias of aliases) withoutCountries = withoutCountries.replace(new RegExp(`\\b${alias}\\b`, 'g'), ' ');
  // Do not silently drop an unknown nationality, era or other qualifying condition.
  const qualifiers = withoutCountries.replace(/\b(hien tai|bay gio|noi tieng|tren the gioi|the gioi|co danh hieu|danh hieu|gm|nu|nam|male|fide|chess players?|grandmasters?|dai kien tuong|ky thu|ke ten|liet ke|danh sach|cho toi|cho minh|cho|toi|minh|ten|mot so|mot vai|vai|nhung ai|nhung nguoi|vi du|list|name|give me|current|currently|please|ke them|con ai nua|them|nguoi|con|o|cua|thuoc|la|thi sao|nhe|nha)\b/g, ' ')
    .replace(/\b\d+\b/g, ' ').replace(new RegExp(`\\b(${Object.keys(numbers).join('|')})\\b`, 'g'), ' ');
  if (qualifiers.trim()) return knowledgeReply('Mình hiểu bạn muốn một danh sách kỳ thủ, nhưng chưa có bộ lọc đủ tin cậy cho điều kiện bổ sung này. Bạn có thể hỏi tên GM nói chung, hoặc nêu quốc gia và tiêu chí cụ thể; mình sẽ nói rõ nếu kho chưa đủ.', [source], 'clarify', {suggestions:['Kể tên 3 đại kiện tướng', 'Kể tên GM Việt Nam']});
  const female = /\bnu\b/.test(text);
  const male = /\b(?:male|ky thu nam|gm nam)\b/.test(withoutCountries);
  const unique = [...new Map(CHESS_PLAYERS.filter(p => p.fideId && p.gmYear && !p.died).map(p => [p.fideId, p])).values()]
    .sort((a,b)=>b.factsCheckedAt.localeCompare(a.factsCheckedAt));
  const pool = unique.filter(p => (!country || p.country === country[0]) && (!female || p.gender === 'female') && (!male || p.gender === 'male'));
  const players = pool.slice(offset, offset + count);
  if (!players.length) return knowledgeReply('Kho hồ sơ hiện chưa có thêm GM đáp ứng điều kiện này. Điều đó không có nghĩa ngoài thực tế không có; bạn có thể tra tiếp danh sách FIDE.', [source], 'insufficient', {suggestions:['GM là gì?', 'Tôi muốn hỏi câu khác']});
  const limited = players.length < requested;
  const answer = `${limited ? `Mình có ${players.length} hồ sơ phù hợp để giới thiệu` : `Ví dụ ${players.length} kỳ thủ có danh hiệu GM`}${country ? `, hồ sơ ghi ${country[0]}` : ''}:\n`
    + players.map((p, i) => `${i + 1}. ${p.name} — GM năm ${p.gmYear}.`).join('\n')
    + `\nĐây là danh sách ví dụ từ hồ sơ đã lưu, không phải xếp hạng Elo hay xác nhận đang thi đấu hôm nay. Mốc kiểm tra: ${[...new Set(players.map(p=>p.factsCheckedAt))].join(', ')}.`
    + (limited ? '\nKho hiện chưa đủ số lượng bạn yêu cầu; mình không thêm tên chưa xác minh.' : '')
    + (requested > 10 ? '\nMỗi lần mình hiển thị tối đa 10 hồ sơ.' : '');
  return knowledgeReply(answer, players.map(p => ({title:`FIDE · ${p.name}`,url:`https://ratings.fide.com/profile/${p.fideId}`})), limited ? 'insufficient' : 'grounded', {
    playerList:{names:players.map(p=>p.name),count:players.length,requested,country:country ? norm(country[0]) : '',gender:female ? 'nu' : male ? 'male' : ''},
    suggestions:[`${players[0].name} là ai?`, ...(offset + players.length < pool.length ? ['Kể thêm'] : ['GM là gì?']), 'Tôi muốn hỏi câu khác']
  });
}
