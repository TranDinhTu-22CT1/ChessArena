import { rateLimit } from '../../../../lib/rateLimit';
import { gameParticipantUserId, relatedOnlineUserIds, requireOnlineUser } from '../../../../lib/online';
import { uploadDataAsset } from '../../../../lib/storage';

export const runtime = 'nodejs';

function cleanDisplayName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function cleanAvatarImage(value) {
  const input = String(value || '').trim();
  if (!input) return null;
  if (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\r\n]+$/i.test(input)) {
    return input.length <= 120_000 ? input : undefined;
  }
  if (input.length > 500) return undefined;
  try {
    const url = new URL(input);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function gameOutcomeForUser(game, userId) {
  if (game.result === '1/2-1/2') return 'draw';
  const color = game.white_user_id === userId ? 'w' : 'b';
  const won = (game.result === '1-0' && color === 'w') || (game.result === '0-1' && color === 'b');
  return won ? 'win' : 'loss';
}

function optionalRows(result, fallback = []) {
  if (result.error) return fallback;
  return Array.isArray(result.data) ? result.data : fallback;
}

function participantFilter(userIds) {
  const values = userIds.join(',');
  return `white_user_id.in.(${values}),black_user_id.in.(${values})`;
}

function mergeRatings(rows, primaryUserId) {
  const byMode = new Map();
  for (const rating of rows) {
    const current = byMode.get(rating.mode);
    if (!current || rating.user_id === primaryUserId || Number(rating.games_played || 0) > Number(current.games_played || 0)) {
      byMode.set(rating.mode, rating);
    }
  }
  return [...byMode.values()].sort((first, second) => String(first.mode).localeCompare(String(second.mode)));
}

function profileAchievements({ summary, ratings, reviews, newPuzzleCount }) {
  return [
    {
      id: 'first-blood',
      label: 'Chiến thắng đầu tiên',
      description: 'Thắng ván online đầu tiên.',
      unlocked: summary.wins >= 1
    },
    {
      id: 'arena-regular',
      label: 'Kỳ thủ Arena',
      description: 'Hoàn thành 20 ván online.',
      unlocked: summary.gamesPlayed >= 20,
      progress: Math.min(summary.gamesPlayed, 20),
      target: 20
    },
    {
      id: 'review-discipline',
      label: 'Kỷ luật phân tích',
      description: 'Lưu Game Review cho 10 ván đấu.',
      unlocked: reviews.length >= 10,
      progress: Math.min(reviews.length, 10),
      target: 10
    },
    {
      id: 'mode-climber',
      label: 'Chinh phục rating',
      description: 'Đạt 800 rating ở một chế độ.',
      unlocked: ratings.some((rating) => Number(rating.rating || 0) >= 800)
    },
    {
      id: 'training-ready',
      label: 'Sẵn sàng luyện tập',
      description: 'Có bài tập cá nhân được tạo từ ván thật.',
      unlocked: newPuzzleCount > 0,
      progress: Math.min(newPuzzleCount, 5),
      target: 5
    }
  ];
}

async function profileRecord(supabase, userId) {
  const fullProfile = await supabase
    .from('users')
    .select('id, username, display_name, email, photo_url, email_verified, created_at')
    .eq('id', userId)
    .single();
  if (!fullProfile.error) return fullProfile.data;

  const publicProfile = await supabase
    .from('users')
    .select('id, username, display_name, photo_url, created_at')
    .eq('id', userId)
    .single();
  if (!publicProfile.error) return publicProfile.data;

  const minimalProfile = await supabase
    .from('users')
    .select('id, username, display_name, created_at')
    .eq('id', userId)
    .single();
  if (minimalProfile.error) throw minimalProfile.error;
  return minimalProfile.data;
}

export async function profilePayload(supabase, userId, { includePrivate = false, relatedUserIds = null } = {}) {
  const profile = await profileRecord(supabase, userId);
  const participantIds = Array.isArray(relatedUserIds) && relatedUserIds.length ? relatedUserIds : [userId];
  const [ratingsResult, gamesResult, recentGamesResult, reviewsResult, refundRowsResult, puzzleResult, membershipResult] = await Promise.all([
    supabase
      .from('user_ratings')
      .select('user_id, mode, rating, games_played, wins, losses, draws, provisional')
      .in('user_id', participantIds)
      .gt('games_played', 0)
      .order('mode', { ascending: true }),
    supabase
      .from('online_games')
      .select('result, white_user_id, black_user_id')
      .or(participantFilter(participantIds))
      .in('status', ['checkmate', 'draw', 'resigned']),
    supabase
      .from('online_games')
      .select('id, result, status, mode, rated, time_control, white_user_id, black_user_id, white_name, black_name, white_rating_before, black_rating_before, white_rating_after, black_rating_after, finished_at, created_at')
      .or(participantFilter(participantIds))
      .in('status', ['checkmate', 'draw', 'resigned'])
      .order('finished_at', { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from('game_reviews')
      .select('game_id, accuracy, average_centipawn_loss, blunders, mistakes, inaccuracies, best_moves, total_moves, updated_at')
      .in('user_id', participantIds)
      .order('updated_at', { ascending: false })
      .limit(30),
    supabase
      .from('rating_refunds')
      .select('refund_delta')
      .in('refunded_user_id', participantIds),
    supabase
      .from('personal_puzzles')
      .select('id, status')
      .in('user_id', participantIds)
      .limit(200),
    supabase
      .from('user_memberships')
      .select('tier, status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle()
  ]);

  const ratings = mergeRatings(optionalRows(ratingsResult), userId);
  const games = optionalRows(gamesResult);
  const recentGames = optionalRows(recentGamesResult);
  const reviews = optionalRows(reviewsResult);
  const refundRows = optionalRows(refundRowsResult);
  const puzzles = optionalRows(puzzleResult);
  const membership = membershipResult.error ? null : membershipResult.data;
  const record = profile || {};
  const summary = games.reduce((total, game) => {
    const participantUserId = gameParticipantUserId(game, participantIds, userId);
    const color = game.white_user_id === participantUserId ? 'w' : 'b';
    const won = (game.result === '1-0' && color === 'w') || (game.result === '0-1' && color === 'b');
    const drawn = game.result === '1/2-1/2';
    return {
      gamesPlayed: total.gamesPlayed + 1,
      wins: total.wins + (won ? 1 : 0),
      losses: total.losses + (!won && !drawn ? 1 : 0),
      draws: total.draws + (drawn ? 1 : 0)
    };
  }, { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 });
  const reviewsByGame = new Map(reviews.map((review) => [review.game_id, review]));
  const reviewedMoves = reviews.reduce((sum, review) => sum + Number(review.total_moves || 0), 0);
  const averageAccuracy = reviews.length
    ? Number((reviews.reduce((sum, review) => sum + Number(review.accuracy || 0), 0) / reviews.length).toFixed(1))
    : null;
  const averageCpl = reviews.length
    ? Math.round(reviews.reduce((sum, review) => sum + Number(review.average_centipawn_loss || 0), 0) / reviews.length)
    : null;
  const totalBlunders = reviews.reduce((sum, review) => sum + Number(review.blunders || 0), 0);
  const totalMistakes = reviews.reduce((sum, review) => sum + Number(review.mistakes || 0), 0);
  const bestMoveRate = reviewedMoves
    ? Math.round((reviews.reduce((sum, review) => sum + Number(review.best_moves || 0), 0) / reviewedMoves) * 100)
    : null;
  const totalRefundedRating = refundRows.reduce((sum, refund) => sum + Number(refund.refund_delta || 0), 0);
  const newPuzzleCount = puzzles.filter((puzzle) => puzzle.status === 'new').length;
  const achievements = profileAchievements({ summary, ratings, reviews, newPuzzleCount });

  return {
    id: record.id,
    username: record.username,
    displayName: record.display_name,
    email: includePrivate ? record.email : null,
    emailVerified: includePrivate ? Boolean(record.email_verified) : null,
    photoURL: record.photo_url,
    createdAt: record.created_at,
    membershipTier: membership?.status === 'active' ? membership.tier : 'free',
    ratings,
    summary,
    skillLab: {
      reviewedGames: reviews.length,
      reviewedMoves,
      averageAccuracy,
      averageCentipawnLoss: averageCpl,
      totalBlunders,
      totalMistakes,
      bestMoveRate,
      totalRefundedRating
    },
    training: {
      personalPuzzles: puzzles.length,
      newPersonalPuzzles: newPuzzleCount,
      reviewedGames: reviews.length,
      nextAction: newPuzzleCount > 0
        ? 'Mở Puzzle cá nhân để sửa lỗi từ các ván thật.'
        : reviews.length > 0
          ? 'Review thêm ván thua để tạo bài tập cá nhân.'
          : 'Review một ván online đã kết thúc để tạo bài tập cá nhân.'
    },
    achievements,
    recentGames: recentGames.map((game) => {
      const participantUserId = gameParticipantUserId(game, participantIds, userId);
      const isWhite = game.white_user_id === participantUserId;
      const ratingBefore = Number(isWhite ? game.white_rating_before : game.black_rating_before);
      const ratingAfter = Number(isWhite ? game.white_rating_after : game.black_rating_after);
      const review = reviewsByGame.get(game.id);
      return {
        id: game.id,
        result: game.result,
        outcome: gameOutcomeForUser(game, participantUserId),
        status: game.status,
        mode: game.mode,
        rated: game.rated !== false,
        timeControl: game.time_control,
        color: isWhite ? 'w' : 'b',
        opponent: {
          id: isWhite ? game.black_user_id : game.white_user_id,
          name: isWhite ? game.black_name : game.white_name
        },
        ratingDelta: Number.isFinite(ratingAfter) && Number.isFinite(ratingBefore) ? ratingAfter - ratingBefore : null,
        review: review ? {
          accuracy: review.accuracy,
          blunders: review.blunders,
          mistakes: review.mistakes,
          averageCentipawnLoss: review.average_centipawn_loss
        } : null,
        finishedAt: game.finished_at || game.created_at
      };
    })
  };
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'profile-read', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const relatedUserIds = await relatedOnlineUserIds(context.supabase, context.user);
  return Response.json({ ok: true, profile: await profilePayload(context.supabase, context.user.id, { includePrivate: true, relatedUserIds }) });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'profile-write', limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await request.json().catch(() => null);
  const displayName = cleanDisplayName(payload?.displayName);
  let photoURL = cleanAvatarImage(payload?.photoURL);
  if (displayName.length < 2) {
    return Response.json({ ok: false, error: 'Display name must contain at least 2 characters.' }, { status: 400 });
  }
  if (photoURL === undefined) {
    return Response.json({ ok: false, error: 'Avatar image could not be processed. Please choose another image.' }, { status: 400 });
  }
  if (photoURL?.startsWith('data:image/')) {
    try {
      const asset = await uploadDataAsset({
        ownerUserId: context.user.id,
        dataUrl: photoURL,
        mimeType: photoURL.slice(5, photoURL.indexOf(';')),
        originalName: 'avatar.webp',
        purpose: 'avatars',
        maxBytes: 2 * 1024 * 1024
      });
      photoURL = asset.url;
    } catch (error) {
      return Response.json({ ok: false, error: error.message || 'Avatar upload failed.' }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const { error } = await context.supabase
    .from('users')
    .update({ display_name: displayName, photo_url: photoURL, updated_at: now })
    .eq('id', context.user.id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  await context.supabase
    .from('online_presence')
    .update({ display_name: displayName, updated_at: now })
    .eq('user_id', context.user.id);

  const relatedUserIds = await relatedOnlineUserIds(context.supabase, context.user);
  return Response.json({ ok: true, profile: await profilePayload(context.supabase, context.user.id, { includePrivate: true, relatedUserIds }) });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
