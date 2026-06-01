import { rateLimit } from '../../../../lib/rateLimit';
import { withStockfishEngine } from '../../../../lib/stockfishEngine';
import { PUZZLE_POSITIONS } from '../../../../lib/puzzlePositions';
import { readJsonPayload } from '../../../../lib/validation';
import { requireOnlineUser } from '../../../../lib/online';

export const runtime = 'nodejs';

function validMove(move) {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move || '');
}

function equivalentWinningMove(bestScore, playedScore) {
  if (bestScore > 90000) return playedScore > 90000;
  return bestScore - playedScore <= 35;
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'stockfish-puzzle-check', limit: 160, windowMs: 60_000 });
  if (blocked) return blocked;

  const payload = await readJsonPayload(request);
  if (!payload) {
    return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  let puzzle = PUZZLE_POSITIONS.find((item) => item.id === payload?.puzzleId);
  let personalContext = null;
  if (!puzzle) {
    const context = await requireOnlineUser();
    if (!context.error) {
      const { data } = await context.supabase
        .from('personal_puzzles')
        .select('*')
        .eq('id', payload?.puzzleId)
        .eq('user_id', context.user.id)
        .maybeSingle();
      if (data) {
        personalContext = context;
        puzzle = {
          id: data.id,
          fen: data.fen,
          solution: data.solution,
          theme: data.theme,
          stage: data.stage
        };
      }
    }
  }
  const move = String(payload?.move || '');
  if (!puzzle || !validMove(move)) {
    return Response.json({ ok: false, error: 'Invalid puzzle attempt.' }, { status: 400 });
  }

  try {
    const check = await withStockfishEngine({ skillLevel: 20 }, async (engine) => {
      await engine.configure({ skillLevel: 20 });
      const best = await engine.analyze({ fen: puzzle.fen, depth: 20 });
      const afterPlayed = await engine.analyze({ fen: puzzle.fen, moves: [move], depth: 20 });
      const playedScore = -afterPlayed.score;
      const expectedMove = puzzle.solution || best.bestMove;
      return {
        accepted: move === expectedMove || move === best.bestMove || equivalentWinningMove(best.score, playedScore),
        bestMove: best.bestMove,
        bestScore: best.score,
        playedScore
      };
    });
    if (personalContext && check.accepted) {
      await personalContext.supabase
        .from('personal_puzzles')
        .update({ status: 'solved', updated_at: new Date().toISOString() })
        .eq('id', puzzle.id)
        .eq('user_id', personalContext.user.id);
    }
    return Response.json({ ok: true, ...check });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Could not check puzzle move.' }, { status: 500 });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
