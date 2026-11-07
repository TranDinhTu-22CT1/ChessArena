import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Chess } from 'chess.js';
import { readFile } from 'node:fs/promises';
import { testDatabase } from './database.mjs';

test('gameplay transactions and local game persistence', { timeout: 180_000 }, async t => {
  const cluster = await testDatabase();
  const { db } = cluster;
  const a = await cluster.connect(), b = await cluster.connect();
  const user = async () => {
    const id = randomUUID();
    await db.query('insert into users(id,username,display_name,firebase_uid) values($1::uuid,$1::text,$1::text,$1::text)', [id]);
    return id;
  };
  const game = async (status = 'active', rated = false) => {
    const white = await user(), black = await user();
    return (await db.query(`insert into online_games(white_user_id,black_user_id,white_name,black_name,status,match_type,
      mode,time_control,rated,result,fen,started_at,last_move_at) values($1,$2,'W','B',$3,'friend','rapid','600+0',$4,$5,'start',now(),now()) returning *`,
    [white,black,status,rated,status === 'active' ? '*' : '1-0'])).rows[0];
  };
  const call = async (client, fn, args) => (await client.query(`select ${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`, args)).rows[0].value;
  const play = async (client, g, chess, san) => {
    const color = chess.turn(), move = chess.move(san);
    return call(client, 'commit_online_move_v3', [g.id, color === 'w' ? g.white_user_id : g.black_user_id,
      chess.history().length,color,move.san,move.lan,move.from,move.to,move.promotion || null,
      chess.fen(),chess.pgn(),chess.turn(),chess.isCheckmate() ? 'checkmate' : 'active',chess.isCheckmate() ? '0-1' : '*']);
  };
  const occupy = async (g) => {
    await db.query('insert into user_active_locks(user_id,game_id) values($1,$3),($2,$3)', [g.white_user_id,g.black_user_id,g.id]);
    await db.query(`insert into online_presence(user_id,firebase_uid,display_name,status,current_game_id)
      values($1::uuid,$1::uuid::text,'W','playing',$3::uuid),($2::uuid,$2::uuid::text,'B','playing',$3::uuid)
      on conflict(user_id) do update set status='playing',current_game_id=excluded.current_game_id`,
    [g.white_user_id,g.black_user_id,g.id]);
  };
  try {
    await t.test('simultaneous resignations converge and cannot rewrite a finished result or rating', async () => {
      const g = await game('active', true);
      const results = await Promise.all([call(a,'resign_online_game',[g.white_user_id,g.id]),call(b,'resign_online_game',[g.black_user_id,g.id])]);
      assert.equal(results[0].result,results[1].result);
      const result = results[0].result;
      await Promise.all([call(a,'finalize_online_rating_result',[g.id,result]),call(b,'finalize_online_rating_result',[g.id,result])]);
      assert.equal((await call(a,'resign_online_game',[g.white_user_id,g.id])).result,result);
      await assert.rejects(call(b,'finalize_online_rating_result',[g.id,result === '1-0' ? '0-1' : '1-0']),{code:'55000'});
      const rows = (await db.query('select games_played from user_ratings where user_id=any($1)',[[g.white_user_id,g.black_user_id]])).rows;
      assert.ok(rows.every(row=>row.games_played===1));
      const active = await game('active',true);
      await assert.rejects(call(a,'finalize_online_rating_result',[active.id,'1-0']),{code:'55000'});
    });
    await t.test('simultaneous offers and accept/cancel races cannot accept a withdrawn draw', async () => {
      const g = await game();
      const attempts = await Promise.allSettled([call(a,'respond_online_draw',[g.white_user_id,g.id,'offer']),call(b,'respond_online_draw',[g.black_user_id,g.id,'offer'])]);
      assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
      const offer = attempts.find(r=>r.status==='fulfilled').value;
      const sender = offer.draw_offered_by, recipient = sender===g.white_user_id ? g.black_user_id : g.white_user_id;
      await assert.rejects(call(a,'respond_online_draw',[sender,g.id,'accept']),{code:'42501'});
      await call(a,'respond_online_draw',[sender,g.id,'cancel']);
      await assert.rejects(call(b,'respond_online_draw',[recipient,g.id,'accept']),{code:'55000'});
      await call(a,'respond_online_draw',[sender,g.id,'offer']);
      await Promise.allSettled([call(a,'respond_online_draw',[sender,g.id,'cancel']),call(b,'respond_online_draw',[recipient,g.id,'accept'])]);
      const stored = (await db.query('select * from online_games where id=$1',[g.id])).rows[0];
      assert.equal(stored.draw_offered_by,null);
      assert.ok(['active','draw'].includes(stored.status));
      if(stored.status==='draw') assert.equal((await call(b,'resign_online_game',[recipient,g.id])).result,'1/2-1/2');
    });
    await t.test('opening expiry uses committed moves, and a late move cannot revive an expired game', async () => {
      const g = await game(); const chess = new Chess();
      await play(a,g,chess,'e4');
      await db.query("update online_games set started_at=now()-interval '25 seconds' where id=$1",[g.id]);
      assert.equal((await call(a,'expire_online_game',[g.id])).status,'active','Black still has the opening response window');
      await db.query("update online_game_moves set created_at=now()-interval '21 seconds' where game_id=$1",[g.id]);
      const expired = await play(b,g,chess,'e5');
      assert.equal(expired.status,'abandoned');
      const snapshot = await call(a,'online_game_snapshot',[g.id,g.white_user_id]);
      assert.equal(snapshot.moves.length,1); assert.equal(snapshot.game.fen,snapshot.moves[0].fen_after);
      assert.equal(await call(a,'online_game_snapshot',[g.id,await user()]),null);
    });
    await t.test('White first-move AFK abort is authoritative and releases both players', async () => {
      const g=await game(); await occupy(g);
      await db.query("update online_games set started_at=now()-interval '21 seconds' where id=$1",[g.id]);
      const before=Number((await db.query('select state_version from online_games where id=$1',[g.id])).rows[0].state_version);
      const expired=await call(a,'expire_online_game',[g.id]);
      assert.equal(expired.status,'abandoned'); assert.equal(expired.result,'*');
      const stored=(await db.query('select state_version from online_games where id=$1',[g.id])).rows[0];
      assert.ok(Number(stored.state_version)>before);
      assert.equal((await db.query('select count(*)::int n from user_active_locks where game_id=$1',[g.id])).rows[0].n,0);
      const presence=(await db.query('select status,current_game_id from online_presence where user_id=any($1)',[[g.white_user_id,g.black_user_id]])).rows;
      assert.equal(presence.length,2); assert.ok(presence.every(row=>row.status==='online' && row.current_game_id===null));
    });
    await t.test('Black first-move AFK abort releases both players after White has moved', async () => {
      const g=await game(); const chess=new Chess(); await occupy(g);
      await play(a,g,chess,'e4');
      await db.query("update online_game_moves set created_at=now()-interval '21 seconds' where game_id=$1",[g.id]);
      const expired=await call(b,'expire_online_game',[g.id]);
      assert.equal(expired.status,'abandoned');
      assert.equal((await db.query('select count(*)::int n from user_active_locks where game_id=$1',[g.id])).rows[0].n,0);
      assert.equal((await db.query("select count(*)::int n from online_presence where user_id=any($1) and status='online' and current_game_id is null",[[g.white_user_id,g.black_user_id]])).rows[0].n,2);
    });
    await t.test('after both first moves only the chess clock applies', async () => {
      const g=await game(); const chess=new Chess();
      await play(a,g,chess,'e4'); await play(b,g,chess,'e5');
      await db.query("update online_game_moves set created_at=now()-interval '25 seconds' + ply * interval '1 second' where game_id=$1",[g.id]);
      const snapshot=await call(a,'expire_online_game',[g.id]);
      assert.equal(snapshot.status,'active');
      assert.equal((await db.query('select count(*)::int n from online_game_moves where game_id=$1',[g.id])).rows[0].n,2);
    });
    await t.test('clock expiry precedes a late draw agreement or move', async () => {
      const g=await game(); const chess=new Chess();
      await play(a,g,chess,'e4'); await play(b,g,chess,'e5');
      await call(a,'respond_online_draw',[g.black_user_id,g.id,'offer']);
      await db.query("update online_games set started_at=now()-interval '700 seconds' where id=$1",[g.id]);
      await db.query("update online_game_moves set created_at=now()-interval '650 seconds' + ply * interval '1 second' where game_id=$1",[g.id]);
      const result=await call(a,'respond_online_draw',[g.white_user_id,g.id,'accept']);
      assert.equal(result.status,'resigned'); assert.equal(result.result,'0-1');
      assert.equal((await play(a,g,chess,'Nf3')).result,'0-1');
      assert.equal((await db.query('select count(*) from online_game_moves where game_id=$1',[g.id])).rows[0].count,'2');
    });
    await t.test('checkmate remains the result when a resignation arrives afterwards', async () => {
      const g=await game(); const chess=new Chess();
      for(const san of ['f3','e5','g4','Qh4#']) await play(a,g,chess,san);
      const terminal=await call(b,'resign_online_game',[g.black_user_id,g.id]);
      assert.equal(terminal.status,'checkmate'); assert.equal(terminal.result,'0-1');
    });
    await t.test('rematch accepts once, swaps colors, preserves the link and takes current ratings', async () => {
      const g=await game('resigned',true);
      const request=await call(a,'respond_online_rematch',[g.white_user_id,g.id,'request']);
      const retry=await call(a,'respond_online_rematch',[g.white_user_id,g.id,'request']);
      assert.equal(request.previous_game.rematch_requested_at,retry.previous_game.rematch_requested_at);
      await assert.rejects(call(a,'respond_online_rematch',[g.white_user_id,g.id,'accept']),{code:'42501'});
      const accepted=await Promise.all([call(a,'respond_online_rematch',[g.black_user_id,g.id,'accept']),call(b,'respond_online_rematch',[g.black_user_id,g.id,'accept'])]);
      const next=accepted[0].game;
      assert.equal(next.id,accepted[1].game.id); assert.equal(next.white_user_id,g.black_user_id);
      assert.equal((await call(a,'respond_online_rematch',[g.black_user_id,g.id,'decline'])).game.id,next.id);
      assert.equal((await call(a,'respond_online_rematch',[g.white_user_id,g.id,'request'])).game.id,next.id);
      const ratings=(await db.query("select * from user_ratings where user_id=any($1) and mode='rapid'",[[g.white_user_id,g.black_user_id]])).rows;
      assert.equal(next.white_rating_before,ratings.find(r=>r.user_id===g.black_user_id).rating);
      assert.equal(next.black_rating_before,ratings.find(r=>r.user_id===g.white_user_id).rating);
      assert.equal((await db.query('select count(*) from user_active_locks where game_id=$1',[next.id])).rows[0].count,'2');
      assert.equal((await db.query('select count(*) from matchmaking_integrity_issues where game_id=$1',[next.id])).rows[0].count,'0');
    });
    await t.test('expired and busy rematches cannot create a new game', async () => {
      const g=await game('resigned');
      await call(a,'respond_online_rematch',[g.white_user_id,g.id,'request']);
      await db.query("update online_games set rematch_requested_at=now()-interval '16 seconds' where id=$1",[g.id]);
      assert.equal((await call(b,'respond_online_rematch',[g.black_user_id,g.id,'accept'])).expired,true);
      await call(a,'respond_online_rematch',[g.white_user_id,g.id,'request']);
      await db.query("insert into online_games(status,match_type,white_user_id,black_user_id,mode,time_control) values('active','friend',$1,$2,'rapid','600+0')",[g.white_user_id,await user()]);
      await assert.rejects(call(b,'respond_online_rematch',[g.black_user_id,g.id,'accept']),{code:'55000'});
    });
    await t.test('rematch racing a queue search keeps at most one active game per player', async () => {
      const g=await game('resigned'), third=await user();
      await call(a,'respond_online_rematch',[g.white_user_id,g.id,'request']);
      await call(a,'quick_match_find_game_v3',[g.white_user_id,'600+0','rapid',400,'tab-a','tab-a']);
      await Promise.allSettled([call(a,'respond_online_rematch',[g.black_user_id,g.id,'accept']),call(b,'quick_match_find_game_v3',[third,'600+0','rapid',400,'tab-b','tab-b'])]);
      const games=(await db.query("select * from online_games where status='active' and (white_user_id=$1 or black_user_id=$1)",[g.white_user_id])).rows;
      assert.equal(games.length,1);
    });
    await t.test('local game saves are atomic, retryable and cannot overwrite another account', async () => {
      const one=await user(), two=await user();
      const log={gameId:randomUUID(),playerColor:'w',aiElo:1200,result:'1-0',fen:new Chess().fen(),pgn:'1. e4',headers:{},savedAt:new Date().toISOString(),
        moves:[{ply:1,moveNumber:1,color:'white',san:'e4',lan:'e2e4',from:'e2',to:'e4',piece:'p'}]};
      const [x,y]=await Promise.all([call(a,'save_local_game_log',[one,log]),call(b,'save_local_game_log',[one,log])]);
      assert.equal(x,y);
      await assert.rejects(call(b,'save_local_game_log',[two,log]),{code:'42501'});
      await assert.rejects(call(a,'save_local_game_log',[one,{...log,pgn:'broken',moves:[{...log.moves[0],color:'invalid'}]}]),{code:'23514'});
      assert.equal((await db.query('select pgn from games where id=$1',[x])).rows[0].pgn,'1. e4');
      assert.equal((await db.query('select count(*) from game_moves where game_id=$1',[x])).rows[0].count,'1');
      await a.query('set role authenticated');
      try { await assert.rejects(call(a,'save_local_game_log',[one,log]),{code:'42501'}); }
      finally { await a.query('reset role'); }
    });
    await t.test('an action waiting on a game lock receives a fresh update timestamp', async () => {
      const g=await game('active',true);
      for(const action of ['draw','rating']) {
        await a.query('begin');
        try {
          await a.query('select id from online_games where id=$1 for update',[g.id]);
          const pending=action==='draw' ? call(b,'respond_online_draw',[g.white_user_id,g.id,'offer'])
            : call(b,'finalize_online_rating_result',[g.id,'1-0']);
          await db.query('select pg_sleep(0.05)');
          const previous=(await a.query("update online_games set status=$2,result=$3,updated_at=clock_timestamp() where id=$1 returning updated_at",
            [g.id,action==='draw'?'active':'resigned',action==='draw'?'*':'1-0'])).rows[0].updated_at;
          await a.query('commit');
          await pending;
          const updated=(await db.query('select updated_at from online_games where id=$1',[g.id])).rows[0].updated_at;
          assert.ok(updated.getTime()>=previous.getTime(),'A delayed action must not look older than the state it replaces');
        } finally { await a.query('rollback'); }
      }
    });
    await t.test('the incremental SQL bundle can be reapplied without changing existing games', async () => {
      const before=(await db.query('select (select count(*) from online_games) as online,(select count(*) from games) as local')).rows[0];
      const sql=await readFile(new URL('../../supabase/BanCanCapNhat.sql',import.meta.url),'utf8');
      await db.query(sql); await db.query(sql);
      assert.deepEqual((await db.query('select (select count(*) from online_games) as online,(select count(*) from games) as local')).rows[0],before);
      const capabilities=await call(a,'get_platform_capabilities',[]);
      assert.equal(capabilities.gameplayVersion,1);assert.equal(capabilities.gameLogVersion,1);
    });
  } finally { await cluster.close(); }
});
