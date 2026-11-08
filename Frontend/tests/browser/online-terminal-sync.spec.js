import { test, expect } from '@playwright/test';
import { Chess } from 'chess.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const GAME = '77777777-7777-4777-8777-777777777777';

function createGameHarness() {
  let status = 'active';
  let result = '*';
  let version = 1;
  let updatedAt = new Date().toISOString();
  let resignCalls = 0;
  let queueJoins = 0;
  const searching = new Set();

  const gameFor = id => ({
    id: GAME,
    status,
    matchType: 'friend',
    mode: 'rapid',
    rated: false,
    fen: new Chess().fen(),
    pgn: '',
    turn: 'w',
    result,
    timeControl: '600+0',
    playerColor: id === A ? 'w' : 'b',
    moves: [],
    stateVersion: version,
    white: { id: A, name: 'Player A', rating: 800, you: id === A },
    black: { id: B, name: 'Player B', rating: 810, you: id === B },
    startedAt: '2026-09-21T10:00:00.000Z',
    lastMoveAt: updatedAt,
    updatedAt,
    clockSnapshotAt: updatedAt,
    clocks: { w: 600000, b: 600000 }
  });

  const setup = async (context, id) => {
    const page = await context.newPage();
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === `/api/online/games/${GAME}/events`) {
        const body = `retry: 40\nevent: realtime-status\ndata: ${JSON.stringify({ connected: true })}\n\nevent: game\ndata: ${JSON.stringify({ game: gameFor(id) })}\n\n`;
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body });
      }
      if (path === `/api/online/games/${GAME}/resign`) {
        if (status === 'active') {
          resignCalls += 1;
          status = 'resigned';
          result = id === A ? '0-1' : '1-0';
          version += 1;
          updatedAt = new Date().toISOString();
        }
        return route.fulfill({ json: { ok: true, game: gameFor(id) } });
      }
      if (path === `/api/online/games/${GAME}`) return route.fulfill({ json: { ok: true, game: gameFor(id) } });
      if (path === `/api/online/games/${GAME}/chat`) return route.fulfill({ json: { ok: true, messages: [] } });
      if (path === '/api/online/heartbeat') {
        const requestedGame = request.postDataJSON()?.gameId;
        const shouldReturnGame = status === 'active' || requestedGame === GAME;
        return route.fulfill({ json: { ok: true, me: { id, rating: id === A ? 800 : 810 }, currentGameId: status === 'active' ? GAME : null, game: shouldReturnGame ? gameFor(id) : null, queueTicketId: searching.has(id) ? `ticket-${id}` : null, joinedAt: searching.has(id) ? updatedAt : null, onlineCount: 2, queueCount: searching.size } });
      }
      if (path === '/api/online/matchmaking/find') {
        queueJoins += 1;
        searching.add(id);
        return route.fulfill({ json: { ok: true, status: 'waiting', queueTicketId: `ticket-${id}`, joinedAt: new Date().toISOString(), ratingWindow: 50, onlineCount: 2, queueCount: queueJoins } });
      }
      if (path === '/api/online/invitations') return route.fulfill({ json: { ok: true, userId: id, invitations: [] } });
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto(`/tests/browser/fixture.html?view=online&user=${id}&game=${GAME}`);
    await expect(page.getByRole('region', { name: 'Online chess board' })).toBeVisible();
    return page;
  };

  return {
    setup,
    abort() {
      status = 'abandoned';
      result = '*';
      version += 1;
      updatedAt = new Date().toISOString();
    },
    get resignCalls() { return resignCalls; },
    get queueJoins() { return queueJoins; }
  };
}

test('resign requires confirmation and both clients receive one terminal result', { timeout: 45_000 }, async ({ browser }) => {
  test.setTimeout(45_000);
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const harness = createGameHarness();
  try {
    const one = await harness.setup(contextA, A);
    const two = await harness.setup(contextB, B);

    await one.getByRole('button', { name: 'Đầu hàng', exact: true }).click();
    const confirmation = one.getByRole('dialog', { name: /Bạn muốn kết thúc ván đấu/ });
    await expect(confirmation).toBeVisible();
    expect(harness.resignCalls).toBe(0);
    await confirmation.getByRole('button', { name: 'Quay lại ván' }).click();
    expect(harness.resignCalls).toBe(0);

    await one.getByRole('button', { name: 'Đầu hàng', exact: true }).click();
    await one.getByRole('dialog', { name: /Bạn muốn kết thúc ván đấu/ }).getByRole('button', { name: 'Xác nhận đầu hàng' }).click();
    await expect(one.getByRole('dialog', { name: 'Online game result' })).toContainText('You lost');
    await expect(two.getByRole('dialog', { name: 'Online game result' })).toContainText('You won');
    expect(harness.resignCalls).toBe(1);
    await one.reload();
    const restored = one.getByRole('dialog', { name: 'Online game result' });
    await expect(restored).toContainText('You lost');
    await restored.getByRole('button', { name: 'Về sảnh tìm trận' }).click();
    await expect(one.getByRole('button', { name: 'Tìm trận', exact: true })).toBeVisible();
    await expect(one.getByRole('dialog', { name: 'Online game result' })).toHaveCount(0);
  } finally {
    await Promise.all([contextA.close(), contextB.close()]);
  }
});

test('a server abort reaches both clients and both can immediately search again', { timeout: 45_000 }, async ({ browser }) => {
  test.setTimeout(45_000);
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const harness = createGameHarness();
  try {
    const one = await harness.setup(contextA, A);
    const two = await harness.setup(contextB, B);
    harness.abort();

    const resultA = one.getByRole('dialog', { name: 'Online game result' });
    const resultB = two.getByRole('dialog', { name: 'Online game result' });
    await expect(resultA).toContainText('Ván đấu đã hủy', { timeout: 8_000 });
    await expect(resultB).toContainText('Ván đấu đã hủy', { timeout: 8_000 });
    await resultA.getByRole('button', { name: 'New game' }).click();
    await resultB.getByRole('button', { name: 'New game' }).click();
    await expect(one.getByRole('button', { name: 'Hủy tìm trận', exact: true })).toBeVisible();
    await expect(two.getByRole('button', { name: 'Hủy tìm trận', exact: true })).toBeVisible();
    expect(harness.queueJoins).toBe(2);
  } finally {
    await Promise.all([contextA.close(), contextB.close()]);
  }
});
