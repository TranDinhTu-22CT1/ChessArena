import { rateLimit } from '../../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../../lib/validation';
import { onlineSummary, requireOnlineUser } from '../../../../../lib/online';

export const runtime = 'nodejs';

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'online-matchmaking-cancel', limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await readJsonPayload(request) ?? {};
  const { supabase, user } = context;
  const { error } = await supabase.rpc('quick_match_cancel', {
    p_user_id: user.id,
    p_reason: String(payload.reason || 'user_cancelled').slice(0, 80)
  });
  if (error) {
    return Response.json({ ok: false, error: error.message || 'Unable to cancel matchmaking.' }, { status: 500 });
  }
  return Response.json({ ok: true, status: 'cancelled', ...(await onlineSummary(supabase)) });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
