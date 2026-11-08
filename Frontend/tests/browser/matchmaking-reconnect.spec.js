import { test, expect } from '@playwright/test';
import { Chess } from 'chess.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const GAME = '88888888-8888-4888-8888-888888888888';

test('two clients can cancel a search, match into one game, and restore it after reload', { timeout: 60_000 }, async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const queue = new Map();
  const chess = new Chess();
  const moves = [];
  let active = false;
  let version = 1;
  let updatedAt = new Date().toISOString();
  let cancellations = 0;

  const gameFor = id => ({
    id: GAME,
    status: 'active',
    matchType: 'quick',
    mode: 'rapid',
    rated: true,
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: chess.turn(),
    result: '*',
    timeControl: '600+0',
    playerColor: id === A ? 'w' : 'b',
    moves: [...moves],
    stateVersion: version,
    white: { id: A, name: 'Player A', rating: 800, you: id === A },
    black: { id: B, name: 'Player B', rating: 810, you: id === B },
    startedAt: '2026-09-21T10:00:00.000Z',
    lastMoveAt: updatedAt,
    updatedAt,
    clockSnapshotAt: updatedAt,
    clocks: { w: 600000, b: 600000 },
    openingDeadline: moves.length < 2
      ? { color: chess.turn(), expiresAt: new Date(Date.now() + 20_000).toISOString() }
      : null
  });

  const setup = async (context, id) => {
    const page = await context.newPage();
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/api/online/matchmaking/find') {
        queue.set(id, { ticket: `ticket-${id}`, joinedAt: new Date().toISOString() });
        if (queue.has(A) && queue.has(B)) active = true;
        return route.fulfill({ json: active
          ? { ok: true, status: 'matched', gameId: GAME, game: gameFor(id), onlineCount: 2, queueCount: 0 }
          : { ok: true, status: 'waiting', queueTicketId: `ticket-${id}`, joinedAt: queue.get(id).joinedAt, ratingWindow: 50, onlineCount: 2, queueCount: queue.size } });
      }
      if (path === '/api/online/matchmaking/cancel') {
        cancellations += 1;
        queue.delete(id);
        return route.fulfill({ json: { ok: true, status: 'cancelled', onlineCount: 2, queueCount: queue.size } });
      }
      if (path === '/api/online/heartbeat') {
        if (active) return route.fulfill({ json: { ok: true, me: { id, rating: id === A ? 800 : 810 }, currentGameId: GAME, game: gameFor(id), onlineCount: 2, queueCount: 0 } });
        const waiting = queue.get(id);
        return route.fulfill({ json: { ok: true, me: { id, rating: id === A ? 800 : 810 }, queueTicketId: waiting?.ticket || null, joinedAt: waiting?.joinedAt || null, onlineCount: 2, queueCount: queue.size } });
      }
      if (path === `/api/online/games/${GAME}/events`) {
        const body = `retry: 50\nevent: realtime-status\ndata: ${JSON.stringify({ connected: true })}\n\nevent: game\ndata: ${JSON.stringify({ game: gameFor(id) })}\n\n`;
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body });
      }
      if (path === `/api/online/games/${GAME}/move`) {
        const move = chess.move(request.postDataJSON());
        if (!move) return route.fulfill({ status: 400, json: { ok: false, error: 'Invalid move' } });
        version += 1;
        updatedAt = new Date().toISOString();
        moves.push({ id: `move-${version}`, ply: moves.length + 1, color: move.color, san: move.san, lan: move.lan, from: move.from, to: move.to, promotion: move.promotion || null, fenAfter: chess.fen(), createdAt: updatedAt });
        return route.fulfill({ json: { ok: true, game: gameFor(id) } });
      }
      if (path === `/api/online/games/${GAME}`) return route.fulfill({ json: { ok: true, game: gameFor(id) } });
      if (path === `/api/online/games/${GAME}/chat`) return route.fulfill({ json: { ok: true, messages: [] } });
      if (path === '/api/online/invitations') return route.fulfill({ json: { ok: true, userId: id, invitations: [] } });
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto(`/tests/browser/fixture.html?view=online&user=${id}`);
    return page;
  };

  try {
    const one = await setup(contextA, A);
    const two = await setup(contextB, B);

    await one.getByRole('button', { name: 'Tìm trận', exact: true }).click();
    await expect(one.locator('.search-timer')).toContainText('00:00');
    await expect(one.locator('.search-timer')).toContainText('00:01', { timeout: 3_000 });
    await one.getByRole('button', { name: 'Hủy tìm trận', exact: true }).click();
    await expect(one.getByRole('button', { name: 'Tìm trận', exact: true })).toBeVisible();
    expect(cancellations).toBe(1);
    expect(queue.has(A)).toBe(false);

    await one.getByRole('button', { name: 'Tìm trận', exact: true }).click();
    await two.getByRole('button', { name: 'Tìm trận', exact: true }).click();
    await expect(one.getByRole('region', { name: 'Online chess board' })).toBeVisible({ timeout: 8_000 });
    await expect(two.getByRole('region', { name: 'Online chess board' })).toBeVisible({ timeout: 8_000 });
    await expect(one.locator('.online-opening-deadline')).toContainText('Bạn cần đi nước đầu');
    await expect(two.locator('.online-opening-deadline')).toContainText('Đối thủ cần đi nước đầu');

    // Simulate a server-committed move before the reconnect. Board propagation
    // itself is covered by online-realtime.spec.js with both move directions.
    const committed = chess.move('e4');
    version += 1;
    updatedAt = new Date().toISOString();
    moves.push({ id: `move-${version}`, ply: 1, color: committed.color, san: committed.san, lan: committed.lan, from: committed.from, to: committed.to, promotion: null, fenAfter: chess.fen(), createdAt: updatedAt });

    await one.reload();
    await expect(one.getByRole('region', { name: 'Online chess board' })).toBeVisible({ timeout: 8_000 });
    await expect(one.locator('.online-moves')).toContainText('e4');
    await expect(one.getByRole('region', { name: 'Online chess board' }).getByRole('button', { name: 'e4', exact: true }).locator('img')).toHaveCount(1);
    await expect(one.locator('.online-clock')).toHaveCount(2);
  } finally {
    await Promise.all([contextA.close(), contextB.close()]);
  }
});
