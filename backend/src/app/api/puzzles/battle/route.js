import { requireOnlineUser } from '../../../../lib/online';
import { PUZZLE_POSITIONS } from '../../../../lib/puzzlePositions';
import { distributedRateLimit } from '../../../../lib/rateLimit';
import { withStockfishEngine } from '../../../../lib/stockfishEngine';

export const runtime = 'nodejs';

function publicBattle(row, userId) {
  const player = row.player_one_id === userId ? 'one' : row.player_two_id === userId ? 'two' : null;
  const index = player === 'one' ? row.player_one_index : row.player_two_index;
  const score = player === 'one' ? row.player_one_score : row.player_two_score;
  const opponentScore = player === 'one' ? row.player_two_score : row.player_one_score;
  const puzzleId = row.status === 'active' ? row.puzzle_ids?.[index] || null : null;
  const puzzle = PUZZLE_POSITIONS.find((item) => item.id === puzzleId);
  return {
    id: row.id,
    status: row.status,
    player,
    score,
    opponentScore,
    index,
    total: Array.isArray(row.puzzle_ids) ? row.puzzle_ids.length : 0,
    puzzle: puzzle ? {
      id: puzzle.id,
      fen: puzzle.fen,
      theme: puzzle.theme,
      stage: puzzle.stage,
      rating: puzzle.rating
    } : null,
    winnerUserId: row.winner_user_id,
    won: row.status === 'finished' ? row.winner_user_id === userId : null,
    expiresAt: row.expires_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  };
}

function battlePuzzleIds() {
  return [...PUZZLE_POSITIONS]
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(10, PUZZLE_POSITIONS.length))
    .map((item) => item.id);
}

async function loadBattle(supabase, battleId, userId) {
  let query = supabase.from('puzzle_battles').select('*');
  if (battleId) query = query.eq('id', battleId);
  else query = query.or(`player_one_id.eq.${userId},player_two_id.eq.${userId}`).in('status', ['waiting', 'active']);
  return query.order('created_at', { ascending: false }).limit(1).maybeSingle();
}

export async function GET(request) {
  const blocked = await distributedRateLimit(request, { scope: 'puzzle-battle-read', limit: 120, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const battleId = new URL(request.url).searchParams.get('battleId') || '';
  const { data: battle, error } = await loadBattle(context.supabase, battleId, context.user.id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!battle) return Response.json({ ok: true, battle: null });
  if (![battle.player_one_id, battle.player_two_id].includes(context.user.id)) {
    return Response.json({ ok: false, error: 'Forbidden.' }, { status: 403 });
  }
  return Response.json({ ok: true, battle: publicBattle(battle, context.user.id) });
}

export async function POST(request) {
  const blocked = await distributedRateLimit(request, { scope: 'puzzle-battle-write', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const payload = await request.json().catch(() => ({}));
  const action = String(payload.action || '');

  if (action === 'join') {
    const { data: existing } = await loadBattle(context.supabase, '', context.user.id);
    if (existing) return Response.json({ ok: true, battle: publicBattle(existing, context.user.id) });
    const { data: waiting = [] } = await context.supabase
      .from('puzzle_battles')
      .select('*')
      .eq('status', 'waiting')
      .neq('player_one_id', context.user.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(1);
    if (waiting[0]) {
      const now = new Date().toISOString();
      const { data: matched } = await context.supabase.from('puzzle_battles')
        .update({ player_two_id: context.user.id, status: 'active', started_at: now, updated_at: now })
        .eq('id', waiting[0].id)
        .is('player_two_id', null)
        .select('*')
        .maybeSingle();
      if (matched) return Response.json({ ok: true, battle: publicBattle(matched, context.user.id) });
    }
    const { data: created, error } = await context.supabase.from('puzzle_battles').insert({
      player_one_id: context.user.id,
      puzzle_ids: battlePuzzleIds()
    }).select('*').single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, battle: publicBattle(created, context.user.id) });
  }

  if (action === 'cancel') {
    const { data: battle } = await loadBattle(context.supabase, String(payload.battleId || ''), context.user.id);
    if (!battle || battle.status !== 'waiting' || battle.player_one_id !== context.user.id) {
      return Response.json({ ok: false, error: 'Waiting battle not found.' }, { status: 404 });
    }
    await context.supabase.from('puzzle_battles').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', battle.id);
    return Response.json({ ok: true, battle: null });
  }

  if (action !== 'answer') return Response.json({ ok: false, error: 'Invalid battle action.' }, { status: 400 });
  const { data: battle } = await loadBattle(context.supabase, String(payload.battleId || ''), context.user.id);
  if (!battle || battle.status !== 'active') return Response.json({ ok: false, error: 'Active battle not found.' }, { status: 404 });
  const playerOne = battle.player_one_id === context.user.id;
  const index = playerOne ? battle.player_one_index : battle.player_two_index;
  const puzzleId = battle.puzzle_ids?.[index];
  const puzzle = PUZZLE_POSITIONS.find((item) => item.id === puzzleId);
  if (!puzzle) return Response.json({ ok: false, error: 'Puzzle not found.' }, { status: 404 });
  const move = String(payload.move || '').toLowerCase();
  const best = await withStockfishEngine({ skillLevel: 20 }, async (engine) => {
    await engine.configure({ skillLevel: 20 });
    return engine.analyze({ fen: puzzle.fen, depth: 18 });
  });
  const correct = move === String(best.bestMove || '').toLowerCase();
  const nextIndex = index + 1;
  const nextScore = (playerOne ? battle.player_one_score : battle.player_two_score) + (correct ? 1 : 0);
  const patch = playerOne
    ? { player_one_index: nextIndex, player_one_score: nextScore }
    : { player_two_index: nextIndex, player_two_score: nextScore };
  const total = battle.puzzle_ids.length;
  const otherDone = playerOne ? battle.player_two_index >= total : battle.player_one_index >= total;
  if (nextIndex >= total && otherDone) {
    const oneScore = playerOne ? nextScore : battle.player_one_score;
    const twoScore = playerOne ? battle.player_two_score : nextScore;
    patch.status = 'finished';
    patch.finished_at = new Date().toISOString();
    patch.winner_user_id = oneScore === twoScore ? null : oneScore > twoScore ? battle.player_one_id : battle.player_two_id;
  }
  patch.updated_at = new Date().toISOString();
  const { data: updated, error } = await context.supabase.from('puzzle_battles').update(patch).eq('id', battle.id).select('*').single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, correct, battle: publicBattle(updated, context.user.id) });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
