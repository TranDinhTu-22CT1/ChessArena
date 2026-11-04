import { rateLimit } from '../../../../lib/rateLimit';
import { PUZZLE_POSITIONS } from '../../../../lib/puzzlePositions';
import { checkPuzzleAttempt } from '../../../../lib/puzzleCheck';
import { isUuid } from '../../../../lib/puzzleUtils';
import { readJsonPayload } from '../../../../lib/validation';
import { requireOnlineUser } from '../../../../lib/online';
import { puzzleContext, puzzleFailure } from '../../../../lib/puzzleSecurity';

export const runtime = 'nodejs';

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'stockfish-puzzle-check', limit: 160, windowMs: 60_000 });
  if (blocked) return blocked;
  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  const actor = await puzzleContext();
  if (actor?.error) return actor.error;
  if (actor) {
    if (!isUuid(payload.attemptId) || !Number.isInteger(payload.version) || typeof payload.move!=='string') {
      return Response.json({ok:false,error:'Thiếu phiên câu đố. Hãy tải lại.'},{status:400});
    }
    try {
      const {data:a,error} = await actor.supabase.from('puzzle_attempts').select('*').eq('id',payload.attemptId).eq('user_id',actor.user.id).maybeSingle();
      if(error)throw error;
      if(!a) return Response.json({ok:false,error:'Không tìm thấy câu đố.'},{status:404});
      if(a.last_version===payload.version && a.last_move===payload.move) return Response.json({ok:true,...a.last_response});
      if(a.version!==payload.version || a.finished_at) return Response.json({ok:false,error:'Tiến trình đã thay đổi. Hãy tải lại.'},{status:409});
      const check = await checkPuzzleAttempt(a.snapshot,payload.move,a.played_moves,request.signal);
      const saved = await actor.supabase.rpc('commit_puzzle_answer',{p_user:actor.user.id,p_attempt:a.id,p_version:payload.version,p_move:payload.move,p_check:check});
      if(saved.error)throw saved.error;
      return Response.json({ok:true,...saved.data});
    } catch(error) { return puzzleFailure(error); }
  }
  if (payload.attemptId) return Response.json({ok:false,error:'Đăng nhập lại để tiếp tục.'},{status:401});
  let puzzle = PUZZLE_POSITIONS.find((item) => item.id === payload.puzzleId);
  let context;
  if (!puzzle && isUuid(payload.puzzleId)) {
    context = await requireOnlineUser();
    if (context.error) return context.error;
    const { data, error } = await context.supabase.from('personal_puzzles').select('*')
      .eq('id', payload.puzzleId).eq('user_id', context.user.id).maybeSingle();
    if (error) return Response.json({ ok: false, error: 'Không đọc được bài tập cá nhân.' }, { status: 503 });
    puzzle = data;
  }
  if (!puzzle) return Response.json({ ok: false, error: 'Câu đố không tồn tại.' }, { status: 404 });
  try {
    const check = await checkPuzzleAttempt(puzzle, payload.move, payload.playedMoves || [], request.signal);
    if (context && check.complete) {
      const { error } = await context.supabase.from('personal_puzzles')
        .update({ status: 'solved', updated_at: new Date().toISOString() }).eq('id', puzzle.id).eq('user_id', context.user.id);
      if (error) throw new Error('Chưa lưu được kết quả bài tập. Hãy thử lại nước đi.');
    }
    return Response.json({ ok: true, ...check });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Chưa kiểm tra được nước đi.' }, { status: error.status || 500 });
  }
}

export function OPTIONS() { return new Response(null, { status: 204 }); }
