import { rateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../lib/online';

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

export async function profilePayload(supabase, userId, { includePrivate = false } = {}) {
  const [{ data: profile }, { data: ratings = [] }, { data: games = [] }, { data: recentGames = [] }, { data: reviews = [] }, { data: refundRows = [] }] = await Promise.all([
    supabase
      .from('users')
      .select('id, username, display_name, email, photo_url, email_verified, created_at')
      .eq('id', userId)
      .single(),
    supabase
      .from('user_ratings')
      .select('mode, rating, games_played, wins, losses, draws, provisional')
      .eq('user_id', userId)
      .gt('games_played', 0)
      .order('mode', { ascending: true }),
    supabase
      .from('online_games')
      .select('result, white_user_id, black_user_id')
      .or(`white_user_id.eq.${userId},black_user_id.eq.${userId}`)
      .in('status', ['checkmate', 'draw', 'resigned']),
    supabase
      .from('online_games')
      .select('id, result, status, mode, rated, time_control, white_user_id, black_user_id, white_name, black_name, white_rating_before, black_rating_before, white_rating_after, black_rating_after, finished_at, created_at')
      .or(`white_user_id.eq.${userId},black_user_id.eq.${userId}`)
      .in('status', ['checkmate', 'draw', 'resigned'])
      .order('finished_at', { ascending: false, nullsFirst: false })
      .limit(12),
    supabase
      .from('game_reviews')
      .select('game_id, accuracy, average_centipawn_loss, blunders, mistakes, inaccuracies, best_moves, total_moves, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(30),
    supabase
      .from('rating_refunds')
      .select('refund_delta')
      .eq('refunded_user_id', userId)
  ]);

  const record = profile || {};
  const summary = games.reduce((total, game) => {
    const color = game.white_user_id === userId ? 'w' : 'b';
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

  return {
    id: record.id,
    username: record.username,
    displayName: record.display_name,
    email: includePrivate ? record.email : null,
    emailVerified: includePrivate ? Boolean(record.email_verified) : null,
    photoURL: record.photo_url,
    createdAt: record.created_at,
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
    recentGames: recentGames.map((game) => {
      const isWhite = game.white_user_id === userId;
      const ratingBefore = Number(isWhite ? game.white_rating_before : game.black_rating_before);
      const ratingAfter = Number(isWhite ? game.white_rating_after : game.black_rating_after);
      const review = reviewsByGame.get(game.id);
      return {
        id: game.id,
        result: game.result,
        outcome: gameOutcomeForUser(game, userId),
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
  return Response.json({ ok: true, profile: await profilePayload(context.supabase, context.user.id, { includePrivate: true }) });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'profile-write', limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await request.json().catch(() => null);
  const displayName = cleanDisplayName(payload?.displayName);
  const photoURL = cleanAvatarImage(payload?.photoURL);
  if (displayName.length < 2) {
    return Response.json({ ok: false, error: 'Display name must contain at least 2 characters.' }, { status: 400 });
  }
  if (photoURL === undefined) {
    return Response.json({ ok: false, error: 'Avatar image could not be processed. Please choose another image.' }, { status: 400 });
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

  return Response.json({ ok: true, profile: await profilePayload(context.supabase, context.user.id, { includePrivate: true }) });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
