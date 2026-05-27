import React from 'react';

export function useGameClock({
  reviewMode,
  game,
  gameFinished,
  timeWinner,
  clockRunning,
  setClocks,
  setTimeWinner,
  setResultDismissed
}) {
  React.useEffect(() => {
    if (reviewMode || gameFinished || timeWinner || !clockRunning) return undefined;

    const activeColor = game.turn();
    let previousAt = window.performance.now();
    const timer = window.setInterval(() => {
      const now = window.performance.now();
      const elapsedSeconds = (now - previousAt) / 1000;
      previousAt = now;
      setClocks((currentClocks) => {
        const nextValue = Math.max(0, currentClocks[activeColor] - elapsedSeconds);
        const nextClocks = { ...currentClocks, [activeColor]: nextValue };

        if (nextValue <= 0) {
          setTimeWinner(activeColor === 'w' ? 'b' : 'w');
          setResultDismissed(false);
        }

        return nextClocks;
      });
    }, 50);

    return () => window.clearInterval(timer);
  }, [clockRunning, game, gameFinished, reviewMode, setClocks, setResultDismissed, setTimeWinner, timeWinner]);
}
