import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database.mjs';

test('online hotfix removes the artificial wait on revision 2 without deleting data', {timeout:90000}, async()=>{
  const schema=await readFile(new URL('../../supabase/schema.sql',import.meta.url),'utf8');
  const legacyFunction=await readFile(new URL('./fixtures/matchmaking-revision2.sql',import.meta.url),'utf8');
  const old=schema.replace(/CREATE OR REPLACE FUNCTION public\.quick_match_find_game_v3\([\s\S]*?\$function\$;/,()=>legacyFunction)
    .replace("'matchmakingRevision',3,","'matchmakingRevision',2,");
  assert.notEqual(old,schema);
  const cluster=await testDatabase({schemaSql:old});
  try {
    const {db}=cluster;
    const ids=[randomUUID(),randomUUID()];
    for(const [i,id] of ids.entries()) {
      await db.query('insert into users(id,username,display_name,firebase_uid) values($1::uuid,$1::text,$1::text,$1::text)',[id]);
      await db.query("insert into user_ratings(user_id,mode,rating,games_played) values($1,'rapid',$2,$3)",[id,i?432:301,i?0:30]);
    }
    const find=async id=>(await db.query("select quick_match_find_game_v3($1::uuid,'600+0','rapid',null,$1::text,$1::text,'global',200) as result",[id])).rows[0].result;
    await find(ids[0]); await find(ids[1]);
    assert.equal((await find(ids[0])).status,'waiting');
    assert.equal((await find(ids[1])).status,'waiting');
    const tickets=(await db.query('select id from online_match_queue order by id')).rows;
    const hotfix=await readFile(new URL('../../supabase/OnlineHotfix.sql',import.meta.url),'utf8');
    await db.query(hotfix); await db.query(hotfix);
    assert.deepEqual((await db.query('select id from online_match_queue order by id')).rows,tickets);
    assert.equal((await db.query('select get_platform_capabilities() as caps')).rows[0].caps.matchmakingRevision,3);
    const first=await find(ids[0]),second=await find(ids[1]);
    assert.equal(first.status,'matched'); assert.equal(first.game_id,second.game_id);
    assert.equal(first.rating_gap,131);
  } finally { await cluster.close(); }
});
