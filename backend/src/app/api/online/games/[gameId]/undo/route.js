export const runtime = 'nodejs';

export async function POST() {
  return Response.json(
    { ok: false, error: 'Undo is local move review only and does not alter an online game.' },
    { status: 410 }
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
