import { distributedRateLimit } from '../../../../../lib/rateLimit';
import { readJsonPayload } from '../../../../../lib/validation';
import { onlineSummary, requireOnlineUser } from '../../../../../lib/online';

export const runtime = 'nodejs';

export async function POST(request) {
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const blocked = await distributedRateLimit(request, {
    scope: 'online-matchmaking-cancel',
    identity: context.user.id,
    limit: 20,
    windowMs: 60_000
  });
  if (blocked) return blocked;

  const payload = await readJsonPayload(request) ?? {};
  const { supabase, user } = context;
  const reason = String(payload.reason || 'user_cancelled').slice(0, 80);
  const ticketId = String(payload.ticketId || '').trim();
  const sessionId = String(payload.sessionId || '').trim().slice(0, 120);
  let result = ticketId && sessionId
    ? await supabase.rpc('quick_match_cancel_v2', {
        p_user_id: user.id,
        p_ticket_id: ticketId,
        p_session_id: sessionId,
        p_reason: reason
      })
    : { error: { code: 'PGRST202' } };
  if (result.error?.code === 'PGRST202' || result.error?.code === 'PGRST203') {
    result = await supabase.rpc('quick_match_cancel', {
      p_user_id: user.id,
      p_reason: reason
    });
  }
  const { data, error } = result;
  if (error) {
    return Response.json({ ok: false, error: error.message || 'Unable to cancel matchmaking.' }, { status: 500 });
  }
  return Response.json({
    ok: true,
    status: data?.status || 'cancelled',
    queueTicketId: data?.queue_ticket_id || ticketId || null,
    ...(await onlineSummary(supabase))
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
