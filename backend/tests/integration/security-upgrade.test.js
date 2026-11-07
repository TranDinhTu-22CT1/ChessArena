import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { testDatabase } from './database.mjs';

test('security upgrade preserves data and enforces authoritative puzzle attempts', {timeout:180000}, async t=>{
  const upgrade=await readFile(new URL('../../supabase/SecurityUpgrade.sql',import.meta.url),'utf8');
  const block=sql=>sql.split('-- BEGIN SECURITY UPGRADE')[1].split('-- END SECURITY UPGRADE')[0];
  for(const file of ['schema.sql','BanCanCapNhat.sql'])assert.equal(block(await readFile(new URL('../../supabase/'+file,import.meta.url),'utf8')),block(upgrade));
  const cluster=await testDatabase({upgrades:[upgrade,upgrade]});
  const {db}=cluster;
  const a=randomUUID(),b=randomUUID();
  const puzzle=id=>({id,fen:'7k/8/5KQ1/8/8/8/8/8 w - - 0 1',rating:800,line:['g6g7'],theme:'mate'});
  const start=async(user=a,mode='rated',id=randomUUID(),run=null,limit=5,request=randomUUID())=>(await db.query('select start_puzzle_attempt($1,$2,$3,$4,$5,$6) as v',[user,request,mode,puzzle(id),run,limit])).rows[0].v;
  const answer=async(attempt,user=a,version=0,move='g6g7',accepted=true,complete=true)=>(await db.query('select commit_puzzle_answer($1,$2,$3,$4,$5) as v',
    [user,attempt,version,move,{accepted,complete,playedMoves:accepted?[move]:[],fen:puzzle('').fen,rating:4000,score:999999}])).rows[0].v;
  try {
    for(const id of [a,b])await db.query('insert into users(id,username,display_name) values($1::uuid,$1::text,$1::text)',[id]);
    const scenario=async(name,fn)=>t.test(name,async()=>{await db.query('begin');try{await fn();}finally{await db.query('rollback');}});
    await scenario('public roles have no direct access to private/configuration tables or RPCs',async()=>{
      const verification=await readFile(new URL('../../supabase/VerifySecurityUpgrade.sql',import.meta.url),'utf8');
      const results=await db.query(verification);
      assert.equal(results[0].rows.length,6);assert.equal(results[1].rows.length,5);
      for(const result of results)for(const row of result.rows)assert.equal(row.result,'PASS');
      await db.query('revoke update on public.puzzle_attempts from service_role');
      const missingPermission=await db.query(verification);
      assert.equal(missingPermission[0].rows.find(row=>row.table_name==='puzzle_attempts').result,'CHECK PERMISSIONS');
      await db.query('grant update on public.puzzle_attempts to service_role');
      for(const table of ['bot_personas','site_events','personal_puzzles','puzzle_runs','puzzle_attempts','puzzle_awards']){
        assert.equal((await db.query("select relrowsecurity from pg_class where oid=$1::regclass",['public.'+table])).rows[0].relrowsecurity,true);
        for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') as allowed",[role,'public.'+table])).rows[0].allowed,false);
      }
      assert.equal((await db.query("select has_function_privilege('anon','public.commit_puzzle_answer(uuid,uuid,integer,text,jsonb)','EXECUTE') as allowed")).rows[0].allowed,false);
      assert.equal((await db.query("select has_function_privilege('service_role','public.start_puzzle_attempt(uuid,uuid,text,jsonb,uuid,integer)','EXECUTE') as allowed")).rows[0].allowed,true);
    });
    await scenario('site heartbeat preserves queue/game ownership and does not renew a lease',async()=>{
      await db.query('select touch_site_presence($1)',[a]);
      const ticket=randomUUID(),game=randomUUID();
      await db.query("insert into online_match_queue(id,user_id,firebase_uid,display_name,lease_expires_at) values($1,$2::uuid,$2::text,'Player',now()+interval '10 seconds')",[ticket,a]);
      const before=(await db.query('select lease_expires_at from online_match_queue where id=$1',[ticket])).rows[0].lease_expires_at;
      await db.query("insert into online_games(id,status) values($1,'waiting')",[game]);
      await db.query("update online_presence set status='playing',current_game_id=$2,current_queue_ticket_id=$3,last_seen=now()-interval '2 minutes' where user_id=$1",[a,game,ticket]);
      await db.query('select touch_site_presence($1)',[a]);
      const row=(await db.query('select * from online_presence where user_id=$1',[a])).rows[0];
      assert.equal(row.status,'playing');assert.equal(row.current_game_id,game);assert.equal(row.current_queue_ticket_id,ticket);
      assert.ok(Date.now()-row.last_seen.getTime()<5000);
      assert.deepEqual((await db.query('select lease_expires_at from online_match_queue where id=$1',[ticket])).rows[0].lease_expires_at,before);
    });
    await scenario('server score ignores forged fields, same move replay awards once, and outsider is rejected',async()=>{
      const s=await start();
      const won=await answer(s.attempt.id);
      assert.equal(won.progress.rating,812);assert.equal(won.progress.points,12);assert.equal(won.progress.correct,1);
      assert.deepEqual(await answer(s.attempt.id),won);
      await assert.rejects(answer(s.attempt.id,b),{code:'42501'});
    });
    await scenario('partial moves do not score; stale versions cannot finish a different position',async()=>{
      const s=await start();
      const part=await answer(s.attempt.id,a,0,'g6g5',true,false);
      assert.equal(part.progress.points,0);assert.equal(part.version,1);
      await assert.rejects(answer(s.attempt.id,a,0,'g6g7'),{code:'40001'});
    });
    await scenario('wrong answer penalizes once on retry and then a correct answer can finish',async()=>{
      const s=await start();
      const wrong=await answer(s.attempt.id,a,0,'g6g5',false,false);
      assert.equal(wrong.progress.rating,792);
      assert.deepEqual(await answer(s.attempt.id,a,0,'g6g5',false,false),wrong);
      const won=await answer(s.attempt.id,a,1);
      assert.equal(won.progress.attempted,1);assert.equal(won.progress.correct,1);
    });
    await scenario('quota survives reload; request retries do not consume a second assignment',async()=>{
      const request=randomUUID();
      const one=await start(a,'rated','quota',null,1,request);
      assert.equal((await start(a,'rated','quota',null,1,request)).attempt.id,one.attempt.id);
      const reload=await start(a,'rated','different',null,1);
      assert.equal(reload.attempt.id,one.attempt.id);
      await answer(one.attempt.id);
      await assert.rejects(start(a,'rated','different',null,1),{code:'54000'});
    });
    await scenario('repeated catalog puzzle or daily claim does not farm points',async()=>{
      const one=await start(a,'rated','repeat');await answer(one.attempt.id);
      const two=await start(a,'rated','repeat');const result=await answer(two.attempt.id);
      assert.equal(result.reward,0);assert.equal(result.progress.points,12);
      const daily=await start(a,'daily','daily');await answer(daily.attempt.id);
      const again=await start(a,'daily','daily');const repeated=await answer(again.attempt.id);
      assert.equal(repeated.reward,0);assert.equal(repeated.progress.dailyStreak,1);
    });
    await scenario('expired run cannot score and no client timestamp extends it',async()=>{
      const s=await start(a,'rush');
      await db.query("update puzzle_runs set expires_at=clock_timestamp()-interval '1 second' where id=$1",[s.run.id]);
      const result=await answer(s.attempt.id);assert.equal(result.expired,true);assert.equal(result.progress.rushBest,0);
    });
    await scenario('rush/streak aggregate server answers, end on mistakes, and finish is idempotent',async()=>{
      let s=await start(a,'streak');await answer(s.attempt.id);
      s=await start(a,'streak',randomUUID(),s.run.id);
      const lost=await answer(s.attempt.id,a,0,'g6g5',false,false);
      assert.equal(lost.run.status,'finished');assert.equal(lost.run.score,1);assert.equal(lost.progress.streakBest,1);
      await db.query('select finish_puzzle_run($1,$2)',[a,s.run.id]);
      assert.equal(Number((await db.query('select count(*) from puzzle_sessions where id=$1',[s.run.id])).rows[0].count),1);
      await assert.rejects(db.query('select finish_puzzle_run($1,$2)',[b,s.run.id]),{code:'42501'});
    });
    // Independent transactions exercise the advisory/row locks, outside rollback fixtures.
    await scenario('normal reload preserves partial progress; a new rush retires the old tab',async()=>{
      const normal=await start();await answer(normal.attempt.id,a,0,'g6g5',true,false);
      const reload=await start();assert.equal(reload.attempt.id,normal.attempt.id);assert.equal(reload.attempt.version,1);
      assert.deepEqual(reload.attempt.played_moves,['g6g5']);
      const old=await start(a,'rush');const fresh=await start(a,'rush');assert.notEqual(old.run.id,fresh.run.id);
      await assert.rejects(answer(old.attempt.id),{code:'55000'});
    });
    await scenario('three rush mistakes terminate the run; no further points can be committed',async()=>{
      let s=await start(a,'rush'),result;
      for(let i=0;i<3;i++) {
        if(i)s=await start(a,'rush',randomUUID(),s.run.id);
        result=await answer(s.attempt.id,a,0,'g6g5',false,false);
      }
      assert.equal(result.run.status,'finished');assert.equal(result.run.misses,3);assert.equal(result.run.attempted,3);
      assert.equal((await start(a,'rush',randomUUID(),s.run.id)).finished,true);
    });
    await scenario('an existing daily claim survives upgrade without a second award',async()=>{
      await db.query("insert into daily_puzzle_claims(user_id,puzzle_date,puzzle_id,solved_at,streak) values($1,(now() at time zone 'utc')::date,'legacy',now(),7)",[a]);
      const s=await start(a,'daily');const result=await answer(s.attempt.id);assert.equal(result.reward,0);
      assert.equal((await db.query('select streak from daily_puzzle_claims where user_id=$1',[a])).rows[0].streak,7);
    });
    await scenario('browser roles stay denied even with a leftover permissive policy and column grant',async()=>{
      await db.query("insert into bot_personas(name) values('Private admin bot')");
      await db.query('grant select(name) on bot_personas to authenticated');
      await db.query('create policy legacy_open on bot_personas for select to authenticated using(true)');
      await db.query('set local role authenticated');
      assert.equal((await db.query('select name from bot_personas')).rows.length,0);
      await db.query('reset role');
    });
    await t.test('two connections finishing the same answer cannot double score',async()=>{
      const s=await start(a,'rated','concurrent'),x=await cluster.connect(),y=await cluster.connect();
      const query=c=>c.query('select commit_puzzle_answer($1,$2,0,$3,$4) as v',[a,s.attempt.id,'g6g7',{accepted:true,complete:true,playedMoves:['g6g7']}]);
      const [one,two]=await Promise.all([query(x),query(y)]);assert.deepEqual(one.rows[0],two.rows[0]);
      assert.equal(one.rows[0].v.progress.points,12);
    });
  } finally {await cluster.close();}
});
