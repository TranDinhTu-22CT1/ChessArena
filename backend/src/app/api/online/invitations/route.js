import { requireOnlineUser, normalizeTimeControl } from '../../../../lib/online';
import { distributedRateLimit } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error) => Response.json({ ok: false, error: error.message }, {
  status: error.code === '42501' ? 403 : error.code === '55000' ? 409 : error.code === '22023' ? 400 : 503
});

export async function GET() {
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const { supabase, user } = context;
  const { data, error } = await supabase.from('game_invitations')
    .select('*, sender:users!sender_id(id, display_name, photo_url), recipient:users!recipient_id(id, display_name, photo_url), game:online_games!game_id(status)')
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .in('status', ['pending', 'accepted'])
    .gt('expires_at', new Date(Date.now() - 60_000).toISOString())
    .order('created_at', { ascending: false }).limit(20);
  if (error) return fail(error);
  return Response.json({ ok: true, userId: user.id, invitations: (data || []).filter((v) =>
    v.status === 'accepted' ? v.game?.status === 'active' : Date.parse(v.expires_at) > Date.now()) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const blocked = await distributedRateLimit(request, { scope: 'game-invitations', identity: context.user.id, limit: 15, windowMs: 60_000 });
  if (blocked) return blocked;
  const payload = await request.json().catch(() => ({}));
  if (!UUID.test(payload.recipientId || '')) return Response.json({ ok: false, error: 'Người nhận không hợp lệ.' }, { status: 400 });
  const { data, error } = await context.supabase.rpc('send_game_invitation', {
    p_sender: context.user.id, p_recipient: payload.recipientId,
    p_time_control: normalizeTimeControl(payload.timeControl),
    p_color: ['w', 'b'].includes(payload.side) ? payload.side : 'random'
  });
  return error ? fail(error) : Response.json({ ok: true, invitation: data });
}

export async function PATCH(request) {
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const blocked = await distributedRateLimit(request, { scope: 'game-invitation-response', identity: context.user.id, limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;
  const payload = await request.json().catch(() => ({}));
  if (!UUID.test(payload.invitationId || '') || !['accept', 'decline', 'cancel'].includes(payload.action)) {
    return Response.json({ ok: false, error: 'Phản hồi không hợp lệ.' }, { status: 400 });
  }
  const { data, error } = await context.supabase.rpc('respond_game_invitation', {
    p_user: context.user.id, p_invitation: payload.invitationId, p_action: payload.action
  });
  return error ? fail(error) : Response.json({ ok: true, invitation: data });
}

export function OPTIONS() { return new Response(null, { status: 204 }); }
