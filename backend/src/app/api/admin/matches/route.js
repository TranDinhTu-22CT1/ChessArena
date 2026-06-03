import { Chess } from 'chess.js';
import { requireAdminCsrf, requireAdminPermission, requireAdminUser, writeAdminAudit } from '../../../../lib/admin';
import { createUserNotification } from '../../../../lib/notifications';
import { ensureModeRating, normalizeTimeControl, onlineModeFromTimeControl, randomInviteCode } from '../../../../lib/online';
import { rateLimit } from '../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../lib/validation';

export const runtime = 'nodejs';
const ADMIN_INVITE_TTL_MS = 30 * 60 * 1000;

function cleanUuid(value) {
  const id = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(id) ? id : '';
}

function cleanSide(value) {
  return ['white', 'black', 'random'].includes(value) ? value : 'random';
}

function cleanMatchType(value) {
  return value === 'quick' ? 'quick' : 'friend';
}

function cleanName(value, fallback = 'Player') {
  return String(value || fallback).trim().replace(/\s+/g, ' ').slice(0, 80) || fallback;
}

async function uniqueInviteCode(supabase) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomInviteCode();
    const { data } = await supabase.from('online_games').select('id').eq('invite_code', code).maybeSingle();
    if (!data) return code;
  }
  throw new Error('Could not create invite code.');
}

async function userById(supabase, userId) {
  if (!userId) return null;
  const { data } = await supabase
    .from('users')
    .select('id, username, display_name, firebase_uid, email')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}

function chooseColors(whiteSeed, blackSeed, side) {
  if (side === 'white') return { whiteUser: whiteSeed, blackUser: blackSeed };
  if (side === 'black') return { whiteUser: blackSeed, blackUser: whiteSeed };
  return Math.random() < 0.5
    ? { whiteUser: whiteSeed, blackUser: blackSeed }
    : { whiteUser: blackSeed, blackUser: whiteSeed };
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-matches', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'matches:view');
  if (permissionError) return permissionError;

  const { searchParams } = new URL(request.url);
  const limit = Math.max(5, Math.min(80, Number(searchParams.get('limit')) || 30));
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const status = String(searchParams.get('status') || '').trim();

  let query = context.supabase
    .from('online_games')
    .select('id, invite_code, invite_expires_at, match_type, white_user_id, black_user_id, white_name, black_name, result, status, mode, rated, time_control, white_rating_before, black_rating_before, white_rating_after, black_rating_after, created_at, started_at, finished_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (status) query = query.eq('status', status);

  const { data: games = [], count = 0, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const ids = games.map((game) => game.id);
  const { data: moves = [] } = ids.length
    ? await context.supabase
      .from('online_game_moves')
      .select('game_id, ply, san, created_at')
      .in('game_id', ids)
      .order('ply', { ascending: true })
    : { data: [] };

  return Response.json({
    ok: true,
    page,
    limit,
    total: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
    matches: games.map((game) => ({
      ...game,
      moveCount: (moves || []).filter((move) => move.game_id === game.id).length,
      lastMoves: (moves || []).filter((move) => move.game_id === game.id).slice(-8)
    }))
  });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'admin-matches-create', limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'matches:manage');
  if (permissionError) return permissionError;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;

  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });

  const primaryUserId = cleanUuid(payload.whiteUserId || payload.hostUserId);
  const opponentUserId = cleanUuid(payload.blackUserId || payload.opponentUserId);
  if (!primaryUserId) {
    return Response.json({ ok: false, error: 'Select at least one player to create a match.' }, { status: 400 });
  }
  if (opponentUserId && opponentUserId === primaryUserId) {
    return Response.json({ ok: false, error: 'White and black players must be different.' }, { status: 400 });
  }

  const timeControl = normalizeTimeControl(payload.timeControl);
  const mode = onlineModeFromTimeControl(timeControl);
  const rated = Boolean(payload.rated);
  const matchType = cleanMatchType(payload.matchType);
  const side = cleanSide(payload.side);
  const now = new Date().toISOString();
  const [primaryUser, opponentUser] = await Promise.all([
    userById(context.supabase, primaryUserId),
    userById(context.supabase, opponentUserId)
  ]);

  if (!primaryUser) return Response.json({ ok: false, error: 'Primary player not found.' }, { status: 404 });
  if (opponentUserId && !opponentUser) return Response.json({ ok: false, error: 'Opponent player not found.' }, { status: 404 });

  const { whiteUser, blackUser } = opponentUser
    ? chooseColors(primaryUser, opponentUser, side)
    : side === 'black'
      ? { whiteUser: null, blackUser: primaryUser }
      : { whiteUser: primaryUser, blackUser: null };
  const inviteCode = await uniqueInviteCode(context.supabase);
  const inviteExpiresAt = opponentUser ? null : new Date(Date.now() + ADMIN_INVITE_TTL_MS).toISOString();

  const [whiteRating, blackRating] = await Promise.all([
    whiteUser ? ensureModeRating(context.supabase, whiteUser.id, mode) : Promise.resolve(null),
    blackUser ? ensureModeRating(context.supabase, blackUser.id, mode) : Promise.resolve(null)
  ]);

  const insertPayload = {
    invite_code: inviteCode,
    invite_expires_at: inviteExpiresAt,
    status: opponentUser ? 'active' : 'waiting',
    match_type: matchType,
    white_user_id: whiteUser?.id || null,
    black_user_id: blackUser?.id || null,
    white_name: cleanName(whiteUser?.display_name),
    black_name: cleanName(blackUser?.display_name),
    fen: new Chess().fen(),
    pgn: '',
    turn: 'w',
    result: '*',
    time_control: timeControl,
    mode,
    rated,
    started_at: opponentUser ? now : null,
    last_move_at: opponentUser ? now : null,
    white_rating_before: whiteRating?.rating ?? null,
    black_rating_before: blackRating?.rating ?? null,
    created_at: now,
    updated_at: now
  };

  const { data: game, error } = await context.supabase
    .from('online_games')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  if (opponentUser) {
    await context.supabase.from('user_active_locks').upsert([
      { user_id: whiteUser.id, game_id: game.id, acquired_at: now },
      { user_id: blackUser.id, game_id: game.id, acquired_at: now }
    ], { onConflict: 'user_id' });
  }

  const recipients = [whiteUser, blackUser].filter(Boolean);
  await Promise.all(recipients.map((user) => createUserNotification(context.supabase, {
    recipientUserId: user.id,
    type: opponentUser ? 'admin_match_created' : 'admin_game_invite',
    title: opponentUser ? 'Admin đã tạo trận đấu mới' : 'Admin đã tạo lời mời thi đấu',
    body: opponentUser
      ? `Bạn có trận ${rated ? 'xếp hạng' : 'không xếp hạng'} ${timeControl}. Mở Online để vào ván.`
      : `Admin đã tạo phòng ${timeControl}. Chia sẻ mã ${inviteCode} hoặc mở link mời để người chơi khác tham gia.`,
    actionUrl: opponentUser ? `/play/online?game=${game.id}` : `/play/online?invite=${inviteCode}`,
    priority: 'high',
    metadata: { gameId: game.id, inviteCode, timeControl, mode, rated, createdByAdmin: context.admin.email }
  })).catch(() => {}));

  await writeAdminAudit(context.supabase, context.admin, 'match.create', {
    gameId: game.id,
    inviteCode,
    status: game.status,
    matchType,
    timeControl,
    mode,
    rated,
    whiteUserId: game.white_user_id,
    blackUserId: game.black_user_id
  });

  return Response.json({ ok: true, match: game });
}

export async function PATCH(request) {
  const blocked = rateLimit(request, { scope: 'admin-matches-update', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'matches:manage');
  if (permissionError) return permissionError;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;

  const payload = await readJsonPayload(request);
  const gameId = cleanUuid(payload?.gameId);
  const status = String(payload?.status || '').trim();
  if (!gameId || !['abandoned', 'draw', 'resigned'].includes(status)) {
    return Response.json({ ok: false, error: 'Invalid match update.' }, { status: 400 });
  }

  const result = status === 'draw' ? '1/2-1/2' : '*';
  const { data, error } = await context.supabase
    .from('online_games')
    .update({
      status,
      result,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', gameId)
    .select('id, status, result, white_user_id, black_user_id, white_name, black_name')
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  await writeAdminAudit(context.supabase, context.admin, 'match.update_status', {
    gameId,
    status,
    result,
    whiteUserId: data.white_user_id,
    blackUserId: data.black_user_id
  });
  return Response.json({ ok: true, match: data });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
