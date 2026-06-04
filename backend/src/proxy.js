import { NextResponse } from 'next/server';

function configuredOrigins() {
  return [process.env.FRONTEND_URL, process.env.FRONTEND_URLS]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

const allowedOrigins = new Set([
  ...configuredOrigins(),
  'https://chessarena2.vercel.app',
  'https://chess-arena-iho3.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

function corsHeaders(request) {
  const origin = request.headers.get('origin');
  const requestedHeaders = request.headers.get('access-control-request-headers');
  const headers = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': requestedHeaders || 'Content-Type, Authorization, X-Admin-CSRF',
    Vary: 'Origin'
  };

  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

export function proxy(request) {
  if (!request.nextUrl.pathname.startsWith('/api/')) return;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request)
    });
  }

  const response = NextResponse.next();
  const headers = corsHeaders(request);
  Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: '/api/:path*'
};
