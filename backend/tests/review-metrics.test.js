import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {reviewMetrics,lineToSan,moveAccuracy} from '../src/lib/reviewMetrics.js';
import {needsPositionAnalysis} from '../src/lib/chatPosition.js';
import {sacrificeCandidates} from '../src/lib/moveSacrifice.js';
const fen=new Chess().fen();
test('review does not punish the engine best move for search noise or invent a sacrifice award',()=>{
  const best={bestMove:'e2e4',score:50,depth:22,pv:['e2e4','e7e5'],variations:[]};
  const metrics=reviewMetrics({fen,move:'e2e4',best,played:{...best,score:-30}});
  assert.equal(metrics.tone,'best');assert.equal(metrics.centipawnLoss,0);assert.equal(metrics.accuracy,100);
  assert.deepEqual(metrics.continuationSan,['e4','e5']);
});
test('review keeps score perspectives, mate labels and legal continuations consistent',()=>{
  const board=new Chess();board.move('e4');
  const best={bestMove:'e7e5',score:600,depth:24,pv:['e7e5'],variations:[]};
  const metrics=reviewMetrics({fen:board.fen(),move:'f7f6',best,played:{score:-100000,mate:-2,depth:24,pv:['f7f6']}});
  assert.equal(metrics.whiteScore,100000);assert.equal(metrics.whiteMate,2);assert.equal(metrics.tone,'miss');assert.equal(metrics.centipawnLoss,2000);
  assert.deepEqual(lineToSan(fen,['e2e4','e7e5','a1a8']),['e4','e5']);
  assert.ok(moveAccuracy(2)>moveAccuracy(20));
});
test('greetings, payment and rule questions do not launch a position search',()=>{
  assert.equal(needsPositionAnalysis('Xin chào',true),false);
  assert.equal(needsPositionAnalysis('Luật nhập thành là gì?',true),false);
  assert.equal(needsPositionAnalysis('Nên đi nước gì tiếp?',true),true);
  assert.equal(needsPositionAnalysis('Nên đi nước gì tiếp?',false),false);
});
test('only a verified sacrifice can earn Brilliant; ordinary exchanges cannot',()=>{
  const fen='5r1k/6pp/4Q2N/8/8/8/8/6K1 w - - 0 1';
  assert.deepEqual(sacrificeCandidates(fen,'e6g8'),['f8g8']);
  const best={bestMove:'e6g8',score:99998,mate:2,depth:18,pv:['e6g8','f8g8','h6f7'],variations:[]};
  assert.equal(reviewMetrics({fen,move:'e6g8',best,played:best}).tone,'best');
  assert.equal(reviewMetrics({fen,move:'e6g8',best,played:best,sacrifice:{line:best.pv}}).tone,'brilliant');
  assert.deepEqual(sacrificeCandidates('6k1/5ppp/8/8/4q3/8/5PPP/4R1K1 w - - 0 1','e1e4'),[]);
});
