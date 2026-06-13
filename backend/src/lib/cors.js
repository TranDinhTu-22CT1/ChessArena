const DEFAULT_FRONTEND_ORIGINS = [
  'https://chessarena2.vercel.app',
  'https://chess-arena-iho3.vercel.app'
];

const DEFAULT_VERCEL_PREVIEW_PROJECTS = [
  'chessarena2',
  'chess-arena-iho3'
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
    ...commaSeparated(env.FRONTEND_URLS)
  ]
    .map(normalizedOrigin)
    .filter(Boolean);
}

function configuredPreviewProjects(env) {
  return [
    ...DEFAULT_VERCEL_PREVIEW_PROJECTS,
    ...commaSeparated(env.FRONTEND_VERCEL_PROJECTS)
  ]
    .map((value) => value.toLowerCase())
    .filter((value) => /^[a-z0-9-]+$/.test(value));
}

function isLocalDevelopmentOrigin(url, env) {
  if (env.NODE_ENV === 'production' && env.ALLOW_LOCAL_CORS !== 'true') return false;
  return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
}

function isProjectPreviewOrigin(url, env) {
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app')) return false;
  const deployment = url.hostname.slice(0, -'.vercel.app'.length);
  return configuredPreviewProjects(env).some((project) =>
    deployment === project || deployment.startsWith(`${project}-`)
  );
}

export function isAllowedCorsOrigin(origin, env = process.env) {
  const normalized = normalizedOrigin(origin);
  if (!normalized) return false;
  if (configuredOrigins(env).includes(normalized)) return true;

  const url = new URL(normalized);
  return isLocalDevelopmentOrigin(url, env) || isProjectPreviewOrigin(url, env);
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
