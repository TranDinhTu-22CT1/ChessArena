import { rateLimit } from '../../../../lib/rateLimit';
import { withStockfishEngine } from '../../../../lib/stockfishEngine';
import { isOpeningBookMove } from '../../../../lib/openingBook';
import { readJsonPayload } from '../../../../lib/validation';
import { requireOnlineUser } from '../../../../lib/online';

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

function reviewSummary(results, color) {
  const own = results.filter((item) => item.mover === color);
  const totalLoss = own.reduce((sum, item) => sum + Number(item.winLoss || 0), 0);
  const totalCpLoss = own.reduce((sum, item) => sum + Number(item.centipawnLoss || 0), 0);
  const countTone = (tone) => own.filter((item) => item.tone === tone).length;
  return {
    accuracy: own.length ? Number(Math.max(1, Math.min(99, 100 - (totalLoss / own.length) * 2.4)).toFixed(1)) : 0,
    averageCentipawnLoss: own.length ? Math.round(totalCpLoss / own.length) : 0,
    blunders: countTone('blunder'),
    mistakes: countTone('mistake') + countTone('miss'),
    inaccuracies: countTone('inaccuracy'),
    bestMoves: ['best', 'great', 'brilliant', 'book'].reduce((sum, tone) => sum + countTone(tone), 0),
    totalMoves: own.length,
    own
  };
}

async function saveOnlineReview({ payload, results }) {
  if (!payload?.gameId || results.length === 0) return null;
  const context = await requireOnlineUser();
  if (context.error) return null;

  const { supabase, user } = context;
  const { data: game } = await supabase
    .from('online_games')
    .select('id, white_user_id, black_user_id, mode, time_control')
    .eq('id', payload.gameId)
    .maybeSingle();
  if (!game || (game.white_user_id !== user.id && game.black_user_id !== user.id)) return null;

  const color = game.white_user_id === user.id ? 'w' : 'b';
  const summary = reviewSummary(results, color);
  const now = new Date().toISOString();
  const { data: review, error } = await supabase
    .from('game_reviews')
    .upsert({
      game_id: game.id,
      user_id: user.id,
      color,
      accuracy: summary.accuracy,
      average_centipawn_loss: summary.averageCentipawnLoss,
      blunders: summary.blunders,
      mistakes: summary.mistakes,
      inaccuracies: summary.inaccuracies,
      best_moves: summary.bestMoves,
      total_moves: summary.totalMoves,
      summary: {
        policy: 'stockfish_game_review_v1',
        mode: game.mode || 'rapid',
        updatedFromClient: true
      },
      updated_at: now
    }, { onConflict: 'game_id,user_id' })
    .select('*')
    .single();
  if (error || !review) return null;

  await supabase.from('game_review_moves').delete().eq('review_id', review.id);
  const positionByPly = new Map((payload.positions || []).map((position) => [position.ply, position]));
  const rows = summary.own.map((item) => {
    const position = positionByPly.get(item.ply) || {};
    return {
      review_id: review.id,
      game_id: game.id,
      user_id: user.id,
      ply: item.ply,
      san: item.san,
      move: item.move,
      fen: position.fen || null,
      best_move: item.bestMove,
      tone: item.tone,
      label: item.label,
      centipawn_loss: item.centipawnLoss || 0,
      win_loss: item.winLoss || 0,
      white_score: item.whiteScore ?? null
    };
  });
  if (rows.length) await supabase.from('game_review_moves').insert(rows);

  const puzzleRows = rows
    .filter((item) => ['blunder', 'mistake', 'miss'].includes(item.tone) && item.fen && item.best_move)
    .slice(0, 6)
    .map((item) => ({
      user_id: user.id,
      source_game_id: game.id,
      source_review_id: review.id,
      source_ply: item.ply,
      fen: item.fen,
      solution: item.best_move,
      played_move: item.move,
      san: item.san,
      theme: item.tone === 'miss' ? 'missed_tactic' : item.tone,
      stage: item.ply <= 16 ? 'opening' : item.ply >= 70 ? 'endgame' : 'middlegame',
      rating: Math.max(700, Math.min(2400, 1000 + Number(item.centipawn_loss || 0) * 2)),
      status: 'new',
      updated_at: now
    }));
  if (puzzleRows.length) {
    await supabase
      .from('personal_puzzles')
      .upsert(puzzleRows, { onConflict: 'user_id,source_game_id,source_ply' });
  }

  return { reviewId: review.id, savedMoves: rows.length, personalPuzzles: puzzleRows.length, summary };
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

    const savedReview = await saveOnlineReview({ payload, results });
    return Response.json({ ok: true, engine: 'stockfish-wasm', movetime, results, savedReview });
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
