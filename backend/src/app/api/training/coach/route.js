import { requireOnlineUser } from '../../../../lib/online';
import { rateLimit } from '../../../../lib/rateLimit';
import { safeArray } from '../../../../lib/validation';

export const runtime = 'nodejs';

function pct(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function buildInsights({ ratings, games, reviewMoves, puzzleSessions }) {
  const ratingRows = safeArray(ratings);
  const gameRows = safeArray(games);
  const reviewMoveRows = safeArray(reviewMoves);
  const puzzleSessionRows = safeArray(puzzleSessions);
  const finishedGames = gameRows.filter((game) => game.result && game.result !== '*');
  const losses = finishedGames.filter((game) => game.outcome === 'loss').length;
  const wins = finishedGames.filter((game) => game.outcome === 'win').length;
  const draws = finishedGames.filter((game) => game.outcome === 'draw').length;
  const total = finishedGames.length || 1;
  const mistakeCount = reviewMoveRows.filter((move) => ['mistake', 'blunder', 'miss'].includes(move.tone)).length;
  const blunderCount = reviewMoveRows.filter((move) => move.tone === 'blunder').length;
  const puzzleCorrect = puzzleSessionRows.reduce((sum, item) => sum + (Number(item.correct) || 0), 0);
  const puzzleAttempted = puzzleSessionRows.reduce((sum, item) => sum + (Number(item.attempted) || 0), 0);
  const bestRush = Math.max(0, ...puzzleSessionRows.filter((item) => item.mode === 'rush').map((item) => Number(item.score) || 0));
  const bestStreak = Math.max(0, ...puzzleSessionRows.map((item) => Number(item.best_streak) || 0));
  const bestRating = Math.max(0, ...ratingRows.map((item) => Number(item.rating) || 0));
  const puzzleAccuracy = puzzleAttempted ? puzzleCorrect / puzzleAttempted : 0;
  const phaseMistakes = reviewMoveRows.reduce((summary, move) => {
    if (!['mistake', 'blunder', 'miss'].includes(move.tone)) return summary;
    const phase = Number(move.ply) <= 20 ? 'opening' : Number(move.ply) <= 60 ? 'middlegame' : 'endgame';
    summary[phase] += 1;
    return summary;
  }, { opening: 0, middlegame: 0, endgame: 0 });
  const weakestPhase = Object.entries(phaseMistakes).sort((first, second) => second[1] - first[1])[0]?.[0] || 'middlegame';
  const phaseLabels = {
    opening: 'Khai cuộc',
    middlegame: 'Trung cuộc',
    endgame: 'Tàn cuộc'
  };

  const cards = [
    {
      key: 'onlineForm',
      title: 'Phong độ online',
      value: `${wins}-${draws}-${losses}`,
      detail: `${finishedGames.length} ván đã hoàn thành. Tỷ lệ thắng ${pct(wins / total)}.`
    },
    {
      key: 'bestRating',
      title: 'Rating cao nhất',
      value: bestRating || 'Mới',
      detail: bestRating ? 'Mức rating cao nhất trong các chế độ hiện tại.' : 'Chơi ván tính điểm để nhận tư vấn rating.'
    },
    {
      key: 'reviewRisk',
      title: 'Rủi ro khi review',
      value: mistakeCount,
      detail: `Phát hiện ${blunderCount} nước sai nghiêm trọng trong các nước đã review.`
    },
    {
      key: 'puzzleForm',
      title: 'Phong độ puzzle',
      value: puzzleAttempted ? pct(puzzleAccuracy) : 'Mới',
      detail: `Rush tốt nhất ${bestRush}. Chuỗi tốt nhất ${bestStreak}.`
    }
  ];

  const recommendations = [];
  if (finishedGames.length < 5) {
    recommendations.push('Hoàn thành ít nhất 5 ván online để Coach phân tích rõ xu hướng ở khai cuộc, trung cuộc và tàn cuộc.');
  }
  if (mistakeCount >= 5) {
    recommendations.push('Mở Game Review sau mỗi ván thua và chơi lại các vị trí sai trước khi bắt đầu ván mới.');
  }
  if (blunderCount >= 3) {
    recommendations.push('Ưu tiên puzzle cá nhân được tạo từ các ván đã review. Giảm lỗi một nước là cách cải thiện rating nhanh nhất lúc này.');
  }
  if (!puzzleAttempted || puzzleAccuracy < 0.65) {
    recommendations.push('Luyện Puzzle Streak trước Puzzle Rush. Hãy ưu tiên độ chính xác cho đến khi vượt mốc 65%.');
  }
  if (bestRush >= 20) {
    recommendations.push('Tốc độ chiến thuật của bạn đang tốt. Hãy bổ sung puzzle chậm về tàn cuộc và kỹ thuật chuyển hóa ưu thế.');
  }
  if (!recommendations.length) {
    recommendations.push('Dữ liệu luyện tập đang cân bằng. Tiếp tục luân phiên ván online, Game Review và chuỗi puzzle hằng ngày.');
  }

  const weeklyPlan = [
    { day: 'Thứ 2', focus: `Review ${phaseLabels[weakestPhase].toLowerCase()}`, target: 'Review kỹ 2 ván đã chơi' },
    { day: 'Thứ 4', focus: 'Độ chính xác chiến thuật', target: '15 puzzle, mục tiêu chính xác 70%' },
    { day: 'Thứ 6', focus: 'Thư viện khai cuộc', target: 'Ôn 2 biến bằng PGN đã lưu' },
    { day: 'Cuối tuần', focus: 'Luyện tập tính điểm', target: '3 ván chậm và review toàn bộ' }
  ];

  return { cards, recommendations, phaseMistakes, weakestPhase, weeklyPlan };
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
      .select('tone, label, ply, fen, created_at')
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

  const games = safeArray(rawGames).map((game) => {
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
