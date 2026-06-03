import { decorateGameRatings, gameParticipantUserId, publicGame, relatedOnlineUserIds } from '../../../../../lib/online';
import { requireAdminPermission, requireAdminUser } from '../../../../../lib/admin';
import { rateLimit } from '../../../../../lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  const blocked = rateLimit(request, { scope: 'admin-user-detail', limit: 50, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'users:view');
  if (permissionError) return permissionError;

  const { userId } = await params;
  const { supabase } = context;
  const [
    { data: user, error: userError },
    { data: devices = [] },
    { data: bans = [] },
    { data: mutes = [] },
    { data: reports = [] },
    { data: playerReports = [] },
    { data: ratingRefunds = [] },
    { data: membership = null }
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).maybeSingle(),
    supabase.from('user_devices').select('*').eq('user_id', userId).order('last_seen_at', { ascending: false }),
    supabase.from('user_bans').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('user_mutes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('anti_cheat_reports').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('player_reports').select('*').or(`reporter_user_id.eq.${userId},reported_user_id.eq.${userId}`).order('created_at', { ascending: false }).limit(20),
    supabase.from('rating_refunds').select('*').or(`offender_user_id.eq.${userId},refunded_user_id.eq.${userId}`).order('created_at', { ascending: false }).limit(20),
    supabase.from('user_memberships').select('*').eq('user_id', userId).maybeSingle()
  ]);

  if (userError) return Response.json({ ok: false, error: userError.message }, { status: 500 });
  if (!user) return Response.json({ ok: false, error: 'User not found.' }, { status: 404 });

  const relatedUserIds = await relatedOnlineUserIds(supabase, { ...user, firebaseUid: user.firebase_uid });
  const { data: relatedUsers = [] } = await supabase
    .from('users')
    .select('id, username, display_name, email, firebase_uid, created_at')
    .in('id', relatedUserIds);

  const { data: games = [], error: gamesError } = await supabase
    .from('online_games')
    .select('*')
    .or(`white_user_id.in.(${relatedUserIds.join(',')}),black_user_id.in.(${relatedUserIds.join(',')})`)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (gamesError) return Response.json({ ok: false, error: gamesError.message }, { status: 500 });

  const decoratedGames = await Promise.all(games.map(async (game) => {
    const { data: moves = [] } = await supabase
      .from('online_game_moves')
      .select('*')
      .eq('game_id', game.id)
      .order('ply', { ascending: true });
    return publicGame(await decorateGameRatings(supabase, game), moves, gameParticipantUserId(game, relatedUserIds, userId));
  }));

  return Response.json({
    ok: true,
    user,
    devices,
    bans,
    mutes,
    reports,
    playerReports,
    ratingRefunds,
    membership,
    diagnostics: {
      relatedUserIds,
      relatedUsers,
      splitAccount: relatedUserIds.length > 1,
      completedGamesFound: games.filter((game) => ['checkmate', 'draw', 'resigned'].includes(game.status)).length,
      activeGamesFound: games.filter((game) => game.status === 'active').length,
      openPlayerReports: playerReports.filter((report) => ['pending', 'in_review', 'escalated'].includes(report.status)).length,
      refundEvents: ratingRefunds.length,
      membershipStatus: membership?.status || 'inactive'
    },
    games: decoratedGames
  });
}
