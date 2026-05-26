import React from 'react';

export function useGameClock({
  reviewMode,
  game,
  timeWinner,
  historyLength,
  setClocks,
  setTimeWinner,
  setResultDismissed
}) {
  React.useEffect(() => {
    if (reviewMode || game.isGameOver() || timeWinner || historyLength === 0) return undefined;

    const activeColor = game.turn();
    const timer = window.setInterval(() => {
      setClocks((currentClocks) => {
        const nextValue = Math.max(0, currentClocks[activeColor] - 1);
        const nextClocks = { ...currentClocks, [activeColor]: nextValue };

        if (nextValue <= 0) {
          setTimeWinner(activeColor === 'w' ? 'b' : 'w');
          setResultDismissed(false);
        }

        return nextClocks;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [game, historyLength, reviewMode, setClocks, setResultDismissed, setTimeWinner, timeWinner]);
}
