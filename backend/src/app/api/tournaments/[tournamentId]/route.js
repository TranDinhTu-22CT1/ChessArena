import { decorateGameRatings, publicGame, requireOnlineUser } from '../../../../lib/online';
import { rateLimit } from '../../../../lib/rateLimit';
import { pairPublicTournament, syncTournamentLifecycle } from '../../../../lib/tournaments';

export const runtime = 'nodejs';

function publicStanding(row, rank) {
  return {
    rank: rank + 1,
    userId: row.user_id,
    displayName: row.display_name,
    score: row.score,
    gamesPlayed: row.games_played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses
  };
}

export async function GET(request, { params }) {
  const blocked = rateLimit(request, { scope: 'tournament-detail', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const { tournamentId } = await params;
  const { supabase, user } = context;
  const { data: storedTournament, error: tournamentError } = await supabase
    .from('arena_tournaments')
    .select('*')
    .eq('id', tournamentId)
    .maybeSingle();
  if (tournamentError) return Response.json({ ok: false, error: tournamentError.message }, { status: 500 });
  if (!storedTournament) return Response.json({ ok: false, error: 'Không tìm thấy giải đấu.' }, { status: 404 });
  const syncedTournament = await syncTournamentLifecycle(supabase, storedTournament);
  const { tournament } = await pairPublicTournament(supabase, syncedTournament);

  const [{ data: playerRows }, { data: gameLinkRows }] = await Promise.all([
    supabase
      .from('arena_tournament_players')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('score', { ascending: false })
      .order('wins', { ascending: false })
      .order('updated_at', { ascending: false }),
    supabase
      .from('arena_tournament_games')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false })
      .limit(20)
  ]);
  const players = Array.isArray(playerRows) ? playerRows : [];
  const gameLinks = Array.isArray(gameLinkRows) ? gameLinkRows : [];

  const gameIds = gameLinks.map((item) => item.game_id);
  const { data: gameRows } = gameIds.length
    ? await supabase
      .from('online_games')
      .select('*')
      .in('id', gameIds)
    : { data: [] };
  const games = Array.isArray(gameRows) ? gameRows : [];
  const { data: moveRows } = gameIds.length
    ? await supabase
      .from('online_game_moves')
      .select('*')
      .in('game_id', gameIds)
      .order('ply', { ascending: true })
    : { data: [] };
  const moves = Array.isArray(moveRows) ? moveRows : [];

  const standings = players.map(publicStanding);
  const myStanding = standings.find((item) => item.userId === user.id) || null;
  const gameById = new Map(games.map((game) => [game.id, game]));
  const recentGames = await Promise.all(gameLinks.map(async (link) => {
    const game = gameById.get(link.game_id);
    if (!game) return null;
    const gameMoves = moves.filter((move) => move.game_id === game.id);
    return {
      ...publicGame(await decorateGameRatings(supabase, game), gameMoves, user.id),
      tournamentScore: {
        white: link.score_white,
        black: link.score_black
      }
    };
  }));

  return Response.json({
    ok: true,
    tournament: {
      id: tournament.id,
      title: tournament.title,
      status: tournament.status,
      timeControl: tournament.time_control,
      startsAt: tournament.starts_at,
      endsAt: tournament.ends_at,
      joined: Boolean(myStanding),
      playerCount: players.length,
      gameCount: gameLinks.length,
      pairingSystem: tournament.pairing_system || 'arena',
      maxPlayers: tournament.max_players || 100,
      currentRound: tournament.current_round || 0
    },
    standings,
    myStanding,
    recentGames: recentGames.filter(Boolean)
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
