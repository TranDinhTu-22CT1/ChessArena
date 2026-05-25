const buckets = new Map();

function clientKey(request, scope) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip');
  return `${scope}:${forwardedFor || realIp || 'local'}`;
}

export function rateLimit(request, { scope, limit = 60, windowMs = 60_000 }) {
  const key = clientKey(request, scope);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;

  if (bucket.count <= limit) {
    return null;
  }

  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
  return Response.json(
    { ok: false, error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) }
    }
  );
}
