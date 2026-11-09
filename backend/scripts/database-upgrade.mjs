import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// These two reviewed files are canonical; never rebuild an older migration bundle.
const target = new URL('../supabase/BanCanCapNhat.sql', import.meta.url);
const sql = await readFile(target, 'utf8');
for (const file of [target, new URL('../supabase/schema.sql', import.meta.url)]) {
  const contents = await readFile(file, 'utf8');
  if (!/^begin;/m.test(contents) || !/commit;\s*$/.test(contents)) throw new Error(`Incomplete SQL transaction: ${fileURLToPath(file)}`);
  console.log(`SQL ready: ${fileURLToPath(file)}`);
}
if (process.argv.includes('--apply')) {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in backend/.env to a Supabase PostgreSQL connection string. The REST service role key cannot apply SQL.');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15_000 });
  try {
    await client.connect();
    await client.query(sql);
    console.log('Database upgrade committed. Run npm run check:platform to verify readiness.');
  } catch (error) {
    await client.query('rollback').catch(() => {});
    console.error(`Database upgrade failed (${error.code || 'connection_error'}). No connection credentials were logged.`);
    process.exitCode = 1;
  } finally { await client.end(); }
}
