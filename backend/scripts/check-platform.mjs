import { getSupabaseAdmin } from '../src/lib/supabaseAdmin.js';
import { fetchPayPalPlan } from '../src/lib/paypal.js';
import { assertRecurringPlan, configuredPlan } from '../src/lib/membershipPolicy.js';

const supabase=getSupabaseAdmin();
const summary={database:[],paypal:[]};
const databaseOnly = process.argv.includes('--database-only');
if(supabase) {
  for(const [table, columns] of [
    ['users','id'], ['online_games','id,state_version'], ['game_invitations','id'],
    ['membership_subscriptions','subscription_id'], ['membership_checkouts','user_id'],
    ['website_settings','setting_key,value'], ['review_quota_uses','user_id,review_key'],
    ['game_review_moves','game_id,ply'], ['online_match_queue','id,lease_expires_at']
  ]) {
    // HEAD may hide a PostgREST schema error. GET limit 0 validates columns
    // without transferring any account, game or payment records.
    const {error}=await supabase.from(table).select(columns).limit(0).abortSignal(AbortSignal.timeout(12_000));
    summary.database.push({table,reachable:!error,code:error?.code||null});
  }
  const {data,error}=await supabase.rpc('get_platform_capabilities').abortSignal(AbortSignal.timeout(12_000));
  summary.capabilities=error?{available:false,code:error.code||'connection_failed'}:data;
}
if (!databaseOnly) for(const tier of ['plus','pro','master'])for(const cycle of ['monthly','yearly']) {
  const planId=configuredPlan(tier,cycle);
  if(!planId){summary.paypal.push({tier,cycle,configured:false});continue;}
  try {
    const plan=await fetchPayPalPlan(planId);
    let recurring=true;
    try{assertRecurringPlan(plan,cycle);}catch{recurring=false;}
    summary.paypal.push({tier,cycle,status:plan.status,recurring});
  } catch { summary.paypal.push({tier,cycle,reachable:false}); }
}
console.log(JSON.stringify(summary,null,2));
if(summary.capabilities?.matchmakingVersion!==3 || !(Number(summary.capabilities?.matchmakingRevision)>=3) || summary.capabilities?.gameplayVersion!==1
  || summary.capabilities?.gameLogVersion!==1 || summary.capabilities?.reviewVersion!==2 || summary.capabilities?.accountBanAppeals!==true || summary.database.some(row=>!row.reachable)
  || summary.paypal.some(row=>row.reachable===false || row.recurring!==true))process.exitCode=1;
