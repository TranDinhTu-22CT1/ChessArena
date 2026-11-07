import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { createEnginePool } from '../src/lib/enginePool.js';
import { createUciProtocol } from '../src/lib/stockfishEngine.js';
import { enginePosition } from '../src/lib/enginePosition.js';
import { botStrength, chooseBeginnerMove, resolvePlayingElo } from '../src/lib/enginePolicy.js';

const tick = () => new Promise(resolve => setImmediate(resolve));

test('pool runs independently, bounds waiting, cancels queued work, and resets each customer', async () => {
  let id = 0;
  const instances = [];
  const pool = createEnginePool({ size: 2, maxQueue: 1, create: () => {
    const instance = { id: ++id, init: async () => {}, configure: async function(options) { this.elo = options.elo ?? null; }, close() { this.closed = true; } };
    instances.push(instance); return instance;
  }});
  const releases = [];
  const hold = engine => new Promise(resolve => releases.push(() => resolve({ id: engine.id, elo: engine.elo })));
  try {
    const first = pool.run({elo:800}, hold), second = pool.run({elo:2400}, hold);
    await tick();
    assert.equal(pool.stats().busy, 2);
    const controller = new AbortController();
    const queued = pool.run({signal:controller.signal}, () => assert.fail('cancelled job ran'));
    const cancelled = assert.rejects(queued, {name:'AbortError'});
    await assert.rejects(pool.run({}, () => {}), {status:503});
    controller.abort(); await cancelled;
    releases.forEach(release => release());
    assert.deepEqual(await Promise.all([first,second]), [{id:1,elo:800},{id:2,elo:2400}]);
    const analysis = await pool.run({}, engine => engine.elo);
    assert.equal(analysis, null);
  } finally { pool.close(); }
  assert.ok(instances.every(engine => engine.closed));
});

test('aborting a running job destroys that process before serving the next game', async () => {
  let created = 0, killed = 0, entered;
  const ready = new Promise(resolve => {entered = resolve;});
  const pool = createEnginePool({ size:1, create: () => ({id:++created, init:async()=>{},configure:async()=>{},close(){killed++;}}) });
  try {
    const controller = new AbortController();
    const task = pool.run({signal:controller.signal}, () => {entered(); return new Promise(()=>{});});
    const failed = assert.rejects(task, {name:'AbortError'});
    await ready; controller.abort(); await failed;
    assert.equal(killed,1);
    assert.equal(await pool.run({}, engine => engine.id),2);
  } finally {pool.close();}
});

test('UCI parses the selected PV rather than the last MultiPV score and resets strength', async () => {
  const commands = [];
  let killed = false;
  const engine = createUciProtocol(command => {
    commands.push(command);
    if (command === 'uci') queueMicrotask(() => {
      ['option name Skill Level type spin default 20 min 0 max 20','option name MultiPV type spin default 1 min 1 max 256',
        'option name UCI_LimitStrength type check default false','option name UCI_Elo type spin default 1320 min 1320 max 3190','uciok'].forEach(engine.consume);
    });
    if (command === 'isready') queueMicrotask(() => engine.consume('readyok'));
    if (command.startsWith('go ')) queueMicrotask(() => {
      engine.consume('info depth 12 multipv 1 score cp 34 nodes 100 pv e2e4 e7e5');
      engine.consume('info depth 12 multipv 2 score cp -91 nodes 100 pv a2a3 e7e5');
      engine.consume('info depth 13 multipv 1 score cp 999 lowerbound pv e2e4');
      engine.consume('bestmove e2e4');
    });
  }, () => {killed=true;});
  try {
    await engine.init({elo:1777,skillLevel:3,multiPv:2});
    const result = await engine.analyze({fen:new Chess().fen(),movetime:50});
    assert.equal(result.score,34); assert.equal(result.pv[1],'e7e5');
    await engine.configure();
    assert.ok(commands.includes('setoption name UCI_Elo value 1777'));
    assert.deepEqual(commands.slice(-4), ['setoption name Skill Level value 20','setoption name MultiPV value 1','setoption name UCI_LimitStrength value false','isready']);
    await assert.rejects(engine.configure({elo:250}), /supported range/);
  } finally {engine.close();}
  assert.ok(killed);
});

test('engine input rejects illegal moves, command injection and an already attacked opposing king', () => {
  assert.throws(() => enginePosition(new Chess().fen(), ['e2e5']),{status:400});
  assert.throws(() => enginePosition(new Chess().fen()+'\ngo infinite'),{status:400});
  assert.throws(() => enginePosition('6k1/8/8/8/8/8/8/4K1R1 w - - 0 1'));
  const board = enginePosition(new Chess().fen(), ['e2e4','e7e5']);
  assert.equal(board.turn(),'w');
});

test('configured admin Elo overrides the caller, disabled/scheduled bots cannot play', async () => {
  const payload = {botId:'941aed79-5cac-43a4-b9d1-019d87b73130',elo:3190};
  assert.equal(await resolvePlayingElo(payload,async()=>({elo:577,active:true})),577);
  await assert.rejects(resolvePlayingElo(payload,async()=>({elo:1200,active:false})),{status:409});
  await assert.rejects(resolvePlayingElo(payload,async()=>({elo:1200,active:true,starts_at:'2099-01-01'})),{status:409});
  assert.equal(await resolvePlayingElo({...payload,fullStrength:true},async()=>assert.fail()),3190);
});

test('beginner profiles select legal alternatives without affecting analysis or supported Elo', () => {
  const board = new Chess();
  for (const elo of [250,500,800,1100,1319]) {
    const move = chooseBeginnerMove(board,'e2e4',botStrength(elo),()=>0);
    assert.ok(board.moves({verbose:true}).some(candidate => candidate.lan === move));
  }
  assert.equal(chooseBeginnerMove(board,'e2e4',botStrength(2000),()=>0),'e2e4');
});
