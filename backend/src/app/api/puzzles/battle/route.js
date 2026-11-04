import { requireOnlineUser } from '../../../../lib/online';
import { PUZZLE_POSITIONS } from '../../../../lib/puzzlePositions';
import { publicBattle } from '../../../../lib/puzzleBattle';
import { checkPuzzleAttempt } from '../../../../lib/puzzleCheck';
import { isUuid } from '../../../../lib/puzzleUtils';
import { distributedRateLimit } from '../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../lib/validation';

export const runtime = 'nodejs';

function puzzleIds() {
  // Battles use one-move exercises; longer combinations belong to the trainer.
  const pool = PUZZLE_POSITIONS.filter((p) => p.line.length === 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 10).sort((a, b) => a.rating - b.rating).map((p) => p.id);
}

async function action(context, name, id, extra = {}) {
  const { data, error } = await context.supabase.rpc('puzzle_battle_action', {
    p_user: context.user.id, p_action: name, p_battle: id || null, ...extra
  });
  if (error) throw Object.assign(new Error('Chưa cập nhật được Puzzle Battle. Hãy kiểm tra kết nối và bản cập nhật SQL.'), { status: 503 });
  return data;
}

async function handle(request, write) {
  const blocked = await distributedRateLimit(request, { scope: write ? 'puzzle-battle-write' : 'puzzle-battle-read', limit: 120, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const payload = write ? await readJsonPayload(request) : { action: 'read', battleId: new URL(request.url).searchParams.get('battleId') };
  if (!payload || (payload.battleId && !isUuid(payload.battleId))) return Response.json({ ok: false, error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  try {
    const name = payload.action;
    if (!['read', 'join', 'cancel', 'answer'].includes(name)) return Response.json({ ok: false, error: 'Thao tác không hợp lệ.' }, { status: 400 });
    let result;
    let correct;
    if (name === 'answer') {
      if (!payload.battleId) return Response.json({ ok: false, error: 'Thiếu mã trận đấu.' }, { status: 400 });
      const current = await action(context, 'read', payload.battleId);
      const battle = publicBattle(current.battle, context.user.id);
      if (!battle || battle.status !== 'active' || !battle.puzzle) return Response.json({ ok: false, error: 'Trận đấu đã kết thúc hoặc không tồn tại.' }, { status: 409 });
      if (payload.index !== battle.index || payload.puzzleId !== battle.puzzle.id) return Response.json({ ok: false, error: 'Câu đố đã thay đổi. Hãy thử lại.' }, { status: 409 });
      const puzzle = PUZZLE_POSITIONS.find((p) => p.id === battle.puzzle.id);
      correct = (await checkPuzzleAttempt(puzzle, payload.move, [], request.signal)).accepted;
      result = await action(context, 'answer', battle.id, { p_index: battle.index, p_correct: correct });
      if (!result.applied) return Response.json({ ok: false, error: 'Nước trả lời đã được xử lý hoặc trận đã hết giờ.' }, { status: 409 });
    } else result = await action(context, name, payload.battleId, name === 'join' ? { p_ids: puzzleIds() } : {});
    const ids = [result.battle?.player_one_id, result.battle?.player_two_id].filter(Boolean);
    const profiles = ids.length ? await context.supabase.from('users').select('id,display_name,photo_url').in('id', ids) : { data: [] };
    return Response.json({ ok: true, ...(correct !== undefined ? { correct } : {}), battle: publicBattle(result.battle, context.user.id, profiles.data || []) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return Response.json({ ok: false, error: error.message }, { status: error.status || 500 }); }
}
export function GET(request) { return handle(request, false); }
export function POST(request) { return handle(request, true); }
export function OPTIONS() { return new Response(null, { status: 204 }); }
