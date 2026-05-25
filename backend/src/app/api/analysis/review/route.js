import { rateLimit } from '../../../../lib/rateLimit';
import { createStockfish } from '../../../../lib/stockfishEngine';

export const runtime = 'nodejs';

const DEFAULT_DEPTH = Number(process.env.STOCKFISH_DEPTH || 12);

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

function classify({ loss, winLoss, playedBestMove, bestScore, playedScore }) {
  if (playedBestMove || winLoss <= 0.8) return { label: 'Best', tone: 'best' };
  if (winLoss <= 1.8) return { label: 'Excellent', tone: 'excellent' };
  if (winLoss <= 4.5) return { label: 'Good', tone: 'good' };
  if (winLoss <= 8) return { label: 'Inaccuracy', tone: 'inaccuracy' };
  if (winLoss <= 16) return { label: 'Mistake', tone: 'mistake' };
  if (winningChance(bestScore) >= 70 && winningChance(playedScore) <= 45) return { label: 'Miss', tone: 'miss' };
  return { label: 'Blunder', tone: 'blunder' };
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'stockfish-review', limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;

  const { positions = [], depth = DEFAULT_DEPTH } = await request.json();
  const limitedPositions = positions.slice(0, 24);
  const engine = createStockfish();

  try {
    await engine.init();
    const results = [];

    for (const position of limitedPositions) {
      if (!position?.fen || !position?.move) continue;

      const mover = sideToMove(position.fen);
      const best = await engine.analyze({ fen: position.fen, depth });
      const afterPlayed = await engine.analyze({ fen: position.fen, moves: [position.move], depth });
      const playedScore = -afterPlayed.score;
      const whiteScore = mover === 'w' ? playedScore : -playedScore;
      const loss = Math.max(0, best.score - playedScore);
      const bestWinChance = winningChance(best.score);
      const playedWinChance = winningChance(playedScore);
      const winLoss = Math.max(0, bestWinChance - playedWinChance);
      const playedBestMove = sameMove(position.move, best.bestMove);
      const classification = classify({
        loss,
        winLoss,
        playedBestMove,
        bestScore: best.score,
        playedScore
      });

      results.push({
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

    return Response.json({ ok: true, engine: 'stockfish-avx2', depth, results });
  } catch (error) {
    return Response.json(
      { ok: false, error: error.message || 'Stockfish review failed.' },
      { status: 500 }
    );
  } finally {
    engine.close();
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
