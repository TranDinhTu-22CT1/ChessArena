import { distributedRateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../lib/online';
import { queryMomoPayment } from '../../../../lib/momo';
import { activateMomoMembership } from '../confirm/route';

export const runtime = 'nodejs';

export async function POST(request) {
  const blocked = await distributedRateLimit(request, {
    scope: 'momo-payment-status',
    limit: 20,
    windowMs: 60_000
  });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await request.json().catch(() => ({}));
  const orderId = String(payload?.orderId || '').trim().slice(0, 160);
  if (!orderId) {
    return Response.json({ ok: false, error: 'Missing MoMo order id.' }, { status: 400 });
  }

  const { data: transaction, error } = await context.supabase
    .from('payment_transactions')
    .select('user_id, status, tier, billing_cycle')
    .eq('provider', 'momo')
    .eq('provider_event_id', orderId)
    .maybeSingle();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!transaction || transaction.user_id !== context.user.id) {
    return Response.json({ ok: false, error: 'MoMo transaction was not found for this account.' }, { status: 404 });
  }
  if (transaction.status === 'completed') {
    return Response.json({
      ok: true,
      idempotent: true,
      tier: transaction.tier,
      billingCycle: transaction.billing_cycle
    });
  }

  try {
    const result = await queryMomoPayment(orderId);
    return activateMomoMembership(context.supabase, result, context.user.id, {
      verifySignature: false
    });
  } catch (queryError) {
    return Response.json({
      ok: false,
      error: queryError.message || 'Could not query the MoMo transaction.'
    }, { status: 502 });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
