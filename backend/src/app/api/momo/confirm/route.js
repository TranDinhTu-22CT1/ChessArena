import { distributedRateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser, requireSupabase } from '../../../../lib/online';
import {
  isMomoPendingResult,
  momoAmount,
  momoResultMessage,
  readMomoExtraData,
  verifyMomoResultSignature
} from '../../../../lib/momo';
import { recordPaymentTransaction } from '../../../../lib/payments';

export const runtime = 'nodejs';

function cleanTransactionId(payload) {
  return String(payload?.transId || payload?.orderId || '').trim().slice(0, 160);
}

export async function activateMomoMembership(
  supabase,
  payload,
  expectedUserId = null,
  { verifySignature = true } = {}
) {
  const extra = readMomoExtraData(payload.extraData);
  if (!extra?.userId || !extra?.tier || !extra?.billingCycle) {
    return Response.json({ ok: false, error: 'Missing MoMo membership metadata.' }, { status: 400 });
  }
  if (expectedUserId && extra.userId !== expectedUserId) {
    return Response.json({
      ok: false,
      error: 'Phiên đăng nhập hiện tại không khớp với tài khoản đã tạo giao dịch MoMo. Hãy đăng nhập lại đúng tài khoản; hệ thống vẫn nhận IPN để cập nhật giao dịch cho tài khoản ban đầu.'
    }, { status: 409 });
  }

  const expectedAmount = momoAmount(extra.tier, extra.billingCycle);
  if (!expectedAmount || Number(payload.amount) !== expectedAmount) {
    return Response.json({ ok: false, error: 'MoMo amount does not match the selected membership.' }, { status: 400 });
  }

  if (verifySignature && !verifyMomoResultSignature(payload)) {
    return Response.json({ ok: false, error: 'Invalid MoMo signature.' }, { status: 400 });
  }

  const transactionId = cleanTransactionId(payload);
  if (!transactionId) {
    return Response.json({ ok: false, error: 'Missing MoMo transaction id.' }, { status: 400 });
  }

  const orderId = String(payload.orderId || '').trim().slice(0, 160);
  const { data: existingTransaction } = orderId
    ? await supabase
      .from('payment_transactions')
      .select('status, tier, billing_cycle, user_id')
      .eq('provider', 'momo')
      .eq('provider_event_id', orderId)
      .maybeSingle()
    : { data: null };

  if (existingTransaction?.status === 'completed') {
    return Response.json({
      ok: true,
      idempotent: true,
      tier: existingTransaction.tier,
      billingCycle: existingTransaction.billing_cycle
    });
  }

  if (Number(payload.resultCode) !== 0) {
    const pending = isMomoPendingResult(payload.resultCode);
    await recordPaymentTransaction(supabase, {
      userId: extra.userId,
      provider: 'momo',
      providerTransactionId: transactionId,
      providerEventId: orderId || null,
      status: pending ? 'pending' : 'failed',
      tier: extra.tier,
      billingCycle: extra.billingCycle,
      currency: 'VND',
      amount: payload.amount,
      metadata: {
        orderId: payload.orderId,
        requestId: payload.requestId,
        resultCode: Number(payload.resultCode),
        providerMessage: payload.message || ''
      }
    }).catch(() => null);
    return Response.json({
      ok: false,
      pending,
      final: !pending,
      resultCode: Number(payload.resultCode),
      error: momoResultMessage(payload.resultCode, payload.message)
    }, { status: pending ? 202 : 200 });
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
    providerEventId: orderId || null,
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
  let expectedUserId = null;
  if (request.headers.get('origin')) {
    const context = await requireOnlineUser();
    if (context.error) return context.error;
    expectedUserId = context.user.id;
  }
  return activateMomoMembership(supabase, payload, expectedUserId);
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
