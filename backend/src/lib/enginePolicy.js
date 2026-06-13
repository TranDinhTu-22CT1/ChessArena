export function botStrength(elo) {
  const rating = Math.max(1320, Math.min(3190, Number(elo) || 1600));

  if (rating <= 1320) return { skillLevel: 4, elo: rating, movetime: 450 };
  if (rating <= 1600) return { skillLevel: 9, elo: rating, movetime: 650 };
  if (rating <= 2000) return { skillLevel: 14, elo: rating, movetime: 900 };
  if (rating <= 2400) return { skillLevel: 18, elo: rating, movetime: 1250 };
  if (rating < 3190) return { skillLevel: 20, elo: rating, movetime: 1800 };
  return { skillLevel: 20, elo: null, movetime: 2400 };
}

export function engineStrength(elo, fullStrength = false) {
  return fullStrength
    ? { skillLevel: 20, elo: null, movetime: 2400 }
    : botStrength(elo);
}
