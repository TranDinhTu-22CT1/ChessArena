import { rateLimit } from '../../../../../lib/rateLimit';
import { requireSupabase } from '../../../../../lib/online';
import { profilePayload } from '../route';

export const runtime = 'nodejs';

function cleanProfileId(value) {
  return String(value || '').trim().slice(0, 120);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request, { params }) {
  const blocked = rateLimit(request, { scope: 'profile-public-read', limit: 90, windowMs: 60_000 });
  if (blocked) return blocked;

  const { supabase, error } = requireSupabase();
  if (error) return error;

  const { userId } = await params;
  const lookup = cleanProfileId(decodeURIComponent(userId || ''));
  if (!lookup) {
    return Response.json({ ok: false, error: 'Missing profile id.' }, { status: 400 });
  }

  const query = supabase
    .from('users')
    .select('id')
    .maybeSingle();
  const { data: user, error: userError } = await (isUuid(lookup)
    ? query.eq('id', lookup)
    : query.eq('username', lookup));

  if (userError) return Response.json({ ok: false, error: userError.message }, { status: 500 });
  if (!user) return Response.json({ ok: false, error: 'Profile not found.' }, { status: 404 });

  return Response.json({ ok: true, profile: await profilePayload(supabase, user.id) });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
