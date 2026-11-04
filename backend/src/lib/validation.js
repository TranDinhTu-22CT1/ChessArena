const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const PIECE_SET_IDS = new Set(['classic', 'glass', 'bold', 'neo', 'marble', 'shadow', 'royal', 'minimal']);

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function isMissingTableError(error, tableName = '') {
  const message = String(error?.message || '').toLowerCase();
  const table = String(tableName || '').toLowerCase();
  return error?.code === 'PGRST205'
    || (message.includes('could not find the table') && (!table || message.includes(table)))
    || (message.includes('schema cache') && (!table || message.includes(table)));
}

export async function readJsonPayload(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function validateSessionPayload(payload) {
  if (!isPlainObject(payload) || typeof payload.idToken !== 'string' || payload.idToken.length < 20) {
    return 'Missing or invalid Firebase ID token';
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
  if (typeof log.gameId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(log.gameId)) return 'Invalid game id';
  if (typeof log.userId !== 'string' || log.userId.length > 80) return 'Invalid user id';
  if (!['w', 'b'].includes(log.playerColor)) return 'Invalid player color';
  if (!Number.isInteger(Number(log.aiElo)) || Number(log.aiElo) < 0 || Number(log.aiElo) > 4000) return 'Invalid AI rating';
  if (typeof log.fen !== 'string' || log.fen.length < 8 || log.fen.length > 200) return 'Invalid FEN';
  if (!Array.isArray(log.moves)) return 'Invalid move list';
  if (log.moves.length === 0) return 'Empty games are not logged';
  if (!['1-0', '0-1', '1/2-1/2'].includes(log.result)) return 'Only completed games are logged';
  if (log.moves.length > 2000) return 'Too many moves';
  if (typeof log.savedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(log.savedAt)
      || !Number.isFinite(Date.parse(log.savedAt))) return 'Invalid save date';
  if (typeof log.pgn !== 'string' || log.pgn.length > 200_000) return 'Invalid PGN';
  if (!isPlainObject(log.headers) || JSON.stringify(log.headers).length > 16_000) return 'Invalid PGN headers';
  if (log.moves.some((move, index) => !isPlainObject(move) || move.ply !== index + 1
    || move.moveNumber !== Math.floor(index / 2) + 1 || !['white', 'black'].includes(move.color)
    || !/^[a-h][1-8]$/.test(move.from) || !/^[a-h][1-8]$/.test(move.to)
    || !['p', 'n', 'b', 'r', 'q', 'k'].includes(move.piece)
    || typeof move.san !== 'string' || move.san.length > 20
    || typeof move.lan !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move.lan)
    || (move.promotion != null && !['q', 'r', 'b', 'n'].includes(move.promotion)))) return 'Invalid move list';
  return null;
}

export function sanitizeTheme(value) {
  if (!isPlainObject(value)) return null;
  // Missing keys inherit public defaults. Store only explicit user choices so
  // changing the piece set does not freeze every website appearance default.
  const theme = {};
  for (const key of ['accent', 'lightSquare', 'darkSquare', 'surface', 'page']) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== 'string' || !HEX_COLOR.test(value[key])) return null;
    theme[key] = value[key];
  }
  if (value.pieceSet !== undefined) theme.pieceSet = sanitizePieceSet(value.pieceSet);
  if (value.appearance !== undefined) {
    if (!['system', 'dark', 'light', 'custom'].includes(value.appearance)) return null;
    theme.appearance = value.appearance;
  }
  return theme;
}

export function sanitizePieceSet(value) {
  return PIECE_SET_IDS.has(value) ? value : 'classic';
}
