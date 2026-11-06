import React from 'react';
import { requestStockfishMove } from '../api/stockfish';

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

    const suggestionArrows = botOptions.suggestionArrows && game.turn() === playerColor;
    const threatArrows = botOptions.threatArrows && game.turn() !== playerColor;

    if (!suggestionArrows && !threatArrows) {
      setSuggestionMove(null);
      setThreatMove(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const historyMoves = history.map((move) => `${move.from}${move.to}${move.promotion ?? ''}`);

    requestStockfishMove(gameFen, aiElo, {
      moves: historyMoves,
      variant: gameVariant,
      fullStrength: true,
      signal: controller.signal
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
      controller.abort();
    };
  }, [
    aiElo,
    botGameStarted,
    botOptions.suggestionArrows,
    botOptions.threatArrows,
    game,
    gameFen,
    gameFinished,
    gameVariant,
    history,
    playerColor,
    reviewMode,
    setSuggestionMove,
    setThreatMove,
    timeWinner
  ]);
}
