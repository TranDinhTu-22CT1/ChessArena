import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { createStockfish } from '../../src/lib/stockfishEngine.js';
import { COACH_LESSON_POSITIONS, buildCoachInsight } from '../../../Frontend/src/coach/coach.js';

test('installed Stockfish plays legal moves in full games and both sides of coach lessons', {timeout:30000}, async () => {
  const engine=createStockfish();
  try {
    await engine.init({threads:1,hash:16});
    for(const fen of [new Chess().fen(), COACH_LESSON_POSITIONS.middlegame[2].fen, COACH_LESSON_POSITIONS.endgame[2].fen]) {
      const board=new Chess(fen);
      const {bestMove,score}=await engine.analyze({fen,movetime:120});
      const move=board.move({from:bestMove.slice(0,2),to:bestMove.slice(2,4),promotion:bestMove[4]});
      assert.ok(move);
      assert.ok(Number.isFinite(score));
      const insight=buildCoachInsight({analysis:{tone:'best',bestMove,whiteScore:move.color==='w'?score:-score},latestMove:move,playerColor:move.color,aiElo:1600,coachMode:'basic'});
      assert.equal(insight.bestMove,'');
      assert.equal(insight.quality,'Tốt nhất');
      assert.match(insight.messages[0],new RegExp(move.san.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    }
  } finally {engine.close();}
});
