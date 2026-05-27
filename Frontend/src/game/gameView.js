const MATERIAL_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function formatClock(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);
  if (safeSeconds < 10) {
    const tenths = Math.floor((safeSeconds - Math.floor(safeSeconds)) * 10);
    return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`;
  }
  const roundedSeconds = Math.ceil(safeSeconds);
  return `${Math.floor(roundedSeconds / 60)}:${String(roundedSeconds % 60).padStart(2, '0')}`;
}

export function squareCenter(square, flipped) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank - 1 : 8 - rank;

  return {
    x: col * 12.5 + 6.25,
    y: row * 12.5 + 6.25
  };
}

export function squareTopLeft(square, flipped) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank - 1 : 8 - rank;

  return {
    x: `${col * 12.5}%`,
    y: `${row * 12.5}%`
  };
}

export function promotionPopoverStyle(square, color, flipped) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const col = flipped ? 7 - file : file;
  const row = flipped ? rank - 1 : 8 - rank;
  const x = Math.max(22, Math.min(78, col * 12.5 + 6.25));
  const y = color === 'w'
    ? Math.min(86, (row + 1) * 12.5 + 1.2)
    : Math.max(14, row * 12.5 - 1.2);

  return {
    left: `${x}%`,
    top: `${y}%`
  };
}

export function boardMaterialScore(chess) {
  return chess.board().flat().reduce((score, piece) => {
    if (!piece) return score;
    const value = MATERIAL_VALUES[piece.type] ?? 0;
    return score + (piece.color === 'w' ? value : -value);
  }, 0);
}

export function capturedPoints(captures) {
  return captures.reduce((total, piece) => total + (MATERIAL_VALUES[piece.type] ?? 0), 0);
}

export function engineBarPercent(whiteScore) {
  return Math.max(4, Math.min(96, 50 - Math.tanh((whiteScore || 0) / 650) * 44));
}
