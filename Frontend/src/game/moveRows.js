// A lesson can begin with Black to move and at any move number.
export function moveRows(history, initialFen) {
  const rows = [];
  let number = Number(initialFen?.split(/\s+/)[5]) || 1;
  history.forEach((move, index) => {
    const moveNumber = Number(move.before?.split(/\s+/)[5]) || number;
    if (!rows.length || rows.at(-1).number !== moveNumber) rows.push({ number: moveNumber });
    rows.at(-1)[move.color] = { ...move, ply: index + 1 };
    number = moveNumber + (move.color === 'b' ? 1 : 0);
  });
  return rows;
}
