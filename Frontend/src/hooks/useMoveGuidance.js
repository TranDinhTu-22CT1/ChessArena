import React from 'react';
import { requestStockfishMove } from '../api/stockfish';
import { coachBehaviorFromMode } from '../coach/coach';

export function useMoveGuidance({
  botGameStarted,
  reviewMode,
  game,
  gameFen,
  gameFinished,
  timeWinner,
  botOptions,
  playerColor,
  aiElo,
  isCoachGame,
  coachMode,
  history,
  gameVariant,
  setSuggestionMove,
  setThreatMove
}) {
  React.useEffect(() => {
    if (!botGameStarted || reviewMode || gameFinished || timeWinner) {
      setSuggestionMove(null);
      setThreatMove(null);
      return;
    }

    const coachBehavior = coachBehaviorFromMode(coachMode);
    const suggestionArrows = isCoachGame ? coachBehavior.suggestionArrows : botOptions.suggestionArrows;
    const threatArrows = isCoachGame ? coachBehavior.threatArrows : botOptions.threatArrows;

    if (!suggestionArrows && !threatArrows) {
      setSuggestionMove(null);
      setThreatMove(null);
      return;
    }

    let cancelled = false;
    const historyMoves = history.map((move) => `${move.from}${move.to}${move.promotion ?? ''}`);

    requestStockfishMove(gameFen, aiElo, {
      moves: historyMoves,
      variant: gameVariant,
      fullStrength: true
    })
      .then((bestMove) => {
        if (cancelled) return;
        const legalMove = game.moves({ verbose: true }).some((move) => (
          move.from === bestMove.from
          && move.to === bestMove.to
          && (move.promotion ?? '') === (bestMove.promotion ?? '')
        ));
        if (!legalMove) {
          setSuggestionMove(null);
          setThreatMove(null);
          return;
        }
        if (game.turn() === playerColor && suggestionArrows) {
          setSuggestionMove({ from: bestMove.from, to: bestMove.to });
          setThreatMove(null);
        } else if (game.turn() !== playerColor && threatArrows) {
          setThreatMove({ from: bestMove.from, to: bestMove.to });
          setSuggestionMove(null);
        } else {
          setSuggestionMove(null);
          setThreatMove(null);
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
    coachMode,
    game,
    gameFen,
    gameFinished,
    gameVariant,
    history,
    isCoachGame,
    playerColor,
    reviewMode,
    setSuggestionMove,
    setThreatMove,
    timeWinner
  ]);
}
