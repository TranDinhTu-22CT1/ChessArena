import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('firebase_id_token');
  return Response.json({ ok: true });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
