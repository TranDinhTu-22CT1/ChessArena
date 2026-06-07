import { getSupabaseAdmin } from './supabaseAdmin';

const buckets = new Map();

function clientKey(request, scope, identity) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip');
  const actor = String(identity || forwardedFor || realIp || 'local').slice(0, 160);
  return `${scope}:${actor}`;
}

export function rateLimit(request, { scope, limit = 60, windowMs = 60_000, identity }) {
  const key = clientKey(request, scope, identity);
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

export async function distributedRateLimit(request, options) {
  const { scope, limit = 60, windowMs = 60_000, identity } = options;
  if (process.env.RATE_LIMIT_BACKEND !== 'supabase') {
    return rateLimit(request, options);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return rateLimit(request, options);

  const key = clientKey(request, scope, identity);
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_ms: windowMs
  });

  if (error) {
    console.error('Distributed rate limit failed; using local fallback.', {
      scope,
      message: error.message
    });
    return rateLimit(request, options);
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (result?.allowed !== false) return null;
  return Response.json(
    { ok: false, error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, Number(result.retry_after) || 1)) }
    }
  );
}
