import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { verifyAppealToken } from '../../../../lib/banPolicy';
import { rateLimit } from '../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../lib/validation';

export const runtime = 'nodejs';

// This proof grants access only to one ban's appeal, never an application session.
async function context(request) {
  const blocked = rateLimit(request, {scope:'ban-appeal',limit:12,windowMs:60_000});
  if (blocked) return {error:blocked};
  const proof = verifyAppealToken(request.headers.get('authorization')?.replace(/^Bearer /,''));
  if (!proof) return {error:Response.json({ok:false,error:'Phiên gửi yêu cầu đã hết hạn. Hãy xác thực đăng nhập lại để tiếp tục.'},{status:401})};
  const supabase = getSupabaseAdmin();
  if (!supabase) return {error:Response.json({ok:false,error:'Chưa kết nối được hệ thống hỗ trợ.'},{status:503})};
  return {supabase,proof};
}
export async function GET(request) {
  const ctx=await context(request); if(ctx.error)return ctx.error;
  const {data,error}=await ctx.supabase.from('support_requests').select('id,status,admin_note,reviewed_at,created_at,context')
    .eq('user_id',ctx.proof.userId).contains('context',{kind:'ban_appeal',banId:ctx.proof.banId}).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(error)return Response.json({ok:false,error:'Chưa đọc được yêu cầu. Hãy thử lại.'},{status:503});
  return Response.json({ok:true,appeal:data},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request) {
  const ctx=await context(request); if(ctx.error)return ctx.error;
  const payload=await readJsonPayload(request);
  const message=typeof payload?.message==='string'?payload.message.trim():'';
  if(message.length<20||message.length>2000)return Response.json({ok:false,error:'Hãy nhập nội dung từ 20 đến 2.000 ký tự.'},{status:400});
  const {data,error}=await ctx.supabase.rpc('submit_account_ban_appeal',{p_user:ctx.proof.userId,p_ban:ctx.proof.banId,p_message:message});
  if(error)return Response.json({ok:false,error:error.code==='55000'?'Lệnh khóa đã kết thúc. Bạn có thể thử đăng nhập lại.':'Chưa gửi được yêu cầu. Hãy thử lại.'},{status:error.code==='55000'?409:503});
  return Response.json({ok:true,appeal:data},{headers:{'Cache-Control':'no-store'}});
}
