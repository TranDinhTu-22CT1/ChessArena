import { requireOnlineUser } from '../../../../lib/online';
import { rateLimit } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';

function pct(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function buildInsights({ ratings, games, reviewMoves, puzzleSessions }) {
  const finishedGames = games.filter((game) => game.result && game.result !== '*');
  const losses = finishedGames.filter((game) => game.outcome === 'loss').length;
  const wins = finishedGames.filter((game) => game.outcome === 'win').length;
  const draws = finishedGames.filter((game) => game.outcome === 'draw').length;
  const total = finishedGames.length || 1;
  const mistakeCount = reviewMoves.filter((move) => ['mistake', 'blunder', 'miss'].includes(move.tone)).length;
  const blunderCount = reviewMoves.filter((move) => move.tone === 'blunder').length;
  const puzzleCorrect = puzzleSessions.reduce((sum, item) => sum + (Number(item.correct) || 0), 0);
  const puzzleAttempted = puzzleSessions.reduce((sum, item) => sum + (Number(item.attempted) || 0), 0);
  const bestRush = Math.max(0, ...puzzleSessions.filter((item) => item.mode === 'rush').map((item) => Number(item.score) || 0));
  const bestStreak = Math.max(0, ...puzzleSessions.map((item) => Number(item.best_streak) || 0));
  const bestRating = Math.max(0, ...ratings.map((item) => Number(item.rating) || 0));
  const puzzleAccuracy = puzzleAttempted ? puzzleCorrect / puzzleAttempted : 0;

  const cards = [
    {
      title: 'Online form',
      value: `${wins}-${draws}-${losses}`,
      detail: `${finishedGames.length} finished games. Win rate ${pct(wins / total)}.`
    },
    {
      title: 'Best rating',
      value: bestRating || 'New',
      detail: bestRating ? 'Highest current mode rating.' : 'Play rated games to unlock rating advice.'
    },
    {
      title: 'Review risk',
      value: mistakeCount,
      detail: `${blunderCount} blunders found in reviewed moves.`
    },
    {
      title: 'Puzzle form',
      value: puzzleAttempted ? pct(puzzleAccuracy) : 'New',
      detail: `Rush best ${bestRush}. Streak best ${bestStreak}.`
    }
  ];

  const recommendations = [];
  if (finishedGames.length < 5) {
    recommendations.push('Finish at least 5 online games so the coach can separate opening, middlegame and endgame patterns.');
  }
  if (mistakeCount >= 5) {
    recommendations.push('Open Game Review after each loss and replay every blunder position before starting a new match.');
  }
  if (blunderCount >= 3) {
    recommendations.push('Prioritize personal puzzles generated from your reviewed games. Your biggest rating gain is reducing one-move blunders.');
  }
  if (!puzzleAttempted || puzzleAccuracy < 0.65) {
    recommendations.push('Play Puzzle Streak before Puzzle Rush. Accuracy matters more than speed until you pass 65%.');
  }
  if (bestRush >= 20) {
    recommendations.push('Your tactical speed is strong. Add slower custom puzzles filtered by endgame or material conversion.');
  }
  if (!recommendations.length) {
    recommendations.push('Your training data is balanced. Keep alternating online games, Game Review and daily puzzle streaks.');
  }

  return { cards, recommendations };
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'coach-insights', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const [
    { data: ratings = [] },
    { data: rawGames = [] },
    { data: reviewMoves = [] },
    { data: puzzleSessions = [] }
  ] = await Promise.all([
    context.supabase.from('user_ratings').select('mode, rating, games_played, wins, losses, draws').eq('user_id', context.user.id),
    context.supabase
      .from('online_games')
      .select('white_user_id, black_user_id, result, status, created_at')
      .or(`white_user_id.eq.${context.user.id},black_user_id.eq.${context.user.id}`)
      .order('created_at', { ascending: false })
      .limit(40),
    context.supabase
      .from('game_review_moves')
      .select('tone, label, ply, created_at')
      .eq('user_id', context.user.id)
      .order('created_at', { ascending: false })
      .limit(80),
    context.supabase
      .from('puzzle_sessions')
      .select('mode, score, correct, attempted, best_streak, finished_at')
      .eq('user_id', context.user.id)
      .order('finished_at', { ascending: false })
      .limit(40)
  ]);

  const games = rawGames.map((game) => {
    const isWhite = game.white_user_id === context.user.id;
    const outcome = game.result === '1/2-1/2'
      ? 'draw'
      : (game.result === '1-0' && isWhite) || (game.result === '0-1' && !isWhite)
        ? 'win'
        : game.result && game.result !== '*'
          ? 'loss'
          : 'open';
    return { ...game, outcome };
  });

  return Response.json({
    ok: true,
    ...buildInsights({ ratings, games, reviewMoves, puzzleSessions })
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
