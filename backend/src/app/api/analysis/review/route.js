import { rateLimit } from '../../../../lib/rateLimit';
import { withStockfishEngine } from '../../../../lib/stockfishEngine';
import { isOpeningBookMove } from '../../../../lib/openingBook';
import { readJsonPayload } from '../../../../lib/validation';

export const runtime = 'nodejs';

const DEFAULT_MOVETIME = Number(process.env.STOCKFISH_REVIEW_MOVETIME || 180);

function sideToMove(fen) {
  return fen.split(/\s+/)[1] === 'b' ? 'b' : 'w';
}

function sameMove(a, b) {
  return String(a || '').slice(0, 5) === String(b || '').slice(0, 5);
}

function winningChance(score) {
  if (Math.abs(score) > 90000) return score > 0 ? 100 : 0;
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * score)) - 1);
}

function classify({ position, winLoss, playedBestMove, bestScore, playedScore, reply }) {
  if (position.variant === 'standard' && isOpeningBookMove(position.priorMoves, position.move)) {
    return { label: 'Book', tone: 'book' };
  }

  const movedPieceValue = { p: 1, n: 3, b: 3, r: 5, q: 9 }[position.piece] ?? 0;
  const capturedValue = { p: 1, n: 3, b: 3, r: 5, q: 9 }[position.captured] ?? 0;
  const offersMaterial = movedPieceValue > capturedValue
    && reply?.bestMove?.slice(2, 4) === position.move.slice(2, 4);
  const winning = winningChance(bestScore) >= 62;

  if (playedBestMove && offersMaterial && winning) return { label: 'Brilliant', tone: 'brilliant' };
  if (playedBestMove && (Math.abs(bestScore) > 90000 || winningChance(bestScore) >= 82)) return { label: 'Great', tone: 'great' };
  if (playedBestMove || winLoss <= 0.8) return { label: 'Best', tone: 'best' };
  if (winLoss <= 1.8) return { label: 'Excellent', tone: 'excellent' };
  if (winLoss <= 4.5) return { label: 'Good', tone: 'good' };
  if (winLoss <= 8) return { label: 'Inaccuracy', tone: 'inaccuracy' };
  if (winLoss <= 16) return { label: 'Mistake', tone: 'mistake' };
  if (winningChance(bestScore) >= 70 && winningChance(playedScore) <= 45) return { label: 'Miss', tone: 'miss' };
  return { label: 'Blunder', tone: 'blunder' };
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'stockfish-review', limit: 120, windowMs: 60_000 });
  if (blocked) return blocked;

  const payload = await readJsonPayload(request);
  if (!payload) {
    return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const { positions = [] } = payload;
  const movetime = Math.max(80, Math.min(350, Number(payload.movetime) || DEFAULT_MOVETIME));
  const limitedPositions = positions.slice(0, 24);
  try {
    const results = await withStockfishEngine({ skillLevel: 20 }, async (engine) => {
      const analyzed = [];
      await engine.configure({ skillLevel: 20 });

      for (const position of limitedPositions) {
        if (!position?.fen || !position?.move) continue;

        const mover = sideToMove(position.fen);
        if (position.variant === 'standard' && isOpeningBookMove(position.priorMoves, position.move)) {
          analyzed.push({
            ply: position.ply,
            san: position.san,
            move: position.move,
            mover,
            bestMove: position.move,
            centipawnLoss: 0,
            winLoss: 0,
            bestWinChance: 50,
            playedWinChance: 50,
            score: 0,
            label: 'Book',
            tone: 'book'
          });
          continue;
        }

        const best = await engine.analyze({ fen: position.fen, movetime });
        const afterPlayed = await engine.analyze({ fen: position.fen, moves: [position.move], movetime });
        const playedScore = -afterPlayed.score;
        const whiteScore = mover === 'w' ? playedScore : -playedScore;
        const loss = Math.max(0, best.score - playedScore);
        const bestWinChance = winningChance(best.score);
        const playedWinChance = winningChance(playedScore);
        const winLoss = Math.max(0, bestWinChance - playedWinChance);
        const playedBestMove = sameMove(position.move, best.bestMove);
        const classification = classify({
          position,
          winLoss,
          playedBestMove,
          bestScore: best.score,
          playedScore,
          reply: afterPlayed
        });

        analyzed.push({
          ply: position.ply,
          san: position.san,
          move: position.move,
          mover,
          bestMove: best.bestMove,
          centipawnLoss: Math.round(loss),
          winLoss: Number(winLoss.toFixed(1)),
          bestWinChance: Number(bestWinChance.toFixed(1)),
          playedWinChance: Number(playedWinChance.toFixed(1)),
          score: Math.round(playedScore),
          whiteScore: Math.round(whiteScore),
          bestScore: Math.round(best.score),
          ...classification
        });
      }

      return analyzed;
    });

    return Response.json({ ok: true, engine: 'stockfish-wasm', movetime, results });
  } catch (error) {
    return Response.json(
      { ok: false, error: error.message || 'Stockfish review failed.' },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
