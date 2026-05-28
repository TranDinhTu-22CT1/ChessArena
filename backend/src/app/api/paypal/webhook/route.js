import { headers } from 'next/headers';
import { verifyPayPalWebhook } from '../../../../lib/paypal';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

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
  const verified = await verifyPayPalWebhook(headerStore, body);
  if (!verified) return Response.json({ ok: false, error: 'Invalid PayPal webhook signature.' }, { status: 401 });

  const event = JSON.parse(body);
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
  return Response.json({ ok: true });
}
