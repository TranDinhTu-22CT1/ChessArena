import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { rateLimit } from '../../../../lib/rateLimit';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { validateGameLogPayload } from '../../../../lib/validation';

export const runtime = 'nodejs';

function safeGameId(gameId) {
  return String(gameId || 'local')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80) || 'local';
}

function safeUserId(userId) {
  return String(userId || 'guest')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'guest';
}

function pgnWithHeaders(log) {
  const headers = log.headers ?? {};
  const headerText = Object.entries(headers)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `[${key} "${String(value).replaceAll('"', '\\"')}"]`)
    .join('\n');

  return `${headerText}\n\n${log.pgn ?? ''}\n`;
}

function dateStamp(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function gameSlug(gameNumber) {
  return `game-${String(gameNumber).padStart(3, '0')}`;
}

async function saveLogToFiles(log, userId, gameId) {
  const logsDir = path.join(process.cwd(), 'logs', userId);
  const indexPath = path.join(logsDir, 'index.json');

  await mkdir(logsDir, { recursive: true });

  let index = [];
  try {
    index = JSON.parse(await readFile(indexPath, 'utf8'));
  } catch {
    index = [];
  }

  const entry = {
    gameId,
    userId,
    savedAt: log.savedAt,
    result: log.result,
    white: log.headers?.White,
    black: log.headers?.Black,
    fileBase: null,
    pgnFile: null,
    jsonFile: null
  };

  const existingEntry = index.find((item) => item.gameId === gameId);
  const day = dateStamp(log.savedAt);
  const gamesToday = index.filter((item) => item.day === day);
  const nextGameNumber = existingEntry?.gameNumber ?? gamesToday.length + 1;
  const fileBase = existingEntry?.fileBase ?? `${day}-${gameSlug(nextGameNumber)}`;
  const finalEntry = {
    ...entry,
    day,
    gameNumber: nextGameNumber,
    fileBase,
    pgnFile: `logs/${userId}/${fileBase}.pgn`,
    jsonFile: `logs/${userId}/${fileBase}.json`
  };

  index = [finalEntry, ...index.filter((item) => item.gameId !== gameId)].slice(0, 100);

  await Promise.all([
    writeFile(path.join(logsDir, `${fileBase}.json`), JSON.stringify(log, null, 2), 'utf8'),
    writeFile(path.join(logsDir, `${fileBase}.pgn`), pgnWithHeaders(log), 'utf8'),
    writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8')
  ]);

  return finalEntry;
}

async function saveLogToSupabase(log, userId, gameId) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return { enabled: false };
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .upsert(
      {
        username: userId,
        display_name: log.displayName || userId,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'username' }
    )
    .select('id')
    .single();

  if (userError) throw userError;

  const { data: game, error: gameError } = await supabase
    .from('games')
    .upsert(
      {
        client_game_id: gameId,
        user_id: user.id,
        player_color: log.playerColor === 'b' ? 'b' : 'w',
        ai_elo: Number(log.aiElo ?? 1200),
        result: log.result ?? '*',
        fen: log.fen,
        pgn: log.pgn ?? '',
        headers: log.headers ?? {},
        saved_at: log.savedAt,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'client_game_id' }
    )
    .select('id')
    .single();

  if (gameError) throw gameError;

  const { error: deleteMovesError } = await supabase
    .from('game_moves')
    .delete()
    .eq('game_id', game.id);

  if (deleteMovesError) throw deleteMovesError;

  const moves = (log.moves ?? []).map((move) => ({
    game_id: game.id,
    ply: move.ply,
    move_number: move.moveNumber,
    color: move.color,
    san: move.san,
    lan: move.lan,
    from_square: move.from,
    to_square: move.to,
    piece: move.piece,
    captured: move.captured,
    promotion: move.promotion,
    flags: move.flags
  }));

  if (moves.length > 0) {
    const { error: movesError } = await supabase.from('game_moves').insert(moves);
    if (movesError) throw movesError;
  }

  return { enabled: true, userDatabaseId: user.id, gameDatabaseId: game.id };
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'game-log', limit: 120, windowMs: 60_000 });
  if (blocked) return blocked;

  const log = await request.json();
  const validationError = validateGameLogPayload(log);

  if (validationError) {
    return Response.json({ ok: false, error: validationError }, { status: 400 });
  }

  const gameId = safeGameId(log.gameId);
  const userId = safeUserId(log.userId);
  const fileEntry = await saveLogToFiles(log, userId, gameId);
  let supabaseResult;

  try {
    supabaseResult = await saveLogToSupabase(log, userId, gameId);
  } catch (error) {
    console.warn('Supabase game log sync failed. Local log was saved.', {
      message: error?.message,
      code: error?.code,
      details: error?.details
    });
    supabaseResult = {
      enabled: true,
      synced: false,
      error: error?.message || 'Supabase sync failed'
    };
  }

  return Response.json({
    ok: true,
    degraded: Boolean(supabaseResult?.error),
    userId,
    gameId,
    supabase: supabaseResult,
    files: [fileEntry.jsonFile, fileEntry.pgnFile]
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = safeUserId(searchParams.get('userId'));
  const gameId = searchParams.get('gameId');
  const logsDir = path.join(process.cwd(), 'logs', userId);
  const supabase = getSupabaseAdmin();

  if (supabase) {
    try {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('username', userId)
        .maybeSingle();

      if (!user) {
        return Response.json({ ok: true, userId, games: [] });
      }

      if (gameId) {
        const safeId = safeGameId(gameId);
        const { data: game, error: gameError } = await supabase
          .from('games')
          .select('*, game_moves(*)')
          .eq('user_id', user.id)
          .eq('client_game_id', safeId)
          .maybeSingle();

        if (gameError) throw gameError;
        return Response.json({ ok: true, log: game });
      }

      const { data: games, error } = await supabase
        .from('games')
        .select('client_game_id, result, saved_at, headers')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return Response.json({ ok: true, userId, games });
    } catch (error) {
      console.warn('Supabase game log read failed. Falling back to local logs.', {
        message: error?.message,
        code: error?.code,
        details: error?.details
      });
    }
  }

  if (gameId) {
    const safeId = safeGameId(gameId);
    let index = [];
    try {
      index = JSON.parse(await readFile(path.join(logsDir, 'index.json'), 'utf8'));
    } catch {
      index = [];
    }
    const entry = index.find((item) => item.gameId === safeId);
    const fileName = entry?.fileBase ? `${entry.fileBase}.json` : `${safeId}.json`;
    const log = JSON.parse(await readFile(path.join(logsDir, fileName), 'utf8'));
    return Response.json({ ok: true, log });
  }

  let games = [];
  try {
    games = JSON.parse(await readFile(path.join(logsDir, 'index.json'), 'utf8'));
  } catch {
    games = [];
  }

  return Response.json({ ok: true, userId, games });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
