import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { testDatabase } from './database.mjs';

test('season leaderboard: periods, server results, ranks and permissions', { timeout: 180000 }, async t => {
  const migration = await readFile(new URL('../../supabase/LeaderboardSeasons.sql', import.meta.url), 'utf8');
  const block = sql => sql.split('-- BEGIN LEADERBOARD SEASONS')[1].split('-- END LEADERBOARD SEASONS')[0].trim();
  for (const file of ['schema.sql', 'BanCanCapNhat.sql']) {
    assert.equal(block(await readFile(new URL('../../supabase/' + file, import.meta.url), 'utf8')), block(migration));
  }
  const cluster = await testDatabase({ upgrades: [migration, migration] });
  const { db } = cluster;
  try {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const id of ids) {
      await db.query('insert into users(id,username,display_name) values($1::uuid,$1::text,$1::text)', [id]);
      await db.query("insert into user_ratings(user_id,mode,rating,games_played,wins) values($1,'rapid',600,10,5)", [id]);
    }
    const board = async (period = 'week', offset = 0, user = ids[0], page = 1) =>
      (await db.query('select get_leaderboard($1,\'rapid\',$2,$3,$4,10) as value', [user, period, offset, page])).rows[0].value;
    const game = async ({ at, result = '1-0', rated = true, type = 'quick', status = 'resigned', mode = 'rapid', event = true, black = ids[1] }) => {
      const id = randomUUID();
      await db.query(`insert into online_games(id,white_user_id,black_user_id,status,match_type,rated,mode,result,finished_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, ids[0], black, status, type, rated, mode, result, at]);
      if (event) await db.query('insert into online_rating_events(game_id,white_user_id,black_user_id,result) values($1,$2,$3,$4)', [id, ids[0], black, result]);
      return id;
    };
    const scenario = (name, action) => t.test(name, async () => {
      await db.query('begin');
      try { await action(); } finally { await db.query('rollback'); }
    });

    await scenario('rank is identical in personal card and paged entries, including Elo ties', async () => {
      for (const id of ids) {
        const value = await board('all', 0, id, 999);
        assert.equal(value.page, 1);
        assert.equal(value.currentUser.rank, value.entries.find(row => row.userId === id).rank);
      }
    });
    await scenario('weekly reset preserves Elo and previous rank; boundaries are Vietnam Monday', async () => {
      const before = (await db.query('select * from user_ratings order by user_id')).rows;
      const empty = await board();
      assert.equal(empty.currentUser, null);
      const start = new Date(empty.periodStart), end = new Date(empty.periodEnd);
      assert.equal(new Date(start.getTime() + 7 * 3600000).getUTCDay(), 1);
      assert.equal(new Date(start.getTime() + 7 * 3600000).getUTCHours(), 0);
      await game({ at: new Date(start.getTime() - 1) });
      await game({ at: start, result: '1/2-1/2' });
      await game({ at: end }); // half-open interval: belongs to next week, never this one
      const value = await board();
      assert.equal(value.currentUser.points, 1);
      assert.equal(value.currentUser.gamesPlayed, 1);
      assert.equal(value.previousUser.points, 3);
      const previous = await board('week', 1);
      assert.equal(previous.currentUser.rank, value.previousUser.rank);
      assert.deepEqual((await db.query('select * from user_ratings order by user_id')).rows, before);
    });
    await scenario('monthly boundaries and empty previous period do not invent a rank', async () => {
      const empty = await board('month');
      assert.equal(empty.previousUser, null);
      assert.equal(empty.total, 0);
      const start = new Date(empty.periodStart);
      assert.equal(new Date(start.getTime() + 7 * 3600000).getUTCDate(), 1);
      await game({ at: start });
      await game({ at: new Date(start.getTime() - 1), result: '0-1' });
      await game({ at: empty.periodEnd });
      const value = await board('month');
      assert.equal(value.currentUser.points, 3);
      assert.equal(value.currentUser.gamesPlayed, 1);
      assert.equal(value.previousUser.points, 0);
    });
    await scenario('only finalized rated quick results count; duplicate requests cannot duplicate a game', async () => {
      const at = (await board()).periodStart;
      await game({ at, type: 'friend' });
      await game({ at, rated: false });
      await game({ at, event: false });
      await game({ at, status: 'abandoned' });
      const id = await game({ at });
      await db.query('insert into online_rating_events select * from online_rating_events where game_id=$1 on conflict do nothing', [id]);
      assert.equal((await board()).currentUser.gamesPlayed, 1);
      assert.equal((await board()).currentUser.points, 3);
    });
    await scenario('three-game pair cap is shared across speed modes and resets daily', async () => {
      const start = new Date((await board()).periodStart);
      for (let i = 0; i < 3; i++) await game({ at: new Date(start.getTime() + i), mode: 'blitz' });
      await game({ at: new Date(start.getTime() + 3) });
      assert.equal((await board()).currentUser, null);
      await game({ at: new Date(start.getTime() + 4), black: ids[2] });
      assert.equal((await board()).currentUser.points, 3);
      // Previous week is fully in the past, so this test also works on Monday.
      const previous = new Date((await board('week', 1)).periodStart);
      for (let i = 0; i < 4; i++) await game({ at: new Date(previous.getTime() + i) });
      await game({ at: new Date(previous.getTime() + 86400000) });
      assert.equal((await board('week', 1)).currentUser.points, 12);
    });
    await scenario('ordinary Supabase roles cannot impersonate a viewer through RPC', async () => {
      for (const role of ['anon', 'authenticated']) {
        const value = (await db.query("select has_function_privilege($1,'get_leaderboard(uuid,text,text,integer,integer,integer)','execute') as allowed", [role])).rows[0];
        assert.equal(value.allowed, false);
      }
      assert.equal((await db.query("select has_function_privilege('service_role','get_leaderboard(uuid,text,text,integer,integer,integer)','execute') as allowed")).rows[0].allowed, true);
    });
  } finally { await cluster.close(); }
});
