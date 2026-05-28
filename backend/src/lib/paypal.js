const PAYPAL_API_BASE = process.env.PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

let tokenCache = null;

export function paypalBaseUrl() {
  return PAYPAL_API_BASE;
}

export async function paypalAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new Error('Missing PayPal server credentials.');

  const credentials = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.error || `PayPal token request failed (${response.status}).`);
  }
  if (!data.access_token) throw new Error('PayPal token is empty.');

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 300) * 1000
  };
  return tokenCache.token;
}

export async function fetchPayPalSubscription(subscriptionId) {
  const token = await paypalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  if (!response.ok) return null;
  return response.json();
}

export async function createPayPalSubscription({ planId, customId, returnUrl, cancelUrl }) {
  const token = await paypalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: customId,
      application_context: {
        brand_name: 'ChessArena',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const debugId = response.headers.get('paypal-debug-id');
    const issue = data.details?.map((detail) => [detail.issue, detail.description].filter(Boolean).join(': ')).filter(Boolean).join('; ');
    const detail = issue || data.message || data.name || 'PayPal subscription create failed.';
    const suffix = debugId ? ` PayPal-Debug-Id: ${debugId}.` : '';
    throw new Error(`${detail}${suffix}`);
  }
  return data;
}

export async function fetchPayPalPlan(planId) {
  const token = await paypalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans/${encodeURIComponent(planId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const debugId = response.headers.get('paypal-debug-id');
    const message = data.message || data.name || `PayPal plan request failed (${response.status}).`;
    throw new Error(debugId ? `${message} PayPal-Debug-Id: ${debugId}.` : message);
  }
  return data;
}

export async function verifyPayPalWebhook(headers, body) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error('Missing PAYPAL_WEBHOOK_ID.');

  const token = await paypalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      auth_algo: headers.get('paypal-auth-algo'),
      cert_url: headers.get('paypal-cert-url'),
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: JSON.parse(body)
    })
  });

  if (!response.ok) throw new Error('PayPal webhook verification request failed.');
  const data = await response.json();
  return data.verification_status === 'SUCCESS';
}
