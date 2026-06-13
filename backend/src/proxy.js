import { NextResponse } from 'next/server';
import { corsHeaders } from './lib/cors';

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
