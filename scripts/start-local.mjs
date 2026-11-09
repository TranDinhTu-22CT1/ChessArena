import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const role = process.argv.includes('--client') ? 'client' : 'host';
const production = process.argv.includes('--production');
const backendArg = process.argv.find((arg) => arg.startsWith('--backend='));
const backendUrl = backendArg?.slice('--backend='.length) || 'http://127.0.0.1:3000';
const parsed = new URL(backendUrl);
if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Backend URL must be an HTTP(S) origin without credentials.');
if (role === 'client' && !backendArg) throw new Error('Use --client --backend=http://<host Tailscale IP>:3000');
for (const directory of role === 'host' ? ['backend', 'Frontend'] : ['Frontend']) {
  if (!existsSync(resolve(root, directory, '.env'))) throw new Error(`Create ${directory}/.env from .env.example and configure your existing project credentials first.`);
  if (!existsSync(resolve(root, directory, 'node_modules'))) throw new Error(`Run npm ci in ${directory} first.`);
}

const children = [];
let closing = false;
function start(directory, args, env = {}) {
  const child = spawn(process.execPath, args, {
    cwd: resolve(root, directory), env: { ...process.env, ...env }, windowsHide: true, stdio: 'inherit'
  });
  children.push(child);
  child.on('error', (error) => { console.error(error.message); stop(1); });
  child.on('exit', (code) => { if (!closing) stop(code || 0); });
}
function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
if (role === 'host') {
  // Trust only this host's actual interface addresses for the local Vite UI.
  // Remote client UIs on other hosts must be explicitly listed in FRONTEND_URLS.
  const localOrigins = Object.values(networkInterfaces()).flat().filter(item=>item.family==='IPv4')
    .map(item=>`http://${item.address}:5173`);
  start('backend', ['node_modules/next/dist/bin/next', ...(production ? ['start'] : ['dev', '--webpack']), '--hostname', '0.0.0.0', '--port', '3000'], { MATCHMAKING_REGION: 'global', COOKIE_SECURE: 'false', FRONTEND_URL: 'http://localhost:5173',
    LOCAL_FRONTEND_ORIGINS:localOrigins.join(',') });
  start('backend', ['--env-file=.env', 'scripts/matchmaking-worker.mjs']);
  start('backend', ['--env-file=.env', 'scripts/membership-worker.mjs']);
}
start('Frontend', ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '5173'], {
  VITE_API_URL: '', VITE_PROXY_API_URL: role === 'host' ? 'http://127.0.0.1:3000' : parsed.origin
});
console.log(`ChessArena ${role}: open http://localhost:5173. Both players must use the same host backend.`);
