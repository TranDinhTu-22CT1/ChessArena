import React from 'react';
import { requestStockfishMove } from '../api/stockfish';

export function useMoveGuidance({
  botGameStarted,
  reviewMode,
  game,
  gameFen,
  timeWinner,
  isMoveAnimating,
  botOptions,
  playerColor,
  aiElo,
  history,
  gameVariant,
  setSuggestionMove,
  setThreatMove
}) {
  React.useEffect(() => {
    if (!botGameStarted || reviewMode || game.isGameOver() || timeWinner || isMoveAnimating) {
      setSuggestionMove(null);
      setThreatMove(null);
      return;
    }

    if (!botOptions.suggestionArrows && !botOptions.threatArrows) {
      setSuggestionMove(null);
      setThreatMove(null);
      return;
    }

    let cancelled = false;
    const historyMoves = history.map((move) => `${move.from}${move.to}${move.promotion ?? ''}`);

    requestStockfishMove(gameFen, aiElo, { moves: historyMoves, variant: gameVariant })
      .then((bestMove) => {
        if (cancelled) return;
        if (game.turn() === playerColor) {
          setSuggestionMove({ from: bestMove.from, to: bestMove.to });
          setThreatMove(null);
        } else {
          setThreatMove({ from: bestMove.from, to: bestMove.to });
          setSuggestionMove(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSuggestionMove(null);
        setThreatMove(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    aiElo,
    botGameStarted,
    botOptions.suggestionArrows,
    botOptions.threatArrows,
    game,
    gameFen,
    gameVariant,
    history,
    isMoveAnimating,
    playerColor,
    reviewMode,
    setSuggestionMove,
    setThreatMove,
    timeWinner
  ]);
}
