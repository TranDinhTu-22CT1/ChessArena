import { isUuid } from './puzzleUtils.js';

export function botStrength(elo, range = { min: 1320, max: 3190 }) {
  const rating = Math.max(250, Math.min(3200, Math.round(Number(elo) || 1600)));
  const beginner = rating < range.min;
  return {
    rating,
    skillLevel: 20,
    elo: Math.max(range.min, Math.min(range.max, rating)),
    mode: beginner ? 'beginner-estimate' : rating > range.max ? 'ceiling-estimate' : 'uci-elo',
    oversight: beginner ? 0.85 * ((range.min - rating) / (range.min - 250)) ** 1.5 : 0,
    movetime: Math.round(450 + (rating - 250) / 2950 * 1550),
    depth: 24
  };
}

export function engineStrength(elo, fullStrength = false, range) {
  return fullStrength
    ? { skillLevel: 20, elo: null, mode: 'analysis', movetime: 1800, depth: 24 }
    : botStrength(elo, range);
}

// Below Stockfish's supported Elo, a smooth oversight probability distinguishes
// beginner levels. These are estimates, not calibrated human/FIDE ratings.
export function chooseBeginnerMove(board, engineMove, profile, random = Math.random) {
  if (!profile.oversight || random() >= profile.oversight) return engineMove;
  const moves = board.moves({ verbose: true });
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const weighted = moves.map((move) => ({ move, weight: 1
    + Math.min(3, (values[move.captured] || 0) / 2)
    + (move.promotion === 'q' ? 3 : 0) + (move.san.includes('#') ? 4 : 0) }));
  let draw = random() * weighted.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of weighted) {
    draw -= entry.weight;
    if (draw <= 0) return entry.move.lan;
  }
  return engineMove;
}

export async function resolvePlayingElo(payload, loadBot, now = Date.now()) {
  if (payload.fullStrength === true || !payload.botId) return Number(payload.elo) || 1600;
  if (!isUuid(payload.botId)) throw Object.assign(new Error('Mã bot không hợp lệ.'), { status: 400 });
  const bot = await loadBot(payload.botId);
  if (!bot || !bot.active || (bot.starts_at && Date.parse(bot.starts_at) > now)
      || (bot.ends_at && Date.parse(bot.ends_at) < now)) {
    throw Object.assign(new Error('Bot này đã ngừng hoạt động. Hãy chọn bot khác.'), { status: 409 });
  }
  if (!Number.isFinite(Number(bot.elo)) || Number(bot.elo) < 250 || Number(bot.elo) > 3200) {
    throw Object.assign(new Error('Elo của bot chưa hợp lệ. Quản trị viên cần cập nhật lại.'), { status: 409 });
  }
  return Math.round(Number(bot.elo));
}
