import { rateLimit } from '../../../../lib/rateLimit';
import { requireSupabase } from '../../../../lib/online';
import { momoAmount, readMomoExtraData, verifyMomoResultSignature } from '../../../../lib/momo';

export const runtime = 'nodejs';

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
      provider_subscription_id: String(payload.transId || payload.orderId || '').slice(0, 160),
      provider_plan_id: `momo:${extra.tier}:${extra.billingCycle}`,
      started_at: now.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      cancelled_at: null,
      updated_at: now.toISOString()
    }, { onConflict: 'user_id' });

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, tier: extra.tier, billingCycle: extra.billingCycle });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'momo-payment-confirm', limit: 30, windowMs: 60_000 });
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
