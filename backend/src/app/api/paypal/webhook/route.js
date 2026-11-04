import { verifyPayPalWebhook, fetchPayPalSubscription } from '../../../../lib/paypal';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { recordPaymentTransaction } from '../../../../lib/payments';
import { eventSubscriptionId, subscriptionIdentity } from '../../../../lib/membershipPolicy';
import { syncSubscription, processSubscriptionCancellations } from '../../../../lib/membershipService';

export const runtime = 'nodejs';

export async function POST(request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ ok: false }, { status: 503 });
  const body = await request.text();
  let event;
  try { event = JSON.parse(body); }
  catch { return Response.json({ ok: false }, { status: 400 }); }
  try {
    if (!event.id || !(await verifyPayPalWebhook(request.headers, body, event))) return Response.json({ ok: false }, { status: 401 });
    const subscriptionId = eventSubscriptionId(event);
    if (!subscriptionId) return Response.json({ ok: true, ignored: true });
    const previous = await supabase.from('paypal_webhook_events').select('id').eq('id', event.id).maybeSingle();
    if (previous.error) throw previous.error;
    if (previous.data) return Response.json({ ok: true, duplicate: true });
    const subscription = await fetchPayPalSubscription(subscriptionId);
    if (!subscription) throw new Error('Subscription unavailable; retry webhook.');
    const { userId, tier, cycle } = subscriptionIdentity(subscription);
    await syncSubscription(supabase, subscription);
    if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
      const amount = event.resource.amount || {};
      await recordPaymentTransaction(supabase, {
        userId, provider: 'paypal', providerTransactionId: event.resource.id, providerEventId: event.id,
        kind: 'renewal', status: 'completed', tier, billingCycle: cycle,
        amount: amount.total ?? amount.value, currency: amount.currency ?? amount.currency_code,
        occurredAt: event.create_time, metadata: { subscriptionId, eventType: event.event_type }
      });
    }
    await processSubscriptionCancellations(supabase, userId);
    const stored = await supabase.from('paypal_webhook_events').upsert({ id: event.id, event_type: event.event_type, subscription_id: subscriptionId }, { onConflict: 'id' });
    if (stored.error) throw stored.error;
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[paypal webhook]', error.message);
    return Response.json({ ok: false, error: 'Webhook processing pending; retry required.' }, { status: 503 });
  }
}
