import { createUserNotification } from './notifications';
import { onlineModeFromTimeControl } from './online';

export async function syncTournamentLifecycle(supabase, tournament) {
  if (!tournament || tournament.status === 'cancelled') return tournament;
  const now = Date.now();
  const startsAt = Date.parse(tournament.starts_at || '');
  const endsAt = Date.parse(tournament.ends_at || '');
  let status = tournament.status;
  if (Number.isFinite(endsAt) && endsAt <= now) status = 'finished';
  else if (Number.isFinite(startsAt) && startsAt <= now && ['scheduled', 'open'].includes(status)) status = 'running';
  else if (Number.isFinite(startsAt) && startsAt > now && status === 'scheduled') status = 'open';
  if (status === tournament.status) return tournament;
  const { data } = await supabase
    .from('arena_tournaments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', tournament.id)
    .select('*')
    .single();
  return data || { ...tournament, status };
}

export async function pairPublicTournament(supabase, inputTournament) {
  const tournament = await syncTournamentLifecycle(supabase, inputTournament);
  if (!tournament?.auto_manage || tournament.status !== 'running') return { tournament, created: [] };
  const { data: openPairings = [] } = await supabase
    .from('tournament_pairings')
    .select('id')
    .eq('tournament_id', tournament.id)
    .in('status', ['pending', 'active'])
    .limit(1);
  if (openPairings.length) return { tournament, created: [] };

  const [{ data: players = [] }, { data: locks = [] }] = await Promise.all([
    supabase.from('arena_tournament_players').select('*').eq('tournament_id', tournament.id)
      .order('score', { ascending: false }).order('games_played', { ascending: true }).order('joined_at', { ascending: true }),
    supabase.from('user_active_locks').select('user_id')
  ]);
  const locked = new Set(locks.map((item) => item.user_id));
  const available = players.filter((player) => !locked.has(player.user_id));
  if (available.length < 2) return { tournament, created: [] };

  const roundNumber = Number(tournament.current_round || 0) + 1;
  const created = [];
  for (let index = 0; index + 1 < available.length; index += 2) {
    const first = available[index];
    const second = available[index + 1];
    const white = (roundNumber + index) % 2 === 0 ? second : first;
    const black = white === first ? second : first;
    const now = new Date().toISOString();
    const { data: game, error } = await supabase.from('online_games').insert({
      status: 'active',
      match_type: 'quick',
      white_user_id: white.user_id,
      black_user_id: black.user_id,
      white_name: white.display_name,
      black_name: black.display_name,
      fen: 'start',
      pgn: '',
      turn: 'w',
      result: '*',
      time_control: tournament.time_control,
      mode: onlineModeFromTimeControl(tournament.time_control),
      rated: true,
      last_move_at: now,
      started_at: now,
      updated_at: now
    }).select('*').single();
    if (error || !game) continue;

    await Promise.all([
      supabase.from('tournament_pairings').insert({
        tournament_id: tournament.id,
        round_number: roundNumber,
        white_user_id: white.user_id,
        black_user_id: black.user_id,
        game_id: game.id,
        status: 'active'
      }),
      supabase.from('arena_tournament_games').insert({
        tournament_id: tournament.id,
        game_id: game.id,
        white_user_id: white.user_id,
        black_user_id: black.user_id,
        result: '*'
      }),
      supabase.from('user_active_locks').insert([
        { user_id: white.user_id, game_id: game.id },
        { user_id: black.user_id, game_id: game.id }
      ]),
      ...[white, black].map((player) => createUserNotification(supabase, {
        recipientUserId: player.user_id,
        type: 'tournament_pairing',
        title: `Đã ghép cặp vòng ${roundNumber}`,
        body: `${tournament.title}: ván đấu của bạn đã sẵn sàng.`,
        actionUrl: `/online?game=${game.id}`,
        priority: 'high',
        metadata: { tournamentId: tournament.id, gameId: game.id, roundNumber }
      }))
    ]);
    created.push(game);
  }

  if (created.length) {
    await supabase.from('arena_tournaments')
      .update({ current_round: roundNumber, updated_at: new Date().toISOString() })
      .eq('id', tournament.id);
  }
  return {
    tournament: { ...tournament, current_round: created.length ? roundNumber : tournament.current_round },
    created
  };
}
