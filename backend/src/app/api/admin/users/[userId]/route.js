import { decorateGameRatings, publicGame } from '../../../../../lib/online';
import { requireAdminUser } from '../../../../../lib/admin';
import { rateLimit } from '../../../../../lib/rateLimit';

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  const blocked = rateLimit(request, { scope: 'admin-user-detail', limit: 50, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  const { userId } = await params;
  const { supabase } = context;
  const [{ data: user, error: userError }, { data: devices = [] }, { data: bans = [] }, { data: mutes = [] }, { data: reports = [] }] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).maybeSingle(),
    supabase.from('user_devices').select('*').eq('user_id', userId).order('last_seen_at', { ascending: false }),
    supabase.from('user_bans').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('user_mutes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('anti_cheat_reports').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
  ]);

  if (userError) return Response.json({ ok: false, error: userError.message }, { status: 500 });
  if (!user) return Response.json({ ok: false, error: 'User not found.' }, { status: 404 });

  const { data: games = [], error: gamesError } = await supabase
    .from('online_games')
    .select('*')
    .or(`white_user_id.eq.${userId},black_user_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (gamesError) return Response.json({ ok: false, error: gamesError.message }, { status: 500 });

  const decoratedGames = await Promise.all(games.map(async (game) => {
    const { data: moves = [] } = await supabase
      .from('online_game_moves')
      .select('*')
      .eq('game_id', game.id)
      .order('ply', { ascending: true });
    return publicGame(await decorateGameRatings(supabase, game), moves, userId);
  }));

  return Response.json({
    ok: true,
    user,
    devices,
    bans,
    mutes,
    reports,
    games: decoratedGames
  });
}
