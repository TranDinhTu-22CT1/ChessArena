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
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

function corsHeaders(request) {
  const origin = request.headers.get('origin');
  const headers = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
