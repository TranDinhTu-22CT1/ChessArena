import { rateLimit } from '../../../../lib/rateLimit';
import { selectPuzzle, publicPuzzle } from '../../../../lib/puzzleRules';
import { PUZZLE_POSITIONS, PUZZLE_STAGES, PUZZLE_THEMES } from '../../../../lib/puzzlePositions';
import { isUuid } from '../../../../lib/puzzleUtils';
import { readJsonPayload } from '../../../../lib/validation';
import { randomUUID } from 'node:crypto';
import { puzzleContext, puzzleAccess, puzzleFailure } from '../../../../lib/puzzleSecurity';

export const runtime = 'nodejs';

export async function GET() {
  return Response.json({ ok: true, themes: PUZZLE_THEMES, stages: PUZZLE_STAGES, count: PUZZLE_POSITIONS.length });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'stockfish-puzzle', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;
  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  const mode = payload.mode || 'rated';
  if (!['rated','daily','rush','streak','custom','personal'].includes(mode)) return Response.json({ ok:false, error:'Chế độ không hợp lệ.' }, { status:400 });
  const context = await puzzleContext();
  if (context?.error) return context.error;
  if (!context && ['rush','custom','personal'].includes(mode)) return Response.json({ ok:false,error:'Đăng nhập để sử dụng chế độ này.' }, { status:401 });
  try {
  const limit = context ? await puzzleAccess(context, mode) : null;
  const requestId = payload.requestId || randomUUID();
  if (!isUuid(requestId) || (payload.runId && !isUuid(payload.runId))) return Response.json({ok:false,error:'Yêu cầu không hợp lệ.'},{status:400});
  let candidate;
  if (context) {
    // Recover the same assignment before selecting from the remaining catalog.
    // This also works when the last available exercise is still in progress.
    let pending = context.supabase.from('puzzle_attempts').select('snapshot').eq('user_id',context.user.id);
    const retry = await pending.eq('id',requestId).maybeSingle();
    if (retry.error) throw retry.error;
    candidate = retry.data?.snapshot;
    if (!candidate && payload.runId && ['rush','streak'].includes(mode)) {
      pending = await context.supabase.from('puzzle_attempts').select('snapshot').eq('user_id',context.user.id)
        .eq('run_id',payload.runId).is('finished_at',null).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if (pending.error) throw pending.error;
      candidate = pending.data?.snapshot;
    }
  }
  if (!candidate && mode === 'personal') {
    const excluded = Array.isArray(payload.excluded) ? payload.excluded.filter(isUuid).slice(-300) : [];
    let query = context.supabase.from('personal_puzzles').select('*').eq('user_id', context.user.id)
      .eq('status', 'new').order('created_at', { ascending: false }).limit(1);
    if (excluded.length) query = query.not('id', 'in', `(${excluded.join(',')})`);
    const { data = [], error } = await query;
    if (error) return Response.json({ ok: false, error: 'Không đọc được bài tập cá nhân.' }, { status: 503 });
    if (!data[0]) return Response.json({ ok: false, exhausted: true,
      error: 'Chưa có bài tập cá nhân mới. Hãy phân tích một ván online đã kết thúc.' }, { status: 404 });
    candidate = data[0];
  } else if (!candidate) {
    const options = { ...payload, mode };
    if (context) {
      const progress = await context.supabase.from('puzzle_progress').select('rating,seen_puzzle_ids').eq('user_id',context.user.id).maybeSingle();
      if (progress.error) throw progress.error;
      options.rating = progress.data?.rating || 800;
      options.excluded = progress.data?.seen_puzzle_ids || [];
      if (payload.runId) {
        if (!isUuid(payload.runId)) return Response.json({ok:false,error:'Phiên không hợp lệ.'},{status:400});
        const attempts = await context.supabase.from('puzzle_attempts').select('puzzle_id').eq('run_id',payload.runId).eq('user_id',context.user.id);
        if (attempts.error) throw attempts.error;
        // Runs may reuse the catalog from earlier runs, but never repeat within one run.
        if (['rush','streak'].includes(mode)) options.excluded = (attempts.data || []).map(a=>a.puzzle_id);
      } else if (['rush','streak'].includes(mode)) options.excluded=[];
      if (mode!=='custom') { options.theme='all';options.stage='all';options.minRating=0;options.maxRating=4000; }
    }
    candidate = selectPuzzle(options);
  }
  if (!candidate) {
    let run, progress;
    if (context && payload.runId && ['rush','streak'].includes(mode)) {
      const ended = await context.supabase.rpc('finish_puzzle_run',{p_user:context.user.id,p_run:payload.runId});
      if (ended.error) throw ended.error;
      run = ended.data;
      const snapshot = await context.supabase.rpc('puzzle_progress_snapshot',{p_user:context.user.id});
      if (snapshot.error) throw snapshot.error;
      progress = snapshot.data;
    }
    return Response.json({ ok: false, exhausted: true, run, progress,
      error: 'Bạn đã hoàn thành các câu đố trong bộ lọc này.' }, { status: 404 });
  }
  if (!context) return Response.json({ ok:true, engine:'verified-catalog', puzzle:{...publicPuzzle(candidate),practice:true} });
  const {data,error} = await context.supabase.rpc('start_puzzle_attempt',{
    p_user:context.user.id,p_request:requestId,p_mode:mode,p_puzzle:candidate,
    p_run:['rush','streak'].includes(mode) ? payload.runId || null : null,p_limit:limit
  });
  if(error)throw error;
  if(data.finished) return Response.json({ok:false,error:'Lượt chơi đã kết thúc.',run:data.run,progress:data.progress},{status:409});
  return Response.json({ok:true,engine:mode==='personal'?'saved-review':'verified-catalog',puzzle:{
    ...publicPuzzle(data.attempt.snapshot),attemptId:data.attempt.id,version:data.attempt.version,
    run:{...data.run,serverNow:new Date().toISOString()},progress:data.progress,playedMoves:data.attempt.played_moves
  }});
  } catch(error) { return puzzleFailure(error); }
}

export function OPTIONS() { return new Response(null, { status: 204 }); }
