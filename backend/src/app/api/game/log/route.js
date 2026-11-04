import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { rateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../lib/online';
import { authCookieOptions } from '../../../../lib/cookies';
import { readJsonPayload, validateGameLogPayload } from '../../../../lib/validation';
import { saveGameLogFiles, readGameLogFiles } from '../../../../lib/gameLogStorage';

export const runtime = 'nodejs';
const guestCookie = 'chessarena_guest_logs';
const logsRoot = () => path.join(process.cwd(), 'logs');

async function ownerContext(createGuest = false) {
  const store = await cookies();
  if (store.get('firebase_id_token')?.value || store.get('admin_session_token')?.value) {
    const context = await requireOnlineUser({ allowBanned: true });
    if (context.error) return context;
    return { ...context, owner: context.user.id };
  }
  let guest = store.get(guestCookie)?.value;
  if (!/^[a-f0-9-]{36}$/.test(guest || '')) {
    if (!createGuest) return { owner: null };
    guest = randomUUID();
    store.set(guestCookie, guest, authCookieOptions(30 * 86400));
  }
  return { owner: 'guest-' + guest };
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'game-log', limit: 120, windowMs: 60_000 });
  if (blocked) return blocked;
  const log = await readJsonPayload(request);
  const invalid = validateGameLogPayload(log);
  if (invalid) return Response.json({ ok: false, error: invalid }, { status: 400 });
  const context = await ownerContext(true);
  if (context.error) return context.error;
  const { supabase, user, owner } = context;
  const safeLog = { ...log, userId: owner, displayName: user?.displayName || 'Guest' };
  let database = { enabled: Boolean(supabase), synced: false };
  if (supabase) {
    const { data, error } = await supabase.rpc('save_local_game_log', { p_user: user.id, p_log: safeLog })
      .abortSignal(globalThis.AbortSignal.timeout(12_000));
    if (error?.code === '42501') return Response.json({ ok: false, error: 'Game belongs to another account.' }, { status: 403 });
    if (error && ['22023', '22P02', '23502', '23514'].includes(error.code)) {
      return Response.json({ ok: false, error: 'Invalid game log.' }, { status: 400 });
    }
    database = { ...database, synced: !error, gameDatabaseId: data || null, code: error?.code || null };
  }
  let files = [];
  try {
    const entry = await saveGameLogFiles(logsRoot(), owner, safeLog);
    files = [entry.jsonFile, entry.pgnFile];
  } catch (error) {
    console.warn('Game log file save failed.', { code: error.code || 'file_error' });
    if (!database.synced) return Response.json({ ok: false, error: 'Kh?ng l?u ???c v?n ??u. H?y th? l?i.' }, { status: 503 });
  }
  return Response.json({ ok: true, degraded: Boolean(supabase && !database.synced),
    userId: owner, gameId: log.gameId, supabase: database, files });
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'game-log-read', limit: 120, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await ownerContext();
  if (context.error) return context.error;
  const gameId = new URL(request.url).searchParams.get('gameId');
  if (gameId && !/^[a-zA-Z0-9_-]{1,80}$/.test(gameId)) return Response.json({ ok: false, error: 'Invalid game id.' }, { status: 400 });
  const { supabase, user, owner } = context;
  if (!owner) return Response.json({ ok: true, games: [], ...(gameId ? { log: null } : {}) });
  if (supabase) {
    const query = supabase.from('games').select(gameId ? '*, game_moves(*)' : 'client_game_id, result, saved_at, headers')
      .eq('user_id', user.id);
    const { data, error } = await (gameId ? query.eq('client_game_id', gameId).maybeSingle() : query.order('saved_at', { ascending: false }).limit(100))
      .abortSignal(globalThis.AbortSignal.timeout(12_000));
    if (!error && (!gameId || data)) {
      if (data?.game_moves) data.game_moves.sort((a, b) => a.ply - b.ply);
      return Response.json({ ok: true, userId: owner, ...(gameId ? { log: data } : { games: data }) });
    }
  }
  try {
    const data = await readGameLogFiles(logsRoot(), owner, gameId);
    return Response.json({ ok: true, userId: owner, ...(gameId ? { log: data } : { games: data }) });
  } catch {
    return Response.json({ ok: false, error: 'Kh?ng ??c ???c l?ch s? v?n ??u.' }, { status: 503 });
  }
}

export function OPTIONS() { return new Response(null, { status: 204 }); }
