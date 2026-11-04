import { enginePosition } from './enginePosition.js';
import { withStockfishEngine } from './stockfishEngine.js';
import { lineToSan } from './reviewMetrics.js';

const cache=new Map();
export function needsPositionAnalysis(question,hasBoard) {
  if(!hasBoard)return false;
  const text=String(question).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
  if(/\b(luat|tieu su|la ai|xin chao|hello|thanh toan|tai khoan|paypal)\b/.test(text))return false;
  return /\b(nuoc|the co|hien tai|fen|pgn|phan tich|ke hoach|di gi|nen di|position|best|sai|chien thuat|tai sao|vi sao)\b/.test(text);
}
export async function analyzeChatPosition(fen,{signal}={}) {
  const board=enginePosition(fen);
  const key=board.fen();const cached=cache.get(key);
  if(cached?.until>Date.now())return cached.value;
  const result=await withStockfishEngine({signal},async engine=>{
    await engine.configure({multiPv:3});
    return engine.analyze({fen:key,movetime:900,depth:28});
  });
  const value={fen:key,engine:result.engine||'Stockfish 18',depth:result.depth,turn:board.turn(),
    check:board.inCheck(),terminal:board.isGameOver(),checkmate:board.isCheckmate(),
    score:result.score,mate:result.mate,bestSan:lineToSan(key,[result.bestMove])[0]||null,
    variations:(result.variations||[]).slice(0,3).map(v=>({score:v.score,mate:v.mate,depth:v.depth,san:lineToSan(key,v.pv)}))};
  if(cache.size>=96)cache.delete(cache.keys().next().value);
  cache.set(key,{value,until:Date.now()+120000});
  return value;
}
