import { Chess } from 'chess.js';
import { FILES } from './constants';

export function newLocalGameId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `game-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function safeUserId(value) {
  return String(value || 'guest')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'guest';
}

export function resolvePlayerColor(choice) {
  if (choice === 'random') return Math.random() < 0.5 ? 'w' : 'b';
  return choice;
}

export function squareName(row, col, flipped) {
  const rank = flipped ? row + 1 : 8 - row;
  const file = flipped ? FILES[7 - col] : FILES[col];
  return `${file}${rank}`;
}

export function statusText(game) {
  if (game.isCheckmate()) {
    return `${game.turn() === 'w' ? 'Đen' : 'Trắng'} thắng bằng chiếu hết`;
  }
  if (game.isDraw()) return 'Hòa cờ';
  if (game.isCheck()) return `${game.turn() === 'w' ? 'Trắng' : 'Đen'} đang bị chiếu`;
  return `Lượt ${game.turn() === 'w' ? 'Trắng' : 'Đen'}`;
}

export function gameResult(game) {
  if (game.isCheckmate()) return game.turn() === 'w' ? '0-1' : '1-0';
  if (game.isDraw()) return '1/2-1/2';
  return '*';
}

export function gameOutcome(game, playerColor) {
  if (!game.isGameOver()) return null;

  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? 'b' : 'w';
    return {
      type: winner === playerColor ? 'win' : 'loss',
      title: winner === playerColor ? 'Bạn thắng' : 'Bạn thua',
      detail: `${winner === 'w' ? 'Trắng' : 'Đen'} thắng bằng chiếu hết`
    };
  }

  if (game.isDraw()) {
    let detail = 'Hòa cờ';
    if (game.isStalemate()) detail = 'Hòa do hết nước đi hợp lệ';
    else if (game.isThreefoldRepetition()) detail = 'Hòa do lặp lại thế cờ ba lần';
    else if (game.isInsufficientMaterial()) detail = 'Hòa do không đủ quân chiếu hết';

    return {
      type: 'draw',
      title: 'Ván đấu hòa',
      detail
    };
  }

  return null;
}

export function buildMoveLog(game, gameId, playerColor, aiLevel, userId, displayName, timeControl, resultOverride = null) {
  const now = new Date();
  const result = resultOverride || gameResult(game);
  const moves = game.history({ verbose: true }).map((move, index) => ({
    ply: index + 1,
    moveNumber: Math.floor(index / 2) + 1,
    color: move.color === 'w' ? 'white' : 'black',
    san: move.san,
    lan: `${move.from}${move.to}${move.promotion ?? ''}`,
    from: move.from,
    to: move.to,
    piece: move.piece,
    captured: move.captured ?? null,
    promotion: move.promotion ?? null,
    flags: move.flags
  }));

  return {
    gameId,
    userId,
    displayName,
    playerColor,
    aiElo: aiLevel.elo,
    standard: 'PGN/SAN/FEN',
    savedAt: now.toISOString(),
    headers: {
      Event: 'Chess Arena Local AI',
      Site: 'Local',
      Date: now.toISOString().slice(0, 10).replaceAll('-', '.'),
      Round: '1',
      White: playerColor === 'w' ? displayName : `AI ${aiLevel.elo}`,
      Black: playerColor === 'b' ? displayName : `AI ${aiLevel.elo}`,
      Result: result,
      TimeControl: timeControl?.id ?? '600+0',
      Termination: result === '*' ? 'Unterminated' : 'Normal'
    },
    fen: game.fen(),
    pgn: game.pgn(),
    result,
    moves
  };
}

export function generateChess960Fen() {
  const squares = Array(8).fill(null);
  const darkBishop = [0, 2, 4, 6][Math.floor(Math.random() * 4)];
  const lightBishop = [1, 3, 5, 7][Math.floor(Math.random() * 4)];
  squares[darkBishop] = 'b';
  squares[lightBishop] = 'b';

  const emptyAfterBishops = squares.map((piece, index) => (piece ? null : index)).filter((index) => index !== null);
  const queenIndex = emptyAfterBishops[Math.floor(Math.random() * emptyAfterBishops.length)];
  squares[queenIndex] = 'q';

  const emptyAfterQueen = squares.map((piece, index) => (piece ? null : index)).filter((index) => index !== null);
  const knightOne = emptyAfterQueen[Math.floor(Math.random() * emptyAfterQueen.length)];
  squares[knightOne] = 'n';
  const emptyAfterKnightOne = squares.map((piece, index) => (piece ? null : index)).filter((index) => index !== null);
  const knightTwo = emptyAfterKnightOne[Math.floor(Math.random() * emptyAfterKnightOne.length)];
  squares[knightTwo] = 'n';

  const remaining = squares.map((piece, index) => (piece ? null : index)).filter((index) => index !== null).sort((a, b) => a - b);
  squares[remaining[0]] = 'r';
  squares[remaining[1]] = 'k';
  squares[remaining[2]] = 'r';

  const blackBackRank = squares.join('');
  const whiteBackRank = blackBackRank.toUpperCase();

  // Castling is disabled until the move generator is upgraded for full Chess960 castling semantics.
  return `${blackBackRank}/pppppppp/8/8/8/8/PPPPPPPP/${whiteBackRank} w - - 0 1`;
}

export function replayGameAt(history, ply, initialFen = null) {
  const reviewGame = initialFen ? new Chess(initialFen) : new Chess();
  history.slice(0, ply).forEach((move) => {
    reviewGame.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' });
  });
  return reviewGame;
}

export function createGameState(moves = [], initialFen = null) {
  const chess = initialFen ? new Chess(initialFen) : new Chess();
  const playedMoves = [];

  moves.forEach((move) => {
    const playedMove = chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion ?? 'q'
    });

    if (playedMove) {
      playedMoves.push(playedMove);
    }
  });

  return { chess, moves: playedMoves };
}
