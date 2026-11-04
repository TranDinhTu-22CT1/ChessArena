import { applyOnlineRatingResult, decorateGameRatings, publicGame } from './online';
import { publishOnlineGame } from './onlineEvents';

export function onlineActionError(error) {
  const missingMigration = ['PGRST202', 'PGRST203', '42883'].includes(error.code);
  const status = missingMigration ? 503 : error.code === '42501' ? 403
    : error.code === 'P0002' ? 404 : error.code === '22023' || error.code === '22P02' ? 400
      : ['55000', '40001', '40P01'].includes(error.code) ? 409 : 500;
  return Response.json({ ok: false, error: missingMigration
    ? 'Cần cập nhật cơ sở dữ liệu bằng file SQL nâng cấp trước khi tiếp tục.' : error.message }, { status });
}

export async function onlineActionGame(supabase, user, game) {
  const { data: moves, error } = await supabase.from('online_game_moves').select('*')
    .eq('game_id', game.id).order('ply', { ascending: true });
  if (error) throw error;
  if (['checkmate', 'draw', 'resigned'].includes(game.status)) {
    await Promise.all([
      applyOnlineRatingResult(supabase, game, game.result),
    ]);
  }
  const decorated = await decorateGameRatings(supabase, game);
  publishOnlineGame(game.id, { game: decorated, moves });
  return publicGame(decorated, moves, user.id);
}
