const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateSessionPayload(payload) {
  if (!isPlainObject(payload) || typeof payload.idToken !== 'string' || payload.idToken.length < 20) {
    return 'Missing or invalid Firebase ID token';
  }

  if (payload.deviceId !== undefined && payload.deviceId !== null && typeof payload.deviceId !== 'string') {
    return 'Invalid device id';
  }

  if (payload.profile !== undefined && payload.profile !== null) {
    if (!isPlainObject(payload.profile)) return 'Invalid profile';
    if (payload.profile.displayName !== undefined && typeof payload.profile.displayName !== 'string') {
      return 'Invalid profile display name';
    }
    if (payload.profile.githubLogin !== undefined && typeof payload.profile.githubLogin !== 'string') {
      return 'Invalid GitHub login';
    }
    if (payload.profile.githubName !== undefined && typeof payload.profile.githubName !== 'string') {
      return 'Invalid GitHub name';
    }
    if (payload.profile.photoURL !== undefined && typeof payload.profile.photoURL !== 'string') {
      return 'Invalid profile photo';
    }
  }

  return null;
}

export function validateGameLogPayload(log) {
  if (!isPlainObject(log)) return 'Invalid log payload';
  if (typeof log.gameId !== 'string' || log.gameId.length > 100) return 'Invalid game id';
  if (typeof log.userId !== 'string' || log.userId.length > 80) return 'Invalid user id';
  if (!['w', 'b'].includes(log.playerColor)) return 'Invalid player color';
  if (!Number.isFinite(Number(log.aiElo))) return 'Invalid AI rating';
  if (typeof log.fen !== 'string' || log.fen.length < 8) return 'Invalid FEN';
  if (!Array.isArray(log.moves)) return 'Invalid move list';
  if (log.moves.length === 0) return 'Empty games are not logged';
  if (!['1-0', '0-1', '1/2-1/2'].includes(log.result)) return 'Only completed games are logged';
  return null;
}

export function sanitizeTheme(value) {
  if (!isPlainObject(value)) return null;

  const theme = {
    accent: value.accent,
    lightSquare: value.lightSquare,
    darkSquare: value.darkSquare,
    surface: value.surface,
    page: value.page
  };

  return Object.values(theme).every((color) => typeof color === 'string' && HEX_COLOR.test(color))
    ? theme
    : null;
}
