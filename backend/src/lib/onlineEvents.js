import { onlineGameState } from './onlineGameState.js';
// Next bundles route handlers independently. All bundles in this process must
// publish into the same bus; Postgres Realtime covers other server processes.
const busKey = Symbol.for('chessarena.onlineGameListeners');
const listeners = globalThis[busKey] ||= new Map();

export function subscribeOnlineGame(gameId, listener) {
  const key = String(gameId);
  const gameListeners = listeners.get(key) || new Set();
  gameListeners.add(listener);
  listeners.set(key, gameListeners);

  return () => {
    gameListeners.delete(listener);
    if (gameListeners.size === 0) listeners.delete(key);
  };
}

export function publishOnlineGame(gameId, payload = null) {
  if(payload?.game?.id===gameId && Array.isArray(payload.moves)) onlineGameState.remember(payload.game,payload.moves);
  else if(payload?.type!=='chat') onlineGameState.remove(gameId);
  const gameListeners = listeners.get(String(gameId));
  if (!gameListeners) return;
  for (const listener of gameListeners) {
    // A disconnected listener must not turn a committed move into a failed request.
    try { Promise.resolve(listener(payload)).catch(() => {}); } catch { /* Isolate listeners. */ }
  }
}
