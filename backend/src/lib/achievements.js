import { safeArray } from './validation';

export const ACHIEVEMENTS = [
  {
    key: 'first_online_win',
    tier: 'bronze',
    title: 'First Online Win',
    description: 'Win your first rated online game.',
    target: 1
  },
  {
    key: 'ten_online_games',
    tier: 'bronze',
    title: 'Arena Regular',
    description: 'Finish 10 online games.',
    target: 10
  },
  {
    key: 'rating_800',
    tier: 'silver',
    title: '800 Rated',
    description: 'Reach 800 rating in any speed mode.',
    target: 800
  },
  {
    key: 'review_5_games',
    tier: 'silver',
    title: 'Game Reviewer',
    description: 'Review 5 completed games.',
    target: 5
  },
  {
    key: 'puzzle_50_correct',
    tier: 'silver',
    title: 'Tactics Builder',
    description: 'Solve 50 puzzles across trainer modes.',
    target: 50
  },
  {
    key: 'rush_20',
    tier: 'gold',
    title: 'Puzzle Rush 20',
    description: 'Score 20 or more in a Puzzle Rush session.',
    target: 20
  },
  {
    key: 'streak_15',
    tier: 'gold',
    title: 'Puzzle Streak 15',
    description: 'Reach a 15 puzzle streak.',
    target: 15
  },
  {
    key: 'daily_7',
    tier: 'gold',
    title: 'Daily Streak 7',
    description: 'Keep a 7-day Daily Puzzle streak.',
    target: 7
  },
  {
    key: 'tournament_joined',
    tier: 'bronze',
    title: 'Tournament Entrant',
    description: 'Join your first Arena tournament.',
    target: 1
  }
];

export function achievementDefinitionsByKey() {
  return new Map(ACHIEVEMENTS.map((item) => [item.key, item]));
}

function clampProgress(value, target) {
  return Math.max(0, Math.min(Number(value) || 0, target));
}

function progressPayload(key, value) {
  const definition = achievementDefinitionsByKey().get(key);
  const target = definition?.target || 1;
  const progress = clampProgress(value, target);
  return {
    ...definition,
    progress,
    unlocked: progress >= target
  };
}

export async function computeAchievementProgress(supabase, userId) {
  const [
    { data: ratings = [] },
    { data: games = [] },
    { count: reviewCount = 0 },
    { data: puzzleTotals = [] },
    { data: dailyClaims = [] },
    { count: tournamentCount = 0 }
  ] = await Promise.all([
    supabase.from('user_ratings').select('rating, games_played, wins').eq('user_id', userId),
    supabase
      .from('online_games')
      .select('white_user_id, black_user_id, result, status')
      .or(`white_user_id.eq.${userId},black_user_id.eq.${userId}`),
    supabase
      .from('game_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('puzzle_sessions')
      .select('mode, score, correct, best_streak')
      .eq('user_id', userId),
    supabase
      .from('daily_puzzle_claims')
      .select('streak')
      .eq('user_id', userId)
      .order('puzzle_date', { ascending: false })
      .limit(1),
    supabase
      .from('arena_tournament_players')
      .select('tournament_id', { count: 'exact', head: true })
      .eq('user_id', userId)
  ]);

  const ratingRows = safeArray(ratings);
  const gameRows = safeArray(games);
  const puzzleRows = safeArray(puzzleTotals);
  const dailyRows = safeArray(dailyClaims);

  const onlineWins = gameRows.filter((game) => (
    (game.result === '1-0' && game.white_user_id === userId)
    || (game.result === '0-1' && game.black_user_id === userId)
  )).length;
  const finishedGames = gameRows.filter((game) => game.result && game.result !== '*').length;
  const maxRating = Math.max(0, ...ratingRows.map((item) => Number(item.rating) || 0));
  const correctPuzzles = puzzleRows.reduce((total, item) => total + (Number(item.correct) || 0), 0);
  const bestRush = Math.max(0, ...puzzleRows.filter((item) => item.mode === 'rush').map((item) => Number(item.score) || 0));
  const bestStreak = Math.max(0, ...puzzleRows.map((item) => Number(item.best_streak) || 0));
  const dailyStreak = Number(dailyRows[0]?.streak) || 0;

  return [
    progressPayload('first_online_win', onlineWins),
    progressPayload('ten_online_games', finishedGames),
    progressPayload('rating_800', maxRating),
    progressPayload('review_5_games', reviewCount || 0),
    progressPayload('puzzle_50_correct', correctPuzzles),
    progressPayload('rush_20', bestRush),
    progressPayload('streak_15', bestStreak),
    progressPayload('daily_7', dailyStreak),
    progressPayload('tournament_joined', tournamentCount || 0)
  ];
}

export async function syncAchievements(supabase, userId) {
  const achievements = await computeAchievementProgress(supabase, userId);
  const now = new Date().toISOString();
  const rows = achievements.map((item) => ({
    user_id: userId,
    achievement_key: item.key,
    tier: item.tier,
    progress: item.progress,
    target: item.target,
    unlocked_at: item.unlocked ? now : null,
    updated_at: now,
    metadata: {
      title: item.title,
      description: item.description
    }
  }));

  if (rows.length) {
    await supabase
      .from('user_achievements')
      .upsert(rows, { onConflict: 'user_id,achievement_key' });
  }

  return achievements;
}
