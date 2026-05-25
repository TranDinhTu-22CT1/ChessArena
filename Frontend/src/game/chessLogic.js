import { Chess } from 'chess.js';
import { FILES, PIECE_VALUES } from './constants';

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
    return `${game.turn() === 'w' ? 'Black' : 'White'} wins by checkmate`;
  }
  if (game.isDraw()) return 'Draw';
  if (game.isCheck()) return `${game.turn() === 'w' ? 'White' : 'Black'} is in check`;
  return `${game.turn() === 'w' ? 'White' : 'Black'} to move`;
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
      title: winner === playerColor ? 'You won' : 'You lost',
      detail: `${winner === 'w' ? 'White' : 'Black'} wins by checkmate`
    };
  }

  if (game.isDraw()) {
    let detail = 'Draw';
    if (game.isStalemate()) detail = 'Draw by stalemate';
    else if (game.isThreefoldRepetition()) detail = 'Draw by threefold repetition';
    else if (game.isInsufficientMaterial()) detail = 'Draw by insufficient material';

    return {
      type: 'draw',
      title: 'Game drawn',
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

export function evaluateBoard(chess) {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -999999 : 999999;
  }

  if (chess.isDraw()) return 0;

  let score = 0;
  const board = chess.board();

  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;
      const value = PIECE_VALUES[piece.type];
      score += piece.color === 'w' ? value : -value;
    }
  }

  const legalMoves = chess.moves().length;
  score += chess.turn() === 'w' ? legalMoves * 2 : -legalMoves * 2;

  if (chess.isCheck()) {
    score += chess.turn() === 'w' ? -35 : 35;
  }

  return score;
}

function moveScoreDelta(chess, move, color) {
  const before = evaluateBoard(chess);
  chess.move(move);
  const after = evaluateBoard(chess);
  chess.undo();
  return color === 'w' ? after - before : before - after;
}

function classifyDelta(loss) {
  if (loss <= 15) return { label: 'Best', tone: 'best' };
  if (loss <= 55) return { label: 'Good', tone: 'good' };
  if (loss <= 130) return { label: 'Inaccuracy', tone: 'inaccuracy' };
  if (loss <= 280) return { label: 'Mistake', tone: 'mistake' };
  return { label: 'Blunder', tone: 'blunder' };
}

export function analyzeMoves(history) {
  const chess = new Chess();

  return history.map((playedMove, index) => {
    const legalMoves = chess.moves({ verbose: true });
    const color = chess.turn();
    const scoredMoves = legalMoves.map((move) => ({
      move,
      delta: moveScoreDelta(chess, move, color)
    }));

    scoredMoves.sort((a, b) => b.delta - a.delta);
    const best = scoredMoves[0];
    const played = scoredMoves.find((item) => item.move.from === playedMove.from
      && item.move.to === playedMove.to
      && (item.move.promotion ?? '') === (playedMove.promotion ?? ''));
    const loss = Math.max(0, (best?.delta ?? 0) - (played?.delta ?? 0));
    const classification = classifyDelta(loss);

    chess.move({
      from: playedMove.from,
      to: playedMove.to,
      promotion: playedMove.promotion ?? 'q'
    });

    return {
      ply: index + 1,
      san: playedMove.san,
      color,
      bestSan: best?.move?.san ?? playedMove.san,
      centipawnLoss: Math.round(loss),
      ...classification
    };
  });
}

function minimax(chess, depth, alpha, beta, maximizingWhite) {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess);
  }

  const moves = chess.moves({ verbose: true });

  if (maximizingWhite) {
    let best = -Infinity;
    for (const move of moves) {
      chess.move(move);
      best = Math.max(best, minimax(chess, depth - 1, alpha, beta, false));
      chess.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    chess.move(move);
    best = Math.min(best, minimax(chess, depth - 1, alpha, beta, true));
    chess.undo();
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseAiMove(fen, level) {
  const chess = new Chess(fen);
  const aiColor = chess.turn();
  const moves = chess.moves({ verbose: true });

  if (moves.length === 0) return null;

  const scoredMoves = moves.map((move) => {
    chess.move(move);
    const score = minimax(chess, level.depth - 1, -Infinity, Infinity, chess.turn() === 'w');
    chess.undo();
    return {
      move,
      score
    };
  });

  scoredMoves.sort((a, b) => (aiColor === 'w' ? b.score - a.score : a.score - b.score));

  if (Math.random() < level.blunderRate) {
    const pool = scoredMoves.slice(0, Math.min(level.candidatePool, scoredMoves.length));
    return pool[Math.floor(Math.random() * pool.length)].move;
  }

  return scoredMoves[0].move;
}
