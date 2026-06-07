import { cookies } from 'next/headers';
import { Chess } from 'chess.js';
import { verifyFirebaseSession } from './firebaseAdmin';
import { getSupabaseAdmin } from './supabaseAdmin';
import { activeBanForUser, ensureAdminAppUser, requireAdminUser } from './admin';
import { sanitizePieceSet } from './validation';

const ONLINE_WINDOW_MS = 45_000;
const QUEUE_STALE_MS = 30_000;
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const OPENING_MOVE_DEADLINE_MS = 20_000;
export const DEFAULT_ONLINE_RATING = 400;

function safeUsername(value) {
  return String(value || 'user')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'user';
}

function cleanName(value, fallback = 'Player') {
  const name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  return name && !name.includes('@') ? name : fallback;
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

export async function relatedOnlineUserIds(supabase, user) {
  const ids = [user.id];
  const lookups = [
    user.firebaseUid ? ['firebase_uid', user.firebaseUid] : null,
    user.email ? ['email', user.email] : null,
    user.username ? ['username', user.username] : null
  ].filter(Boolean);

  if (lookups.length === 0) return ids;

  const results = await Promise.all(lookups.map(([column, value]) => (
    supabase
      .from('users')
      .select('id')
      .eq(column, value)
  )));

  return uniqueValues([
    ...ids,
    ...results.flatMap((result) => (result.data || []).map((item) => item.id))
  ]);
}

export function gameParticipantUserId(game, userIds, fallbackId = null) {
  return userIds.find((userId) => game.white_user_id === userId || game.black_user_id === userId) || fallbackId;
}

export function randomInviteCode(length = 6) {
  let code = '';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (const byte of bytes) code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
  return code;
}

export function staleIso(ms) {
  return new Date(Date.now() - ms).toISOString();
}

export function onlineSinceIso() {
  return staleIso(ONLINE_WINDOW_MS);
}

export function queueStaleIso() {
  return staleIso(QUEUE_STALE_MS);
}

export function normalizeTimeControl(value) {
  return ['180+0', '300+0', '600+0', '900+10'].includes(value) ? value : '600+0';
}

export function onlineModeFromTimeControl(value) {
  const [base = '600'] = String(value || '600+0').split('+');
  const seconds = Number(base) || 600;
  if (seconds < 180) return 'bullet';
  if (seconds < 600) return 'blitz';
  if (seconds < 3600) return 'rapid';
  return 'classical';
}

export function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      error: Response.json({ ok: false, error: 'Online play requires Supabase service role configuration.' }, { status: 503 })
    };
  }
  return { supabase };
}

export async function requireOnlineUser(options = {}) {
  const { supabase, error } = requireSupabase();
  if (error) return { error };

  const cookieStore = await cookies();
  const token = cookieStore.get('firebase_id_token')?.value;
  if (!token) {
    const adminContext = await requireAdminUser();
    if (!adminContext.error) {
      try {
        return {
          supabase,
          user: await ensureAdminAppUser(supabase, adminContext.admin)
        };
      } catch (error) {
        return { error: Response.json({ ok: false, error: error.message || 'Could not create admin user context.' }, { status: 500 }) };
      }
    }

    return { error: Response.json({ ok: false, error: 'Sign in is required for online play.' }, { status: 401 }) };
  }

  let decoded;
  try {
    decoded = await verifyFirebaseSession(token);
  } catch {
    return { error: Response.json({ ok: false, error: 'Invalid or expired session.' }, { status: 401 }) };
  }

  const username = safeUsername(decoded.email || decoded.uid);
  const { data: storedUser } = await supabase
    .from('users')
    .select('id, username, display_name, firebase_uid, photo_url, email')
    .eq('firebase_uid', decoded.uid)
    .maybeSingle();

  if (storedUser) {
    const activeBan = await activeBanForUser(supabase, storedUser.id);
    const userPayload = {
      id: storedUser.id,
      username: storedUser.username,
      displayName: cleanName(storedUser.display_name, username),
      firebaseUid: storedUser.firebase_uid,
      email: storedUser.email,
      photoURL: storedUser.photo_url
    };
    if (activeBan && options.allowBanned) {
      return {
        supabase,
        user: userPayload,
        activeBan
      };
    }
    if (activeBan) {
      return { error: Response.json({ ok: false, error: activeBan.reason || 'This account is banned.' }, { status: 403 }) };
    }
    return {
      supabase,
      user: userPayload
    };
  }

  const displayName = cleanName(decoded.name, username);
  const { data: user, error: upsertError } = await supabase
    .from('users')
    .upsert(
      {
        username,
        display_name: displayName,
        firebase_uid: decoded.uid,
        email: decoded.email ?? null,
        photo_url: decoded.picture ?? null,
        email_verified: Boolean(decoded.email_verified),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'firebase_uid' }
    )
    .select('id, username, display_name, firebase_uid, photo_url')
    .single();

  if (upsertError) {
    return { error: Response.json({ ok: false, error: upsertError.message }, { status: 500 }) };
  }

  return {
    supabase,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      firebaseUid: user.firebase_uid,
      photoURL: user.photo_url
    }
  };
}

export async function touchPresence(supabase, user, patch = {}) {
  await supabase
    .from('online_presence')
    .upsert(
      {
        user_id: user.id,
        firebase_uid: user.firebaseUid,
        display_name: user.displayName,
        status: patch.status ?? 'online',
        current_game_id: patch.currentGameId ?? null,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    );
}

export async function activeOnlineGameForUser(supabase, userId) {
  const { data } = await supabase
    .from('online_games')
    .select('*')
    .in('status', ['waiting', 'active'])
    .or(`white_user_id.eq.${userId},black_user_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}

export async function ensureOnlineRating(supabase, userId) {
  const fallback = {
    user_id: userId,
    rating: DEFAULT_ONLINE_RATING,
    games_played: 0,
    wins: 0,
    losses: 0,
    draws: 0
  };

  const { data } = await supabase
    .from('online_ratings')
    .select('user_id, rating, games_played, wins, losses, draws')
    .eq('user_id', userId)
    .maybeSingle();

  if (data) return data;

  const { data: created, error } = await supabase
    .from('online_ratings')
    .insert(fallback)
    .select('user_id, rating, games_played, wins, losses, draws')
    .single();

  if (error) return fallback;
  return created;
}

export async function ensureModeRating(supabase, userId, mode) {
  const normalizedMode = ['bullet', 'blitz', 'rapid', 'classical'].includes(mode) ? mode : 'rapid';
  const { data } = await supabase
    .from('user_ratings')
    .select('user_id, mode, rating, games_played, wins, losses, draws, provisional')
    .eq('user_id', userId)
    .eq('mode', normalizedMode)
    .maybeSingle();
  if (data) return data;

  const legacy = await ensureOnlineRating(supabase, userId);
  const { data: created, error } = await supabase
    .from('user_ratings')
    .insert({
      user_id: userId,
      mode: normalizedMode,
      rating: legacy.rating ?? DEFAULT_ONLINE_RATING,
      games_played: legacy.games_played ?? 0,
      wins: legacy.wins ?? 0,
      losses: legacy.losses ?? 0,
      draws: legacy.draws ?? 0,
      provisional: (legacy.games_played ?? 0) < 20
    })
    .select('user_id, mode, rating, games_played, wins, losses, draws, provisional')
    .single();
  return error ? { ...legacy, mode: normalizedMode, provisional: true } : created;
}

function ratingKFactor(player) {
  if ((player.games_played ?? 0) < 30) return 40;
  if ((player.rating ?? DEFAULT_ONLINE_RATING) < 1200) return 32;
  if ((player.rating ?? DEFAULT_ONLINE_RATING) < 2000) return 24;
  return 16;
}

function ratingDelta(player, opponent, score) {
  const rating = player.rating ?? DEFAULT_ONLINE_RATING;
  const opponentRating = opponent.rating ?? DEFAULT_ONLINE_RATING;
  const expected = 1 / (1 + (10 ** ((opponentRating - rating) / 400)));
  return Math.round(ratingKFactor(player) * (score - expected));
}

function scoreForResult(result, color) {
  if (result === '1/2-1/2') return 0.5;
  if (result === '1-0') return color === 'w' ? 1 : 0;
  if (result === '0-1') return color === 'b' ? 1 : 0;
  return null;
}

export async function applyOnlineRatingResult(supabase, game, result) {
  if (game.rated === false || !['1-0', '0-1', '1/2-1/2'].includes(result) || !game.white_user_id || !game.black_user_id) {
    return null;
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc('finalize_online_rating_result', {
    p_game_id: game.id,
    p_result: result
  });
  if (!rpcError) {
    if (rpcResult?.status === 'finalized') {
      await supabase.from('activity_feed').insert([
        {
          actor_user_id: game.white_user_id,
          type: result === '1-0' ? 'won_game' : result === '1/2-1/2' ? 'drew_game' : 'played_game',
          subject_id: game.id,
          metadata: { result, mode: game.mode || 'rapid', opponentUserId: game.black_user_id }
        },
        {
          actor_user_id: game.black_user_id,
          type: result === '0-1' ? 'won_game' : result === '1/2-1/2' ? 'drew_game' : 'played_game',
          subject_id: game.id,
          metadata: { result, mode: game.mode || 'rapid', opponentUserId: game.white_user_id }
        }
      ]);
    }
    return rpcResult;
  }

  const { error: eventError } = await supabase
    .from('online_rating_events')
    .insert({
      game_id: game.id,
      white_user_id: game.white_user_id,
      black_user_id: game.black_user_id,
      result
    });

  if (eventError) return null;

  const mode = game.mode || onlineModeFromTimeControl(game.time_control);
  const [whiteRating, blackRating] = await Promise.all([
    ensureModeRating(supabase, game.white_user_id, mode),
    ensureModeRating(supabase, game.black_user_id, mode)
  ]);
  const whiteScore = scoreForResult(result, 'w');
  const blackScore = scoreForResult(result, 'b');
  const whiteDelta = ratingDelta(whiteRating, blackRating, whiteScore);
  const blackDelta = ratingDelta(blackRating, whiteRating, blackScore);
  const now = new Date().toISOString();

  const whitePatch = {
    rating: Math.max(100, (whiteRating.rating ?? DEFAULT_ONLINE_RATING) + whiteDelta),
    games_played: (whiteRating.games_played ?? 0) + 1,
    wins: (whiteRating.wins ?? 0) + (whiteScore === 1 ? 1 : 0),
    losses: (whiteRating.losses ?? 0) + (whiteScore === 0 ? 1 : 0),
    draws: (whiteRating.draws ?? 0) + (whiteScore === 0.5 ? 1 : 0),
    provisional: (whiteRating.games_played ?? 0) + 1 < 20,
    updated_at: now
  };
  const blackPatch = {
    rating: Math.max(100, (blackRating.rating ?? DEFAULT_ONLINE_RATING) + blackDelta),
    games_played: (blackRating.games_played ?? 0) + 1,
    wins: (blackRating.wins ?? 0) + (blackScore === 1 ? 1 : 0),
    losses: (blackRating.losses ?? 0) + (blackScore === 0 ? 1 : 0),
    draws: (blackRating.draws ?? 0) + (blackScore === 0.5 ? 1 : 0),
    provisional: (blackRating.games_played ?? 0) + 1 < 20,
    updated_at: now
  };

  await Promise.all([
    supabase.from('user_ratings').update(whitePatch).eq('user_id', game.white_user_id).eq('mode', mode),
    supabase.from('user_ratings').update(blackPatch).eq('user_id', game.black_user_id).eq('mode', mode),
    supabase.from('online_games').update({
      white_rating_before: game.white_rating_before ?? whiteRating.rating,
      black_rating_before: game.black_rating_before ?? blackRating.rating,
      white_rating_after: whitePatch.rating,
      black_rating_after: blackPatch.rating
    }).eq('id', game.id)
  ]);

  return {
    white: { before: whiteRating.rating, after: whitePatch.rating, delta: whiteDelta },
    black: { before: blackRating.rating, after: blackPatch.rating, delta: blackDelta }
  };
}

export async function decorateGameRatings(supabase, game) {
  const ids = [game.white_user_id, game.black_user_id].filter(Boolean);
  if (ids.length === 0) return game;

  const mode = game.mode || onlineModeFromTimeControl(game.time_control);
  const [{ data: modeRatings = [] }, { data: players = [] }, { data: preferences = [] }, { data: memberships = [] }] = await Promise.all([
    supabase
      .from('user_ratings')
      .select('user_id, rating, games_played')
      .eq('mode', mode)
      .in('user_id', ids),
    supabase
      .from('users')
      .select('id, photo_url')
      .in('id', ids),
    supabase
      .from('user_preferences')
      .select('user_id, theme')
      .in('user_id', ids),
    supabase
      .from('user_memberships')
      .select('user_id, tier, status')
      .in('user_id', ids)
  ]);
  let data = modeRatings || [];
  if (data.length === 0) {
    const { data: legacyRatings = [] } = await supabase
      .from('online_ratings')
      .select('user_id, rating, games_played')
      .in('user_id', ids);
    data = legacyRatings;
  }

  const byUser = new Map((data || []).map((rating) => [rating.user_id, rating]));
  const photoByUser = new Map((players || []).map((player) => [player.id, player.photo_url]));
  const pieceSetByUser = new Map((preferences || []).map((preference) => [
    preference.user_id,
    sanitizePieceSet(preference.theme?.pieceSet)
  ]));
  const membershipByUser = new Map((memberships || []).map((membership) => [
    membership.user_id,
    membership.status === 'active' ? membership.tier : 'free'
  ]));
  return {
    ...game,
    white_rating: byUser.get(game.white_user_id)?.rating ?? DEFAULT_ONLINE_RATING,
    black_rating: byUser.get(game.black_user_id)?.rating ?? DEFAULT_ONLINE_RATING,
    white_photo_url: photoByUser.get(game.white_user_id) ?? null,
    black_photo_url: photoByUser.get(game.black_user_id) ?? null,
    white_piece_set: pieceSetByUser.get(game.white_user_id) ?? 'classic',
    black_piece_set: pieceSetByUser.get(game.black_user_id) ?? 'classic',
    white_membership_tier: membershipByUser.get(game.white_user_id) ?? 'free',
    black_membership_tier: membershipByUser.get(game.black_user_id) ?? 'free'
  };
}

function tournamentPoints(result, color) {
  const score = scoreForResult(result, color);
  if (score === 1) return 2;
  if (score === 0.5) return 1;
  return 0;
}

export async function applyTournamentResult(supabase, game, result) {
  if (!['1-0', '0-1', '1/2-1/2'].includes(result) || !game?.white_user_id || !game?.black_user_id) {
    return null;
  }

  const finishedAt = game.finished_at || new Date().toISOString();
  const { data: tournaments = [], error: tournamentError } = await supabase
    .from('arena_tournaments')
    .select('id, title, status, time_control, starts_at, ends_at')
    .in('status', ['open', 'running'])
    .eq('time_control', game.time_control)
    .lte('starts_at', finishedAt)
    .gte('ends_at', finishedAt);
  if (tournamentError || tournaments.length === 0) return null;

  const updates = [];
  for (const tournament of tournaments) {
    const { data: players = [] } = await supabase
      .from('arena_tournament_players')
      .select('user_id')
      .eq('tournament_id', tournament.id)
      .in('user_id', [game.white_user_id, game.black_user_id]);
    if ((players || []).length !== 2) continue;

    const whitePoints = tournamentPoints(result, 'w');
    const blackPoints = tournamentPoints(result, 'b');
    const { data: existingTournamentGame } = await supabase
      .from('arena_tournament_games')
      .select('result')
      .eq('tournament_id', tournament.id)
      .eq('game_id', game.id)
      .maybeSingle();
    if (existingTournamentGame && ['1-0', '0-1', '1/2-1/2'].includes(existingTournamentGame.result)) continue;
    const { error: eventError } = await supabase.from('arena_tournament_games').upsert({
      tournament_id: tournament.id,
      game_id: game.id,
      white_user_id: game.white_user_id,
      black_user_id: game.black_user_id,
      result,
      score_white: whitePoints,
      score_black: blackPoints
    }, { onConflict: 'tournament_id,game_id' });
    if (eventError) continue;
    await supabase
      .from('tournament_pairings')
      .update({ status: 'finished', updated_at: new Date().toISOString() })
      .eq('tournament_id', tournament.id)
      .eq('game_id', game.id);

    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from('arena_tournament_players')
        .update({ updated_at: now })
        .eq('tournament_id', tournament.id)
        .eq('user_id', game.white_user_id),
      supabase
        .from('arena_tournament_players')
        .update({ updated_at: now })
        .eq('tournament_id', tournament.id)
        .eq('user_id', game.black_user_id)
    ]);

    const { data: whiteRow } = await supabase
      .from('arena_tournament_players')
      .select('score, games_played, wins, draws, losses')
      .eq('tournament_id', tournament.id)
      .eq('user_id', game.white_user_id)
      .single();
    const { data: blackRow } = await supabase
      .from('arena_tournament_players')
      .select('score, games_played, wins, draws, losses')
      .eq('tournament_id', tournament.id)
      .eq('user_id', game.black_user_id)
      .single();

    await Promise.all([
      supabase
        .from('arena_tournament_players')
        .update({
          score: Number(whiteRow?.score || 0) + whitePoints,
          games_played: Number(whiteRow?.games_played || 0) + 1,
          wins: Number(whiteRow?.wins || 0) + (whitePoints === 2 ? 1 : 0),
          draws: Number(whiteRow?.draws || 0) + (whitePoints === 1 ? 1 : 0),
          losses: Number(whiteRow?.losses || 0) + (whitePoints === 0 ? 1 : 0),
          updated_at: now
        })
        .eq('tournament_id', tournament.id)
        .eq('user_id', game.white_user_id),
      supabase
        .from('arena_tournament_players')
        .update({
          score: Number(blackRow?.score || 0) + blackPoints,
          games_played: Number(blackRow?.games_played || 0) + 1,
          wins: Number(blackRow?.wins || 0) + (blackPoints === 2 ? 1 : 0),
          draws: Number(blackRow?.draws || 0) + (blackPoints === 1 ? 1 : 0),
          losses: Number(blackRow?.losses || 0) + (blackPoints === 0 ? 1 : 0),
          updated_at: now
        })
        .eq('tournament_id', tournament.id)
        .eq('user_id', game.black_user_id)
    ]);

    updates.push({ tournamentId: tournament.id, whitePoints, blackPoints });
  }

  return updates.length ? updates : null;
}

let onlineSummaryCache = {
  expiresAt: 0,
  value: null,
  pending: null
};

export async function onlineSummary(supabase) {
  const now = Date.now();
  if (onlineSummaryCache.value && onlineSummaryCache.expiresAt > now) {
    return onlineSummaryCache.value;
  }
  if (onlineSummaryCache.pending) return onlineSummaryCache.pending;

  onlineSummaryCache.pending = Promise.all([
    supabase
      .from('online_presence')
      .select('user_id', { count: 'exact', head: true })
      .gte('last_seen', onlineSinceIso()),
    supabase
      .from('online_presence')
      .select('user_id', { count: 'exact', head: true })
      .eq('status', 'queue')
      .gte('last_seen', queueStaleIso())
  ]).then(([{ count: onlineCount }, { count: queueCount }]) => {
    const value = {
      onlineCount: onlineCount ?? 0,
      queueCount: queueCount ?? 0
    };
    onlineSummaryCache = {
      expiresAt: Date.now() + 5000,
      value,
      pending: null
    };
    return value;
  }).catch((error) => {
    onlineSummaryCache.pending = null;
    throw error;
  });

  return onlineSummaryCache.pending;
}

export function chessFromMoves(moves) {
  const chess = new Chess();
  for (const move of moves) {
    chess.move({
      from: move.from_square,
      to: move.to_square,
      promotion: move.promotion || undefined
    });
  }
  return chess;
}

export function gameResult(chess) {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? '0-1' : '1-0';
  if (chess.isDraw()) return '1/2-1/2';
  return '*';
}

export function gameStatus(chess) {
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isDraw()) return 'draw';
  return 'active';
}

export function onlineClockMilliseconds(game, moves, now = Date.now()) {
  const [base = '600', increment = '0'] = String(game?.time_control || game?.timeControl || '600+0').split('+');
  const baseMs = Math.max(0, Number(base) || 600) * 1000;
  const incrementMs = Math.max(0, Number(increment) || 0) * 1000;
  const clocks = { w: baseMs, b: baseMs };
  let previousAt = Date.parse(game?.started_at || game?.startedAt || game?.last_move_at || game?.lastMoveAt || game?.created_at || game?.createdAt || '');

  for (const move of moves || []) {
    const moveAt = Date.parse(move.created_at || move.createdAt || '');
    if (Number.isFinite(previousAt) && Number.isFinite(moveAt)) {
      clocks[move.color] = Math.max(0, clocks[move.color] - Math.max(0, moveAt - previousAt));
    }
    clocks[move.color] += incrementMs;
    if (Number.isFinite(moveAt)) previousAt = moveAt;
  }

  const turn = game?.turn;
  const endAt = game?.status === 'active'
    ? now
    : Date.parse(game?.finished_at || game?.finishedAt || '');
  if (turn && Number.isFinite(previousAt) && Number.isFinite(endAt)) {
    clocks[turn] = Math.max(0, clocks[turn] - Math.max(0, endAt - previousAt));
  }
  return clocks;
}

export function openingMoveDeadline(game, moves) {
  if (!game || game.status !== 'active') return null;
  const pendingColor = moves.length === 0
    ? 'w'
    : moves.length === 1 && moves[0].color === 'w'
      ? 'b'
      : null;
  if (!pendingColor) return null;

  const startedAt = pendingColor === 'w'
    ? game.started_at || game.startedAt || game.last_move_at || game.lastMoveAt || game.created_at || game.createdAt
    : moves[0].created_at || moves[0].createdAt;
  const startedMs = Date.parse(startedAt || '');
  if (!Number.isFinite(startedMs)) return null;

  return {
    color: pendingColor,
    expiresAt: new Date(startedMs + OPENING_MOVE_DEADLINE_MS).toISOString()
  };
}

export async function abortOnlineGameIfOpeningIdle(supabase, game, moves) {
  const deadline = openingMoveDeadline(game, moves);
  if (!deadline || Date.parse(deadline.expiresAt) > Date.now()) {
    return { game, aborted: false };
  }

  const now = new Date().toISOString();
  const { data: updatedGame, error } = await supabase
    .from('online_games')
    .update({ status: 'abandoned', result: '*', finished_at: now, updated_at: now })
    .eq('id', game.id)
    .eq('status', 'active')
    .select('*')
    .maybeSingle();

  if (error || !updatedGame) return { game, aborted: false };
  return { game: updatedGame, aborted: true };
}

export async function expireOnlineGameOnClock(supabase, game, moves) {
  if (!game || game.status !== 'active') return { game, timedOut: false };
  const clocks = onlineClockMilliseconds(game, moves);
  const expiredColor = game.turn && clocks[game.turn] <= 0 ? game.turn : null;
  if (!expiredColor) return { game, timedOut: false };

  const result = expiredColor === 'w' ? '0-1' : '1-0';
  const now = new Date().toISOString();
  const { data: updatedGame, error } = await supabase
    .from('online_games')
    .update({ status: 'resigned', result, finished_at: now, updated_at: now })
    .eq('id', game.id)
    .eq('status', 'active')
    .select('*')
    .maybeSingle();

  if (error || !updatedGame) return { game, timedOut: false };
  await applyOnlineRatingResult(supabase, updatedGame, result);
  await applyTournamentResult(supabase, updatedGame, result);
  return { game: updatedGame, timedOut: true };
}

export function publicGame(game, moves, userId) {
  const playerColor = game.white_user_id === userId ? 'w' : game.black_user_id === userId ? 'b' : null;
  const whiteName = cleanName(game.white_name, 'Player');
  const blackName = cleanName(game.black_name, 'Player');
  const playedPosition = moves.length > 0 ? chessFromMoves(moves) : null;
  const rematchRequesterName = game.rematch_requested_by === game.white_user_id
    ? whiteName
    : game.rematch_requested_by === game.black_user_id
      ? blackName
      : null;
  const clocks = onlineClockMilliseconds(game, moves);
  const endedByTimeout = game.status === 'resigned' && clocks[game.turn] <= 0;
  const openingDeadline = openingMoveDeadline(game, moves);
  const whiteRatingBefore = game.white_rating_before ?? game.white_rating ?? DEFAULT_ONLINE_RATING;
  const blackRatingBefore = game.black_rating_before ?? game.black_rating ?? DEFAULT_ONLINE_RATING;
  const whiteRatingAfter = game.white_rating_after ?? null;
  const blackRatingAfter = game.black_rating_after ?? null;
  const whiteRatingDelta = Number.isFinite(whiteRatingAfter) ? whiteRatingAfter - whiteRatingBefore : null;
  const blackRatingDelta = Number.isFinite(blackRatingAfter) ? blackRatingAfter - blackRatingBefore : null;
  const whiteDisplayRating = whiteRatingAfter ?? whiteRatingBefore;
  const blackDisplayRating = blackRatingAfter ?? blackRatingBefore;
  return {
    id: game.id,
    inviteCode: game.invite_code,
    inviteExpiresAt: game.invite_expires_at || null,
    status: game.status,
    matchType: game.match_type,
    mode: game.mode || onlineModeFromTimeControl(game.time_control),
    rated: game.rated !== false,
    fen: playedPosition?.fen() ?? (game.fen === 'start' ? new Chess().fen() : game.fen),
    pgn: playedPosition?.pgn() ?? game.pgn,
    turn: playedPosition?.turn() ?? game.turn,
    result: game.result,
    drawOffer: game.draw_offered_by ? {
      userId: game.draw_offered_by,
      offeredAt: game.draw_offered_at,
      byYou: game.draw_offered_by === userId
    } : null,
    spectatorAllowed: game.spectator_allowed !== false,
    spectator: playerColor === null,
    disconnectGraceSeconds: game.disconnect_grace_seconds ?? 45,
    whiteDisconnectedAt: game.white_disconnected_at || null,
    blackDisconnectedAt: game.black_disconnected_at || null,
    timeControl: game.time_control,
    lastMoveAt: game.last_move_at,
    startedAt: game.started_at,
    finishedAt: game.finished_at,
    endReason: game.status === 'abandoned' ? 'aborted' : endedByTimeout ? 'timeout' : game.status === 'resigned' ? 'resignation' : null,
    openingDeadline,
    clocks,
    createdAt: game.created_at,
    playerColor,
    white: {
      id: game.white_user_id,
      name: whiteName,
      rating: whiteDisplayRating,
      ratingBefore: whiteRatingBefore,
      ratingAfter: whiteRatingAfter,
      ratingDelta: whiteRatingDelta,
      photoURL: game.white_photo_url ?? null,
      pieceSet: sanitizePieceSet(game.white_piece_set),
      membershipTier: game.white_membership_tier ?? 'free',
      you: game.white_user_id === userId
    },
    black: {
      id: game.black_user_id,
      name: blackName,
      rating: blackDisplayRating,
      ratingBefore: blackRatingBefore,
      ratingAfter: blackRatingAfter,
      ratingDelta: blackRatingDelta,
      photoURL: game.black_photo_url ?? null,
      pieceSet: sanitizePieceSet(game.black_piece_set),
      membershipTier: game.black_membership_tier ?? 'free',
      you: game.black_user_id === userId
    },
    rematch: game.rematch_requested_by ? {
      requestedBy: game.rematch_requested_by,
      requestedByYou: game.rematch_requested_by === userId,
      requestedByName: rematchRequesterName,
      requestedAt: game.rematch_requested_at,
      expiresAt: game.rematch_requested_at
        ? new Date(new Date(game.rematch_requested_at).getTime() + 15_000).toISOString()
        : null,
      response: game.rematch_response,
      gameId: game.rematch_game_id
    } : null,
    moves: moves.map((move) => ({
      ply: move.ply,
      color: move.color,
      san: move.san,
      lan: move.lan,
      from: move.from_square,
      to: move.to_square,
      promotion: move.promotion,
      fenAfter: move.fen_after,
      createdAt: move.created_at
    })),
    updatedAt: game.updated_at
  };
}
