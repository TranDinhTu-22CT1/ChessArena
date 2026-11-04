import { requireOnlineUser } from '../../../../lib/online';
import { distributedRateLimit } from '../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../lib/validation';
import { puzzleFailure } from '../../../../lib/puzzleSecurity';
import { isUuid } from '../../../../lib/puzzleUtils';
import { syncAchievements } from '../../../../lib/achievements';

export const runtime = 'nodejs';

export async function POST(request) {
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const blocked = await distributedRateLimit(request,{scope:'puzzle-finish',identity:context.user.id,limit:40,windowMs:60000});
  if(blocked)return blocked;
  const payload = await readJsonPayload(request);
  if(!isUuid(payload?.runId))return Response.json({ok:false,error:'Thiếu phiên câu đố hợp lệ.'},{status:400});
  try {
    // Scores, timestamps, streaks and ratings in the request are never trusted.
    const {data:run,error}=await context.supabase.rpc('finish_puzzle_run',{p_user:context.user.id,p_run:payload.runId});
    if(error)throw error;
    const snapshot=await context.supabase.rpc('puzzle_progress_snapshot',{p_user:context.user.id});
    if(snapshot.error)throw snapshot.error;
    const achievements=await syncAchievements(context.supabase,context.user.id);
    return Response.json({ok:true,run,progress:snapshot.data,achievements});
  } catch(error) { return puzzleFailure(error); }
}

export async function GET(request) {
  const context=await requireOnlineUser();
  if(context.error)return context.error;
  const blocked=await distributedRateLimit(request,{scope:'puzzle-progress-read',identity:context.user.id,limit:80,windowMs:60000});
  if(blocked)return blocked;
  try {
    const [snapshot,claims]=await Promise.all([
      context.supabase.rpc('puzzle_progress_snapshot',{p_user:context.user.id}),
      context.supabase.from('daily_puzzle_claims').select('*').eq('user_id',context.user.id).order('puzzle_date',{ascending:false}).limit(90)
    ]);
    if(snapshot.error || claims.error)throw snapshot.error || claims.error;
    return Response.json({ok:true,progress:snapshot.data,dailyClaims:claims.data||[]},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) { return puzzleFailure(error); }
}

export function PUT() {
  return Response.json({ok:false,error:'Tiến độ được tính từ đáp án trên server. Hãy cập nhật hoặc tải lại trang.'},{status:405,headers:{Allow:'GET, POST, OPTIONS'}});
}
export function OPTIONS(){return new Response(null,{status:204});}
