import test from 'node:test';
import assert from 'node:assert/strict';
import { checkGameplaySchema, checkMatchmakingSchema, schemaFailure } from '../src/lib/schemaReadiness.js';

test('matchmaking does not silently wait forever with an old v3 policy and recovers after hotfix', async()=>{
  let revision=2, calls=0;
  const db={rpc:async()=>{calls++;return {data:{matchmakingVersion:3,matchmakingRevision:revision}};}};
  const error=await checkMatchmakingSchema(db);
  assert.equal(error.code,'MATCHMAKING_PATCH_REQUIRED');
  assert.match((await schemaFailure(error).json()).error,/OnlineHotfix.sql/);
  revision=3;
  assert.equal(await checkMatchmakingSchema(db),null);
  assert.equal(await checkMatchmakingSchema(db),null);
  assert.equal(calls,2);
});

test('missing functions, columns and tables return actionable upgrade errors, without raw SQL internals', async () => {
  for (const code of ['PGRST202','PGRST205','42703','42883','42P01']) {
    const response = schemaFailure({code,message:'private database internals'});
    assert.equal(response.status,503);
    const body = await response.json();
    assert.equal(body.code,'DATABASE_UPGRADE_REQUIRED');
    assert.match(body.error,/BanCanCapNhat.sql/);
    assert.doesNotMatch(body.error,/private database internals/);
  }
  assert.equal(schemaFailure({code:'42501'}),null);
  assert.equal(schemaFailure({code:'22023'}),null);
});

test('gameplay readiness checks real columns, coalesces requests, and retries after an applied migration', async () => {
  let requests = 0;
  let missing = true;
  const db = { from(table) {
    assert.equal(table, 'online_games');
    return { select(columns) {
      assert.equal(columns, 'id,state_version');
      return { async limit(count) {
        assert.equal(count,0);
        requests++;
        return {error:missing?{code:'42703'}:null};
      }};
    }};
  }};
  const first = await Promise.all([checkGameplaySchema(db),checkGameplaySchema(db)]);
  assert.equal(requests,1);
  assert.deepEqual(first,[{code:'42703'},{code:'42703'}]);
  missing=false;
  assert.equal(await checkGameplaySchema(db),null);
  assert.equal(await checkGameplaySchema(db),null);
  assert.equal(requests,2);
});
