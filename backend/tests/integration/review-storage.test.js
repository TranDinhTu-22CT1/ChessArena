import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Chess} from 'chess.js';
import {testDatabase} from './database.mjs';
import {reviewPosition} from '../../src/lib/positionReview.js';
import {closeStockfishPool} from '../../src/lib/stockfishEngine.js';
import {reviewMetrics} from '../../src/lib/reviewMetrics.js';

test('deep analysis returns legal principal variations and forced mate without a false loss',{timeout:30000},async()=>{
  const board=new Chess();['f3','e5','g4'].forEach(move=>board.move(move));
  try{
    const result=await reviewPosition(board.fen(),'d8h4',{quality:'deep',movetime:650});
    assert.equal(result.best.bestMove,'d8h4');assert.equal(result.best.mate,1);
    assert.equal(result.playedScore,result.best.score);
    assert.ok(result.best.variations.length>=2);
    for(const variation of result.best.variations){const replay=new Chess(board.fen());for(const move of variation.pv)assert.ok(replay.move(move));}
  }finally{closeStockfishPool();}
});
test('quick last-move grading verifies a queen sacrifice with Stockfish and reuses its result',{timeout:30000},async t=>{
  const fen='5r1k/6pp/4Q2N/8/8/8/8/6K1 w - - 0 1';
  try{
    const result=await reviewPosition(fen,'e6g8',{movetime:180});
    assert.equal(result.sacrifice?.capture,'f8g8');
    assert.equal(reviewMetrics({fen,move:'e6g8',...result}).tone,'brilliant');
    const started=performance.now();const cached=await reviewPosition(fen,'e6g8',{movetime:180});
    assert.equal(cached,result);t.diagnostic(`Quick sacrifice grading: ${result.elapsedMs} ms including engine startup; repeated review: ${(performance.now()-started).toFixed(1)} ms.`);
  }finally{closeStockfishPool();}
});
test('review storage merges concurrent batches and validates game history',{timeout:90000},async t=>{
  const cluster=await testDatabase();const {db}=cluster;const [white,black,outsider]=[randomUUID(),randomUUID(),randomUUID()];
  try{
    for(const id of [white,black,outsider])await db.query('insert into users(id,username,display_name,firebase_uid) values($1::uuid,$1::text,$1::text,$1::text)',[id]);
    const game=(await db.query("insert into online_games(white_user_id,black_user_id,status,time_control) values($1,$2,'resigned','600+0') returning id",[white,black])).rows[0].id;
    const board=new Chess(),results=[];
    for(const [index,san] of ['e4','e5','Nf3'].entries()){
      const fen=board.fen(),move=board.move(san),lan=move.from+move.to+(move.promotion||'');
      await db.query('insert into online_game_moves(game_id,ply,user_id,color,san,lan,from_square,to_square,fen_after) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[game,index+1,move.color==='w'?white:black,move.color,san,lan,move.from,move.to,board.fen()]);
      results.push({ply:index+1,fen,move:lan,bestMove:lan,tone:'best',label:'Best',centipawnLoss:0,winLoss:0,whiteScore:20});
    }
    const save=async(client,user,batch)=>(await client.query('select save_game_review_batch($1,$2,$3) value',[user,game,JSON.stringify(batch)])).rows[0].value;
    const reserve=async(client,user,key,limit=1)=>(await client.query(
      'select reserve_game_review($1,$2,$3,$4) value', [user,game,key,limit]
    )).rows[0].value;
    await t.test('review quota is reserved before analysis and concurrent retries charge once',async()=>{
      const other=await cluster.connect();
      const [first,retry]=await Promise.all([
        reserve(db,white,'ignored-client-key',1),
        reserve(other,white,'another-ignored-key',1)
      ]);
      assert.equal(first.allowed,true);
      assert.equal(retry.allowed,true);
      assert.equal((await db.query('select count(*)::int n from review_quota_uses where user_id=$1',[white])).rows[0].n,1);
      const exhausted=(await db.query('select reserve_game_review($1,null,$2,$3) value',[white,'local:another-review',1])).rows[0].value;
      assert.equal(exhausted.allowed,false);
      const unlimited=(await db.query('select reserve_game_review($1,null,$2,null) value',[white,'local:admin-review'])).rows[0].value;
      assert.equal(unlimited.allowed,true);
      await assert.rejects(reserve(db,outsider,'forged',1),{code:'42501'});
    });
    await t.test('a failed review reservation can be released without touching completed reviews',async()=>{
      const key='local:failed-engine-review';
      const held=(await db.query('select reserve_game_review($1,null,$2,$3) value',[outsider,key,1])).rows[0].value;
      assert.equal(held.allowed,true);
      assert.equal((await db.query('select release_game_review_reservation($1,null,$2) value',[outsider,key])).rows[0].value,true);
      assert.equal((await db.query('select count(*)::int n from review_quota_uses where user_id=$1',[outsider])).rows[0].n,0);
    });
    await t.test('separate and repeated batches retain every previous move',async()=>{
      const other=await cluster.connect();await Promise.all([save(db,white,[results[0]]),save(other,white,[results[2]])]);
      const again=await save(db,white,[results[0]]);
      assert.equal(again.savedMoves,2);assert.equal(again.complete,true);assert.equal(again.summary.accuracy,100);
      assert.equal((await db.query('select count(*)::int n from game_review_moves')).rows[0].n,2);
    });
    await t.test('forged positions and spectators cannot write analysis',async()=>{
      await assert.rejects(save(db,white,[{...results[0],move:'a2a4'}]),{code:'22023'});
      await assert.rejects(save(db,white,[{...results[0],fen:board.fen()}]),{code:'22023'});
      await assert.rejects(save(db,outsider,[results[0]]),{code:'42501'});
    });
    await t.test('reanalysis never resets a solved personal exercise',async()=>{
      const mistake={...results[2],tone:'mistake',bestMove:'b1c3',winLoss:10,centipawnLoss:100};
      await save(db,white,[mistake]);await db.query("update personal_puzzles set status='solved'");
      await save(db,white,[mistake]);
      assert.equal((await db.query('select status from personal_puzzles')).rows[0].status,'solved');
    });
    await t.test('completed game analysis protects its quota reservation from rollback',async()=>{
      assert.equal((await db.query('select release_game_review_reservation($1,$2,null) value',[white,game])).rows[0].value,false);
    });
  }finally{await cluster.close();}
});
