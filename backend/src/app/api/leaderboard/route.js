import { rateLimit } from '../../../lib/rateLimit';
import { requireOnlineUser } from '../../../lib/online';

export const runtime = 'nodejs';
const integer = (value, fallback, min, max) => {
  if (value === null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
};

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'leaderboard-read', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const params = new URL(request.url).searchParams;
  const mode = ['bullet', 'blitz', 'rapid', 'classical'].includes(params.get('mode')) ? params.get('mode') : 'rapid';
  const period = ['week', 'month'].includes(params.get('period')) ? params.get('period') : 'all';
  const { data, error } = await context.supabase.rpc('get_leaderboard', {
    p_user: context.user.id, p_mode: mode, p_period: period,
    p_offset: period === 'all' ? 0 : integer(params.get('offset'), 0, 0, 12),
    p_page: integer(params.get('page'), 1, 1, 1000000), p_limit: integer(params.get('limit'), 20, 10, 50)
  });
  if (error) return Response.json({ ok: false, error: ['PGRST202', '42883'].includes(error.code)
    ? 'Cần chạy backend/supabase/LeaderboardSeasons.sql để mở bảng xếp hạng mới.'
    : 'Chưa tải được bảng xếp hạng. Vui lòng thử lại.' }, { status: 503 });
  return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}

export function OPTIONS() { return new Response(null, { status: 204 }); }
