import { rateLimit } from '../../../../lib/rateLimit';
import { createStockfish } from '../../../../lib/stockfishEngine';
import { PUZZLE_POSITIONS, PUZZLE_STAGES, PUZZLE_THEMES } from '../../../../lib/puzzlePositions';
import { readJsonPayload } from '../../../../lib/validation';

export const runtime = 'nodejs';
let sharedEngine = null;
let engineReady = null;
let engineQueue = Promise.resolve();

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
    engineReady = sharedEngine.init({ threads: 2, hash: 96, skillLevel: 20 });
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

function dayNumber(value) {
  return [...String(value || '')].reduce((total, character) => total + character.charCodeAt(0), 0);
}

function selectCandidate(payload) {
  const excluded = new Set(Array.isArray(payload?.excluded) ? payload.excluded.slice(0, 300) : []);
  const theme = typeof payload?.theme === 'string' ? payload.theme : 'all';
  const stage = typeof payload?.stage === 'string' ? payload.stage : 'all';
  const minRating = Math.max(0, Number(payload?.minRating) || 0);
  const maxRating = Math.min(4000, Number(payload?.maxRating) || 4000);
  const filtered = PUZZLE_POSITIONS.filter((item) => (
    (theme === 'all' || item.theme === theme)
    && (stage === 'all' || item.stage === stage)
    && item.rating >= minRating
    && item.rating <= maxRating
  ));

  if (payload?.mode === 'daily') {
    const preferred = filtered.find((item) => item.id === payload?.preferredId);
    if (preferred) return preferred;
    const unseenDaily = filtered.filter((item) => !excluded.has(item.id));
    if (!unseenDaily.length) return null;
    return unseenDaily[dayNumber(payload?.date) % unseenDaily.length];
  }

  const remaining = filtered
    .filter((item) => !excluded.has(item.id))
    .sort((first, second) => first.rating - second.rating);
  if (!remaining.length) return null;

  if (payload?.mode === 'rated' || payload?.mode === 'rush') {
    return remaining[0];
  }

  return remaining[Math.floor(Math.random() * remaining.length)];
}

export async function GET() {
  return Response.json({ ok: true, themes: PUZZLE_THEMES, stages: PUZZLE_STAGES, count: PUZZLE_POSITIONS.length });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'stockfish-puzzle', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;

  const payload = await readJsonPayload(request);
  if (!payload) {
    return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const candidate = selectCandidate(payload);

  if (!candidate) {
    return Response.json({
      ok: false,
      exhausted: true,
      error: 'No unseen puzzles remain for these filters.'
    }, { status: 404 });
  }

  try {
    const result = await withEngine(async (engine) => {
      await engine.configure({ skillLevel: 20 });
      return engine.analyze({ fen: candidate.fen, depth: 18 });
    });
    const solution = parseMove(result.bestMove);

    if (!solution) {
      return Response.json({ ok: false, error: 'Stockfish could not validate this puzzle.' }, { status: 502 });
    }

    return Response.json({
      ok: true,
      engine: 'stockfish-avx2',
      puzzle: {
        ...candidate,
        solution,
        sideToMove: candidate.fen.split(/\s+/)[1],
        validatedScore: result.score
      }
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error.message || 'Could not generate a validated puzzle.' },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
