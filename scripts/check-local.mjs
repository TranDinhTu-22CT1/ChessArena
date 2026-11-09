const endpoint = process.argv[2] || 'http://localhost:5173';
try {
  const response = await fetch(new URL('/api/health', endpoint), { signal: AbortSignal.timeout(15_000) });
  const status = await response.json();
  if (!response.ok || !status.ready) throw new Error(status.message || 'Backend is not ready.');
  console.log(`Connected: ${endpoint} -> shared backend. Matchmaking version ${status.matchmakingVersion}.`);
} catch (error) {
  console.error(`Connection check failed: ${error.message}\nCheck host process, Tailscale connectivity, firewall and frontend proxy target.`);
  process.exitCode = 1;
}
