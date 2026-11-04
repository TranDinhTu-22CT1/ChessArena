import { distributedRateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../lib/online';
import { readJsonPayload } from '../../../../lib/validation';
import { answerCoachQuestion } from '../../../../lib/coachAnswer';
import { readWebsiteSettings } from '../../../../lib/websiteSettings';

export const runtime='nodejs';
const text=(value,limit)=>String(value||'').trim().slice(0,limit);
export async function POST(request) {
  const configured=Number.parseInt(process.env.AI_COACH_RATE_LIMIT_PER_MINUTE||'20',10);
  const blocked=await distributedRateLimit(request,{scope:'ai-coach-chat',limit:Number.isFinite(configured)&&configured>0?configured:20,windowMs:60000});
  if(blocked)return blocked;
  const auth=await requireOnlineUser();if(auth.error)return auth.error;
  const payload=await readJsonPayload(request);
  if(!payload)return Response.json({ok:false,error:'Dữ liệu câu hỏi không hợp lệ.'},{status:400});
  const question=text(payload.question,900);
  if(!question)return Response.json({ok:false,error:'Hãy nhập câu hỏi.'},{status:400});
  const context=payload.context||{};
  const gameContext={hasBoardContext:context.hasBoardContext===true,fen:text(context.fen,160),pgn:text(context.pgn,6000),
    previousFen:text(context.previousFen,160),latestLan:text(context.latestLan,8)};
  const messages=Array.isArray(payload.messages)?payload.messages.slice(-24).filter(m=>m?.role==='user').slice(-12).map(m=>({role:'user',content:text(m.content,900)})):[];
  const signal=globalThis.AbortSignal.any([request.signal,globalThis.AbortSignal.timeout(18000)]);
  try{
    const websiteSettings=await readWebsiteSettings(auth.supabase).catch(()=>null);
    const result=await answerCoachQuestion(question,{messages,gameContext,websiteSettings,viewer:{displayName:auth.user.displayName},signal});
    return Response.json({ok:true,...result},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return Response.json({ok:false,error:signal.aborted?'Xử lý câu hỏi quá lâu. Hãy thử lại.':'Chưa xử lý được câu hỏi. Hãy thử lại.'},{status:error.status||503,headers:{'Cache-Control':'no-store'}});
  }
}
export function OPTIONS(){return new Response(null,{status:204});}
