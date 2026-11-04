
import { requireAdminCsrf, requireAdminPermission, requireAdminUser, writeAdminAudit } from '../../../../lib/admin';


import { rateLimit } from '../../../../lib/rateLimit';
import { readJsonPayload, safeArray } from '../../../../lib/validation';

export const runtime = 'nodejs';

function cleanUuid(value) {
  const id = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : '';
}

function cleanDate(value, end = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
  return `${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`;
}

function cleanSearch(value) {
  return String(value || '').trim().replace(/[,%()]/g, '').slice(0, 100);
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
  const search = cleanSearch(searchParams.get('search'));
  const matchType = String(searchParams.get('matchType') || '').trim();
  const rated = String(searchParams.get('rated') || '').trim();
  const dateFrom = cleanDate(searchParams.get('dateFrom'));
  const dateTo = cleanDate(searchParams.get('dateTo'), true);

  let query = context.supabase
    .from('online_games')
    .select('id, matchmaking_ticket_white, matchmaking_ticket_black, match_type, white_user_id, black_user_id, white_name, black_name, result, status, mode, rated, time_control, white_rating_before, black_rating_before, white_rating_after, black_rating_after, created_at, started_at, finished_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (status) query = query.eq('status', status);
  if (matchType) query = query.eq('match_type', matchType);
  if (rated === 'true' || rated === 'false') query = query.eq('rated', rated === 'true');
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);
  if (search) {
    const clauses = [`white_name.ilike.%${search}%`, `black_name.ilike.%${search}%`];
    if (cleanUuid(search)) clauses.unshift(`id.eq.${search}`);
    query = query.or(clauses.join(','));
  }

  const { data: gameRows, count = 0, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const games = safeArray(gameRows);

  const ids = games.map((game) => game.id);
  const { data: moveRows } = ids.length
    ? await context.supabase
      .from('online_game_moves')
      .select('game_id, ply, san, created_at')
      .in('game_id', ids)
      .order('ply', { ascending: true })
    : { data: [] };
  const moves = safeArray(moveRows);

  return Response.json({
    ok: true,
    page,
    limit,
    total: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
    matches: games.map((game) => ({
      ...game,
      moveCount: moves.filter((move) => move.game_id === game.id).length,
      lastMoves: moves.filter((move) => move.game_id === game.id).slice(-8)
    }))
  });
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
