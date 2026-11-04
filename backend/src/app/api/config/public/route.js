import { rateLimit } from '../../../../lib/rateLimit';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { readWebsiteSettings, WEBSITE_SETTING_DEFAULTS } from '../../../../lib/websiteSettings';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked=rateLimit(request,{scope:'public-website-settings',limit:120,windowMs:60_000});
  if(blocked)return blocked;
  const supabase=getSupabaseAdmin();
  if(!supabase)return Response.json({ok:true,settings:WEBSITE_SETTING_DEFAULTS},{headers:{'Cache-Control':'no-store'}});
  try{
    return Response.json({ok:true,settings:await readWebsiteSettings(supabase)},{headers:{'Cache-Control':'no-store'}});
  }catch{
    // A temporary read failure must not switch off an already displayed banner.
    return Response.json({ok:false,error:'Không đọc được cài đặt website.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
