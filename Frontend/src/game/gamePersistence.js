import { Chess } from 'chess.js';

export const AI_GAME_STORAGE_PREFIX = 'chessarena-ai-game:v2:';
export const LOCAL_GAME_STORAGE_KEY = 'chessarena-pass-and-play-last-game:v2';

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanMove(move) {
  const from = String(move?.from || '');
  const to = String(move?.to || '');
  const promotion = String(move?.promotion || '');
  if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return null;
  return { from, to, ...(promotion ? { promotion } : {}) };
}

export function portableMoves(moves) {
  return Array.isArray(moves) ? moves.map(cleanMove).filter(Boolean) : [];
}

export function validateStoredMoves(moves, initialFen = null) {
  try {
    const chess = initialFen ? new Chess(initialFen) : new Chess();
    const normalized = [];
    for (const candidate of portableMoves(moves)) {
      const played = chess.move({ ...candidate, promotion: candidate.promotion || 'q' });
      if (!played) return null;
      normalized.push(cleanMove(played));
    }
    return { chess, moves: normalized };
  } catch {
    return null;
  }
}

function parseStorage(storage, key) {
  try {
    return safeObject(JSON.parse(storage?.getItem(key) || 'null'));
  } catch {
    return {};
  }
}

export function loadAiGame(storage, mode) {
  if (!['bot', 'coach'].includes(mode)) return null;
  const value = parseStorage(storage, `${AI_GAME_STORAGE_PREFIX}${mode}`);
  if (value.version !== 2 || value.mode !== mode || value.started !== true) return null;
  const initialFen = typeof value.initialFen === 'string' && value.initialFen.trim() ? value.initialFen : null;
  const replay = validateStoredMoves(value.moves, initialFen);
  if (!replay) return null;
  return {
    ...value,
    initialFen,
    moves: replay.moves,
    gameId: String(value.gameId || ''),
    playerColor: value.playerColor === 'b' ? 'b' : 'w',
    sideChoice: ['w', 'b', 'random'].includes(value.sideChoice) ? value.sideChoice : 'w',
    aiElo: Math.max(100, Math.min(4000, Number(value.aiElo) || 1600)),
    selectedBotId: String(value.selectedBotId || ''),
    timeControlId: String(value.timeControlId || '600+0'),
    gameVariant: String(value.gameVariant || 'standard'),
    coachMode: String(value.coachMode || 'basic'),
    botOptions: safeObject(value.botOptions),
    lastMove: cleanMove(value.lastMove),
    manualResult: value.manualResult || null,
    resultDismissed: value.resultDismissed === true
  };
}

export function saveAiGame(storage, snapshot) {
  if (!storage || !['bot', 'coach'].includes(snapshot?.mode)) return false;
  try {
    storage.setItem(`${AI_GAME_STORAGE_PREFIX}${snapshot.mode}`, JSON.stringify({
      ...snapshot,
      version: 2,
      moves: portableMoves(snapshot.moves),
      savedAt: new Date().toISOString()
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearAiGame(storage, mode) {
  try { storage?.removeItem(`${AI_GAME_STORAGE_PREFIX}${mode}`); } catch { /* optional persistence */ }
}

export function loadLocalGame(storage, now = Date.now()) {
  const value = parseStorage(storage, LOCAL_GAME_STORAGE_KEY);
  if (value.version !== 2 || value.started !== true) return null;
  const replay = validateStoredMoves(value.moves);
  if (!replay) return null;
  const clocks = {
    w: Math.max(0, Number(value.clocks?.w) || 0),
    b: Math.max(0, Number(value.clocks?.b) || 0)
  };
  let timeWinner = value.timeWinner === 'w' || value.timeWinner === 'b' ? value.timeWinner : null;
  const resignedColor = value.resignedColor === 'w' || value.resignedColor === 'b' ? value.resignedColor : null;
  const alreadyFinished = Boolean(timeWinner || resignedColor || replay.chess.isGameOver());
  if (!alreadyFinished) {
    const elapsed = Math.max(0, (now - Date.parse(value.savedAt || '')) / 1000);
    const active = replay.chess.turn();
    if (Number.isFinite(elapsed)) clocks[active] = Math.max(0, clocks[active] - elapsed);
    if (clocks[active] <= 0) timeWinner = active === 'w' ? 'b' : 'w';
  }
  return {
    moves: replay.moves,
    clocks,
    timeWinner,
    resignedColor,
    names: {
      w: String(value.names?.w || 'Người chơi Trắng').slice(0, 80),
      b: String(value.names?.b || 'Người chơi Đen').slice(0, 80)
    },
    timeControlId: String(value.timeControlId || '600+0'),
    flipped: value.flipped === true,
    started: true
  };
}

export function saveLocalGame(storage, snapshot) {
  if (!storage || snapshot?.started !== true) return false;
  try {
    storage.setItem(LOCAL_GAME_STORAGE_KEY, JSON.stringify({
      ...snapshot,
      version: 2,
      moves: portableMoves(snapshot.moves),
      savedAt: new Date().toISOString()
    }));
    return true;
  } catch {
    return false;
  }
}
