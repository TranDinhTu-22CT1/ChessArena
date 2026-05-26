import React from 'react';
import { buildMoveLog } from '../game/chessLogic';

export function useApiGameLog({
  game,
  gameFen,
  historyLength,
  gameId,
  playerColor,
  aiLevel,
  userId,
  userName,
  timeControl,
  outcomeResult
}) {
  const [apiOnline, setApiOnline] = React.useState(null);
  const savedServerLogRef = React.useRef(null);

  React.useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/health`)
      .then((response) => setApiOnline(response.ok))
      .catch(() => setApiOnline(false));
  }, []);

  React.useEffect(() => {
    if (historyLength === 0) return;

    const log = buildMoveLog(game, gameId, playerColor, aiLevel, userId, userName, timeControl, outcomeResult);

    if (!outcomeResult || savedServerLogRef.current === gameId) return;

    savedServerLogRef.current = gameId;
    fetch(`${import.meta.env.VITE_API_URL}/api/game/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log)
    })
      .then((response) => setApiOnline(response.ok))
      .catch(() => setApiOnline(false));
  }, [aiLevel, game, gameFen, gameId, historyLength, outcomeResult, playerColor, timeControl, userId, userName]);

  const resetSavedGameLog = React.useCallback(() => {
    savedServerLogRef.current = null;
  }, []);

  return {
    apiOnline,
    setApiOnline,
    resetSavedGameLog
  };
}
