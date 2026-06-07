import { rateLimit } from '../../../../lib/rateLimit';
import { withStockfishEngine } from '../../../../lib/stockfishEngine';
import { PUZZLE_POSITIONS, PUZZLE_STAGES, PUZZLE_THEMES } from '../../../../lib/puzzlePositions';
import { isUuid } from '../../../../lib/puzzleUtils';
import { readJsonPayload } from '../../../../lib/validation';
import { requireOnlineUser } from '../../../../lib/online';

export const runtime = 'nodejs';

function parseMove(bestMove) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(bestMove || '')) return null;
  return {
    from: bestMove.slice(0, 2),
    to: bestMove.slice(2, 4),
    promotion: bestMove[4] || undefined,
    lan: bestMove
  };
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

async function selectPersonalPuzzle(payload) {
  if (payload?.mode !== 'personal') return null;
  const context = await requireOnlineUser();
  if (context.error) return { error: context.error };

  const excluded = Array.isArray(payload?.excluded)
    ? payload.excluded.filter(isUuid).slice(0, 300)
    : [];
  let query = context.supabase
    .from('personal_puzzles')
    .select('*')
    .eq('user_id', context.user.id)
    .eq('status', 'new')
    .order('created_at', { ascending: false })
    .limit(20);
  if (excluded.length) query = query.not('id', 'in', `(${excluded.map((id) => `"${id}"`).join(',')})`);
  const { data = [], error } = await query;
  if (error) return { error: Response.json({ ok: false, error: error.message }, { status: 500 }) };
  const puzzle = data[0];
  if (!puzzle) {
    return {
      error: Response.json({
        ok: false,
        exhausted: true,
        error: 'No personal puzzles yet. Review a finished online game to generate puzzles from your mistakes.'
      }, { status: 404 })
    };
  }
  return {
    puzzle: {
      id: puzzle.id,
      source: 'personal',
      fen: puzzle.fen,
      theme: puzzle.theme || 'mistake',
      stage: puzzle.stage || 'review',
      rating: puzzle.rating || 1200,
      title: 'Bai tap tu van that cua ban',
      description: `Tim nuoc tot hon thay cho ${puzzle.san || puzzle.played_move || 'nuoc da di'}.`,
      solution: parseMove(puzzle.solution),
      sideToMove: puzzle.fen.split(/\s+/)[1],
      validatedScore: null
    }
  };
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

  const personal = await selectPersonalPuzzle(payload);
  if (personal?.error) return personal.error;
  if (personal?.puzzle) return Response.json({ ok: true, engine: 'saved-review', puzzle: personal.puzzle });

  const candidate = selectCandidate(payload);

  if (!candidate) {
    return Response.json({
      ok: false,
      exhausted: true,
      error: 'No unseen puzzles remain for these filters.'
    }, { status: 404 });
  }

  try {
    const result = await withStockfishEngine({ skillLevel: 20 }, async (engine) => {
      await engine.configure({ skillLevel: 20 });
      return engine.analyze({ fen: candidate.fen, depth: 18 });
    });
    const solution = parseMove(result.bestMove);

    if (!solution) {
      return Response.json({ ok: false, error: 'Stockfish could not validate this puzzle.' }, { status: 502 });
    }

    return Response.json({
      ok: true,
      engine: 'stockfish-wasm',
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
