import { Chess } from 'chess.js';
import { COACH_LIBRARY, COACH_LIBRARY_VERSION } from '../data/coachLibrary.js';
import { CHESS_PLAYER_DATA_UPDATED_AT } from '../data/chessPlayers.js';
import { CHESS_OPENINGS } from '../data/chessOpenings.generated.js';
import { classicGamesAnswer, findChessPlayers, findOpeningKnowledge, isOpeningKnowledgeQuestion, normalizeKnowledgeText, openingKnowledgeAnswer } from './chessKnowledge.js';
import { isPotentialBiographyLookup, isChessBiographyQuestion } from './aiCoachIntent.js';

export const openingSource={title:'Danh mục khai cuộc Lichess (CC0)',url:'https://github.com/lichess-org/chess-openings'};
const profileSource={title:`Hồ sơ kỳ thủ biên soạn trong ChessArena · ${CHESS_PLAYER_DATA_UPDATED_AT}`};
const fideSource={title:'Tra cứu thông tin theo thời điểm tại FIDE',url:'https://ratings.fide.com/'};
const websiteSource={title:'Thông tin công khai ChessArena',url:'/'};
const norm=normalizeKnowledgeText;
function phrase(text,term){return (` ${text} `).includes(` ${norm(term)} `);}
export function knowledgeReply(answer,sources=[],status='grounded',extra={}) {
  return {answer,sources:[...new Map(sources.map(source=>[source.url||source.title,source])).values()].slice(0,4),
    knowledge:{status,version:COACH_LIBRARY_VERSION},model:'chessarena-knowledge-v2',...extra};
}

export function matchCoachCards(question) {
  const text=norm(question);
  return COACH_LIBRARY.map(card=>({card,score:Math.max(0,...[card.title, ...card.terms].filter(term=>phrase(text,term)).map(term=>norm(term).split(' ').length*10))}))
    .filter(hit=>hit.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
}

// Only user questions resolve pronouns. Earlier assistant prose is never imported as facts.
export function contextualKnowledgeQuestion(question,messages=[]) {
  const text=norm(question);
  if(findChessPlayers(question).length)return question;
  if(!/\b(ong ay|anh ay|co ay|ba ay|nguoi do|ho|vay|the con|con |nam nao|bao nhieu tuoi|sinh nam|phong cach|danh hieu|thanh tich)\b/.test(text))return question;
  const previous=messages.filter(message=>message.role==='user').slice(-2).reverse();
  for(const message of previous){
    const players=findChessPlayers(message.content);
    if(players.length===1)return `${question} (${players[0].name})`;
    if(players.length>1)return question;
  }
  return question;
}

function playerReply(question,players) {
  const text=norm(question);
  let sources=players.map(player=>player.fideId?{title:`Hồ sơ FIDE · ${player.name}`,url:`https://ratings.fide.com/profile/${player.fideId}`} : fideSource);
  if(/\b(elo|rating|thu hang|xep hang|hien tai|hom nay|moi nhat|gan day|thang nay|doi dau|ti so|bao nhieu lan|bao nhieu tran|tai san|thu nhap|vo|chong|gia dinh|iq|khai cuoc|chuyen quoc tich)\b/.test(text)){
    return knowledgeReply('Kho hiện có chưa đủ dữ liệu để xác nhận chi tiết bạn hỏi về '+players.map(p=>p.name).join(' và ')+'. Mình không có bảng Elo/xếp hạng trực tiếp, thống kê đối đầu hay kho toàn bộ ván của từng kỳ thủ. Hãy đối chiếu nguồn theo đúng thời điểm và thể thức; mình có thể tra năm sinh, danh hiệu đã lưu, thành tích hoặc mô tả phong cách.',sources,'insufficient');
  }
  const born=/\b(sinh|tuoi|bao nhieu tuoi)\b/.test(text);
  const country=/\b(nuoc nao|quoc tich|nguoi nuoc|quoc gia)\b/.test(text);
  const style=/\b(phong cach|loi choi|choi the nao)\b/.test(text);
  const titleYear=/\b(nam nao|khi nao|bao gio|bao nhieu tuoi)\b/.test(text)&&/\b(gm|dai kien tuong|danh hieu)\b/.test(text);
  const title=/\b(danh hieu|gm|dai kien tuong|wgm)\b/.test(text);
  const achievements=/\b(thanh tich|vo dich|giai thuong)\b/.test(text);
  if(style||achievements||(!born&&!country&&!title))sources=[profileSource];
  const supported=born||country||style||title||achievements||/\b(la ai|tieu su|gioi thieu|thong tin|so sanh)\b/.test(text)||players.some(p=>norm(p.name)===text||p.aliases.some(a=>norm(a)===text));
  if(!supported)return knowledgeReply('Bạn muốn biết điều gì về '+players.map(p=>p.name).join(' và ')+': năm sinh, danh hiệu, thành tích hay phong cách? Mình chưa có dữ liệu đủ cụ thể cho chi tiết khác trong câu hỏi này.',sources,'clarify');
  const paragraphs=players.slice(0,2).map(player=>{
    if(titleYear)return player.gmYear?`${player.name}: được FIDE ghi nhận danh hiệu GM năm ${player.gmYear}.`:`${player.name}: kho hồ sơ chưa có năm được phong GM; mình không suy ra từ năm sinh hoặc thành tích.`;
    if(born)return `${player.name} sinh năm ${player.born}${player.died?`, mất năm ${player.died}`:''}. Kho này không có ngày sinh đầy đủ để tính tuổi chính xác tại một ngày cụ thể.`;
    if(country)return `${player.name}: hồ sơ ghi ${player.country}. Liên đoàn thi đấu và quốc tịch là hai khái niệm khác nhau.`;
    if(style)return `${player.name} — mô tả phong cách trong hồ sơ: ${player.style||'Chưa có mô tả đã biên soạn.'}`;
    if(achievements)return `${player.name}: ${[...player.titles.filter(t=>/vô địch|Á quân/i.test(t)),...player.highlights].join('; ')}.`;
    if(title)return `${player.name}: ${player.titles.join('; ')}${player.gmYear?`; GM năm ${player.gmYear}`:''}.`;
    return `${player.name} — sinh năm ${player.born}${player.died?`, mất năm ${player.died}`:''}, hồ sơ ghi ${player.country}.\n${player.titles.join('; ')}.\n${player.highlights.join('; ')}.${player.style?`\nMô tả phong cách: ${player.style}`:''}`;
  });
  const checked=(born||country||title)?[...new Set(players.map(p=>p.factsCheckedAt||CHESS_PLAYER_DATA_UPDATED_AT))].join(', '):CHESS_PLAYER_DATA_UPDATED_AT;
  return knowledgeReply(paragraphs.join('\n\n')+`\nMốc dữ liệu phần trả lời: ${checked}; không phải cập nhật trực tiếp.`,sources);
}

const openingTokens=pgn=>pgn.replace(/\d+\.(?:\.\.)?/g,' ').replace(/\s+/g,' ').trim().split(' ');
// Tokenization only: no engine and no expensive replay of the complete opening catalog per request.
let openingLines;
export function identifyOpening(pgn) {
  const game=new Chess();game.loadPgn(pgn);
  const played=game.history();
  openingLines ??= CHESS_OPENINGS.map(opening=>({opening,line:openingTokens(opening.pgn)}));
  const matches=openingLines.filter(({line})=>line.length<=played.length&&line.every((move,i)=>move===played[i]))
    .sort((a,b)=>b.line.length-a.line.length||a.opening.name.length-b.opening.name.length);
  return matches[0]?.opening||null;
}

function websiteReply(question, settings = {}) {
  const text = norm(question);
  const asksOwner = /\b(chu website|chu web|chu source|chu ma nguon|chu so huu|(?:website|web|source|ma nguon|chessarena) (?:nay )?cua ai)\b/.test(text) || /^ai la chu$/.test(text);
  const asksDeveloper = /\b(ai phat trien|nguoi phat trien|lap trinh vien|ai lam|ai viet|ai code|tac gia|nguoi tao ra|ai tao ra)\b/.test(text)
    && (/\b(chessarena|website|web|source|ma nguon|ung dung nay|trang nay)\b/.test(text) || /^(ai phat trien|ai lam|ai viet|ai code|ai tao ra)$/.test(text));
  const asksContact = /\b(email|lien he|contact)\b/.test(text) && /\b(chessarena|website|admin|ho tro)\b/.test(text);
  const asksOverview = /\b(chessarena la gi|gioi thieu chessarena|thong tin chessarena|website nay la gi)\b/.test(text);
  if (!asksOwner && !asksDeveloper && !asksContact && !asksOverview) return null;
  if (!/\bchessarena\b/.test(text) && /\b(lichess|chess com|google|openai|facebook|microsoft)\b/.test(text)) {
    return knowledgeReply('Thông tin công khai mình đang đọc là của ChessArena. Mình chưa có nguồn về chủ sở hữu hoặc người phát triển của website khác mà bạn hỏi.', [], 'insufficient');
  }
  if (!settings) return knowledgeReply('Mình chưa đọc được thông tin công khai của website lúc này. Bạn hãy thử lại sau; thông tin này được quản lý trong Website Settings.', [websiteSource], 'unavailable');
  const site = String(settings.siteTitle || 'ChessArena').trim() || 'ChessArena';
  if (asksOwner) return knowledgeReply(settings.ownerName
    ? `Chủ sở hữu được công bố của ${site} là ${settings.ownerName}.`
    : `${site} chưa công bố tên chủ sở hữu. Quản trị viên có thể cập nhật mục Chủ sở hữu công khai trong Website Settings; mình sẽ đọc thông tin đã lưu tại đó.`, [websiteSource], settings.ownerName ? 'grounded' : 'insufficient');
  if (asksDeveloper) return knowledgeReply(settings.developerName
    ? `Người phát triển được công bố của ${site} là ${settings.developerName}.`
    : `${site} chưa công bố tên người phát triển trong Website Settings. Mình không tự gán tên khi chưa có dữ liệu.`, [websiteSource], settings.developerName ? 'grounded' : 'insufficient');
  if (asksContact) return knowledgeReply(settings.supportEmail
    ? `Email hỗ trợ được công bố của ${site} là ${settings.supportEmail}. Bạn cũng có thể tạo ticket tại trang Hỗ trợ.`
    : `${site} chưa công bố email hỗ trợ. Bạn vẫn có thể gửi ticket tại trang Hỗ trợ.`, [{ title: 'Hỗ trợ ChessArena', url: '/support' }], settings.supportEmail ? 'grounded' : 'insufficient');
  return knowledgeReply(`${site}: ${String(settings.siteDescription || 'Nền tảng chơi, luyện tập và phân tích cờ vua.').trim()}`, [websiteSource]);
}

export function resolveCoachKnowledge(question,{messages=[],gameContext={},websiteSettings={}}={}) {
  const effective=contextualKnowledgeQuestion(question,messages),text=norm(effective);
  const productIdentity=websiteReply(effective,websiteSettings);
  if(productIdentity)return productIdentity;
  const openingIntent=isOpeningKnowledgeQuestion(effective)||/\b(khai cuoc|opening|bien the|gambit|defense|najdorf|sicilian|italian|italy|london|ruy lopez|caro[- ]kann|scotch|vienna|catalan|pirc|nimzo[- ]indian)\b/.test(text)||/\b[A-E]\d{2}\b/i.test(question);
  const players=openingIntent?[]:findChessPlayers(effective);
  const classic=classicGamesAnswer(question);
  if(classic&&!/\b(pgn|nuoc thu|toan bo|ket qua|ti so)\b/.test(text))return knowledgeReply(classic,[{title:'Ván cờ kinh điển trong tài liệu ChessArena',url:'/learn'}]);
  if(players.length)return playerReply(effective,players);
  if(/\b(hien tai|moi nhat|hom nay|duong kim|thang nay)\b/.test(text)&&/\b(fide|vo dich|ky thu|elo|xep hang|thu hang)\b/.test(text)){
    return knowledgeReply('Mình chưa có nguồn cập nhật trực tiếp để xác nhận danh hiệu, Elo hoặc thứ hạng hiện tại. Dữ liệu tiểu sử đã lưu không đủ cho câu hỏi thời sự; hãy kiểm tra danh sách FIDE và ngày công bố.',[fideSource],'insufficient');
  }
  const cards=matchCoachCards(question);
  // Definitions and product policies must not be mistaken for a current-board search.
  const explicitBoard=/\b(?:FEN|PGN)\s*:/i.test(question)||/(?:[prnbqkPRNBQK1-8]+\/){7}[prnbqkPRNBQK1-8]+\s+[wb]\s/.test(question);
  const specificBoard=!/\b(luat|la gi|dinh nghia)\b/.test(text)&&(explicitBoard||(/\b(hien tai|nay|vua roi|vua di|nuoc cuoi|o day|cua toi|duoc khong|khong duoc|tai sao|vi sao)\b/.test(text)&&gameContext.hasBoardContext));
  if(cards[0]&&(!specificBoard||cards[0].card.source.url.startsWith('/membership')||['ban','otp','matching','support'].includes(cards[0].card.id))){
    const selected=cards.filter(hit=>hit.score>=cards[0].score).slice(0,2).map(hit=>hit.card);
    return knowledgeReply(selected.map(card=>`${card.title}\n${card.text}`).join('\n\n'),selected.map(card=>card.source),'grounded',{knowledgeTopics:selected.map(card=>card.id)});
  }
  if(!openingIntent&&isChessBiographyQuestion(question))return knowledgeReply('Mình chưa xác định được hồ sơ kỳ thủ phù hợp. Bạn hãy ghi đầy đủ tên hoặc FIDE ID; mình không tự gán danh hiệu, năm sinh hay thành tích cho người chưa có trong dữ liệu.',[fideSource],'clarify');
  if(!openingIntent&&isPotentialBiographyLookup(question))return knowledgeReply('Bạn muốn tìm thông tin về người hoặc chủ đề nào? Hãy ghi đầy đủ tên và điều muốn biết. Kho hiện có chủ yếu gồm kỳ thủ và ChessArena; mình không tự gán tiểu sử, danh hiệu hay thông tin riêng tư cho tên chưa xác định.',[],'clarify');
  if(openingIntent){
    if(/\b(gi|nao|ten)\b/.test(text)&&(/\d+\./.test(question)||gameContext.pgn)&&!/\b(la gi|nhu the nao)\b/.test(text)){
      const supplied=question.match(/(?:PGN\s*:\s*)?(\d+\.(?:\s*\.{2})?\s*[^?\n]+)/i)?.[1]?.replace(/\s+(?:là|la|thuộc|thuoc|đây|day|khai cuộc|khai cuoc)(?=\s|$)[\s\S]*$/iu,'').trim();
      try{
        const opening=identifyOpening(supplied||gameContext.pgn);
        return opening?knowledgeReply(`Chuỗi nước khớp ${opening.name} (${opening.eco}) đến đoạn:\n${opening.pgn}\nTên mô tả đoạn khai cuộc đã khớp; không khẳng định mọi nước tiếp theo thuộc lý thuyết.`,[openingSource]):knowledgeReply('Chuỗi nước hợp lệ nhưng chưa khớp một khai cuộc có tên trong kho hiện có.',[openingSource],'insufficient');
      }catch{return knowledgeReply('Mình chưa đọc được chuỗi PGN này. Hãy gửi riêng phần nước đi, ví dụ: 1. e4 e5 2. Nf3 Nc6 3. Bc4.',[],'clarify');}
    }
    const openings=findOpeningKnowledge(effective,3);
    if(!openings.length)return knowledgeReply('Mình chưa tìm được đúng khai cuộc/biến thể bạn hỏi. Hãy ghi tên đầy đủ, mã ECO (ví dụ B90) hoặc chuỗi nước PGN để tránh trả nhầm một biến gần tên.',[openingSource],'clarify');
    for(const opening of openings){const chess=new Chess();chess.loadPgn(opening.pgn);}
    const answer=openingKnowledgeAnswer(effective)||openings.map(o=>`${o.name} (${o.eco})\n${o.pgn}`).join('\n\n');
    return knowledgeReply(answer,[openingSource]);
  }
  if(/^(xin chao|chao|hello|hi|alo|cam on|thanks)[!. ]*$/.test(text))return knowledgeReply('Chào bạn. Bạn có thể hỏi một chi tiết về kỳ thủ, tên/biến khai cuộc, luật cờ hoặc một nước đi. Với nước đi cụ thể, hãy mở bàn cờ hoặc gửi FEN/PGN.');
  return null;
}

export function insufficientKnowledge(){return knowledgeReply('Mình chưa có dữ liệu đủ khớp để trả lời chính xác câu này. Bạn hãy nêu tên kỳ thủ/khai cuộc, câu luật cụ thể hoặc gửi thế cờ và nước muốn hỏi. Mình sẽ không tự điền thông tin còn thiếu.',[],'insufficient');}

// Providers may select relevant curated passages; generated factual prose is never
// accepted as evidence. This also rejects invented URLs, statistics and instructions.
export function selectedKnowledge(raw,candidates) {
  let choice;try{choice=JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{return null;}
  if(!Array.isArray(choice.ids)||!choice.ids.length||choice.ids.length>2)return null;
  const chosen=[...new Set(choice.ids)].map(id=>candidates.find(card=>card.id===id));
  if(chosen.some(card=>!card))return null;
  return knowledgeReply(chosen.map(card=>`${card.title}\n${card.text}`).join('\n\n'),chosen.map(card=>card.source),'grounded',{knowledgeTopics:chosen.map(card=>card.id)});
}
