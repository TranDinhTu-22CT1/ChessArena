import crypto from 'node:crypto';

const MOMO_TEST_ENDPOINT = 'https://test-payment.momo.vn/v2/gateway/api/create';
const MOMO_LIVE_ENDPOINT = 'https://payment.momo.vn/v2/gateway/api/create';

export const MOMO_AMOUNTS = {
  plus: { monthly: 125000, yearly: 1250000 },
  pro: { monthly: 250000, yearly: 2500000 },
  master: { monthly: 500000, yearly: 5000000 }
};

function momoConfig() {
  return {
    accessKey: process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85',
    secretKey: process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz',
    partnerCode: process.env.MOMO_PARTNER_CODE || 'MOMO',
    partnerName: process.env.MOMO_PARTNER_NAME || 'ChessArena',
    storeId: process.env.MOMO_STORE_ID || 'ChessArenaStore',
    endpoint: process.env.MOMO_ENV === 'live' ? MOMO_LIVE_ENDPOINT : MOMO_TEST_ENDPOINT
  };
}

function sign(rawSignature, secretKey) {
  return crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
}

export function momoAmount(tier, billingCycle) {
  return MOMO_AMOUNTS[tier]?.[billingCycle] || 0;
}

export function momoExtraData(data) {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
}

export function readMomoExtraData(value) {
  try {
    return JSON.parse(Buffer.from(String(value || ''), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export function createMomoSignature(fields) {
  const { accessKey, secretKey } = momoConfig();
  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${fields.amount}`,
    `extraData=${fields.extraData}`,
    `ipnUrl=${fields.ipnUrl}`,
    `orderId=${fields.orderId}`,
    `orderInfo=${fields.orderInfo}`,
    `partnerCode=${fields.partnerCode}`,
    `redirectUrl=${fields.redirectUrl}`,
    `requestId=${fields.requestId}`,
    `requestType=${fields.requestType}`
  ].join('&');
  return sign(rawSignature, secretKey);
}

export function verifyMomoResultSignature(fields) {
  const { accessKey, secretKey } = momoConfig();
  if (!fields?.signature || !secretKey) return false;
  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${fields.amount ?? ''}`,
    `extraData=${fields.extraData ?? ''}`,
    `message=${fields.message ?? ''}`,
    `orderId=${fields.orderId ?? ''}`,
    `orderInfo=${fields.orderInfo ?? ''}`,
    `orderType=${fields.orderType ?? ''}`,
    `partnerCode=${fields.partnerCode ?? ''}`,
    `payType=${fields.payType ?? ''}`,
    `requestId=${fields.requestId ?? ''}`,
    `responseTime=${fields.responseTime ?? ''}`,
    `resultCode=${fields.resultCode ?? ''}`,
    `transId=${fields.transId ?? ''}`
  ].join('&');
  return sign(rawSignature, secretKey) === String(fields.signature);
}

export async function createMomoPayment({
  amount,
  orderId,
  requestId,
  orderInfo,
  redirectUrl,
  ipnUrl,
  extraData,
  lang = 'vi'
}) {
  const config = momoConfig();
  if (!config.accessKey || !config.secretKey || !config.partnerCode) {
    throw new Error('Missing MoMo server credentials. Add MOMO_ACCESS_KEY, MOMO_SECRET_KEY and MOMO_PARTNER_CODE.');
  }

  const requestType = 'payWithMethod';
  const body = {
    partnerCode: config.partnerCode,
    partnerName: config.partnerName,
    storeId: config.storeId,
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    lang,
    requestType,
    autoCapture: true,
    extraData,
    orderGroupId: ''
  };

  body.signature = createMomoSignature({ ...body, requestType });

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.resultCode !== 0) {
    throw new Error(data.message || `MoMo payment create failed with HTTP ${response.status}.`);
  }
  return data;
}
