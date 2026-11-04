import { ReadableStream } from 'node:stream/web';
import { TextEncoder } from 'node:util';
import { decorateGameRatings, publicGame, requireOnlineUser } from '../../../../../../lib/online';
import { subscribeOnlineGame } from '../../../../../../lib/onlineEvents';
import { serializedRefresh } from '../../../../../../lib/serializedRefresh';
import { onlineActionError } from '../../../../../../lib/onlineActionResponse';
import { corsHeaders } from '../../../../../../lib/cors';
import { onlineGameState } from '../../../../../../lib/onlineGameState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadPublicGame(supabase, gameId, userId) {
  const { data, error } = await supabase.rpc('online_game_snapshot', { p_game: gameId, p_user: userId })
    .abortSignal(globalThis.AbortSignal.timeout(12_000));
  if (error) throw error;
  if (!data) return null;
  const decorated=await decorateGameRatings(supabase, data.game);
  onlineGameState.remember(decorated,data.moves);
  return publicGame(decorated, data.moves, userId);
}

export async function GET(request, { params }) {
  const context = await requireOnlineUser();
  if (context.error) return context.error;
  const { supabase, user } = context;
  const { gameId } = await params;
  let initialGame;
  try { initialGame = await loadPublicGame(supabase, gameId, user.id); }
  catch (error) { return onlineActionError(error); }
  if (!initialGame) return Response.json({ ok: false, error: 'Game not found.' }, { status: 404 });

  const encoder = new TextEncoder();
  let close = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let active = true;
      let channel;
      let heartbeat;
      let unsubscribe;
      let refresh;
      let realtimeConnected = false;
      close = () => {
        if (!active) return;
        active = false;
        clearInterval(heartbeat);
        refresh?.close();
        unsubscribe?.();
        request.signal.removeEventListener('abort', close);
        if (channel) void supabase.removeChannel(channel).catch(() => {});
        try { controller.close(); } catch { /* The reader may have cancelled already. */ }
      };
      const send = (event, payload) => {
        if (!active) return;
        try {
          controller.enqueue(encoder.encode('event: ' + event + '\ndata: ' + JSON.stringify(payload) + '\n\n'));
        } catch { close(); }
      };
      refresh = serializedRefresh(
        () => loadPublicGame(supabase, gameId, user.id),
        (game) => { send('game', { ok: true, game }); send('realtime-status', { connected: realtimeConnected }); },
        () => send('realtime-status', { connected: false })
      );
      send('game', { ok: true, game: initialGame });
      send('realtime-status', { connected: false });
      const sendChat = (message) => {
        if (!message?.id) return;
        send('chat', { ok: true, message: { ...message, you: message.userId === user.id } });
      };
      const loadAndSendChat = async (id) => {
        const { data } = await supabase
          .from('online_game_chat')
          .select('id, user_id, body, created_at, users:user_id(display_name, photo_url)')
          .eq('id', id)
          .eq('game_id', gameId)
          .maybeSingle();
        if (data) sendChat({
          id: data.id,
          userId: data.user_id,
          name: data.users?.display_name || 'Player',
          photoURL: data.users?.photo_url || null,
          body: data.body,
          createdAt: data.created_at
        });
      };
      unsubscribe = subscribeOnlineGame(gameId, (payload) => {
        if (payload?.type === 'chat') sendChat(payload.message);
        else if (payload?.game?.id === gameId && Array.isArray(payload.moves)) {
          // The move transaction already returned this snapshot. Avoid another
          // database round trip before the opponent can see the committed move.
          const game = publicGame(payload.game, payload.moves, user.id);
          for (const color of ['white', 'black']) {
            if (initialGame[color]?.id === game[color]?.id) {
              for (const key of ['photoURL', 'pieceSet', 'membershipTier']) {
                game[color][key] = initialGame[color][key];
              }
            }
          }
          send('game', { ok: true, game });
        }
        else refresh.schedule();
      });
      channel = supabase.channel('online-game-' + gameId + '-' + user.id + '-' + crypto.randomUUID())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'online_games', filter: 'id=eq.' + gameId }, refresh.schedule)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'online_game_moves', filter: 'game_id=eq.' + gameId }, refresh.schedule)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'online_game_chat', filter: 'game_id=eq.' + gameId }, (payload) => {
          void loadAndSendChat(payload.new?.id);
        })
        .subscribe((status) => {
          realtimeConnected = status === 'SUBSCRIBED';
          send('realtime-status', { connected: realtimeConnected });
          // Close the gap between the initial SELECT and the subscription becoming ready.
          if (realtimeConnected) refresh.schedule();
        });
      heartbeat = setInterval(() => {
        send('ping', { ok: true, ts: Date.now() });
        refresh.schedule();
      }, 15000);
      request.signal.addEventListener('abort', close, { once: true });
      if (request.signal.aborted) close();
    },
    cancel() { close(); }
  });
  return new Response(stream, { headers: {
    ...corsHeaders(request), 'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no'
  } });
}

export function OPTIONS() { return new Response(null, { status: 204 }); }
