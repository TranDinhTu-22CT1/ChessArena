import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { answerCoachQuestion } from '../../src/lib/coachAnswer.js';
import { closeStockfishPool } from '../../src/lib/stockfishEngine.js';

test('chat uses real Stockfish for the last move and reads a supplied PGN without inventing another position',{timeout:60000},async()=>{
  const chess=new Chess();for(const san of ['f3','e5','g4'])chess.move(san);
  const last=chess.history({verbose:true}).at(-1);
  try{
    const reply=await answerCoachQuestion('Nước vừa rồi sai ở đâu?',{gameContext:{hasBoardContext:true,fen:chess.fen(),previousFen:last.before,latestLan:last.lan}});
    assert.equal(reply.knowledge.status,'grounded');assert.match(reply.answer,/Qh4#/);
    assert.match(reply.answer,/chiếu hết trong biến/);assert.ok(reply.position.depth>0);
    const pgnReply=await answerCoachQuestion('Phân tích PGN: 1. f3 e5 2. g4 Qh4#');
    assert.equal(pgnReply.knowledge.status,'grounded');assert.match(pgnReply.answer,/Trắng.*chiếu hết/);
  }finally{closeStockfishPool();}
});
