import { Chess } from 'chess.js';
import { requireOnlineUser } from '../../../../lib/online';
import { distributedRateLimit } from '../../../../lib/rateLimit';

export const runtime = 'nodejs';

function clean(value, limit) {
  return String(value || '').trim().slice(0, limit);
}

function publicOpening(row) {
  return {
    id: row.id,
    color: row.color,
    name: row.name,
    eco: row.eco,
    pgn: row.pgn,
    notes: row.notes,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validatePgn(pgn) {
  if (!pgn) return '';
  const chess = new Chess();
  try {
    chess.loadPgn(pgn, { strict: false });
    return chess.pgn({ maxWidth: 0, newline: '\n' });
  } catch {
    return '';
  }
}

export async function GET(request) {
  const blocked = await distributedRateLimit(request, { scope: 'opening-repertoire-read', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const { data = [], error } = await context.supabase
    .from('opening_repertoire')
    .select('*')
    .eq('user_id', context.user.id)
    .order('updated_at', { ascending: false });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, openings: data.map(publicOpening) });
}

export async function POST(request) {
  const blocked = await distributedRateLimit(request, { scope: 'opening-repertoire-write', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const payload = await request.json().catch(() => ({}));
  const pgn = validatePgn(clean(payload.pgn, 100_000));
  if (!pgn) return Response.json({ ok: false, error: 'PGN không hợp lệ.' }, { status: 400 });
  const color = payload.color === 'b' ? 'b' : 'w';
  const { data, error } = await context.supabase.from('opening_repertoire').insert({
    user_id: context.user.id,
    color,
    name: clean(payload.name, 120) || `Khai cuộc ${color === 'w' ? 'Trắng' : 'Đen'}`,
    eco: clean(payload.eco, 12) || null,
    pgn,
    notes: clean(payload.notes, 4000),
    source: payload.source === 'game' ? 'game' : 'import'
  }).select('*').single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, opening: publicOpening(data) });
}

export async function DELETE(request) {
  const blocked = await distributedRateLimit(request, { scope: 'opening-repertoire-delete', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const id = new URL(request.url).searchParams.get('id') || '';
  const { error } = await context.supabase.from('opening_repertoire').delete().eq('id', id).eq('user_id', context.user.id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
