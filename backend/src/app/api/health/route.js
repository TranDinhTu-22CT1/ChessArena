import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const runtime = 'nodejs';
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ ready: false, message: 'Backend database is not configured.' }, { status: 503 });
  const { data, error } = await supabase.rpc('get_platform_capabilities');
  if (error || data?.matchmakingVersion !== 3 || data?.gameplayVersion !== 1 || data?.gameLogVersion !== 1 || data?.reviewVersion !== 2 || data?.accountBanAppeals !== true) {
    return Response.json({ ready: false, message: 'Cần chạy backend/supabase/BanCanCapNhat.sql trong Supabase SQL Editor.' }, { status: 503 });
  }
  return Response.json({ ready: true, ...data }, { headers: { 'Cache-Control': 'no-store' } });
}
