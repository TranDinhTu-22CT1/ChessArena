import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {testDatabase} from './database.mjs';
test('account appeals preserve the login ban, submit once, and approve only the selected ban',{timeout:90000},async t=>{
  const upgrade=await readFile(new URL('../../supabase/BanCanCapNhat.sql',import.meta.url),'utf8');
  const cluster=await testDatabase({upgrades:[upgrade,upgrade]});const {db}=cluster;
  const [user,admin,outsider]=[randomUUID(),randomUUID(),randomUUID()];
  try{
    for(const id of [user,admin,outsider])await db.query('insert into users(id,username,firebase_uid,display_name) values($1::uuid,$1::text,$1::text,$1::text)',[id]);
    const bans=(await db.query('insert into user_bans(user_id) values($1),($1) returning id',[user])).rows.map(r=>r.id);
    const submit=async(client= db)=>(await client.query('select submit_account_ban_appeal($1,$2,$3) value',[user,bans[0],'Xin xem xét lại lệnh khóa tài khoản của tôi.'])).rows[0].value;
    let appeal;
    await t.test('concurrent submissions yield one Support ticket and leave both bans active',async()=>{
      const other=await cluster.connect();const responses=await Promise.all([submit(),submit(other)]);appeal=responses[0];
      assert.equal(responses[1].id,appeal.id);
      assert.equal((await db.query("select count(*)::int n from user_bans where status='active'")).rows[0].n,2);
      assert.equal(appeal.context.kind,'ban_appeal');assert.equal(appeal.category,'moderation');
    });
    await t.test('another account cannot appeal that ban and public roles cannot invoke mutations',async()=>{
      await assert.rejects(db.query('select submit_account_ban_appeal($1,$2,$3)',[outsider,bans[0],'Nội dung xin xem xét của tài khoản khác.']),{code:'42501'});
      await db.query('set role authenticated');
      await assert.rejects(submit(),{code:'42501'});await db.query('reset role');
    });
    await t.test('approval lifts only the linked ban and a duplicate decision cannot change it',async()=>{
      const review=async decision=>(await db.query('select review_account_ban_appeal($1,$2,$3,$4) value',[appeal.id,admin,decision,'Đã xác minh và xem xét nội dung.'])).rows[0].value;
      assert.equal((await review('approved')).context.decision,'approved');
      assert.equal((await review('rejected')).context.decision,'approved');
      assert.equal((await db.query('select status from user_bans where id=$1',[bans[0]])).rows[0].status,'lifted');
      assert.equal((await db.query('select status from user_bans where id=$1',[bans[1]])).rows[0].status,'active');
    });
    await t.test('fresh and repeated upgraded schema has no device-ban data or permissions',async()=>{
      assert.equal((await db.query("select to_regclass('public.user_devices') name")).rows[0].name,null);
      const columns=(await db.query("select column_name from information_schema.columns where table_name='user_bans'")).rows.map(r=>r.column_name);
      assert.ok(!columns.includes('device_fingerprint'));
      await assert.rejects(db.query("insert into user_bans(user_id,ban_type) values($1,'device')",[user]),{code:'23514'});
    });
    await t.test('rejecting a separate appeal leaves its account ban active',async()=>{
      const otherAppeal=(await db.query('select submit_account_ban_appeal($1,$2,$3) value',[user,bans[1],'Xin xem xét lệnh khóa tài khoản còn lại.'])).rows[0].value;
      const decision=(await db.query('select review_account_ban_appeal($1,$2,$3,$4) value',[otherAppeal.id,admin,'rejected','Chưa đủ căn cứ để gỡ lệnh khóa.'])).rows[0].value;
      assert.equal(decision.context.decision,'rejected');
      assert.equal(decision.status,'dismissed');
      assert.equal((await db.query('select status from user_bans where id=$1',[bans[1]])).rows[0].status,'active');
    });
  }finally{await cluster.close();}
});
