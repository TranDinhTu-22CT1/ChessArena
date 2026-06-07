import { syncAchievements } from '../../../lib/achievements';
import { requireOnlineUser } from '../../../lib/online';
import { rateLimit } from '../../../lib/rateLimit';
import { readJsonPayload } from '../../../lib/validation';
import { pairPublicTournament, syncTournamentLifecycle } from '../../../lib/tournaments';

export const runtime = 'nodejs';

function publicTournament(row, players = []) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    timeControl: row.time_control,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    playerCount: row.playerCount ?? players.length,
    gameCount: row.gameCount ?? 0,
    pairingSystem: row.pairing_system || 'arena',
    maxPlayers: row.max_players || 100,
    currentRound: row.current_round || 0,
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
  const url = context.url;
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
  const limit = Math.max(6, Math.min(24, Math.floor(Number(url.searchParams.get('limit')) || 12)));
  const status = String(url.searchParams.get('status') || 'all');
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  let query = context.supabase
    .from('arena_tournaments')
    .select('*', { count: 'exact' })
    .order('starts_at', { ascending: false })
    .range(from, to);
  if (['scheduled', 'open', 'running', 'finished', 'cancelled'].includes(status)) query = query.eq('status', status);
  const { data: tournamentRows, error, count = 0 } = await query;
  if (error) throw error;
  const tournaments = await Promise.all((Array.isArray(tournamentRows) ? tournamentRows : []).map(async (item) => {
    const synced = await syncTournamentLifecycle(context.supabase, item);
    return (await pairPublicTournament(context.supabase, synced)).tournament;
  }));

  const ids = tournaments.map((item) => item.id);
  const { data: playerRows } = ids.length
    ? await context.supabase
      .from('arena_tournament_players')
      .select('*')
      .in('tournament_id', ids)
      .order('score', { ascending: false })
      .order('updated_at', { ascending: false })
    : { data: [] };
  const players = Array.isArray(playerRows) ? playerRows : [];
  const { data: gameRows } = ids.length
    ? await context.supabase
      .from('arena_tournament_games')
      .select('tournament_id, game_id')
      .in('tournament_id', ids)
    : { data: [] };
  const games = Array.isArray(gameRows) ? gameRows : [];

  const joinedIds = new Set(players.filter((item) => item.user_id === context.user.id).map((item) => item.tournament_id));
  return {
    page,
    limit,
    total: count ?? tournaments.length,
    totalPages: Math.max(1, Math.ceil(((count ?? tournaments.length) || 0) / limit)),
    tournaments: tournaments.map((item) => {
      const tournamentPlayers = players.filter((player) => player.tournament_id === item.id);
      return publicTournament(
        {
          ...item,
          joined: joinedIds.has(item.id),
          playerCount: tournamentPlayers.length,
          gameCount: games.filter((game) => game.tournament_id === item.id).length
        },
        tournamentPlayers.slice(0, 10)
      );
    })
  };
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'tournaments-read', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  try {
    const result = await loadTournaments({ ...context, url: new URL(request.url) });
    return Response.json({ ok: true, ...result });
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
    const { count: playerCount = 0 } = await context.supabase
      .from('arena_tournament_players')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);
    if ((playerCount || 0) >= (tournament.max_players || 100)) {
      return Response.json({ ok: false, error: 'Giải đấu đã đủ người.' }, { status: 409 });
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

  if (action === 'leave') {
    if (!tournamentId) return Response.json({ ok: false, error: 'Thiếu mã giải đấu.' }, { status: 400 });
    const { data: tournament, error: tournamentError } = await context.supabase
      .from('arena_tournaments')
      .select('id, status')
      .eq('id', tournamentId)
      .maybeSingle();
    if (tournamentError) return Response.json({ ok: false, error: tournamentError.message }, { status: 500 });
    if (!tournament) return Response.json({ ok: false, error: 'Không tìm thấy giải đấu.' }, { status: 404 });
    if (!['scheduled', 'open'].includes(tournament.status)) {
      return Response.json({ ok: false, error: 'Giải đã bắt đầu nên không thể rời.' }, { status: 409 });
    }
    const { error } = await context.supabase
      .from('arena_tournament_players')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('user_id', context.user.id);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'Thao tác giải đấu không được hỗ trợ.' }, { status: 400 });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
