// Explicit live smoke test. Creates two isolated test identities and an unrated
// friend game, then deletes only the records it created. Never enters matchmaking.
import { randomUUID } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { getFirebaseAdmin } from '../src/lib/firebaseAdmin.js';
import { getSupabaseAdmin } from '../src/lib/supabaseAdmin.js';
if(!process.argv.includes('--run'))throw new Error('Use --run to create temporary test accounts and measure live HTTP/SSE.');
loadEnvFile('../Frontend/.env');
const base=process.env.ONLINE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const db=getSupabaseAdmin(), auth=getFirebaseAdmin().auth();
const users=[], accounts=[], controllers=[];
let gameId;
const check=result=>{if(result.error)throw new Error(result.error.code || 'database_error');return result.data;};
const measurements=[];
async function api(path,cookie,body) {
  const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie,'Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const data=await r.json();
  if(!r.ok || data.ok===false)throw new Error(`API ${path.split('/').at(-1)}: ${r.status} ${data.code||''}`);
  return {r,data};
}
async function stream(account) {
  const controller=new AbortController();controllers.push(controller);
  const started=performance.now();
  const response=await fetch(`${base}/api/online/games/${gameId}/events`,{headers:{Cookie:account.cookie},signal:controller.signal});
  if(!response.ok)throw new Error(`SSE ${response.status}`);
  account.events=[];
  const decoder=new TextDecoder();let pending='';
  void (async()=>{
    try {
      for await(const chunk of response.body) {
        pending+=decoder.decode(chunk,{stream:true});
        let boundary;
        while((boundary=pending.indexOf('\n\n'))>=0) {
          const event=pending.slice(0,boundary);pending=pending.slice(boundary+2);
          if(!event.startsWith('event: game\n'))continue;
          const game=JSON.parse(event.split('\ndata: ')[1]).game;
          account.events.push({ply:game.moves.length,status:game.status,at:performance.now()});
        }
      }
    } catch(error) {if(error.name!=='AbortError')console.log('streamError',error.name);}
  })();
  return Math.round(performance.now()-started);
}
async function waitFor(predicate,timeout=10000) {
  const end=Date.now()+timeout;
  while(Date.now()<end) { const result=predicate();if(result)return result;await new Promise(resolve=>setTimeout(resolve,20)); }
  throw new Error('SSE delivery timeout');
}
try {
  await fetch(base+'/api/config/public',{signal:AbortSignal.timeout(5000)});
  for(let i=0;i<2;i++) {
    const uid=`latency-test-${randomUUID()}`;
    const created=await auth.createUser({uid,email:`${uid}@example.invalid`,emailVerified:true,displayName:`Latency test ${i+1}`});
    accounts.push({uid:created.uid});
    const customToken=await auth.createCustomToken(created.uid);
    const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.VITE_FIREBASE_API_KEY}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:customToken,returnSecureToken:true}),signal:AbortSignal.timeout(15000)
    });
    const tokens=await response.json();
    if(!tokens.idToken)throw new Error('Firebase test sign-in failed');
    const {r}=await api('/api/auth/session','',{idToken:tokens.idToken});
    const cookie=r.headers.getSetCookie().find(value=>value.startsWith('firebase_id_token='))?.split(';')[0];
    if(!cookie)throw new Error('Session cookie missing');
    const profile=check(await db.from('users').select('id').eq('firebase_uid',uid).single());
    users.push(profile.id); Object.assign(accounts[i],{id:profile.id,cookie});
  }
  gameId=check(await db.from('online_games').insert({status:'waiting',match_type:'friend',rated:false,
    white_user_id:users[0],black_user_id:users[1],white_name:'Latency test 1',black_name:'Latency test 2',time_control:'600+0',fen:'start'}).select('id').single()).id;
  const ban=check(await db.from('user_bans').insert({user_id:users[0],reason:'Temporary diagnostic ban',status:'active',ban_type:'account'}).select('id').single());
  const banned=await fetch(`${base}/api/online/games/${gameId}`,{headers:{Cookie:accounts[0].cookie}});
  if(banned.status!==403)throw new Error('Account-ban enforcement failed');
  check(await db.from('user_bans').delete().eq('id',ban.id));
  console.log('streamSetupMs',await Promise.all(accounts.map(stream)));
  await Promise.all(accounts.map(a=>waitFor(()=>a.events.length)));
  check(await db.from('online_games').update({status:'active',started_at:new Date().toISOString(),last_move_at:new Date().toISOString()}).eq('id',gameId));
  await Promise.all(accounts.map(a=>waitFor(()=>a.events.some(e=>e.status==='active'))));
  const moves=[['e2','e4'],['e7','e5'],['g1','f3'],['b8','c6'],['f1','c4'],['g8','f6']];
  for(const [i,[from,to]] of moves.entries()) {
    const started=performance.now(), actor=accounts[i%2], opponent=accounts[1-i%2];
    const http=api(`/api/online/games/${gameId}/move`,actor.cookie,{from,to});
    // Attach rejection handling immediately while awaiting the independently delivered SSE.
    const resultPromise=http.then(value=>({value}),error=>({error}));
    const delivered=await waitFor(()=>opponent.events.find(e=>e.ply===i+1));
    const result=await resultPromise;if(result.error)throw result.error;
    measurements.push({ply:i+1,opponentMs:Math.round(delivered.at-started),httpMs:Math.round(performance.now()-started),serverTiming:result.value.r.headers.get('server-timing')});
  }
  console.log(JSON.stringify({measurements},null,2));
  await new Promise(resolve=>setTimeout(resolve,1100));
  await auth.revokeRefreshTokens(accounts[0].uid);
  const revoked=await fetch(`${base}/api/online/games/${gameId}`,{headers:{Cookie:accounts[0].cookie}});
  if(revoked.status!==401)throw new Error('Session-revocation enforcement failed');
  console.log('authorizationChecks','active ban=403, revoked session=401');
} catch(error) {console.error('measurementFailed',error.message);process.exitCode=1;}
finally {
  controllers.forEach(controller=>controller.abort());
  const failures=[];
  if(gameId) {const {error}=await db.from('online_games').delete().eq('id',gameId);if(error)failures.push('game');}
  // A session request may have created its profile even if the HTTP response failed.
  for(const account of accounts) {
    const {error}=await db.from('users').delete().eq('firebase_uid',account.uid);
    if(error)failures.push('profile');
    try{await auth.deleteUser(account.uid);}catch{failures.push('firebase');}
  }
  console.log('cleanup',failures.length?failures:'complete');
  if(failures.length)process.exitCode=1;
}
