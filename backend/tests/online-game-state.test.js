import test from 'node:test';
import assert from 'node:assert/strict';
import { createOnlineGameStateCache } from '../src/lib/onlineGameState.js';

test('game cache rejects delayed snapshots, expires and can be invalidated after a database conflict',()=>{
  let clock=0;
  const cache=createOnlineGameStateCache({now:()=>clock,ttlMs:100,maxEntries:2});
  cache.remember({id:'a',state_version:3},[{ply:1},{ply:2}]);
  cache.remember({id:'a',state_version:2},[{ply:1}]);
  assert.equal(cache.get('a').game.state_version,3);
  cache.remember({id:'a',state_version:3},[{ply:1}]);
  assert.equal(cache.get('a').moves.length,2);
  clock=101;assert.equal(cache.get('a'),null);
  cache.remember({id:'a',state_version:4},[]);
  cache.remove('a');assert.equal(cache.get('a'),null);
  for(const id of ['a','b','c'])cache.remember({id,state_version:1},[]);
  assert.equal(cache.get('a'),null);
  assert.equal(cache.get('c').game.id,'c');
});
