import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { testDatabase } from './database.mjs';

test('real PostgreSQL: matching, invitation transactions and subscription lifecycle', { timeout: 180_000 }, async (t) => {
  const cluster = await testDatabase();
  const { db } = cluster;
  const a = await cluster.connect();
  const b = await cluster.connect();
  const user = async (rating = 800, games = 30, mode = 'rapid') => {
    const id = randomUUID();
    await db.query('insert into users(id,username,display_name,firebase_uid) values($1::uuid,$1::text,$1::text,$1::text)', [id]);
    await db.query('insert into user_ratings(user_id,mode,rating,games_played) values($1,$2,$3,$4)', [id,mode,rating,games]);
    return id;
  };
  const find = async (client, id, { session = id, control = '600+0', mode = 'rapid', renew = true, region = 'global', preference = 200 } = {}) => {
    const { rows } = await client.query('select quick_match_find_game_v3($1,$2,$3,9999,$4,$4,$5,$7,null,$6) as result', [id,control,mode,session,region,renew,preference]);
    return rows[0].result;
  };
  const reset = async () => {
    await db.query("update online_games set status='abandoned' where status='active'; update online_match_queue set status='cancelled' where status in('waiting','claimed');");
  };
  t.afterEach(reset);
  try {
    await t.test('two independent connections converge on one game, with idempotent retries', async () => {
      const one = await user(800); const two = await user(820);
      const started = performance.now();
      await Promise.all([find(a,one),find(b,two)]);
      const x = await find(a,one); const y = await find(b,two);
      assert.equal(x.status,'matched'); assert.equal(x.game_id,y.game_id);
      const game = (await db.query('select * from online_games where id=$1',[x.game_id])).rows[0];
      assert.deepEqual(new Set([game.white_user_id,game.black_user_id]),new Set([one,two]));
      assert.ok(game.rating_gap<=200); assert.equal(game.rated,true);
      const copies=(await db.query("select count(*) from online_games where status='active'")).rows[0].count;
      assert.equal(Number(copies),1);
      t.diagnostic(`Two connections matched in ${Math.round(performance.now()-started)} ms.`);
      await reset();
    });
    await t.test('300 and 432 Elo match on the second join in either experience pool', async () => {
      for (const games of [0,30]) {
        const one=await user(300,30),two=await user(432,games);
        const queued=await find(a,one);
        assert.equal(queued.rating_window,50); assert.equal(queued.rating_limit,200);
        const x=await find(b,two),y=await find(a,one);
        assert.equal(x.status,'matched'); assert.equal(x.game_id,y.game_id); assert.equal(x.rating_gap,132);
        await reset();
      }
    });
    await t.test('early pairing respects both rating preferences, regions and the 200 Elo cap', async () => {
      const one=await user(800),two=await user(932);
      await find(a,one,{preference:100});
      assert.equal((await find(b,two)).status,'waiting');
      assert.equal((await find(a,one,{preference:100})).status,'waiting');
      await reset();
      const vn=await user(800),global=await user(932);
      await find(a,vn,{region:'vn'});
      assert.equal((await find(b,global)).status,'waiting');
      await reset();
      const low=await user(800),high=await user(1001);
      await find(a,low);
      assert.equal((await find(b,high)).status,'waiting');
      await reset();
    });
    await t.test('normal candidates keep priority over an early fallback candidate', async () => {
      const normal=await user(820),fallback=await user(950,0),seeker=await user(800);
      await find(a,normal,{region:'vn'});
      await find(b,fallback); // Region guard keeps the two waiting separately.
      await db.query("update online_match_queue set region='global',region_scope='global' where user_id=$1",[normal]);
      const matched=await find(a,seeker);
      const game=(await db.query('select * from online_games where id=$1',[matched.game_id])).rows[0];
      assert.deepEqual(new Set([game.white_user_id,game.black_user_id]),new Set([normal,seeker]));
      assert.equal((await find(b,fallback)).status,'waiting');
      await reset();
    });
    await t.test('no unlimited rating expansion even after five minutes', async () => {
      const one=await user(400),two=await user(2000);
      await find(a,one); await find(b,two);
      await db.query("update online_match_queue set joined_at=now()-interval '5 minutes',lease_expires_at=now()+interval '1 minute' where status='waiting'");
      const x=await find(a,one),y=await find(b,two);
      assert.equal(x.status,'waiting'); assert.equal(y.status,'waiting'); assert.equal(x.rating_window,200);
      await reset();
    });
    await t.test('40 concurrent searches create 20 games with no duplicate player or ticket', async () => {
      const connections=await Promise.all(Array.from({length:40},()=>cluster.connect()));
      const players=[];
      for(let i=0;i<40;i++) players.push(await user(800+(i%5)*5));
      const started=performance.now();
      await Promise.all(players.map((id,i)=>find(connections[i],id)));
      // Workers retry queued users when concurrent advisory locks skipped a busy opponent.
      for(let pass=0;pass<30;pass++) {
        const pending=(await db.query("select user_id from online_match_queue where status='waiting' and user_id=any($1) order by joined_at",[players])).rows;
        if(!pending.length) break;
        // Match the real worker's bounded concurrency, with independent connections.
        for(let i=0;i<pending.length;i+=10) await Promise.all(pending.slice(i,i+10).map((row,j)=>find(connections[j],row.user_id,{renew:false})));
      }
      const games=(await db.query("select * from online_games where status='active'")).rows;
      assert.equal(games.length,20);
      assert.equal(new Set(games.flatMap(g=>[g.white_user_id,g.black_user_id])).size,40);
      assert.ok(games.every(g=>g.rating_gap<=50));
      assert.equal(Number((await db.query("select count(*) from online_match_queue where user_id=any($1) and status='matched'",[players])).rows[0].count),40);
      t.diagnostic(`40 concurrent players formed 20 games in ${Math.round(performance.now()-started)} ms.`);
      await reset();
    });
    await t.test('a new opponent can use the older ticket window and cancellation returns the committed game', async () => {
      const one=await user(800),two=await user(950);
      const ticket=await find(a,one);
      await db.query("update online_match_queue set joined_at=now()-interval '26 seconds',lease_expires_at=now()+interval '1 minute' where id=$1",[ticket.queue_ticket_id]);
      const matched=await find(b,two);
      assert.equal(matched.status,'matched');
      const cancelled=(await a.query('select quick_match_cancel_v2($1,$2,$3) as result',[one,ticket.queue_ticket_id,one])).rows[0].result;
      assert.equal(cancelled.status,'matched'); assert.equal(cancelled.game_id,matched.game_id);
      await reset();
    });
    await t.test('established strength follows the player to an unplayed mode', async () => {
      const strong=await user(2100,50),beginner=await user(400,0,'blitz');
      await find(a,strong,{control:'300+0',mode:'blitz'});
      await find(b,beginner,{control:'300+0',mode:'blitz'});
      const queue=(await db.query("select rating,pool from online_match_queue where user_id=$1 and status='waiting'",[strong])).rows[0];
      assert.ok(queue.rating>=1950); assert.equal(queue.pool,'standard');
      assert.equal((await find(b,beginner,{control:'300+0',mode:'blitz'})).status,'waiting');
      const opponent=await user(1950,30,'blitz');
      const matched=await find(b,opponent,{control:'300+0',mode:'blitz'});
      assert.equal(matched.status,'matched');
      const game=(await db.query('select * from online_games where id=$1',[matched.game_id])).rows[0];
      const actual=(await db.query("select rating from user_ratings where user_id=$1 and mode='blitz'",[strong])).rows[0].rating;
      assert.equal(game.white_user_id===strong?game.white_rating_before:game.black_rating_before,actual);
      await reset();
    });
    await t.test('stale leases and different sessions cannot steal or cancel live tickets', async () => {
      const id=await user(); const first=await find(a,id,{session:'tab-a'});
      assert.equal((await find(b,id,{session:'tab-b'})).status,'owned_elsewhere');
      const cancel=(await b.query('select quick_match_cancel_v2($1,$2,$3) as result',[id,first.queue_ticket_id,'tab-b'])).rows[0].result;
      assert.equal(cancel.status,'ignored');
      await db.query("update online_match_queue set lease_expires_at=now()-interval '1 second' where id=$1",[first.queue_ticket_id]);
      assert.equal((await find(a,id,{session:'tab-a',renew:false})).status,'idle');
      const next=await find(b,id,{session:'tab-b'}); assert.notEqual(next.queue_ticket_id,first.queue_ticket_id);
      await reset();
    });
    await t.test('invitation accepts exactly once, only for recipient, and cancels both queues', async () => {
      const one=await user(),two=await user(),outsider=await user();
      await db.query("insert into user_friendships(requester_id,receiver_id,status) values($1,$2,'accepted')",[one,two]);
      const sent=(await a.query("select send_game_invitation($1,$2,'600+0','w') as result",[one,two])).rows[0].result;
      await assert.rejects(b.query("select respond_game_invitation($1,$2,'accept')",[outsider,sent.id]),{code:'42501'});
      await find(a,one,{control:'300+0',mode:'blitz'});
      await find(b,two,{control:'180+0',mode:'blitz'});
      const accept=async(client)=>(await client.query("select respond_game_invitation($1,$2,'accept') as result",[two,sent.id])).rows[0].result;
      const [x,y]=await Promise.all([accept(a),accept(b)]);
      assert.equal(x.game_id,y.game_id); assert.equal(x.status,'accepted');
      const game=(await db.query('select * from online_games where id=$1',[x.game_id])).rows[0];
      assert.equal(game.white_user_id,one); assert.equal(game.black_user_id,two); assert.equal(game.rated,false);
      assert.equal(Number((await db.query("select count(*) from online_match_queue where status='waiting' and user_id=any($1)",[[one,two]])).rows[0].count),0);
      await reset();
    });
    await t.test('expired and withdrawn invitations never create a match', async () => {
      const one=await user(),two=await user();
      await db.query("insert into user_friendships(requester_id,receiver_id,status) values($1,$2,'accepted')",[one,two]);
      const sent=(await a.query("select send_game_invitation($1,$2,'600+0') as result",[one,two])).rows[0].result;
      await db.query("update game_invitations set expires_at=now()-interval '1 second' where id=$1",[sent.id]);
      const result=(await b.query("select respond_game_invitation($1,$2,'accept') as result",[two,sent.id])).rows[0].result;
      assert.equal(result.status,'expired'); assert.equal(result.game_id,null);
      const next=(await a.query("select send_game_invitation($1,$2,'600+0') as result",[one,two])).rows[0].result;
      await a.query("select respond_game_invitation($1,$2,'cancel')",[one,next.id]);
      assert.equal((await b.query("select respond_game_invitation($1,$2,'accept') as result",[two,next.id])).rows[0].result.status,'cancelled');
    });
    await t.test('invitation acceptance racing matchmaking leaves each player in at most one active game', async () => {
      const one=await user(),two=await user(),third=await user();
      await db.query("insert into user_friendships(requester_id,receiver_id,status) values($1,$2,'accepted')",[one,two]);
      const sent=(await a.query("select send_game_invitation($1,$2,'600+0') as result",[one,two])).rows[0].result;
      await find(a,one);
      const results=await Promise.allSettled([
        a.query("select respond_game_invitation($1,$2,'accept') as result",[two,sent.id]), find(b,third)
      ]);
      assert.ok(results.some(r=>r.status==='fulfilled'));
      const games=(await db.query("select * from online_games where status='active'")).rows;
      assert.equal(games.length,1);
      const ids=games.flatMap(g=>[g.white_user_id,g.black_user_id]);
      assert.equal(ids.length,new Set(ids).size);
      await reset();
    });
    await t.test('legal moves, checkmate and concurrent rating finalization still work', async () => {
      const one=await user(),two=await user();
      await find(a,one); const matched=await find(b,two);
      const game=(await db.query('select * from online_games where id=$1',[matched.game_id])).rows[0];
      const chess=new Chess();
      for(const [index,san] of ['f3','e5','g4','Qh4#'].entries()) {
        const turn=chess.turn(),id=turn==='w'?game.white_user_id:game.black_user_id;
        const move=chess.move(san);
        const args=[game.id,id,index+1,turn,move.san,move.lan,move.from,move.to,move.promotion||null,chess.fen(),chess.pgn(),chess.turn(),chess.isCheckmate()?'checkmate':'active',chess.isCheckmate()?'0-1':'*'];
        await a.query('select commit_online_move_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',args);
        if(index===0) await assert.rejects(b.query('select commit_online_move_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',args),{code:'40001'});
      }
      const finalize=async(client)=>(await client.query("select finalize_online_rating_result($1,'0-1') as result",[game.id])).rows[0].result;
      const result=await Promise.all([finalize(a),finalize(b)]);
      assert.deepEqual(new Set(result.map(r=>r.status)),new Set(['finalized','already_finalized']));
      const ratings=(await db.query("select rating,games_played from user_ratings where user_id=any($1) and mode='rapid'",[[one,two]])).rows;
      assert.ok(ratings.every(r=>r.games_played===31));
      assert.ok(ratings.some(r=>r.rating>800)); assert.ok(ratings.some(r=>r.rating<800));
      assert.equal(Number((await db.query('select count(*) from online_game_moves where game_id=$1',[game.id])).rows[0].count),4);
      await reset();
    });
    await t.test('paid periods survive cancellation, renewal extends once, lower tiers cannot replace higher', async () => {
      const id=await user(); const paid=new Date(Date.now()+30*86400000).toISOString();
      const sync=async(sub,tier,status,end)=> (await db.query("select apply_paypal_subscription($1,$2,$3,'monthly','PLAN',$4,$5,now(),now(),now()) as result",[id,sub,tier,status,end])).rows[0].result;
      const one=await sync('I-FIRST','pro','ACTIVE',paid); assert.equal(one.status,'active');
      await db.query("update membership_subscriptions set cancel_requested=true where subscription_id='I-FIRST'");
      const pendingCancel=await sync('I-FIRST','pro','ACTIVE',paid);
      assert.equal(pendingCancel.cancel_at_period_end,false, 'Renewal is only shown as stopped after PayPal confirms it');
      const cancelled=await sync('I-FIRST','pro','CANCELLED',null);
      assert.equal(cancelled.status,'active'); assert.equal(Date.parse(cancelled.current_period_end),Date.parse(paid)); assert.equal(cancelled.cancel_at_period_end,true);
      await assert.rejects(db.query("select reserve_membership_checkout($1,'plus','monthly','PLAN')",[id]),{code:'55000'});
      const nextEnd=new Date(Date.now()+60*86400000).toISOString();
      await sync('I-HIGHER','master','ACTIVE',nextEnd);
      await sync('I-FIRST','pro','ACTIVE',paid);
      const active=(await db.query('select * from user_memberships where user_id=$1',[id])).rows[0];
      assert.equal(active.tier,'master'); assert.equal(active.provider_subscription_id,'I-HIGHER');
      await sync('I-HIGHER','master','ACTIVE',nextEnd);
      assert.equal(new Date((await db.query('select current_period_end from user_memberships where user_id=$1',[id])).rows[0].current_period_end).getTime(),Date.parse(nextEnd));
    });
    await t.test('public clients cannot execute privileged matching or payment commits', async () => {
      await a.query('set role authenticated');
      try { await assert.rejects(a.query("select quick_match_find_game_v3($1,'600+0','rapid')",[randomUUID()]),{code:'42501'}); }
      finally { await a.query('reset role'); }
    });
    await t.test('the upgrade can be reapplied without losing players, games or paid access', async () => {
      const historical=await user(400),opponent=await user(2200);
      await db.query("insert into online_games(status,match_type,white_user_id,black_user_id,white_name,black_name,mode,time_control,rated,result,white_rating_before,white_rating_after,black_rating_before,black_rating_after) values('checkmate','quick',$1,$2,'History','Opponent','rapid','600+0',true,'1-0',2200,2220,2200,2180)",[historical,opponent]);
      const before=(await db.query('select (select count(*) from users) as users,(select count(*) from online_games) as games,(select count(*) from user_memberships) as memberships')).rows[0];
      await db.query(await readFile(new URL('../../supabase/BanCanCapNhat.sql',import.meta.url),'utf8'));
      const after=(await db.query('select (select count(*) from users) as users,(select count(*) from online_games) as games,(select count(*) from user_memberships) as memberships')).rows[0];
      assert.deepEqual(after,before);
      assert.equal((await db.query('select get_platform_capabilities() as result')).rows[0].result.matchmakingVersion,3);
      const queued=await find(a,historical);
      assert.equal(queued.rating,1920,'Past established strength remains in matchmaking after current Elo falls');
    });
  } finally { await cluster.close(); }
});
