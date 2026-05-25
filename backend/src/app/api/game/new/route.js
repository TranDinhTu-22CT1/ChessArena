import { rateLimit } from '../../../../lib/rateLimit';

export function POST(request) {
  const blocked = rateLimit(request, { scope: 'game-new', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  return Response.json({
    id: crypto.randomUUID(),
    initialFen: 'start',
    status: 'created',
    createdAt: new Date().toISOString()
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
