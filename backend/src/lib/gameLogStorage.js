import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const writes = new Map();
function segment(value) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new Error('Invalid log path.');
  return value;
}
async function readIndex(directory) {
  try {
    const value = JSON.parse(await readFile(path.join(directory, 'index.json'), 'utf8'));
    if (!Array.isArray(value)) throw new Error('Invalid game log index.');
    return value;
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function atomicWrite(target, contents) {
  const temp = target + '.' + randomUUID() + '.tmp';
  try { await writeFile(temp, contents, 'utf8'); await rename(temp, target); }
  finally { await rm(temp, { force: true }); }
}
function pgnWithHeaders(log) {
  const headers = Object.entries(log.headers || {})
    .filter(([key, value]) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) && value != null)
    .map(([key, value]) => '[' + key + ' "' + String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replace(/[\r\n]/g, ' ') + '"]')
    .join('\n');
  return headers + '\n\n' + (log.pgn || '') + '\n';
}

export async function saveGameLogFiles(root, owner, log) {
  const directory = path.resolve(root, segment(owner));
  segment(log.gameId);
  const savedAt = new Date(log.savedAt).toISOString();
  // Serializing per owner preserves the index when several tabs save together.
  const task = (writes.get(directory) || Promise.resolve()).catch(() => {}).then(async () => {
    await mkdir(directory, { recursive: true });
    const index = await readIndex(directory);
    const day = savedAt.slice(0, 10);
    // The filename stays unique even when older entries fall out of the 100-row index.
    const fileBase = segment(day + '-' + log.gameId);
    const target = extension => {
      const resolved = path.resolve(directory, fileBase + extension);
      if (path.dirname(resolved) !== directory) throw new Error('Invalid log path.');
      return resolved;
    };
    const entry = { gameId: log.gameId, userId: owner, savedAt, result: log.result,
      white: log.headers?.White, black: log.headers?.Black, day, fileBase,
      pgnFile: `logs/${owner}/${fileBase}.pgn`, jsonFile: `logs/${owner}/${fileBase}.json` };
    await atomicWrite(target('.json'), JSON.stringify({ ...log, savedAt }, null, 2));
    await atomicWrite(target('.pgn'), pgnWithHeaders(log));
    await atomicWrite(path.join(directory, 'index.json'), JSON.stringify([entry, ...index.filter(row => row.gameId !== log.gameId)].slice(0, 100), null, 2));
    return entry;
  });
  writes.set(directory, task);
  try { return await task; }
  finally { if (writes.get(directory) === task) writes.delete(directory); }
}

export async function readGameLogFiles(root, owner, gameId = null) {
  const directory = path.join(root, segment(owner));
  const index = await readIndex(directory);
  if (!gameId) return index;
  const entry = index.find(row => row.gameId === segment(gameId));
  if (!entry) return null;
  // Legacy date/game-number filenames remain readable.
  const fileBase = segment(entry.fileBase);
  try { return JSON.parse(await readFile(path.join(directory, fileBase + '.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
