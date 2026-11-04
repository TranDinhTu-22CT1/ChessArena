import { Chess } from 'chess.js';

export function engineInputError(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export function legalMove(board, lan) {
  if (typeof lan !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(lan)) return null;
  return board.moves({ verbose: true }).find((move) => move.lan === lan) || null;
}

// chess.js validates FEN syntax; Stockfish also needs a position with no king capture.
export function enginePosition(fen, moves = []) {
  if (typeof fen !== 'string' || fen.length > 120 || /[\r\n]/.test(fen)
      || !Array.isArray(moves) || moves.length > 512) throw engineInputError('Thế cờ không hợp lệ.');
  let board;
  try { board = new Chess(fen); } catch { throw engineInputError('Thế cờ không hợp lệ.'); }
  const pieces = board.board().flat().filter(Boolean);
  const opponent = board.turn() === 'w' ? 'b' : 'w';
  const king = pieces.find((piece) => piece.type === 'k' && piece.color === opponent);
  if (!king || board.isAttacked(king.square, board.turn()) || pieces.length > 32
      || ['w', 'b'].some((color) => pieces.filter((p) => p.color === color).length > 16
        || pieces.filter((p) => p.color === color && p.type === 'p').length > 8)) {
    throw engineInputError('Thế cờ có vua hoặc số quân không hợp lệ.');
  }
  for (const lan of moves) {
    const move = legalMove(board, lan);
    if (!move) throw engineInputError('Nước đi không hợp lệ trong thế cờ này.');
    board.move(move);
  }
  return board;
}
