import { syncAchievements } from '../../../lib/achievements';
import { requireOnlineUser } from '../../../lib/online';
import { rateLimit } from '../../../lib/rateLimit';
import { readJsonPayload } from '../../../lib/validation';

export const runtime = 'nodejs';

function publicTournament(row, players = []) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    timeControl: row.time_control,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    joined: Boolean(row.joined),
    players: players.map((item, index) => ({
      rank: index + 1,
      userId: item.user_id,
      displayName: item.display_name,
      score: item.score,
      gamesPlayed: item.games_played,
      wins: item.wins,
      draws: item.draws,
      losses: item.losses
    }))
  };
}

async function ensureDefaultTournament(supabase) {
  const { data: existing = [] } = await supabase
    .from('arena_tournaments')
    .select('id')
    .in('status', ['scheduled', 'open', 'running'])
    .limit(1);
  if (existing.length) return;

  const now = new Date();
  const startsAt = new Date(now.getTime() + 5 * 60_000);
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
  await supabase.from('arena_tournaments').insert({
    title: 'Giải nhanh hằng ngày',
    status: 'open',
    time_control: '300+0',
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString()
  });
}

async function loadTournaments(context) {
  await ensureDefaultTournament(context.supabase);
  const { data: tournaments = [], error } = await context.supabase
    .from('arena_tournaments')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(12);
  if (error) throw error;

  const ids = tournaments.map((item) => item.id);
  const { data: players = [] } = ids.length
    ? await context.supabase
      .from('arena_tournament_players')
      .select('*')
      .in('tournament_id', ids)
      .order('score', { ascending: false })
      .order('updated_at', { ascending: false })
    : { data: [] };

  const joinedIds = new Set(players.filter((item) => item.user_id === context.user.id).map((item) => item.tournament_id));
  return tournaments.map((item) => publicTournament(
    { ...item, joined: joinedIds.has(item.id) },
    players.filter((player) => player.tournament_id === item.id).slice(0, 10)
  ));
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'tournaments-read', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  try {
    const tournaments = await loadTournaments(context);
    return Response.json({ ok: true, tournaments });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Không tải được danh sách giải đấu.' }, { status: 500 });
  }
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'tournaments-write', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });

  const action = String(payload.action || '').trim();
  const tournamentId = String(payload.tournamentId || '').trim();

  if (action === 'join') {
    if (!tournamentId) return Response.json({ ok: false, error: 'Thiếu mã giải đấu.' }, { status: 400 });
    const { data: tournament, error: tournamentError } = await context.supabase
      .from('arena_tournaments')
      .select('*')
      .eq('id', tournamentId)
      .maybeSingle();
    if (tournamentError) return Response.json({ ok: false, error: tournamentError.message }, { status: 500 });
    if (!tournament) return Response.json({ ok: false, error: 'Không tìm thấy giải đấu.' }, { status: 404 });
    if (!['scheduled', 'open', 'running'].includes(tournament.status)) {
      return Response.json({ ok: false, error: 'Giải đấu chưa mở tham gia.' }, { status: 409 });
    }

    const { data, error } = await context.supabase
      .from('arena_tournament_players')
      .upsert({
        tournament_id: tournamentId,
        user_id: context.user.id,
        display_name: context.user.displayName || context.user.username || 'Người chơi',
        updated_at: new Date().toISOString()
      }, { onConflict: 'tournament_id,user_id' })
      .select('*')
      .single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    const achievements = await syncAchievements(context.supabase, context.user.id);
    return Response.json({ ok: true, player: data, achievements });
  }

  return Response.json({ ok: false, error: 'Thao tác giải đấu không được hỗ trợ.' }, { status: 400 });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
