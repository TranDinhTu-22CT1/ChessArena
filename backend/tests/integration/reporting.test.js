import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database.mjs';

test('player reports enforce identity and notify the reporter exactly once', { timeout: 90_000 }, async t => {
  const cluster=await testDatabase(); const {db}=cluster;
  const reporter=randomUUID(), reported=randomUUID(), admin=randomUUID();
  try {
    for(const id of [reporter,reported,admin]) {
      await db.query('insert into users(id,username,display_name,firebase_uid) values($1::uuid,$1::text,$1::text,$1::text)',[id]);
    }
    await t.test('database rejects a self-report even for a privileged caller',async()=>{
      await assert.rejects(db.query(`insert into player_reports(reporter_user_id,reported_user_id,category,description)
        values($1,$1,'other','Self report must be rejected')`,[reporter]),{code:'23514'});
    });
    await t.test('a resolved valid report creates one result notification with action metadata',async()=>{
      const report=(await db.query(`insert into player_reports(reporter_user_id,reported_user_id,category,description)
        values($1,$2,'harassment','Evidence attached to this report') returning id`,[reporter,reported])).rows[0];
      await db.query("insert into user_bans(user_id,created_by,reason,status) values($1,$2,'Confirmed violation','active')",[reported,admin]);
      await db.query("update player_reports set status='resolved',reviewed_by=$2,reviewed_at=now() where id=$1",[report.id,admin]);
      await db.query("update player_reports set status='resolved',updated_at=now() where id=$1",[report.id]);
      const notices=(await db.query("select * from user_notifications where recipient_user_id=$1 and type='player_report_result'",[reporter])).rows;
      assert.equal(notices.length,1);
      assert.equal(notices[0].metadata.reportId,report.id);
      assert.equal(notices[0].metadata.actionTaken,true);
      assert.match(notices[0].body,/xử phạt/);
    });
    await t.test('dismissal also notifies without exposing moderation internals',async()=>{
      const report=(await db.query(`insert into player_reports(reporter_user_id,reported_user_id,category,description)
        values($1,$2,'other','A second independently reviewed report') returning id`,[reporter,reported])).rows[0];
      await db.query("update player_reports set status='dismissed',reviewed_by=$2,reviewed_at=now() where id=$1",[report.id,admin]);
      const notice=(await db.query("select * from user_notifications where metadata->>'reportId'=$1",[report.id])).rows[0];
      assert.equal(notice.metadata.status,'dismissed'); assert.equal(notice.metadata.actionTaken,false);
      assert.match(notice.body,/chưa có đủ bằng chứng/);
    });
  } finally { await cluster.close(); }
});
