import { rateLimit } from '../../../lib/rateLimit';
import { requireOnlineUser } from '../../../lib/online';
import { createUserNotification } from '../../../lib/notifications';
import { readJsonPayload, safeArray } from '../../../lib/validation';

export const runtime = 'nodejs';

const ACTIVE_WINDOW_MS = 45_000;
const VALID_RESPONSES = new Set(['accepted', 'declined']);

function cleanUuid(value) {
  const id = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : '';
}

function relationStatus(row, userId) {
  if (!row) return 'none';
  if (row.status === 'accepted') return 'friends';
  if (row.status === 'blocked') return 'blocked';
  if (row.status === 'pending') return row.requester_id === userId ? 'outgoing' : 'incoming';
  return row.status || 'none';
}

function publicUser(profile, presence = null) {
  const lastSeen = presence?.last_seen || null;
  const online = lastSeen ? Date.parse(lastSeen) >= Date.now() - ACTIVE_WINDOW_MS : false;
  return {
    id: profile?.id,
    username: profile?.username || 'player',
    displayName: profile?.display_name || profile?.username || 'Player',
    photoURL: profile?.photo_url || null,
    presence: {
      online,
      status: online ? presence?.status || 'online' : 'offline',
      currentGameId: online ? presence?.current_game_id || null : null,
      lastSeen
    }
  };
}

async function loadFriendRows(supabase, userId) {
  const { data, error } = await supabase
    .from('user_friendships')
    .select('*')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return safeArray(data);
}

async function decorateFriendRows(supabase, rows, userId) {
  const userIds = [...new Set(rows.flatMap((row) => [row.requester_id, row.receiver_id]).filter((id) => id && id !== userId))];
  if (userIds.length === 0) {
    return { friends: [], incoming: [], outgoing: [], blocked: [] };
  }

  const [{ data: profiles = [] }, { data: presences = [] }] = await Promise.all([
    supabase
      .from('users')
      .select('id, username, display_name, photo_url')
      .in('id', userIds),
    supabase
      .from('online_presence')
      .select('user_id, status, current_game_id, last_seen')
      .in('user_id', userIds)
  ]);
  const profileById = new Map(safeArray(profiles).map((profile) => [profile.id, profile]));
  const presenceById = new Map(safeArray(presences).map((presence) => [presence.user_id, presence]));
  const payload = { friends: [], incoming: [], outgoing: [], blocked: [] };

  for (const row of rows) {
    const otherId = row.requester_id === userId ? row.receiver_id : row.requester_id;
    const other = publicUser(profileById.get(otherId), presenceById.get(otherId));
    const item = {
      id: row.id,
      status: relationStatus(row, userId),
      requestedByYou: row.requester_id === userId,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      user: other
    };

    if (row.status === 'accepted') payload.friends.push(item);
    else if (row.status === 'pending' && row.receiver_id === userId) payload.incoming.push(item);
    else if (row.status === 'pending' && row.requester_id === userId) payload.outgoing.push(item);
    else if (row.status === 'blocked') payload.blocked.push(item);
  }

  return payload;
}

async function existingRelation(supabase, userId, targetUserId) {
  const forward = await supabase
    .from('user_friendships')
    .select('*')
    .eq('requester_id', userId)
    .eq('receiver_id', targetUserId)
    .maybeSingle();
  if (forward.data || forward.error) return forward;

  return supabase
    .from('user_friendships')
    .select('*')
    .eq('requester_id', targetUserId)
    .eq('receiver_id', userId)
    .maybeSingle();
}

export async function GET(request) {
  const blocked = rateLimit(request, { scope: 'friends-read', limit: 80, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  try {
    const rows = await loadFriendRows(context.supabase, context.user.id);
    const lists = await decorateFriendRows(context.supabase, rows, context.user.id);
    return Response.json({
      ok: true,
      ...lists,
      counts: {
        friends: lists.friends.length,
        incoming: lists.incoming.length,
        outgoing: lists.outgoing.length
      }
    });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Could not load friends.' }, { status: 500 });
  }
}

export async function POST(request) {
  const blocked = rateLimit(request, { scope: 'friends-write', limit: 60, windowMs: 60_000 });
  if (blocked) return blocked;

  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const payload = await readJsonPayload(request);
  if (!payload) return Response.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 });

  const { supabase, user } = context;
  const action = String(payload.action || '').trim();
  const targetUserId = cleanUuid(payload.userId || payload.targetUserId);
  const friendshipId = cleanUuid(payload.friendshipId);
  const now = new Date().toISOString();

  try {
    if (action === 'request') {
      if (!targetUserId) return Response.json({ ok: false, error: 'Missing target user.' }, { status: 400 });
      if (targetUserId === user.id) return Response.json({ ok: false, error: 'You cannot add yourself.' }, { status: 400 });

      const { data: target } = await supabase
        .from('users')
        .select('id')
        .eq('id', targetUserId)
        .maybeSingle();
      if (!target) return Response.json({ ok: false, error: 'Player not found.' }, { status: 404 });

      const current = await existingRelation(supabase, user.id, targetUserId);
      if (current.error) return Response.json({ ok: false, error: current.error.message }, { status: 500 });
      if (current.data?.status === 'accepted') return Response.json({ ok: true, status: 'friends' });
      if (current.data?.status === 'pending') return Response.json({ ok: true, status: relationStatus(current.data, user.id) });
      if (current.data?.status === 'blocked') return Response.json({ ok: false, error: 'This relationship is blocked.' }, { status: 403 });

      const write = current.data
        ? supabase
          .from('user_friendships')
          .update({ requester_id: user.id, receiver_id: targetUserId, status: 'pending', updated_at: now })
          .eq('id', current.data.id)
          .select('*')
          .single()
        : supabase
          .from('user_friendships')
          .insert({ requester_id: user.id, receiver_id: targetUserId, status: 'pending' })
          .select('*')
          .single();
      const { data, error } = await write;
      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      await createUserNotification(supabase, {
        recipientUserId: targetUserId,
        type: 'friend_request',
        title: 'Lời mời kết bạn mới',
        body: `${user.displayName || user.username} muốn kết bạn với bạn.`,
        actionUrl: '/friends',
        metadata: { friendshipId: data.id, requesterId: user.id }
      });
      return Response.json({ ok: true, status: relationStatus(data, user.id), friendship: data });
    }

    if (action === 'respond') {
      const response = String(payload.response || '').trim();
      if (!friendshipId || !VALID_RESPONSES.has(response)) {
        return Response.json({ ok: false, error: 'Invalid friend response.' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('user_friendships')
        .update({ status: response, updated_at: now })
        .eq('id', friendshipId)
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle();
      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      if (!data) return Response.json({ ok: false, error: 'Friend request not found.' }, { status: 404 });
      await createUserNotification(supabase, {
        recipientUserId: data.requester_id,
        type: response === 'accepted' ? 'friend_accepted' : 'friend_declined',
        title: response === 'accepted' ? 'Lời mời kết bạn đã được chấp nhận' : 'Lời mời kết bạn đã bị từ chối',
        body: `${user.displayName || user.username} đã ${response === 'accepted' ? 'chấp nhận' : 'từ chối'} lời mời kết bạn.`,
        actionUrl: '/friends',
        metadata: { friendshipId: data.id, receiverId: user.id, response }
      });
      return Response.json({ ok: true, status: relationStatus(data, user.id), friendship: data });
    }

    if (action === 'remove') {
      if (!friendshipId && !targetUserId) {
        return Response.json({ ok: false, error: 'Missing friendship.' }, { status: 400 });
      }

      let relationId = friendshipId;
      if (!relationId) {
        const current = await existingRelation(supabase, user.id, targetUserId);
        if (current.error) return Response.json({ ok: false, error: current.error.message }, { status: 500 });
        relationId = current.data?.id || '';
      }

      if (!relationId) return Response.json({ ok: true, status: 'removed' });

      const { error } = await supabase
        .from('user_friendships')
        .delete()
        .eq('id', relationId)
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);
      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      return Response.json({ ok: true, status: 'removed' });
    }

    return Response.json({ ok: false, error: 'Unsupported friend action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Could not update friends.' }, { status: 500 });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
