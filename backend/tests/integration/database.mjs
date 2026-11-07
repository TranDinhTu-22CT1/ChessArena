import EmbeddedPostgres from 'embedded-postgres';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import net from 'node:net';

const backend = fileURLToPath(new URL('../../', import.meta.url));

export async function testDatabase({ schemaSql, upgrades = [] } = {}) {
  const root = resolve(backend, '.test-data');
  await mkdir(root, { recursive: true });
  const databaseDir = resolve(await mkdtemp(resolve(root, 'postgres-')));
  if (!databaseDir.startsWith(root + sep)) throw new Error('Test database must remain inside the workspace.');
  const probe = net.createServer();
  await new Promise((r) => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  const postgres = new EmbeddedPostgres({ databaseDir, port, user: 'postgres', password: randomUUID(),
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    persistent: false, postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: (error) => console.error(String(error)) });
  // The package uses taskkill on Windows, which can hang in restricted environments.
  // pg_ctl performs a database-aware shutdown for this verified test directory.
  if (process.platform === 'win32') postgres.stop = async () => {
    if (!postgres.process) return;
    const exited = postgres.process.exitCode === null ? once(postgres.process, 'close') : Promise.resolve();
    await promisify(execFile)(resolve(backend, 'node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe'),
      ['stop', '-D', databaseDir, '-m', 'immediate', '-w', '-t', '10'], { windowsHide: true, timeout: 15_000 });
    await exited;
    postgres.process = undefined;
    if (!resolve(databaseDir).startsWith(root + sep)) throw new Error('Unsafe test cleanup path.');
    await rm(databaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  };
  await postgres.initialise();
  console.log('Test database initialized');
  await postgres.start();
  console.log('Test database started');
  const clients = [];
  const connect = async () => {
    const client = postgres.getPgClient('postgres', '127.0.0.1');
    client.connectionParameters.connectionTimeoutMillis = 5000;
    client._connectionTimeoutMillis = 5000;
    await client.connect();
    await client.query("set statement_timeout='15s'; set lock_timeout='5s'");
    clients.push(client);
    return client;
  };
  const db = await connect();
  console.log('Test database connected');
  try {
    await db.query(`create role anon; create role authenticated; create role service_role;
      create schema auth; create function auth.role() returns text language sql as 'select current_user::text';
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
    await db.query(schemaSql ?? await readFile(resolve(backend, 'supabase/schema.sql'), 'utf8'));
    for (const sql of upgrades) await db.query(sql);
  } catch (error) { console.error('Migration failed:', error); await Promise.all(clients.map((c) => c.end())); await postgres.stop(); throw error; }
  return { db, connect, close: async () => { await Promise.all(clients.map((c) => c.end())); await postgres.stop(); } };
}
