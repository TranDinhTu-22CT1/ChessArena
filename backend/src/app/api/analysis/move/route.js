import { rateLimit } from '../../../../lib/rateLimit';
import { withStockfishEngine } from '../../../../lib/stockfishEngine';
import { chooseOpeningBookMove } from '../../../../lib/openingBook';
import { readJsonPayload } from '../../../../lib/validation';

export const runtime = 'nodejs';

function botStrength(elo) {
  const rating = Math.max(1320, Math.min(3190, Number(elo) || 1600));

  if (rating <= 1320) return { skillLevel: 3, elo: rating, movetime: 350 };
  if (rating <= 1600) return { skillLevel: 8, elo: rating, movetime: 500 };
  if (rating <= 2000) return { skillLevel: 13, elo: rating, movetime: 700 };
  if (rating <= 2400) return { skillLevel: 17, elo: rating, movetime: 950 };
  if (rating < 3190) return { skillLevel: 20, elo: rating, movetime: 1300 };
  return { skillLevel: 20, elo: null, movetime: 1800 };
}

function validFen(value) {
  return typeof value === 'string' && value.split(/\s+/).length >= 4 && value.length < 120;
}

function parseMove(bestMove) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(bestMove || '')) return null;
  return {
    from: bestMove.slice(0, 2),
    to: bestMove.slice(2, 4),
    promotion: bestMove[4] || undefined,
    lan: bestMove
  };
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'stockfish-move', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;

  const payload = await readJsonPayload(request);
  if (!payload) {
    return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const fen = payload?.fen;

  if (!validFen(fen)) {
    return Response.json({ ok: false, error: 'Invalid FEN.' }, { status: 400 });
  }

  const elo = Math.max(1320, Math.min(3190, Number(payload?.elo) || 1600));
  const moves = Array.isArray(payload?.moves) ? payload.moves.slice(0, 40) : [];
  const bookMove = payload?.variant === 'standard' ? chooseOpeningBookMove(moves, fen) : null;
  const strength = botStrength(elo);

  if (bookMove) {
    return Response.json({
      ok: true,
      engine: 'opening-book',
      elo,
      strength,
      book: true,
      move: parseMove(bookMove)
    });
  }

  try {
    const result = await withStockfishEngine({ skillLevel: 10 }, async (engine) => {
      await engine.configure({
        skillLevel: strength.skillLevel,
        elo: strength.elo
      });

      return engine.analyze({
        fen,
        movetime: strength.movetime
      });
    });
    const parsedMove = parseMove(result.bestMove);

    if (!parsedMove) {
      return Response.json({ ok: false, error: 'Stockfish did not return a legal move.' }, { status: 502 });
    }

    return Response.json({
      ok: true,
      engine: 'stockfish-wasm',
      elo,
      strength,
      move: parsedMove,
      score: result.score
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error.message || 'Could not choose Stockfish move.' },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
