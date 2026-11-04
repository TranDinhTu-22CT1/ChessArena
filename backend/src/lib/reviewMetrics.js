import { Chess } from 'chess.js';

export function winningChance(score) {
  if(Math.abs(score)>=90000)return score>0?100:0;
  return 100/(1+Math.exp(-0.00368208*score));
}
export function moveAccuracy(loss) {return Number(Math.max(0,Math.min(100,100*Math.exp(-0.045*Math.max(0,loss)))).toFixed(1));}
export function lineToSan(fen,moves=[]) {
  const board=new Chess(fen),line=[];
  for(const lan of moves.slice(0,12)) {
    try {const move=board.move(lan);if(!move)break;line.push(move.san);}catch{break;}
  }
  return line;
}
export function reviewMetrics({fen,move,best,played,book=false,sacrifice=null}) {
  const mover=fen.split(/\s+/)[1];
  const playedBest=move===best.bestMove;
  const bestChance=winningChance(best.score),playedChance=winningChance(played.score);
  const winLoss=playedBest?0:Math.max(0,bestChance-playedChance);
  let tone;
  // Only label a critical best move when alternatives have also been searched.
  const second=best.variations?.filter(v=>v.pv?.[0]!==best.bestMove).sort((a,b)=>b.score-a.score)[0];
  if(sacrifice&&playedBest&&winLoss<=.8)tone='brilliant';
  else if(book&&winLoss<=1.8)tone='book';
  else if(playedBest&&second&&bestChance-winningChance(second.score)>=8)tone='great';
  else if(playedBest||winLoss<=.8)tone='best';
  else if(winLoss<=1.8)tone='excellent';
  else if(winLoss<=4.5)tone='good';
  else if(winLoss<=8)tone='inaccuracy';
  else if(winLoss<=16)tone='mistake';
  else if(bestChance>=70&&playedChance<=45)tone='miss';
  else tone='blunder';
  const labels={brilliant:'Brilliant',book:'Book',great:'Great',best:'Best',excellent:'Excellent',good:'Good',inaccuracy:'Inaccuracy',mistake:'Mistake',miss:'Miss',blunder:'Blunder'};
  const whiteScore=(mover==='w'?1:-1)*played.score;
  const whiteMate=played.mate==null?null:(mover==='w'?1:-1)*played.mate;
  return {mover,tone,label:labels[tone],bestMove:best.bestMove,bestSan:lineToSan(fen,[best.bestMove])[0]||'',
    detail:sacrifice?'Nước thí quân được kiểm tra bằng biến bắt quân: bên thí vẫn giữ thế không thua.':tone==='great'?'Giữ được lợi thế quan trọng mà những nước thay thế đã xét không giữ được.':undefined,
    sacrificeLine:sacrifice?lineToSan(fen,sacrifice.line):null,
    score:Math.round(played.score),bestScore:Math.round(best.score),whiteScore:Math.round(whiteScore),whiteMate,
    centipawnLoss:playedBest?0:Math.min(2000,Math.round(Math.max(0,best.score-played.score))),
    winLoss:Number(winLoss.toFixed(1)),accuracy:moveAccuracy(winLoss),bestWinChance:Number(bestChance.toFixed(1)),playedWinChance:Number(playedChance.toFixed(1)),
    depth:best.depth,replyDepth:played.depth,continuation:best.pv.slice(0,10),continuationSan:lineToSan(fen,best.pv),
    playedContinuationSan:lineToSan(fen,played.pv),
    variations:(best.variations||[]).slice(0,3).map(v=>({score:v.score,mate:v.mate,depth:v.depth,moves:v.pv.slice(0,10),san:lineToSan(fen,v.pv)}))};
}
