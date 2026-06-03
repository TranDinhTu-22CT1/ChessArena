import { rateLimit } from '../../../../lib/rateLimit';
import { requireAdminUser, writeAdminAudit } from '../../../../lib/admin';

export const runtime = 'nodejs';

function cleanText(value, fallback, max = 180) {
  return String(value || fallback).trim().replace(/\s+/g, ' ').slice(0, max) || fallback;
}

function cleanEventPayload(payload) {
  return {
    title: cleanText(payload?.title, 'Seasonal Bot Challenge', 80),
    event_type: cleanText(payload?.eventType || payload?.event_type, 'bot_challenge', 40).toLowerCase(),
    description: cleanText(payload?.description, 'Beat the featured bot during the event window.', 260),
    reward_label: cleanText(payload?.rewardLabel || payload?.reward_label, 'Profile badge', 80),
    starts_at: payload?.startsAt || payload?.starts_at || new Date().toISOString(),
    ends_at: payload?.endsAt || payload?.ends_at || null,
    active: payload?.active !== false,
    config: payload?.config && typeof payload.config === 'object' ? payload.config : {}
  };
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-events', limit: 50, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;

  const { searchParams } = new URL(request.url);
  const limit = Math.max(5, Math.min(100, Number(searchParams.get('limit')) || 10));
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data = [], count = 0, error } = await context.supabase
    .from('site_events')
    .select('*', { count: 'exact' })
    .order('starts_at', { ascending: false })
    .range(from, to);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({
    ok: true,
    events: data,
    page,
    limit,
    total: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit))
  });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'admin-events-create', limit: 20, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const payload = await request.json().catch(() => null);

  const { data, error } = await context.supabase
    .from('site_events')
    .insert(cleanEventPayload(payload))
    .select('*')
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  await writeAdminAudit(context.supabase, context.admin, 'event.create', { eventId: data.id, title: data.title });
  return Response.json({ ok: true, event: data });
}

export async function PATCH(request) {
  const blocked = rateLimit(request, { scope: 'admin-events-update', limit: 35, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const payload = await request.json().catch(() => null);
  const eventId = String(payload?.eventId || '').trim();
  if (!eventId) return Response.json({ ok: false, error: 'Missing event id.' }, { status: 400 });

  const { data, error } = await context.supabase
    .from('site_events')
    .update({ ...cleanEventPayload(payload), updated_at: new Date().toISOString() })
    .eq('id', eventId)
    .select('*')
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  await writeAdminAudit(context.supabase, context.admin, 'event.update', { eventId, title: data.title, active: data.active });
  return Response.json({ ok: true, event: data });
}
