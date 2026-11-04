const DEFAULT_FRONTEND_ORIGINS = [
  'https://chessarena2.vercel.app',
  'https://chess-arena-iho3.vercel.app'
];

function commaSeparated(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function normalizedOrigin(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function configuredOrigins(env) {
  return [
    ...DEFAULT_FRONTEND_ORIGINS,
    ...commaSeparated(env.FRONTEND_URL),
    ...commaSeparated(env.FRONTEND_URLS),
    ...commaSeparated(env.LOCAL_FRONTEND_ORIGINS)
  ]
    .map(normalizedOrigin)
    .filter(Boolean);
}

function isLocalDevelopmentOrigin(url, env) {
  if (env.NODE_ENV === 'production' && env.ALLOW_LOCAL_CORS !== 'true') return false;
  return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
}

export function isAllowedCorsOrigin(origin, env = process.env) {
  const normalized = normalizedOrigin(origin);
  if (!normalized || normalized !== origin) return false;
  if (configuredOrigins(env).includes(normalized)) return true;

  const url = new URL(normalized);
  return isLocalDevelopmentOrigin(url, env);
}

// Origin validation is the CSRF boundary for browser cookie mutations. Preview
// domains must be listed exactly in FRONTEND_URLS; prefixes do not prove ownership.
export function mutationGuard(request, env = process.env) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return null;
  const url = new URL(request.url);
  // These server-to-server endpoints authenticate a provider signature / cron
  // secret in their handlers. No browser-cookie endpoint is exempted.
  if (['/api/paypal/webhook', '/api/internal/maintenance'].includes(url.pathname)
      && !request.headers.get('cookie')) return null;
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null' || (origin !== url.origin && !isAllowedCorsOrigin(origin, env))) {
    return Response.json({ ok: false, code: 'UNTRUSTED_ORIGIN', error: 'Nguồn yêu cầu không được phép.' }, { status: 403 });
  }
  const type = request.headers.get('content-type');
  if (type && type.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return Response.json({ ok: false, error: 'Yêu cầu phải dùng application/json.' }, { status: 415 });
  }
  return null;
}

export function frontendReturnOrigin(origin, env = process.env) {
  const fallback = normalizedOrigin(env.FRONTEND_URL || env.NEXT_PUBLIC_APP_URL)
    || 'http://localhost:5173';
  return isAllowedCorsOrigin(origin, env) ? normalizedOrigin(origin) : fallback;
}

export function corsHeaders(request, env = process.env) {
  const origin = request.headers.get('origin');
  const headers = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-CSRF',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };

  if (origin && isAllowedCorsOrigin(origin, env)) {
    headers['Access-Control-Allow-Origin'] = normalizedOrigin(origin);
  }

  return headers;
}
