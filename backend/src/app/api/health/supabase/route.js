import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return Response.json({ ok: false, error: 'Missing Supabase env' }, { status: 500 });
  }

  const { data, error } = await supabase.from('users').select('id').limit(1);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, usersReachable: Array.isArray(data) });
}
