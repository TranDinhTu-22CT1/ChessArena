import { rateLimit } from '../../../../lib/rateLimit';
import { createStockfish } from '../../../../lib/stockfishEngine';

export const runtime = 'nodejs';
let sharedEngine = null;
let engineReady = null;
let engineQueue = Promise.resolve();

function botStrength(elo) {
  const rating = Math.max(400, Math.min(2400, Number(elo) || 1200));

  if (rating <= 800) return { skillLevel: 3, depth: 3, movetime: 120, noise: 0.28 };
  if (rating <= 1200) return { skillLevel: 7, depth: 5, movetime: 220, noise: 0.16 };
  if (rating <= 1600) return { skillLevel: 11, depth: 7, movetime: 360, noise: 0.08 };
  if (rating <= 2000) return { skillLevel: 16, depth: 9, movetime: 520, noise: 0.025 };
  return { skillLevel: 20, depth: 11, movetime: 760, noise: 0 };
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

async function getSharedEngine() {
  if (!sharedEngine) {
    sharedEngine = createStockfish();
    engineReady = sharedEngine.init({ threads: 2, hash: 96, skillLevel: 10 });
  }

  await engineReady;
  return sharedEngine;
}

function withEngine(task) {
  const run = engineQueue.then(async () => {
    try {
      const engine = await getSharedEngine();
      return await task(engine);
    } catch (error) {
      sharedEngine?.close?.();
      sharedEngine = null;
      engineReady = null;
      throw error;
    }
  });

  engineQueue = run.catch(() => {});
  return run;
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'stockfish-move', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;

  const payload = await request.json();
  const fen = payload?.fen;

  if (!validFen(fen)) {
    return Response.json({ ok: false, error: 'Invalid FEN.' }, { status: 400 });
  }

  const elo = Number(payload?.elo || 1200);
  const strength = botStrength(elo);
  try {
    const result = await withEngine(async (engine) => {
      await engine.configure({
        skillLevel: strength.skillLevel,
        elo: Math.max(1320, Math.min(2400, elo))
      });

      return engine.analyze({
        fen,
        depth: strength.depth,
        movetime: strength.movetime
      });
    });
    const parsedMove = parseMove(result.bestMove);

    if (!parsedMove) {
      return Response.json({ ok: false, error: 'Stockfish did not return a legal move.' }, { status: 502 });
    }

    return Response.json({
      ok: true,
      engine: 'stockfish-avx2',
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
