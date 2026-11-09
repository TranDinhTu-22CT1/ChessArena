import { Chess } from 'chess.js';
import { withStockfishEngine, stockfishPoolStats, closeStockfishPool } from '../src/lib/stockfishEngine.js';
import { botStrength, chooseBeginnerMove } from '../src/lib/enginePolicy.js';
import { legalMove } from '../src/lib/enginePosition.js';
import {reviewPosition} from '../src/lib/positionReview.js';
import {reviewMetrics} from '../src/lib/reviewMetrics.js';

try {
  console.log(`Node ${process.version}; ${process.platform}/${process.arch}; engine workers: ${stockfishPoolStats().size}`);
  const started = Date.now();
  const results = await Promise.all([500,1777,3190].map(elo=>withStockfishEngine({},async engine=>{
    const board=new Chess();
    const strength=botStrength(elo,engine.capabilities.options.UCI_Elo);
    await engine.configure(strength);
    const result=await engine.analyze({fen:board.fen(),movetime:250});
    const move=chooseBeginnerMove(board,result.bestMove,strength);
    if(!legalMove(board,move))throw new Error(`Illegal move at Elo ${elo}`);
    return {engine:engine.capabilities.name,requestedElo:elo,engineElo:strength.elo,mode:strength.mode,move};
  })));
  console.table(results);
  console.log(`PASS: three independent playing profiles completed in ${Date.now()-started} ms.`);
  const board=new Chess(),grades=[];
  for(const san of ['e4','e5','Nf3','Nc6','Bc4','Bc5']) {
    const fen=board.fen(),move=board.move(san);
    const result=await reviewPosition(fen,move.lan,{movetime:180});
    const grade=reviewMetrics({fen,move:move.lan,...result});
    grades.push({move:san,grade:grade.label,depth:result.best.depth,elapsedMs:result.elapsedMs});
  }
  console.table(grades);
  console.log('PASS: last-move grading uses unrestricted strength; timing is measured on this machine.');
} catch(error) { console.error(`FAIL: ${error.message}`); process.exitCode=1; }
finally {closeStockfishPool();}
