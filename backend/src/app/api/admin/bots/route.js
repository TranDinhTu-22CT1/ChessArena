import { rateLimit } from '../../../../lib/rateLimit';
import { requireAdminCsrf, requireAdminPermission, requireAdminUser, writeAdminAudit } from '../../../../lib/admin';
import { uploadDataAsset } from '../../../../lib/storage';

export const runtime = 'nodejs';

function cleanText(value, fallback, max = 160) {
  return String(value || fallback).trim().replace(/\s+/g, ' ').slice(0, max) || fallback;
}

function batchTag() {
  return `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanAvatarImage(value) {
  const input = String(value || '').trim();
  if (!input) return '/chessarena-mark.svg';
  if (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\r\n]+$/i.test(input)) {
    return input.length <= 160_000 ? input : '/chessarena-mark.svg';
  }
  return cleanText(input, '/chessarena-mark.svg', 500);
}

async function cleanBotPayload(payload, ownerUserId = null) {
  let avatarUrl = cleanAvatarImage(payload?.avatarUrl || payload?.avatar_url);
  if (avatarUrl.startsWith('data:image/')) {
    const asset = await uploadDataAsset({
      ownerUserId,
      dataUrl: avatarUrl,
      mimeType: avatarUrl.slice(5, avatarUrl.indexOf(';')),
      originalName: `${payload?.name || 'bot'}-avatar.webp`,
      purpose: 'bot-avatars',
      maxBytes: 2 * 1024 * 1024
    });
    avatarUrl = asset.url;
  }
  return {
    name: cleanText(payload?.name, 'Event Bot', 48),
    elo: Math.max(250, Math.min(3200, Number(payload?.elo) || 1200)),
    mood: cleanText(payload?.mood, 'Custom admin bot', 120),
    chat: cleanText(payload?.chat, 'Ready for a themed game.', 220),
    avatar_url: avatarUrl,
    event_tag: cleanText(payload?.eventTag || payload?.event_tag, 'seasonal', 40).toLowerCase(),
    active: payload?.active !== false,
    sort_order: Math.max(0, Math.min(999, Number(payload?.sortOrder || payload?.sort_order) || 50)),
    starts_at: payload?.startsAt || payload?.starts_at || null,
    ends_at: payload?.endsAt || payload?.ends_at || null
  };
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'admin-bots', limit: 50, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'content:manage');
  if (permissionError) return permissionError;

  const { searchParams } = new URL(request.url);
  const limit = Math.max(5, Math.min(100, Number(searchParams.get('limit')) || 10));
  const page = Math.max(1, Math.floor(Number(searchParams.get('page')) || 1));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data = [], count = 0, error } = await context.supabase
    .from('bot_personas')
    .select('*', { count: 'exact' })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({
    ok: true,
    bots: data,
    page,
    limit,
    total: count || 0,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit))
  });
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'admin-bots-create', limit: 25, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'content:manage');
  if (permissionError) return permissionError;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;
  const payload = await request.json().catch(() => null);
  const rawBots = Array.isArray(payload?.bots) ? payload.bots.slice(0, 5) : null;

  if (rawBots) {
    if (rawBots.length !== 5) {
      return Response.json({ ok: false, error: 'Bot batch must contain exactly 5 bots.' }, { status: 400 });
    }
    const sharedEventTag = cleanText(payload?.eventTag || payload?.event_tag, batchTag(), 40).toLowerCase();
    const rows = await Promise.all(rawBots.map((bot, index) => cleanBotPayload({
      ...bot,
      eventTag: sharedEventTag,
      sortOrder: bot?.sortOrder ?? bot?.sort_order ?? 50 + index
    }, context.admin?.id || null)));
    const { data, error } = await context.supabase
      .from('bot_personas')
      .insert(rows)
      .select('*');

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    await writeAdminAudit(context.supabase, context.admin, 'bot.batch_create', {
      count: data.length,
      names: data.map((bot) => bot.name)
    });
    return Response.json({ ok: true, bots: data });
  }

  const { data, error } = await context.supabase
    .from('bot_personas')
    .insert(await cleanBotPayload(payload, context.admin?.id || null))
    .select('*')
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  await writeAdminAudit(context.supabase, context.admin, 'bot.create', { botId: data.id, name: data.name, elo: data.elo });
  return Response.json({ ok: true, bot: data });
}

export async function PATCH(request) {
  const blocked = rateLimit(request, { scope: 'admin-bots-update', limit: 40, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'content:manage');
  if (permissionError) return permissionError;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;
  const payload = await request.json().catch(() => null);
  const botId = String(payload?.botId || '').trim();
  if (!botId) return Response.json({ ok: false, error: 'Missing bot id.' }, { status: 400 });

  const { data, error } = await context.supabase
    .from('bot_personas')
    .update({ ...(await cleanBotPayload(payload, context.admin?.id || null)), updated_at: new Date().toISOString() })
    .eq('id', botId)
    .select('*')
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  await writeAdminAudit(context.supabase, context.admin, 'bot.update', { botId, name: data.name, active: data.active });
  return Response.json({ ok: true, bot: data });
}

export async function DELETE(request) {
  const blocked = rateLimit(request, { scope: 'admin-bots-delete', limit: 30, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireAdminUser();
  if (context.error) return context.error;
  const permissionError = requireAdminPermission(context, 'content:manage');
  if (permissionError) return permissionError;
  const csrfError = await requireAdminCsrf(request, context);
  if (csrfError) return csrfError;

  const payload = await request.json().catch(() => null);
  const botId = String(payload?.botId || '').trim();
  const eventTag = String(payload?.eventTag || payload?.event_tag || '').trim().toLowerCase();

  if (!botId && !eventTag) {
    return Response.json({ ok: false, error: 'Missing bot id or event tag.' }, { status: 400 });
  }

  const query = context.supabase.from('bot_personas').delete();
  const { data = [], error } = botId
    ? await query.eq('id', botId).select('id, name, event_tag')
    : await query.eq('event_tag', eventTag).select('id, name, event_tag');

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  await writeAdminAudit(context.supabase, context.admin, botId ? 'bot.delete' : 'bot.batch_delete', {
    botId: botId || undefined,
    eventTag: eventTag || undefined,
    count: data.length,
    names: data.map((bot) => bot.name)
  });

  return Response.json({ ok: true, deleted: data.length, bots: data });
}
