import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Chess } from 'chess.js';
import { createStockfish, withStockfishEngine, closeStockfishPool } from '../../src/lib/stockfishEngine.js';
import { botStrength, chooseBeginnerMove } from '../../src/lib/enginePolicy.js';
import { PUZZLE_POSITIONS } from '../../src/lib/puzzlePositions.js';
import { enginePosition, legalMove } from '../../src/lib/enginePosition.js';
import { testDatabase } from './database.mjs';

test('Stockfish 18 verifies every authored solution and plays concurrent independent Elo profiles', {timeout:90000}, async t => {
  const engine = createStockfish();
  try {
    await engine.init();
    assert.match(engine.capabilities.name,/Stockfish 18/);
    await t.test('every critical puzzle move preserves a forced mate or winning evaluation', async () => {
      for (const puzzle of PUZZLE_POSITIONS) {
        const board = enginePosition(puzzle.fen);
        for (let ply=0; ply<puzzle.line.length; ply++) {
          const lan = puzzle.line[ply];
          if (ply%2===0) {
            await engine.newGame();
            const result=await engine.analyze({fen:board.fen(),searchMoves:[lan],depth:22,movetime:500});
            assert.equal(result.bestMove,lan,puzzle.id);
            if(puzzle.theme==='mate') assert.ok(result.mate>0 && result.mate<=Math.ceil((puzzle.line.length-ply)/2),`${puzzle.id}: ${JSON.stringify(result)}`);
            else assert.ok(result.score>180,`${puzzle.id} ${lan}: ${result.score}`);
          }
          board.move(lan);
        }
      }
    });
    await t.test('different bot Elo and unrestricted review jobs can run together without illegal or mixed moves', async () => {
      const ratings=[250,577,1320,1777,2400,3190];
      const boards=ratings.map((_,i)=>{const board=new Chess(); if(i%2)board.move('e4');return board;});
      const results=await Promise.all(ratings.map((elo,i)=>withStockfishEngine({},async engine=>{
        const profile=botStrength(elo,engine.capabilities.options.UCI_Elo);
        await engine.configure(profile);
        const result=await engine.analyze({fen:boards[i].fen(),movetime:250});
        const lan=chooseBeginnerMove(boards[i],result.bestMove,profile);
        assert.ok(legalMove(boards[i],lan));
        return profile.rating;
      })));
      assert.deepEqual(results,ratings);
      const result=await withStockfishEngine({},engine=>engine.analyze({fen:PUZZLE_POSITIONS[0].fen,movetime:150}));
      assert.equal(result.bestMove,'d8h4'); assert.equal(result.mate,1);
    });
  } finally {engine.close();closeStockfishPool();}
});

test('Puzzle Battle joins, answers, authorization and simultaneous finishes are atomic', {timeout:90000}, async t => {
  const cluster=await testDatabase();
  const {db}=cluster;
  const clients=await Promise.all([cluster.connect(),cluster.connect(),cluster.connect()]);
  const users=[];
  for(let i=0;i<3;i++) {
    const id=randomUUID();users.push(id);
    await db.query('insert into users(id,username,display_name,firebase_uid) values($1::uuid,$1::text,$1::text,$1::text)',[id]);
  }
  const action=async(index,name,id=null,step=null,correct=null)=>(await clients[index].query(
    'select puzzle_battle_action($1,$2,$3,$4,$5,$6) value',[users[index],name,id,JSON.stringify(['eg-back-rank-rook-white']),step,correct])).rows[0].value;
  try {
    const joins=await Promise.all([action(0,'join'),action(1,'join')]);
    const id=joins[0].battle.id;
    assert.equal(joins[1].battle.id,id);
    assert.equal((await action(0,'read',id)).battle.status,'active');
    await t.test('outsider cannot read or change another battle',async()=>{
      assert.equal((await action(2,'read',id)).battle,null);
      assert.equal((await action(2,'answer',id,0,true)).applied,false);
    });
    await t.test('simultaneous final answers finish the match and repeated requests do not score twice',async()=>{
      await Promise.all([action(0,'answer',id,0,true),action(1,'answer',id,0,false)]);
      const row=(await action(0,'read',id)).battle;
      assert.equal(row.status,'finished'); assert.equal(row.winner_user_id,users[0]);
      assert.equal(row.player_one_score+row.player_two_score,1);
      assert.equal((await action(0,'answer',id,0,true)).applied,false);
    });
    await t.test('expired waiting rooms never pair and expired active games stop accepting answers',async()=>{
      const waiting=await action(0,'join');
      await db.query("update puzzle_battles set expires_at=now()-interval '1 second' where id=$1",[waiting.battle.id]);
      assert.equal((await action(0,'read',waiting.battle.id)).battle.status,'cancelled');
      const fresh=await action(0,'join'); await action(1,'join');
      await db.query("update puzzle_battles set expires_at=now()-interval '1 second' where id=$1",[fresh.battle.id]);
      const late=await action(0,'answer',fresh.battle.id,0,true);
      assert.equal(late.applied,false); assert.equal(late.battle.status,'finished');
      assert.equal(late.battle.player_one_score,0);
    });
    await db.query('set role authenticated');
    await assert.rejects(db.query("select puzzle_battle_action($1,'join')",[users[0]]),{code:'42501'});
    await db.query('reset role');
  } finally {await cluster.close();}
});
