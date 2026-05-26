// Common master-played standard opening lines in UCI notation.
// Stockfish takes over as soon as play leaves this compact repertoire.
const OPENING_LINES = [
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1'],
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d4'],
  ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3'],
  ['e2e4', 'c7c5', 'g1f3', 'b8c6', 'd2d4', 'c5d4', 'f3d4', 'g7g6'],
  ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6', 'c1g5'],
  ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4', 'c8f5'],
  ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5d8', 'd2d4'],
  ['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c1g5', 'f8e7'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4', 'e2e3', 'e8g8'],
  ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6'],
  ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'd7d5', 'b1c3', 'f8e7'],
  ['c2c4', 'e7e5', 'b1c3', 'g8f6', 'g2g3', 'd7d5', 'c4d5', 'f6d5'],
  ['c2c4', 'g8f6', 'b1c3', 'e7e5', 'g1f3', 'b8c6', 'g2g3'],
  ['g1f3', 'd7d5', 'g2g3', 'g8f6', 'f1g2', 'g7g6', 'e1g1'],
  ['e2e4', 'e7e5', 'g1f3', 'g8f6', 'f3e5', 'd7d6', 'e5f3', 'f6e4'],
  ['e2e4', 'c7c5', 'b1c3', 'b8c6', 'g2g3', 'g7g6', 'f1g2'],
  ['d2d4', 'd7d5', 'c1f4', 'g8f6', 'e2e3', 'c7c5', 'c2c3'],
  ['e2e4', 'g7g6', 'd2d4', 'f8g7', 'b1c3', 'd7d6'],
  ['d2d4', 'f7f5', 'g2g3', 'g8f6', 'f1g2', 'g7g6'],
  ['c2c4', 'e7e6', 'g1f3', 'd7d5', 'd2d4', 'g8f6']
];

export function openingBookMoves(moves = []) {
  const prefix = moves.map(String);
  const candidates = OPENING_LINES
    .filter((line) => prefix.every((move, index) => line[index] === move) && line.length > prefix.length)
    .map((line) => line[prefix.length]);

  return [...new Set(candidates)];
}

export function chooseOpeningBookMove(moves = [], seed = '') {
  const candidates = openingBookMoves(moves);
  if (!candidates.length) return null;

  const hash = Array.from(String(seed)).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, moves.length + 1);
  return candidates[hash % candidates.length];
}

export function isOpeningBookMove(priorMoves = [], move = '') {
  return openingBookMoves(priorMoves).includes(move);
}
