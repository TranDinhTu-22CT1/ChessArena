import React from 'react';
import { apiUrl } from '../api/config';
import { saveGameLog } from '../api/gameLog';
import { buildMoveLog } from '../game/chessLogic';

export function useApiGameLog({ game, gameFen, historyLength, gameId, playerColor, aiLevel,
  userId, userName, ownerId = 'guest', timeControl, outcomeResult }) {
  const [apiOnline, setApiOnline] = React.useState(null);
  const saved = React.useRef(new Set());
  const pending = React.useRef(new Map());

  React.useEffect(() => {
    let active = true;
    fetch(apiUrl('/api/health'), { signal: globalThis.AbortSignal.timeout(12_000) })
      .then(response => { if (active) setApiOnline(response.ok); })
      .catch(() => { if (active) setApiOnline(false); });
    return () => { active = false; };
  }, []);

  const persist = React.useCallback(task => {
    if (task.running || task.controller.signal.aborted) return;
    task.running = true;
    task.failed = false;
    saveGameLog(task.log, { signal: task.controller.signal }).then(() => {
      if (task.controller.signal.aborted) return;
      saved.current.add(task.key);
      pending.current.delete(task.key);
      setApiOnline(true);
    }).catch(() => {
      if (task.controller.signal.aborted) return;
      task.failed = true;
      setApiOnline(false);
    }).finally(() => { task.running = false; });
  }, []);

  React.useEffect(() => {
    const tasks = pending.current;
    const completed = saved.current;
    return () => {
      // Cancel on account change/unmount, while allowing the previous game to finish saving.
      for (const task of tasks.values()) task.controller.abort();
      tasks.clear();
      completed.clear();
    };
  }, [ownerId]);

  React.useEffect(() => {
    const tryAgain = () => { for (const task of pending.current.values()) if (task.failed) persist(task); };
    window.addEventListener('online', tryAgain);
    window.addEventListener('focus', tryAgain);
    return () => { window.removeEventListener('online', tryAgain); window.removeEventListener('focus', tryAgain); };
  }, [persist]);

  React.useEffect(() => {
    const key = ownerId + ':' + gameId;
    if (!historyLength || !outcomeResult || saved.current.has(key) || pending.current.has(key)) return;
    const log = buildMoveLog(game, gameId, playerColor, aiLevel, userId, userName, timeControl, outcomeResult);
    const task = { key, log, controller: new AbortController() };
    pending.current.set(key, task);
    persist(task);
  }, [aiLevel, game, gameFen, gameId, historyLength, outcomeResult, ownerId, persist, playerColor, timeControl, userId, userName]);

  const resetSavedGameLog = React.useCallback(() => { saved.current.clear(); }, []);
  return { apiOnline, setApiOnline, resetSavedGameLog };
}
