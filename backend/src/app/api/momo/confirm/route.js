import { distributedRateLimit } from '../../../../lib/rateLimit';
import { requireSupabase } from '../../../../lib/online';
import { momoAmount, readMomoExtraData, verifyMomoResultSignature } from '../../../../lib/momo';
import { recordPaymentTransaction } from '../../../../lib/payments';

export const runtime = 'nodejs';

function cleanTransactionId(payload) {
  return String(payload?.transId || payload?.orderId || '').trim().slice(0, 160);
}

async function activateMomoMembership(supabase, payload) {
  const extra = readMomoExtraData(payload.extraData);
  if (!extra?.userId || !extra?.tier || !extra?.billingCycle) {
    return Response.json({ ok: false, error: 'Missing MoMo membership metadata.' }, { status: 400 });
  }

  const expectedAmount = momoAmount(extra.tier, extra.billingCycle);
  if (!expectedAmount || Number(payload.amount) !== expectedAmount) {
    return Response.json({ ok: false, error: 'MoMo amount does not match the selected membership.' }, { status: 400 });
  }

  if (Number(payload.resultCode) !== 0) {
    return Response.json({ ok: false, error: payload.message || 'MoMo payment was not successful.' }, { status: 400 });
  }

  if (!verifyMomoResultSignature(payload)) {
    return Response.json({ ok: false, error: 'Invalid MoMo signature.' }, { status: 400 });
  }

  const transactionId = cleanTransactionId(payload);
  if (!transactionId) {
    return Response.json({ ok: false, error: 'Missing MoMo transaction id.' }, { status: 400 });
  }

  const { data: existingPayment, error: lookupError } = await supabase
    .from('user_memberships')
    .select('user_id, tier, billing_cycle, status, provider_subscription_id')
    .eq('provider', 'momo')
    .eq('provider_subscription_id', transactionId)
    .maybeSingle();

  if (lookupError) return Response.json({ ok: false, error: lookupError.message }, { status: 500 });
  if (existingPayment) {
    return Response.json({
      ok: true,
      idempotent: true,
      tier: existingPayment.tier,
      billingCycle: existingPayment.billing_cycle,
      status: existingPayment.status
    });
  }

  const now = new Date();
  const currentPeriodEnd = new Date(now);
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + (extra.billingCycle === 'yearly' ? 12 : 1));

  const { error } = await supabase
    .from('user_memberships')
    .upsert({
      user_id: extra.userId,
      tier: extra.tier,
      status: 'active',
      billing_cycle: extra.billingCycle,
      provider: 'momo',
      provider_subscription_id: transactionId,
      provider_plan_id: `momo:${extra.tier}:${extra.billingCycle}`,
      started_at: now.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      cancelled_at: null,
      updated_at: now.toISOString()
    }, { onConflict: 'user_id' });

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  await recordPaymentTransaction(supabase, {
    userId: extra.userId,
    provider: 'momo',
    providerTransactionId: transactionId,
    status: 'completed',
    tier: extra.tier,
    billingCycle: extra.billingCycle,
    currency: 'VND',
    amount: payload.amount,
    metadata: {
      orderId: payload.orderId,
      requestId: payload.requestId
    }
  });
  return Response.json({ ok: true, tier: extra.tier, billingCycle: extra.billingCycle });
}

export async function POST(request) {
  const blocked = await distributedRateLimit(request, { scope: 'momo-payment-confirm', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const { supabase, error } = requireSupabase();
  if (error) return error;

  const payload = await request.json().catch(() => null);
  if (!payload) return Response.json({ ok: false, error: 'Invalid MoMo payload.' }, { status: 400 });
  return activateMomoMembership(supabase, payload);
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
