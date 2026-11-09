import { PUZZLE_POSITIONS } from '../src/lib/puzzlePositions.js';
import { createStockfish } from '../src/lib/stockfishEngine.js';
import { enginePosition } from '../src/lib/enginePosition.js';
const engine = createStockfish();
try {
  await engine.init();
  for (const puzzle of PUZZLE_POSITIONS) {
    try {
      const board = enginePosition(puzzle.fen);
      await engine.newGame();
      const result = await engine.analyze({ fen: puzzle.fen, movetime: 500, depth: 22 });
      const move = board.move(result.bestMove);
      console.log(JSON.stringify({ id: puzzle.id, theme: puzzle.theme, score: result.score, mate: result.mate,
        depth: result.depth, move: move.san, capture: move.captured, promotion: move.promotion, pv: result.pv.slice(0, 9) }));
    } catch (error) { console.log(JSON.stringify({id: puzzle.id, error: error.message})); }
  }
} finally {engine.close();}
