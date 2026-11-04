import { Chess } from 'chess.js';
import { enginePosition } from './enginePosition.js';
import { analyzeChatPosition } from './chatPosition.js';
import { reviewPosition } from './positionReview.js';
import { reviewMetrics } from './reviewMetrics.js';
import { normalizeKnowledgeText } from './chessKnowledge.js';
import { knowledgeReply } from './coachKnowledge.js';

const source={title:'Stockfish · tính từ thế cờ được cung cấp',url:'https://stockfishchess.org/'};
const labels={brilliant:'Thiên tài',great:'Rất mạnh',best:'Tốt nhất',excellent:'Rất tốt',good:'Tốt',inaccuracy:'Chưa chính xác',mistake:'Sai lầm',miss:'Bỏ lỡ',blunder:'Sai lầm nghiêm trọng',book:'Theo lý thuyết'};
export function lineEvidence(fen,line=[]) {
  const board=new Chess(fen),facts=[];
  const pieces={p:'tốt',n:'Mã',b:'Tượng',r:'Xe',q:'Hậu'};
  for(const lan of line.slice(0,8)){
    let move;try{move=board.move(lan);}catch{break;}
    const side=move.color==='w'?'Trắng':'Đen';
    if(board.isCheckmate())return `${side} có ${move.san} chiếu hết trong biến này.`;
    if(move.captured)facts.push(`${side} chơi ${move.san}, bắt ${pieces[move.captured]}`);
  }
  return facts.length?'Diễn biến kiểm tra được: '+facts.slice(0,3).join('; ')+'.':'';
}
export function isBoardQuestion(question,context={}) {
  const text=normalizeKnowledgeText(question);
  if(/\b(luat|la gi|dinh nghia|hoc khai cuoc|ky hieu|y nghia)\b/.test(text))return false;
  return /\b(the co|nuoc vua|nuoc cuoi|vua di|vua roi|nuoc tiep|nuoc nay|nuoc di tot nhat|nuoc tot nhat|best move|nen di|di gi|nuoc ung vien|fen|pgn|chieu|hop le)\b/.test(text)
    || (context.hasBoardContext&&/\b(tai sao|vi sao|phan tich|ke hoach|quan treo|nhap thanh|di duoc|duoc khong|tot|sai|hay hon)\b/.test(text))
    || /\b(?:[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h][1-8][a-h][1-8][qrbn]?|[a-h][1-8])\b/.test(question);
}

export function resolveBoardContext(question,context={}) {
  const explicitFen=question.match(/(?:^|\s|`)((?:[prnbqkPRNBQK1-8]+\/){7}[prnbqkPRNBQK1-8]+\s+[wb]\s+[KQkq-]+\s+(?:[a-h][36]|-)\s+\d+\s+\d+)/)?.[1];
  const explicitPgn=question.match(/\bPGN\s*:\s*([\s\S]+)/i)?.[1]?.replace(/```/g,'').trim();
  let played=null;
  if(explicitPgn){played=new Chess();played.loadPgn(explicitPgn);}
  const fen=explicitFen||(played?.fen())||(context.hasBoardContext?context.fen:'');
  if(!fen)return null;
  const board=enginePosition(fen);
  let previous=null;
  if(!explicitFen&&!explicitPgn&&context.previousFen&&context.latestLan){
    const before=enginePosition(context.previousFen),move=before.move(context.latestLan);
    if(before.fen()===board.fen())previous={fen:context.previousFen,move:move.lan,san:move.san};
  }
  const pgn=explicitPgn||(!explicitFen?context.pgn:'');
  if(pgn&&!previous){
    try{
      played??=new Chess();if(!explicitPgn)played.loadPgn(pgn);
      if(played.fen()===board.fen()){
        const latest=played.history({verbose:true}).at(-1);
        if(latest)previous={fen:latest.before,move:latest.lan,san:latest.san};
      }
    }catch{/* A mismatching/incomplete PGN cannot justify a last-move claim. */}
  }
  return {board,previous};
}

export async function answerBoardQuestion(question,context,{signal,analyze=analyzeChatPosition,review=reviewPosition}={}) {
  let state;
  try{state=resolveBoardContext(question,context);}catch{return knowledgeReply('FEN/PGN hoặc nước trước đó không hợp lệ. Hãy kiểm tra và gửi lại; mình chưa chạy engine trên dữ liệu này.',[],'clarify');}
  if(!state)return knowledgeReply('Mình chưa có thế cờ để kiểm tra nước đi. Hãy mở bàn cờ hoặc gửi FEN/PGN; chỉ tên một nước không đủ để biết nó hợp lệ hay tốt.',[],'clarify');
  const {board,previous}=state,text=normalizeKnowledgeText(question);
  const legal=board.moves({verbose:true});
  if(/\b(nhap thanh|castle|castling)\b/.test(text)){
    const castles=legal.filter(m=>m.san==='O-O'||m.san==='O-O-O');
    return knowledgeReply(castles.length?`Trong FEN này, ${board.turn()==='w'?'Trắng':'Đen'} được nhập thành: ${castles.map(m=>m.san).join(', ')}. Hợp lệ không có nghĩa luôn là nước tốt nhất.`:'Trong FEN này, bên đến lượt không có nước nhập thành hợp lệ. Hãy kiểm tra quyền nhập thành trong FEN, quân chắn giữa Vua–Xe và các ô Vua đang đứng/đi qua/đến có bị tấn công không.',[{title:'Bộ luật bàn cờ ChessArena',url:'/learn'}]);
  }
  const lastAsked=/\b(vua roi|vua di|nuoc cuoi|nuoc vua|nuoc nay)\b/.test(text);
  if(lastAsked&&!previous)return knowledgeReply('FEN hiện tại không cho biết nước vừa đi. Mình cần PGN hoặc thế trước nước đó để chấm đúng; nhãn review gửi từ giao diện không được dùng thay cho kiểm chứng.',[],'clarify');
  const wording=question.replace(/(?:[prnbqkPRNBQK1-8]+\/){7}[prnbqkPRNBQK1-8]+\s+[wb]\s+[KQkq-]+\s+(?:[a-h][36]|-)\s+\d+\s+\d+/g,'').replace(/\bPGN\s*:\s*[\s\S]*/i,'');
  const written=[...wording.matchAll(/\b([a-h][1-8][a-h][1-8][qrbn]?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h]x[a-h][1-8](?:=[QRBN])?[+#]?|[a-h][1-8](?:=[QRBN])?[+#]?)\b/g)].map(m=>m[1]);
  const lastMentioned=previous&&written.some(move=>move===previous.san||move===previous.move);
  let candidates=[];
  if(lastAsked||lastMentioned)candidates=[previous];
  else if(written.length){
    const unique=[...new Set(written)].slice(0,2);
    for(const notation of unique){
      let candidate;try{candidate=new Chess(board.fen()).move(notation);}catch{/* Report invalid or ambiguous notation; do not replace it with another move. */}
      if(!candidate)return knowledgeReply(`Mình không xác định được nước ${notation} hợp lệ cho bên đang đi trong FEN này. Hãy ghi SAN đầy đủ hoặc ô đi–ô đến (ví dụ g1f3); mình không tự đổi sang nước khác.`,[],'clarify');
      candidates.push({fen:board.fen(),move:candidate.lan,san:candidate.san});
    }
  }
  try{
    if(candidates.length){
      const answers=[];let position;
      for(const candidate of candidates){
        const analysis=await review(candidate.fen,candidate.move,{signal,movetime:180,quality:'quick'});
        const metrics=reviewMetrics({...candidate,...analysis});
        position={depth:metrics.depth,turn:metrics.mover,engine:analysis.engine};
        const evidence=lineEvidence(candidate.fen,analysis.played.pv);
        answers.push(`${candidate.san}: ${labels[metrics.tone]}. So với phương án tốt nhất đã tìm, giảm khoảng ${metrics.winLoss} điểm phần trăm cơ hội thắng ước lượng.\nPhương án so sánh: ${metrics.continuationSan.join(' → ')||metrics.bestSan}.\nBiến sau nước đã hỏi: ${metrics.playedContinuationSan.join(' → ')||'Ván đã kết thúc.'}${evidence?`\n${evidence}`:''}${metrics.detail?`\n${metrics.detail}`:''}`);
      }
      return knowledgeReply(answers.join('\n\n')+'\nĐây là phân tích nhanh; biến minh họa giả định đối thủ đáp tốt, không phải lời tiên đoán. Mình chưa kết luận thêm về đòn chiến thuật nếu dữ liệu engine chưa chứng minh.',[source],'grounded',{position});
    }
    const analysis=await analyze(board.fen(),{signal});
    const side=board.turn()==='w'?'Trắng':'Đen';
    if(analysis.checkmate)return knowledgeReply(`${side} đang bị chiếu hết trong thế cờ này.`,[source],'grounded',{position:analysis});
    if(analysis.terminal)return knowledgeReply('Thế cờ này được bộ luật engine nhận là hòa. Một FEN riêng lẻ không xác định được việc lặp lại thế cờ trong toàn bộ ván.',[source],'grounded',{position:analysis});
    const evaluation=analysis.mate==null?`${(analysis.score/100).toFixed(2)} tốt theo phía ${side}`:analysis.mate>0?`có chuỗi chiếu hết trong ${analysis.mate} nước cho ${side}`:`${side} đối mặt chuỗi chiếu hết trong ${Math.abs(analysis.mate)} nước`;
    return knowledgeReply(`${side} đến lượt${analysis.check?' và đang bị chiếu':''}. Stockfish ở độ sâu ${analysis.depth}: ${evaluation}.\nNước đề xuất: ${analysis.bestSan}.\n${analysis.variations.map((line,i)=>`${i+1}. ${line.san.slice(0,8).join(' → ')}`).join('\n')}\nCác biến là phương án tính được, không phải chuỗi đáp bắt buộc của người chơi.`,[source],'grounded',{position:analysis});
  }catch(error){
    if(signal?.aborted)throw error;
    return knowledgeReply('Stockfish chưa trả kết quả đáng tin cậy cho thế cờ này. Mình chưa thể kết luận nước tốt/xấu hoặc đề xuất một biến. Hãy thử lại sau.',[],'unavailable');
  }
}
