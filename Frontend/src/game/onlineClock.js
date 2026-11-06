export function parseOnlineTimeControl(value) {
  const [base = '600', increment = '0'] = String(value || '600+0').split('+');
  return {
    baseSeconds: Math.max(0, Number(base) || 600),
    incrementSeconds: Math.max(0, Number(increment) || 0)
  };
}

export function computeOnlineClocks(game, now = Date.now()) {
  if (!game) return null;

  if (game.clocks && Number.isFinite(Number(game.clocks.w)) && Number.isFinite(Number(game.clocks.b))) {
    const clocks = { w: Number(game.clocks.w), b: Number(game.clocks.b) };
    const snapshotAt = Date.parse(game.clockSnapshotAt || game.updatedAt || '');
    if (game.status === 'active' && game.turn && Number.isFinite(snapshotAt)) {
      clocks[game.turn] = Math.max(0, clocks[game.turn] - Math.max(0, now - snapshotAt));
    }
    return clocks;
  }

  const { baseSeconds, incrementSeconds } = parseOnlineTimeControl(game.timeControl);
  const clocks = { w: baseSeconds * 1000, b: baseSeconds * 1000 };
  const moves = game.moves || [];
  let previousAt = Date.parse(
    game.startedAt || game.lastMoveAt || game.createdAt || game.updatedAt || new Date(now).toISOString()
  );

  for (const move of moves) {
    const moveAt = Date.parse(move.createdAt || game.lastMoveAt || game.updatedAt || new Date(now).toISOString());
    if (Number.isFinite(previousAt) && Number.isFinite(moveAt)) {
      clocks[move.color] = Math.max(0, clocks[move.color] - Math.max(0, moveAt - previousAt));
    }
    clocks[move.color] += incrementSeconds * 1000;
    previousAt = moveAt;
  }

  if (game.status === 'active' && game.turn && Number.isFinite(previousAt)) {
    clocks[game.turn] = Math.max(0, clocks[game.turn] - Math.max(0, now - previousAt));
  } else if (game.turn && game.finishedAt && Number.isFinite(previousAt)) {
    clocks[game.turn] = Math.max(0, clocks[game.turn] - Math.max(0, Date.parse(game.finishedAt) - previousAt));
  }

  return clocks;
}
