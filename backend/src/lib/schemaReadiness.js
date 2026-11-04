export const SCHEMA_UPDATE_MESSAGE = 'Cơ sở dữ liệu chưa được cập nhật. Chạy toàn bộ backend/supabase/BanCanCapNhat.sql trong Supabase SQL Editor rồi thử lại.';

export function isSchemaMismatch(error) {
  return ['PGRST202', 'PGRST203', 'PGRST204', 'PGRST205', '42P01', '42703', '42883'].includes(error?.code);
}

export function schemaFailure(error) {
  if (error?.code === 'MATCHMAKING_PATCH_REQUIRED') return Response.json({ ok:false,
    code:'DATABASE_UPGRADE_REQUIRED',
    error:'Hàm ghép trận đang dùng bản cũ. Chạy toàn bộ backend/supabase/OnlineHotfix.sql trong Supabase SQL Editor rồi thử lại.'
  }, {status:503});
  return isSchemaMismatch(error)
    ? Response.json({ ok: false, code: 'DATABASE_UPGRADE_REQUIRED', error: SCHEMA_UPDATE_MESSAGE }, { status: 503 })
    : null;
}

const gameplayChecks = new WeakMap();
const matchmakingChecks = new WeakMap();

export async function checkMatchmakingSchema(supabase) {
  const previous=matchmakingChecks.get(supabase);
  if(previous && previous.expiresAt>Date.now())return previous.promise;
  const promise=Promise.resolve().then(async()=>{
    const {data,error}=await supabase.rpc('get_platform_capabilities');
    if(error)return error;
    return data?.matchmakingVersion===3 && Number(data.matchmakingRevision)>=3
      ? null : {code:'MATCHMAKING_PATCH_REQUIRED'};
  }).catch(()=>({code:'DATABASE_UNAVAILABLE'}));
  matchmakingChecks.set(supabase,{promise,expiresAt:Date.now()+30000});
  const error=await promise;
  if(error)matchmakingChecks.delete(supabase);
  return error;
}

// Older installations advertised gameplayVersion=1 without state_version.
// Validate the actual column before admitting a player to the ranked queue.
export async function checkGameplaySchema(supabase) {
  const previous = gameplayChecks.get(supabase);
  if (previous && previous.expiresAt > Date.now()) return previous.promise;
  const promise = Promise.resolve().then(async () => {
    const { error } = await supabase.from('online_games').select('id,state_version').limit(0);
    return error || null;
  }).catch(() => ({ code: 'DATABASE_UNAVAILABLE' }));
  const entry = { promise, expiresAt: Date.now() + 30_000 };
  gameplayChecks.set(supabase, entry);
  const error = await promise;
  if (error) gameplayChecks.delete(supabase);
  return error;
}
