import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {testDatabase} from './database.mjs';

test('support status transitions reopen atomically and notify only on real changes',{timeout:90000},async()=>{
  const cluster=await testDatabase();const {db}=cluster;const user=randomUUID(),admin=randomUUID();
  try{
    for(const id of [user,admin])await db.query('insert into users(id,username,display_name,firebase_uid) values($1::uuid,$1::text,$1::text,$1::text)',[id]);
    const request=(await db.query("insert into support_requests(user_id,category,status,subject,message) values($1,'technical','dismissed','Closed ticket','Please reopen this ticket') returning id",[user])).rows[0];
    const update=async status=>(await db.query('select update_support_request_status($1,$2,$3,$4) value',[request.id,admin,status,'Admin workflow note'])).rows[0].value;
    assert.equal((await update('in_review')).status,'in_review');
    assert.equal((await update('in_review')).status,'in_review');
    assert.equal((await db.query('select count(*)::int n from support_status_events where request_id=$1',[request.id])).rows[0].n,1);
    assert.equal((await db.query("select count(*)::int n from user_notifications where recipient_user_id=$1 and type='support_status'",[user])).rows[0].n,1);
    const event=(await db.query('select old_status,new_status,note from support_status_events where request_id=$1',[request.id])).rows[0];
    assert.deepEqual(event,{old_status:'dismissed',new_status:'in_review',note:'Admin workflow note'});
    await db.query('set role authenticated');
    await assert.rejects(update('resolved'),{code:'42501'});
    await db.query('reset role');
    await assert.rejects(update('invalid'),{code:'22023'});
  }finally{await db.query('reset role').catch(()=>{});await cluster.close();}
});
