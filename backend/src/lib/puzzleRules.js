import { PUZZLE_POSITIONS } from './puzzlePositions.js';
import { engineInputError, enginePosition, legalMove } from './enginePosition.js';

export function dailyPuzzle(date = new Date().toISOString().slice(0, 10)) {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  return PUZZLE_POSITIONS[((Number.isFinite(day) ? day : 0) % PUZZLE_POSITIONS.length + PUZZLE_POSITIONS.length) % PUZZLE_POSITIONS.length];
}

export function selectPuzzle(payload, random = Math.random) {
  // Daily assignment is the same for everybody, regardless of filters/history.
  if (payload.mode === 'daily') return dailyPuzzle();
  const excluded = new Set(Array.isArray(payload.excluded) ? payload.excluded.slice(-500) : []);
  const pool = PUZZLE_POSITIONS.filter((p) => !excluded.has(p.id)
    && (!payload.theme || payload.theme === 'all' || p.theme === payload.theme)
    && (!payload.stage || payload.stage === 'all' || p.stage === payload.stage)
    && p.rating >= (Number(payload.minRating) || 0) && p.rating <= (Number(payload.maxRating) || 4000));
  if (!pool.length) return null;
  if (payload.mode === 'rush' || payload.mode === 'streak') return pool.sort((a, b) => a.rating - b.rating)[0];
  if (payload.mode === 'rated') {
    const target = Math.max(100, Math.min(4000, Number(payload.rating) || 800));
    pool.sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target));
    return pool[Math.floor(random() * Math.min(3, pool.length))];
  }
  return pool[Math.floor(random() * pool.length)];
}

export function publicPuzzle(puzzle) {
  return { id: puzzle.id, fen: puzzle.fen, theme: puzzle.theme, stage: puzzle.stage, rating: puzzle.rating,
    sideToMove: puzzle.fen.split(' ')[1], playerMoves: Math.ceil((puzzle.line?.length || 1) / 2) };
}

export function checkCatalogMove(puzzle, move, playedMoves = []) {
  if (!Array.isArray(playedMoves) || playedMoves.length % 2 !== 0 || playedMoves.length >= puzzle.line.length
      || playedMoves.some((lan, i) => lan !== puzzle.line[i])) throw engineInputError('Tiến trình câu đố không hợp lệ. Hãy tải lại.');
  const board = enginePosition(puzzle.fen, playedMoves);
  const legal = legalMove(board, move);
  if (!legal) throw engineInputError('Nước đi không hợp lệ.');
  board.move(legal);
  const accepted = move === puzzle.line[playedMoves.length] || board.isCheckmate();
  if (!accepted) return { accepted: false, complete: false };
  const history = [...playedMoves, move];
  const complete = board.isCheckmate() || history.length === puzzle.line.length;
  const reply = complete ? null : puzzle.line[history.length];
  if (reply) { board.move(reply); history.push(reply); }
  return { accepted: true, complete, reply, playedMoves: history, fen: board.fen() };
}
