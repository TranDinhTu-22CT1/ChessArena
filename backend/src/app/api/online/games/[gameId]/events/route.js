import { ReadableStream } from 'node:stream/web';
import { TextEncoder } from 'node:util';
import { decorateGameRatings, publicGame, requireOnlineUser, touchPresence } from '../../../../../../lib/online';
import { subscribeOnlineGame } from '../../../../../../lib/onlineEvents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function allowedOrigin(request) {
  const requestOrigin = request?.headers.get('origin');
  const configuredOrigins = [process.env.FRONTEND_URL, process.env.FRONTEND_URLS]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const localOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173'
  ];

  if (requestOrigin && [...configuredOrigins, ...localOrigins].includes(requestOrigin)) return requestOrigin;
  return null;
}

function streamHeaders(request) {
  const headers = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin'
  };
  const origin = allowedOrigin(request);
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

async function loadPublicGame(supabase, gameId, userId) {
  const { data: game, error } = await supabase
    .from('online_games')
    .select('*')
    .eq('id', gameId)
    .maybeSingle();

  if (error || !game) return null;
  if (![game.white_user_id, game.black_user_id].includes(userId)) return null;

  const { data: moves = [] } = await supabase
    .from('online_game_moves')
    .select('*')
    .eq('game_id', game.id)
    .order('ply', { ascending: true });

  return publicGame(await decorateGameRatings(supabase, game), moves, userId);
}

export async function GET(request, { params }) {
  const context = await requireOnlineUser();
  if (context.error) return context.error;

  const { supabase, user } = context;
  const { gameId } = await params;
  const initialGame = await loadPublicGame(supabase, gameId, user.id);
  if (!initialGame) {
    return Response.json({ ok: false, error: 'Game not found.' }, { status: 404, headers: streamHeaders(request) });
  }

  await touchPresence(supabase, user, {
    status: initialGame.status === 'active' ? 'playing' : 'online',
    currentGameId: initialGame.status === 'active' ? initialGame.id : null
  });

  const encoder = new TextEncoder();
  let channel;
  let heartbeat;
  let refreshTimer;
  let active = true;
  let unsubscribeLocal;
  let latestGame = initialGame;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event, payload) => {
        if (!active) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      const pushGame = async () => {
        const game = await loadPublicGame(supabase, gameId, user.id);
        if (active && game) {
          latestGame = game;
          send('game', { ok: true, game });
        }
      };

      const pushPublishedGame = async (payload) => {
        if (!payload?.game || !payload?.moves) {
          schedulePush();
          return;
        }
        const game = publicGame(payload.game, payload.moves, user.id);
        latestGame = game;
        send('game', { ok: true, game });
      };

      const pushRealtimeMove = (payload) => {
        const move = payload?.new;
        if (!move || !latestGame || (latestGame.moves?.length || 0) >= move.ply) return;
        const nextMove = {
          ply: move.ply,
          color: move.color,
          san: move.san,
          lan: move.lan,
          from: move.from_square,
          to: move.to_square,
          promotion: move.promotion,
          fenAfter: move.fen_after,
          createdAt: move.created_at
        };
        latestGame = {
          ...latestGame,
          fen: move.fen_after,
          turn: move.color === 'w' ? 'b' : 'w',
          lastMoveAt: move.created_at,
          updatedAt: move.created_at,
          moves: [...(latestGame.moves || []), nextMove]
        };
        send('game', { ok: true, game: latestGame });
      };

      const schedulePush = () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(pushGame, 0);
      };

      send('game', { ok: true, game: initialGame });
      heartbeat = setInterval(() => send('ping', { ok: true, ts: Date.now() }), 15000);
      unsubscribeLocal = subscribeOnlineGame(gameId, pushPublishedGame);

      channel = supabase
        .channel(`online-game-${gameId}-${user.id}-${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'online_games', filter: `id=eq.${gameId}` },
          schedulePush
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'online_game_moves', filter: `game_id=eq.${gameId}` },
          pushRealtimeMove
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') send('realtime-status', { ok: true, connected: true });
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            send('realtime-status', { ok: false, connected: false, status });
          }
        });

      request.signal.addEventListener('abort', () => {
        active = false;
        clearInterval(heartbeat);
        clearTimeout(refreshTimer);
        if (unsubscribeLocal) unsubscribeLocal();
        if (channel) supabase.removeChannel(channel);
        try {
          controller.close();
        } catch {
          // Stream may already be closed by the runtime.
        }
      });
    },
    cancel() {
      active = false;
      clearInterval(heartbeat);
      clearTimeout(refreshTimer);
      if (unsubscribeLocal) unsubscribeLocal();
      if (channel) supabase.removeChannel(channel);
    }
  });

  return new Response(stream, { headers: streamHeaders(request) });
}

export function OPTIONS(request) {
  return new Response(null, { status: 204, headers: streamHeaders(request) });
}
