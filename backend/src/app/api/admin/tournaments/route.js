import { requireAdminUser, writeAdminAudit } from '../../../../lib/admin';
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
  const { data: users = [] } = await supabase
    .from('users')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(500);

  await Promise.all((users || []).map((user) => createUserNotification(supabase, {
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

  const { data: tournaments = [], error } = await context.supabase
    .from('arena_tournaments')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(20);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const ids = tournaments.map((item) => item.id);
  const { data: players = [] } = ids.length
    ? await context.supabase
      .from('arena_tournament_players')
      .select('*')
      .in('tournament_id', ids)
      .order('score', { ascending: false })
      .order('updated_at', { ascending: false })
    : { data: [] };

  return Response.json({
    ok: true,
    tournaments: tournaments.map((item) => ({
      ...item,
      players: players.filter((player) => player.tournament_id === item.id).slice(0, 10)
    }))
  });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'admin-tournaments-create', limit: 15, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

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

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
