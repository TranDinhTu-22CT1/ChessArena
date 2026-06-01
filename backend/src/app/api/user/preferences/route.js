import { cookies } from 'next/headers';
import { verifyFirebaseSession } from '../../../../lib/firebaseAdmin';
import { rateLimit } from '../../../../lib/rateLimit';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { readJsonPayload, sanitizePieceSet, sanitizeTheme } from '../../../../lib/validation';

export const runtime = 'nodejs';

async function currentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('firebase_id_token')?.value;

  if (!token) return null;

  return verifyFirebaseSession(token);
}

async function userDatabaseId(supabase, decoded) {
  const username = String(decoded.email || decoded.uid)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'user';

  const { data: existing, error: lookupError } = await supabase
    .from('users')
    .select('id')
    .eq('firebase_uid', decoded.uid)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing) {
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email: decoded.email ?? null,
        email_verified: Boolean(decoded.email_verified),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;
    return existing.id;
  }

  const { data, error } = await supabase
    .from('users')
    .insert(
      {
        username,
        display_name: decoded.name || decoded.email || username,
        firebase_uid: decoded.uid,
        email: decoded.email ?? null,
        photo_url: decoded.picture ?? null,
        email_verified: Boolean(decoded.email_verified),
        updated_at: new Date().toISOString()
      }
    )
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'preferences-read', limit: 120, windowMs: 60_000 });
  if (blocked) return blocked;

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ ok: true, enabled: false, preferences: null });

  const decoded = await currentUser();
  if (!decoded) return Response.json({ ok: true, enabled: false, preferences: null });

  const userId = await userDatabaseId(supabase, decoded);
  const { data, error } = await supabase
    .from('user_preferences')
    .select('theme')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  return Response.json({ ok: true, enabled: true, preferences: data ?? null });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'preferences-write', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json({ ok: true, enabled: false });

  const decoded = await currentUser();
  if (!decoded) return Response.json({ ok: true, enabled: false });

  const payload = await readJsonPayload(request);
  if (!payload) {
    return Response.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const theme = sanitizeTheme({
    ...(payload?.theme || {}),
    pieceSet: payload?.pieceSet ?? payload?.theme?.pieceSet
  });

  if (!theme) {
    return Response.json({ ok: false, error: 'Invalid theme colors' }, { status: 400 });
  }

  const userId = await userDatabaseId(supabase, decoded);
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        theme,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    );

  if (error) throw error;

  return Response.json({ ok: true, enabled: true, theme: { ...theme, pieceSet: sanitizePieceSet(theme.pieceSet) } });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
