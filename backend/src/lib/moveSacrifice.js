import {enginePosition} from './enginePosition.js';

const value={p:100,n:300,b:320,r:500,q:900,k:0};
// A sacrifice needs a legal capture and a real material investment. Ordinary
// exchanges, promotions, forced single legal moves and immediate mates are excluded.
export function sacrificeCandidates(fen,lan) {
  const board=enginePosition(fen);
  if(board.moves().length<2)return [];
  const move=board.move(lan);
  if(move.promotion||move.san.includes('#')||(value[move.piece]||0)<300)return [];
  return board.moves({verbose:true}).filter(reply=>reply.to===move.to&&reply.captured===move.piece)
    .filter(reply=>{
      const replay=enginePosition(fen,[lan,reply.lan]);
      const recapture=replay.moves({verbose:true}).some(candidate=>candidate.to===reply.to&&candidate.captured);
      const recovered=(value[move.captured]||0)+(recapture?(value[reply.piece]||0):0);
      return value[move.piece]-recovered>=150;
    }).sort((a,b)=>(value[a.piece]||0)-(value[b.piece]||0)).slice(0,2).map(reply=>reply.lan);
}
