import { rateLimit } from '../../../../lib/rateLimit';
import { requireOnlineUser } from '../../../../lib/online';
import {
  createMomoPayment,
  momoAmount,
  momoExtraData,
  momoRequestType,
  momoReturnOrigin
} from '../../../../lib/momo';
import { recordPaymentTransaction } from '../../../../lib/payments';

export const runtime = 'nodejs';

const TIERS = new Set(['plus', 'pro', 'master']);
const CYCLES = new Set(['monthly', 'yearly']);

function backendUrl(request) {
  return String(process.env.BACKEND_PUBLIC_URL || new URL(request.url).origin).replace(/\/+$/, '');
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'momo-payment-create', limit: 12, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await request.json().catch(() => ({}));
  const tier = TIERS.has(payload?.tier) ? payload.tier : '';
  const billingCycle = CYCLES.has(payload?.billingCycle) ? payload.billingCycle : '';
  const paymentMethod = 'atm';
  const requestType = momoRequestType();
  const amount = momoAmount(tier, billingCycle);
  if (!tier || !billingCycle || !amount) {
    return Response.json({ ok: false, error: 'MoMo package does not match the selected membership.' }, { status: 400 });
  }

  const baseUrl = momoReturnOrigin(request.headers.get('origin'));
  const apiBaseUrl = backendUrl(request);
  const orderId = `CA${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const requestId = orderId;
  const extraData = momoExtraData({
    userId: context.user.id,
    tier,
    billingCycle,
    paymentMethod,
    returnOrigin: baseUrl
  });
  const orderInfo = `ATM ChessArena ${tier} ${billingCycle}`;

  try {
    const payment = await createMomoPayment({
      amount,
      orderId,
      requestId,
      orderInfo,
      redirectUrl: `${baseUrl}/membership?momo=return`,
      ipnUrl: `${apiBaseUrl}/api/momo/confirm`,
      extraData
    });
    await recordPaymentTransaction(context.supabase, {
      userId: context.user.id,
      provider: 'momo',
      providerEventId: orderId,
      status: 'pending',
      tier,
      billingCycle,
      currency: 'VND',
      amount,
      metadata: {
        orderId,
        requestId,
        paymentMethod,
        requestType,
        returnOrigin: baseUrl,
        environment: process.env.MOMO_ENV === 'live' ? 'live' : 'sandbox'
      }
    });
    return Response.json({
      ok: true,
      orderId,
      requestId,
      amount,
      paymentMethod,
      requestType,
      payUrl: payment.payUrl,
      deeplink: payment.deeplink || '',
      qrCodeUrl: payment.qrCodeUrl || ''
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'MoMo payment could not be created.' }, { status: 502 });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
