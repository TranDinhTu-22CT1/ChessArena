import { requireAdminCsrf, requireAdminPermission, requireAdminUser, writeAdminAudit } from '../../../../lib/admin';
import { createUserNotification } from '../../../../lib/notifications';
import { rateLimit } from '../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../lib/validation';

export const runtime = 'nodejs';

function cleanText(value, fallback, limit = 120) {
  return String(value || fallback).trim().replace(/\s+/g, ' ').slice(0, limit) || fallback;
}

function cleanTimeControl(value) {
  return ['180+0', '300+0', '600+0', '900+10'].includes(value) ? value : '300+0';
}

function cleanDuration(value) {
  return Math.max(10, Math.min(240, Math.floor(Number(value) || 30)));
}

function cleanStartsAt(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime()) ? date : new Date();
}

async function notifyPlayers(supabase, tournament) {
  const { data: users = [], error } = await supabase
    .from('users')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error || !Array.isArray(users)) return 0;

  await Promise.all(users.map((user) => createUserNotification(supabase, {
    recipientUserId: user.id,
    type: 'arena_tournament_created',
    title: 'Có giải đấu mới',
    body: `${tournament.title} đã mở đăng ký. Vào trang Giải đấu để tham gia và tranh top 1-2-3.`,
    actionUrl: '/tournaments',
    priority: 'high',
    metadata: {
      tournamentId: tournament.id,
      startsAt: tournament.starts_at,
      endsAt: tournament.ends_at,
      timeControl: tournament.time_control
    }
  })).catch(() => {}));

  return users.length;
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-tournaments', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'tournaments:view');
  if (permissionError) return permissionError;

  const { searchParams } = new URL(request.url);
  const limit = Math.max(5, Math.min(50, Number(searchParams.get('limit')) || 10));
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const { data: tournamentRows, count = 0, error } = await context.supabase
      .from('arena_tournaments')
      .select('*', { count: 'exact' })
      .order('starts_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    const tournaments = Array.isArray(tournamentRows) ? tournamentRows : [];

    const ids = tournaments.map((item) => item.id);
    const { data: playerRows, error: playersError } = ids.length
      ? await context.supabase
        .from('arena_tournament_players')
        .select('*')
        .in('tournament_id', ids)
        .order('score', { ascending: false })
        .order('updated_at', { ascending: false })
      : { data: [] };
    if (playersError) throw playersError;
    const players = Array.isArray(playerRows) ? playerRows : [];

    return Response.json({
      ok: true,
      page,
      limit,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
      tournaments: tournaments.map((item) => ({
        ...item,
        playerCount: players.filter((player) => player.tournament_id === item.id).length,
        totalGamesPlayed: players
          .filter((player) => player.tournament_id === item.id)
          .reduce((sum, player) => sum + Number(player.games_played || 0), 0),
        players: players.filter((player) => player.tournament_id === item.id).slice(0, 10)
      }))
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message || 'Không tải được danh sách giải đấu.'
    }, { status: 500 });
  }
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'admin-tournaments-create', limit: 15, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'tournaments:manage');
  if (permissionError) return permissionError;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;

  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });

  const startsAt = cleanStartsAt(payload.startsAt);
  const durationMinutes = cleanDuration(payload.durationMinutes);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const status = startsAt.getTime() <= Date.now() ? 'open' : 'scheduled';

  const { data: tournament, error } = await context.supabase
    .from('arena_tournaments')
    .insert({
      title: cleanText(payload.title, 'Giải nhanh ChessArena'),
      status,
      time_control: cleanTimeControl(payload.timeControl),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      created_by: context.admin.id,
      updated_at: new Date().toISOString()
    })
    .select('*')
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const notifiedPlayers = await notifyPlayers(context.supabase, tournament);
  await writeAdminAudit(context.supabase, context.admin, 'tournament.create', {
    tournamentId: tournament.id,
    title: tournament.title,
    timeControl: tournament.time_control,
    startsAt: tournament.starts_at,
    endsAt: tournament.ends_at,
    notifiedPlayers
  });

  return Response.json({ ok: true, tournament, notifiedPlayers });
}

export async function PATCH(request) {
  const blocked = rateLimit(request, { scope: 'admin-tournaments-update', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'tournaments:manage');
  if (permissionError) return permissionError;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;

  const payload = await readJsonPayload(request);
  const tournamentId = String(payload?.tournamentId || '').trim();
  const status = String(payload?.status || '').trim();
  if (!tournamentId || !['scheduled', 'open', 'running', 'finished', 'cancelled'].includes(status)) {
    return Response.json({ ok: false, error: 'Dữ liệu cập nhật giải đấu không hợp lệ.' }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from('arena_tournaments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', tournamentId)
    .select('*')
    .single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  await writeAdminAudit(context.supabase, context.admin, 'tournament.update_status', {
    tournamentId,
    status,
    title: data.title
  });

  return Response.json({ ok: true, tournament: data });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
