import crypto from 'node:crypto';
import { frontendReturnOrigin } from './cors.js';

const MOMO_TEST_ENDPOINT = 'https://test-payment.momo.vn/v2/gateway/api/create';
const MOMO_LIVE_ENDPOINT = 'https://payment.momo.vn/v2/gateway/api/create';
const MOMO_TEST_QUERY_ENDPOINT = 'https://test-payment.momo.vn/v2/gateway/api/query';
const MOMO_LIVE_QUERY_ENDPOINT = 'https://payment.momo.vn/v2/gateway/api/query';

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
    endpoint: process.env.MOMO_ENV === 'live' ? MOMO_LIVE_ENDPOINT : MOMO_TEST_ENDPOINT,
    queryEndpoint: process.env.MOMO_ENV === 'live' ? MOMO_LIVE_QUERY_ENDPOINT : MOMO_TEST_QUERY_ENDPOINT
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

const MOMO_PENDING_CODES = new Set([1000, 7000, 7002, 9000]);

export function isMomoPendingResult(resultCode) {
  return MOMO_PENDING_CODES.has(Number(resultCode));
}

export function momoResultMessage(resultCode, providerMessage = '') {
  const code = Number(resultCode);
  const messages = {
    0: 'Thanh toán MoMo thành công.',
    10: 'Hệ thống MoMo đang bảo trì. Vui lòng thử lại sau.',
    11: 'Cấu hình merchant MoMo chưa được cấp quyền cho phương thức này.',
    13: 'MoMo không xác thực được thông tin merchant. Vui lòng kiểm tra access key, secret key và partner code.',
    20: 'Yêu cầu thanh toán MoMo không đúng định dạng.',
    21: 'Số tiền giao dịch MoMo không hợp lệ.',
    22: 'Số tiền nằm ngoài giới hạn của phương thức thanh toán đã chọn.',
    40: 'Mã yêu cầu MoMo đã được sử dụng. Vui lòng tạo giao dịch mới.',
    41: 'Mã đơn hàng MoMo đã tồn tại. Vui lòng tạo giao dịch mới.',
    98: 'MoMo không tạo được mã QR. Vui lòng thử lại.',
    99: 'MoMo trả về lỗi chưa xác định. Vui lòng thử lại sau.',
    1000: 'Giao dịch đang chờ bạn xác nhận trên MoMo.',
    1001: 'Tài khoản hoặc thẻ không đủ số dư.',
    1002: 'Nhà phát hành phương thức thanh toán đã từ chối giao dịch. Nếu đang dùng sandbox, hãy chọn thanh toán thẻ ATM nội địa và nhập đúng bộ thẻ thử của MoMo; nếu vẫn bị từ chối, tạo giao dịch mới hoặc chọn Ví MoMo Test.',
    1003: 'Giao dịch đã được xác thực nhưng bị hủy do hết thời gian xử lý.',
    1004: 'Giao dịch vượt hạn mức ngày hoặc tháng của phương thức thanh toán.',
    1005: 'Liên kết hoặc mã QR đã hết hạn. Vui lòng tạo giao dịch mới.',
    1006: 'Bạn đã hủy hoặc từ chối xác nhận giao dịch.',
    1007: 'Tài khoản thanh toán không hoạt động hoặc không tồn tại.',
    1017: 'Giao dịch đã bị hủy.',
    4001: 'Tài khoản MoMo đang bị hạn chế.',
    4002: 'Tài khoản MoMo chưa hoàn tất xác thực theo yêu cầu.',
    4100: 'Đăng nhập MoMo không thành công.',
    7000: 'Giao dịch đang được MoMo xử lý.',
    7002: 'Giao dịch đang được nhà cung cấp phương thức thanh toán xử lý.',
    9000: 'Giao dịch đã được xác thực và đang chờ hoàn tất.'
  };
  return messages[code] || String(providerMessage || '').trim() || `MoMo từ chối giao dịch với mã ${Number.isFinite(code) ? code : 'không xác định'}.`;
}

export function momoReturnOrigin(origin, env = process.env) {
  return frontendReturnOrigin(origin, env);
}

export function momoRequestType() {
  return 'payWithATM';
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

  const requestType = momoRequestType();
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

export async function queryMomoPayment(orderId, lang = 'vi') {
  const config = momoConfig();
  const requestId = `QUERY${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const rawSignature = [
    `accessKey=${config.accessKey}`,
    `orderId=${orderId}`,
    `partnerCode=${config.partnerCode}`,
    `requestId=${requestId}`
  ].join('&');
  const signature = sign(rawSignature, config.secretKey);
  const response = await fetch(config.queryEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partnerCode: config.partnerCode,
      requestId,
      orderId,
      lang,
      signature
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `MoMo status query failed with HTTP ${response.status}.`);
  }
  return data;
}
