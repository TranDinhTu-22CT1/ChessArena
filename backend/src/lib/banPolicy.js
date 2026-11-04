import { createHmac, timingSafeEqual } from 'node:crypto';
import { signingSecret } from './signingSecrets.js';

export async function findOnlineProfile(supabase, firebaseUid) {
  // Read the profile and current ban in one database request. Never cache bans.
  const { data, error } = await supabase.from('users')
    .select('id,username,display_name,firebase_uid,photo_url,email,bans:user_bans!user_bans_user_id_fkey(id,user_id,reason,created_at,expires_at,status,ban_type)')
    .eq('firebase_uid', firebaseUid)
    .eq('bans.status', 'active').eq('bans.ban_type', 'account')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`, { referencedTable: 'bans' })
    .order('created_at', { ascending: false, referencedTable: 'bans' })
    .limit(1, { referencedTable: 'bans' }).maybeSingle();
  if (error) throw Object.assign(new Error('Chưa đọc được hồ sơ hoặc trạng thái tài khoản.'), { status: 503 });
  return data;
}

export async function findAccountBan(supabase, userId) {
  if (!userId) return null;
  const { data, error } = await supabase.from('user_bans').select('id,user_id,reason,created_at,expires_at,status,ban_type')
    .eq('user_id', userId).eq('status','active').eq('ban_type','account')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if (error) throw Object.assign(new Error('Chưa kiểm tra được trạng thái tài khoản. Hãy thử lại.'), {status:503});
  return data;
}

function secret() {
  return signingSecret('ADMIN_SESSION_SECRET');
}
function signature(payload,key) {return createHmac('sha256',key).update(`ban-appeal:${payload}`).digest('base64url');}

export function issueAppealToken(userId,banId,{key=secret(),now=Date.now()}={}) {
  const payload=Buffer.from(JSON.stringify({userId,banId,scope:'ban-appeal',exp:now+15*60_000})).toString('base64url');
  return `${payload}.${signature(payload,key)}`;
}
export function verifyAppealToken(token,{key=secret(),now=Date.now()}={}) {
  try {
    if(typeof token!=='string'||token.length>2000)return null;
    const [payload,signed,...extra]=token.split('.');
    if(!payload||!signed||extra.length)return null;
    const expected=Buffer.from(signature(payload,key)),actual=Buffer.from(signed);
    if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;
    const parsed=JSON.parse(Buffer.from(payload,'base64url').toString());
    return parsed.scope==='ban-appeal'&&parsed.exp>now&&parsed.userId&&parsed.banId?parsed:null;
  }catch{return null;}
}
export function banNotice(ban) {
  return {ok:false,code:'ACCOUNT_BANNED',error:'Tài khoản của bạn đang bị khóa.',
    ban:{id:ban.id,reason:ban.reason,createdAt:ban.created_at,expiresAt:ban.expires_at||null},
    appealToken:issueAppealToken(ban.user_id,ban.id)};
}
