import test from 'node:test';
import assert from 'node:assert/strict';
import { saveGameLog } from '../src/api/gameLog.js';

test('saving retries a transient failure with the same payload and signed-in credentials', async t => {
  const bodies=[];
  t.mock.method(globalThis,'fetch',async(_url,options)=>{
    bodies.push(options.body);assert.equal(options.credentials,'include');
    return Response.json(bodies.length===1?{ok:false}:{ok:true},{status:bodies.length===1?503:200});
  });
  const result=await saveGameLog({gameId:'same-game'},{retryDelays:[0,0]});
  assert.equal(result.ok,true);assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1]);
});

test('degraded cloud saves are retried; forbidden saves and cancelled requests are not',async t=>{
  let attempts=0;
  t.mock.method(globalThis,'fetch',async()=>{attempts++;return Response.json({ok:true,degraded:attempts===1});});
  await saveGameLog({gameId:'same-game'},{retryDelays:[0,0]});assert.equal(attempts,2);
  t.mock.method(globalThis,'fetch',async()=>{attempts++;return Response.json({ok:false},{status:403});});
  await assert.rejects(saveGameLog({},{retryDelays:[0,0]}));assert.equal(attempts,3);
  const controller=new AbortController();controller.abort();
  await assert.rejects(saveGameLog({},{signal:controller.signal,retryDelays:[0,0]}));assert.equal(attempts,3);
});
