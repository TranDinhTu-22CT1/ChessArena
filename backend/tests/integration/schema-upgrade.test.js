import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { testDatabase } from './database.mjs';

test('consolidated schema upgrades retire unused records while preserving played games, support and payments', { timeout: 90_000 }, async () => {
  const cluster = await testDatabase();
  try {
    const { db } = cluster;
    const { rows: [user] } = await db.query("insert into users(username,display_name,firebase_uid) values('existing','Existing player','existing') returning id");
    const { rows: [opponent] } = await db.query("insert into users(username,display_name,firebase_uid) values('opponent','Existing opponent','opponent') returning id");
    const { rows: [game] } = await db.query("insert into online_games(white_user_id,black_user_id,status,fen,pgn,result,time_control,match_type) values($1,$2,'checkmate','start','1. e4','1-0','600+0','friend') returning id", [user.id,opponent.id]);
    await db.query("insert into user_ratings(user_id,mode,rating,games_played) values($1,'rapid',1600,30)",[user.id]);
    await db.query("insert into user_memberships(user_id,tier,status,billing_cycle,provider,provider_subscription_id,provider_plan_id,current_period_end) values($1,'pro','active','yearly','paypal','I-PRESERVE','P-PRESERVE',now()+interval '10 months')",[user.id]);
    await db.query("insert into payment_transactions(user_id,provider,status,amount,currency) values($1,'paypal','completed',99,'USD')",[user.id]);
    // Minimal records from the retired feature, with foreign keys into records we must keep.
    await db.query(`create table arena_tournaments(id uuid primary key default gen_random_uuid());
      create table arena_tournament_players(tournament_id uuid references arena_tournaments(id),user_id uuid references users(id));
      create table arena_tournament_games(tournament_id uuid references arena_tournaments(id),game_id uuid references online_games(id));
      create table tournament_pairings(tournament_id uuid references arena_tournaments(id),game_id uuid references online_games(id));
      create table push_subscriptions(user_id uuid references users(id));
      create table matchmaking_claim_logs(user_id uuid references users(id));
      create table matchmaking_abuse_logs(user_id uuid references users(id));
      alter table support_requests drop constraint support_requests_category_check;
      create table user_devices(user_id uuid references users(id),device_fingerprint text);
      alter table user_bans drop constraint user_bans_ban_type_check;
      alter table user_bans alter column user_id drop not null;
      alter table user_bans add column device_fingerprint text,add column ip_prefix text,
        add column user_agent_hash text,add column risk_signals jsonb;
      alter table admin_audit_logs add column target_device_fingerprint text;`);
    await db.query("insert into user_devices values($1,'legacy-device')",[user.id]);
    const legacyBan=(await db.query("insert into user_bans(user_id,ban_type,device_fingerprint,reason) values($1,'device','legacy-device','Keep this account restriction') returning id",[user.id])).rows[0];
    await db.query("insert into user_bans(ban_type,device_fingerprint) values('device','machine-only')");
    const { rows: [event] } = await db.query('insert into arena_tournaments default values returning id');
    await db.query('insert into arena_tournament_players values($1,$2)',[event.id,user.id]);
    await db.query('insert into arena_tournament_games values($1,$2)',[event.id,game.id]);
    await db.query('insert into tournament_pairings values($1,$2)',[event.id,game.id]);
    await db.query("insert into support_requests(user_id,category,subject,message,context) values($1,'tournament','Keep this request','Original support message',$2)",[user.id,JSON.stringify({recentMessages:[{role:'user',content:'Old AI transcript'}],keep:'Support context'})]);
    await db.query("insert into user_notifications(recipient_user_id,type,title,body,action_url) values($1,'tournament_update','Old alert','Removed feature','/tournaments'),($1,'friend_request','Keep alert','A friend says hi','/friends')",[user.id]);
    const before=(await db.query(`select
      (select row_to_json(g) from online_games g where id=$1) game,
      (select jsonb_agg(row_to_json(p)) from payment_transactions p) payments,
      (select current_period_end from user_memberships where user_id=$2) paid_through`,[game.id,user.id])).rows[0];
    const sql=await readFile(new URL('../../supabase/BanCanCapNhat.sql',import.meta.url),'utf8');
    await db.query('create publication supabase_realtime');
    await db.query(sql); await db.query(sql);
    assert.deepEqual((await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename")).rows.map(row=>row.tablename),['online_game_chat','online_game_moves','online_games']);
    const after=(await db.query(`select
      (select row_to_json(g) from online_games g where id=$1) game,
      (select jsonb_agg(row_to_json(p)) from payment_transactions p) payments,
      (select current_period_end from user_memberships where user_id=$2) paid_through`,[game.id,user.id])).rows[0];
    assert.deepEqual(after,before);
    assert.equal((await db.query('select count(*)::int n from users')).rows[0].n,2);
    assert.equal((await db.query('select category from support_requests')).rows[0].category,'general');
    assert.deepEqual((await db.query('select context from support_requests')).rows[0].context,{keep:'Support context'});
    assert.deepEqual((await db.query('select id,user_id,ban_type,status,reason from user_bans')).rows,[{
      id:legacyBan.id,user_id:user.id,ban_type:'account',status:'active',reason:'Keep this account restriction'
    }]);
    assert.equal((await db.query("select to_regclass('public.user_devices') relation")).rows[0].relation,null);
    assert.equal((await db.query("select count(*)::int n from information_schema.columns where table_schema='public' and column_name in('device_fingerprint','ip_prefix','user_agent_hash','risk_signals','target_device_fingerprint')")).rows[0].n,0);
    assert.deepEqual((await db.query('select title from user_notifications')).rows,[{title:'Keep alert'}]);
    const names=['arena_tournaments','arena_tournament_players','arena_tournament_games','tournament_pairings','push_subscriptions','matchmaking_claim_logs','matchmaking_abuse_logs'];
    for(const name of names) assert.equal((await db.query('select to_regclass($1) relation',['public.'+name])).rows[0].relation,null);
    await assert.rejects(db.query("insert into support_requests(user_id,category) values($1,'tournament')",[user.id]),{code:'23514'});
    await db.query('set role authenticated');
    await assert.rejects(db.query('select * from membership_subscriptions'),{code:'42501'});
    await db.query('reset role');
    const capabilities=(await db.query('select get_platform_capabilities() capabilities')).rows[0].capabilities;
    assert.equal(capabilities.directInvitations,true);
    assert.equal(capabilities.recurringMemberships,true);
    assert.equal(capabilities.accountBanAppeals,true);
    assert.equal(capabilities.reviewVersion,2);
    await db.query('set role service_role');
    await db.query(`insert into website_settings(setting_key,value) values('siteTitle','"Arena updated"'::jsonb),('showMaintenanceBanner','true'::jsonb)
      on conflict(setting_key) do update set value=excluded.value`);
    const settings=(await db.query('select setting_key,value from website_settings')).rows;
    assert.equal(settings.find(row=>row.setting_key==='siteTitle').value,'Arena updated');
    assert.equal(settings.find(row=>row.setting_key==='showMaintenanceBanner').value,true);
    await db.query('set role authenticated');
    await assert.rejects(db.query('select * from website_settings'),{code:'42501'});
    await db.query('reset role');
  } finally { await cluster.close(); }
});
