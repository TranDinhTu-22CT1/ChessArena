export function botStrength(elo) {
  const rating = Math.max(1320, Math.min(3190, Number(elo) || 1600));

  if (rating <= 1320) return { skillLevel: 3, elo: rating, movetime: 350 };
  if (rating <= 1600) return { skillLevel: 8, elo: rating, movetime: 500 };
  if (rating <= 2000) return { skillLevel: 13, elo: rating, movetime: 700 };
  if (rating <= 2400) return { skillLevel: 17, elo: rating, movetime: 950 };
  if (rating < 3190) return { skillLevel: 20, elo: rating, movetime: 1300 };
  return { skillLevel: 20, elo: null, movetime: 1800 };
}

export function engineStrength(elo, fullStrength = false) {
  return fullStrength
    ? { skillLevel: 20, elo: null, movetime: 1800 }
    : botStrength(elo);
}
