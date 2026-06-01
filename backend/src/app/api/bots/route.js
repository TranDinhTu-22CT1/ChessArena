import { rateLimit } from '../../../lib/rateLimit';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'public-bots', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ ok: true, bots: [] });

  const { data = [], error } = await supabase
    .from('bot_personas')
    .select('id, name, elo, mood, chat, avatar_url, event_tag, active, starts_at, ends_at')
    .eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${new Date().toISOString()}`)
    .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) return Response.json({ ok: true, bots: [] });
  return Response.json({ ok: true, bots: data });
}
