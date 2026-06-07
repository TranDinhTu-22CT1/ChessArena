import { headers } from 'next/headers';
import { verifyPayPalWebhook } from '../../../../lib/paypal';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { recordPaymentTransaction } from '../../../../lib/payments';

export const runtime = 'nodejs';

const ACTIVE_EVENTS = new Set([
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.RE-ACTIVATED',
  'PAYMENT.SALE.COMPLETED'
]);
const CANCELLED_EVENTS = new Set([
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED'
]);

function resourceSubscriptionId(event) {
  return event?.resource?.id
    || event?.resource?.billing_agreement_id
    || event?.resource?.subscription_id
    || null;
}

function statusFromEvent(eventType) {
  if (ACTIVE_EVENTS.has(eventType)) return 'active';
  if (eventType === 'BILLING.SUBSCRIPTION.SUSPENDED') return 'pending';
  if (eventType === 'BILLING.SUBSCRIPTION.EXPIRED') return 'expired';
  if (CANCELLED_EVENTS.has(eventType)) return 'cancelled';
  return null;
}

export async function POST(request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ ok: false, error: 'Supabase service role is required.' }, { status: 503 });

  const body = await request.text();
  const headerStore = await headers();
  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return Response.json({ ok: false, error: 'Invalid PayPal webhook payload.' }, { status: 400 });
  }

  let verified = false;
  try {
    verified = await verifyPayPalWebhook(headerStore, body, event);
  } catch (error) {
    console.warn('PayPal webhook verification failed:', error.message);
    return Response.json({ ok: false, error: 'PayPal webhook verification failed.' }, { status: 502 });
  }
  if (!verified) return Response.json({ ok: false, error: 'Invalid PayPal webhook signature.' }, { status: 401 });

  const subscriptionId = resourceSubscriptionId(event);
  const status = statusFromEvent(event.event_type);
  if (!subscriptionId || !status) return Response.json({ ok: true, ignored: true });

  const patch = {
    status,
    updated_at: new Date().toISOString()
  };
  if (status === 'cancelled' || status === 'expired') patch.cancelled_at = new Date().toISOString();
  if (status === 'active') patch.cancelled_at = null;

  const { error } = await supabase
    .from('user_memberships')
    .update(patch)
    .eq('provider', 'paypal')
    .eq('provider_subscription_id', subscriptionId);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const { data: membership } = await supabase
    .from('user_memberships')
    .select('user_id, tier, billing_cycle')
    .eq('provider', 'paypal')
    .eq('provider_subscription_id', subscriptionId)
    .maybeSingle();
  const amount = event?.resource?.amount || event?.resource?.billing_info?.last_payment?.amount || {};
  await recordPaymentTransaction(supabase, {
    userId: membership?.user_id,
    provider: 'paypal',
    providerTransactionId: subscriptionId,
    providerEventId: event.id,
    kind: event.event_type === 'PAYMENT.SALE.COMPLETED' ? 'renewal' : 'subscription',
    status: status === 'active' ? 'completed' : status === 'pending' ? 'pending' : 'cancelled',
    tier: membership?.tier,
    billingCycle: membership?.billing_cycle,
    currency: amount.currency_code || amount.currency || 'USD',
    amount: amount.value || amount.total,
    occurredAt: event.create_time,
    metadata: { eventType: event.event_type }
  });
  return Response.json({ ok: true });
}
