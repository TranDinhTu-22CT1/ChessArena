import { distributedRateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../lib/online';
import { fetchPayPalSubscription } from '../../../../lib/paypal';
import { publicMembership } from '../../../../lib/membershipPolicy';
import { membershipRow, refreshMembership, syncSubscription, cancelSubscription, processSubscriptionCancellations } from '../../../../lib/membershipService';
import { adminMembership } from '../../../../lib/entitlements';

export const runtime = 'nodejs';

async function contextFor(request) {
  const context = await requireOnlineUser();
  if (context.error) return context;
  const error = await distributedRateLimit(request, { scope: 'membership', identity: context.user.id, limit: 40, windowMs: 60_000 });
  return error ? { error } : context;
}
const failure = (error) => Response.json({ ok: false, error: error.message }, { status: error.status || 502 });

export async function GET(request) {
  const context = await contextFor(request);
  if (context.error) return context.error;
  if (context.user.isAdmin) return Response.json({ ok: true, membership: adminMembership() });
  try { return Response.json({ ok: true, membership: await refreshMembership(context.supabase, context.user.id) }); }
  catch (error) { return failure(error); }
}

export async function POST(request) {
  const context = await contextFor(request);
  if (context.error) return context.error;
  if (context.user.isAdmin) return Response.json({ ok: false, error: 'Admin đã có toàn bộ quyền Premium.' }, { status: 409 });
  const payload = await request.json().catch(() => ({}));
  if (!/^I-[A-Z0-9]+$/i.test(payload.subscriptionId || '')) return Response.json({ ok: false, error: 'Mã đăng ký PayPal không hợp lệ.' }, { status: 400 });
  try {
    const subscription = await fetchPayPalSubscription(payload.subscriptionId);
    if (!subscription) throw new Error('Không thể xác minh đăng ký PayPal.');
    await syncSubscription(context.supabase, subscription, context.user.id);
    const cancellations = await processSubscriptionCancellations(context.supabase, context.user.id);
    return Response.json({ ok: true, membership: publicMembership(await membershipRow(context.supabase, context.user.id)), cancellationPending: cancellations.pending > 0 });
  } catch (error) { return failure(error); }
}

// DELETE stops renewal; paid access continues to the stored period boundary.
export async function DELETE(request) {
  const context = await contextFor(request);
  if (context.error) return context.error;
  if (context.user.isAdmin) return Response.json({ ok: false, error: 'Quyền Premium của admin không phải đăng ký thanh toán.' }, { status: 409 });
  try {
    const row = await membershipRow(context.supabase, context.user.id);
    if (!row?.provider_subscription_id || row.provider !== 'paypal') return Response.json({ ok: false, error: 'Bạn không có đăng ký PayPal.' }, { status: 409 });
    await cancelSubscription(context.supabase, row.provider_subscription_id, context.user.id);
    return Response.json({ ok: true, membership: publicMembership(await membershipRow(context.supabase, context.user.id)) });
  } catch (error) { return failure(error); }
}
export function OPTIONS() { return new Response(null, { status: 204 }); }
