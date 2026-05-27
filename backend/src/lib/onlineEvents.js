const listeners = new Map();

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
  const gameListeners = listeners.get(String(gameId));
  if (!gameListeners) return;
  for (const listener of gameListeners) {
    listener(payload);
  }
}
