import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { saveGameLogFiles, readGameLogFiles } from '../src/lib/gameLogStorage.js';
import { serializedRefresh } from '../src/lib/serializedRefresh.js';
import { publishOnlineGame, subscribeOnlineGame } from '../src/lib/onlineEvents.js';

test('separately loaded route bundles share immediate game events and clean up subscriptions', async () => {
  const otherBundle = await import('../src/lib/onlineEvents.js?separate-route-bundle');
  const received=[];
  const unsubscribe=subscribeOnlineGame('cross-bundle', payload=>received.push(payload));
  const snapshot={game:{id:'cross-bundle',state_version:2},moves:[{ply:1}]};
  otherBundle.publishOnlineGame('cross-bundle',snapshot);
  assert.deepEqual(received,[snapshot]);
  unsubscribe();
  otherBundle.publishOnlineGame('cross-bundle',snapshot);
  assert.equal(received.length,1);
});

test('concurrent local saves keep their own files beyond the 100-entry index', async () => {
  const base = resolve('.test-data');
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(resolve(base, 'logs-'));
  try {
    const entries = await Promise.all(Array.from({ length: 105 }, (_, index) => saveGameLogFiles(root, 'owner', {
      gameId: 'game-' + index, savedAt: '2026-09-13T12:00:00.000Z', result: '1-0', headers: { White: 'A', Black: 'B' }, pgn: '1. e4'
    })));
    assert.equal(new Set(entries.map(e=>e.fileBase)).size,105);
    assert.equal((await readGameLogFiles(root,'owner')).length,100);
    for (const entry of entries) assert.equal(JSON.parse(await readFile(resolve(root,'owner',entry.fileBase+'.json'),'utf8')).gameId,entry.gameId);
    assert.equal(await readGameLogFiles(root,'owner','missing'),null);
    assert.deepEqual(await readGameLogFiles(root,'another-owner'),[]);
    await assert.rejects(saveGameLogFiles(root,'../escape',{gameId:'one'}));
  } finally {
    if(!resolve(root).startsWith(base+sep)) throw new Error('Unsafe test cleanup.');
    await rm(root,{recursive:true,force:true});
  }
});

test('log dates are normalized before paths; old indexed filenames remain readable', async()=>{
  const base=resolve('.test-data');await mkdir(base,{recursive:true});
  const root=await mkdtemp(resolve(base,'log-paths-'));
  try {
    const entry=await saveGameLogFiles(root,'owner',{gameId:'offset',savedAt:'2026-10-22T00:30:00+07:00',pgn:''});
    assert.equal(entry.day,'2026-10-21');assert.equal(entry.fileBase,'2026-10-21-offset');
    assert.equal((await readGameLogFiles(root,'owner','offset')).savedAt,'2026-10-21T17:30:00.000Z');
    await assert.rejects(saveGameLogFiles(root,'owner',{gameId:'../../escape',savedAt:'2026-10-22T00:00:00Z'}));
    await assert.rejects(saveGameLogFiles(root,'owner',{gameId:'bad-date',savedAt:'../invalid'}));
    await writeFile(resolve(root,'owner','legacy-001.json'),JSON.stringify({gameId:'legacy',pgn:'1. e4'}));
    await writeFile(resolve(root,'owner','index.json'),JSON.stringify([{gameId:'legacy',fileBase:'legacy-001'}]));
    assert.equal((await readGameLogFiles(root,'owner','legacy')).pgn,'1. e4');
  } finally {
    if(!resolve(root).startsWith(base+sep))throw new Error('Unsafe test cleanup');
    await rm(root,{recursive:true,force:true});
  }
});

test('realtime refresh coalesces bursts, serializes responses and stops after cancellation', async () => {
  let reads=0, finish;
  const received=[];
  const refresh=serializedRefresh(() => { reads++; return new Promise(resolve=>{finish=resolve;}); }, value=>received.push(value),assert.fail,1);
  for(let i=0;i<20;i++)refresh.schedule();
  await delay(15); assert.equal(reads,1);
  for(let i=0;i<20;i++)refresh.schedule();
  assert.equal(reads,1);
  finish('first'); await delay(15); assert.equal(reads,2);
  finish('second'); await delay(5); assert.deepEqual(received,['first','second']);
  refresh.schedule(); await delay(15); refresh.close(); finish('closed'); await delay(5);
  assert.deepEqual(received,['first','second']);
});

test('realtime refresh recovers after a failed read and broken listeners cannot fail a move', async () => {
  let fail=true, errors=0, delivered=0;
  const refresh=serializedRefresh(async()=>{if(fail)throw Error('offline');return true;},()=>delivered++,()=>errors++,1);
  refresh.schedule();await delay(15);assert.equal(errors,1);
  fail=false;refresh.schedule();await delay(15);assert.equal(delivered,1);refresh.close();
  const stop=subscribeOnlineGame('test',()=>{throw Error('closed');});
  const stopAsync=subscribeOnlineGame('test',async()=>{throw Error('closed asynchronously');});
  assert.doesNotThrow(()=>publishOnlineGame('test'));
  await delay(0);stop();stopAsync();
});
