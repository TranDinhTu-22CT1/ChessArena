import { checkCatalogMove } from './puzzleRules.js';
import { enginePosition, legalMove, engineInputError } from './enginePosition.js';
import { reviewPosition } from './positionReview.js';

export async function checkPuzzleAttempt(puzzle, move, playedMoves = [], signal) {
  const board = enginePosition(puzzle.fen, playedMoves);
  const legal = legalMove(board, move);
  if (!legal) throw engineInputError('Nước đi không hợp lệ.');
  if (puzzle.line) {
    const result = checkCatalogMove(puzzle, move, playedMoves);
    if (result.accepted || playedMoves.length !== puzzle.line.length - 1 || puzzle.theme === 'mate') return result;
    const expected = legalMove(board, puzzle.line.at(-1));
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    const achievesGoal = puzzle.theme === 'promotion' ? Boolean(legal.promotion)
      : Boolean(legal.captured) && (values[legal.captured] || 0) >= (values[expected?.captured] || 99);
    if (!achievesGoal) return result;
  } else if (playedMoves.length) throw engineInputError('Tiến trình câu đố không hợp lệ.');
  // Personal exercises and alternative winning captures/promotions are evaluated
  // again. An old saved solution is never blindly accepted after a position changes.
  const { best, playedScore } = await reviewPosition(board.fen(), move, { movetime: 700, signal });
  const accepted = puzzle.line ? playedScore > 200 && best.score - playedScore <= 50
    : move === best.bestMove || (best.score > 90000 ? playedScore > 90000 : best.score - playedScore <= 35);
  board.move(legal);
  return { accepted, complete: accepted, ...(accepted ? { fen: board.fen(), playedMoves: [...playedMoves, move] } : {}) };
}
