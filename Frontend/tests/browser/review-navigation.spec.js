import { test, expect } from '@playwright/test';
import { Chess } from 'chess.js';
import { mockUiApi, uiUser } from './ui-data.js';

const GAME_ID = '77777777-7777-4777-8777-777777777777';

test('compact Review controls change the board without scrolling the page to the move list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await mockReviewFlow(page);
  await page.goto(`/review/${GAME_ID}`);
  const controls = page.getByRole('navigation', { name: 'Điều khiển Review nổi' });
  await expect(controls).toBeVisible();
  await controls.getByRole('button', { name: 'Về vị trí đầu', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  const y = await page.evaluate(() => window.scrollY);
  await controls.getByRole('button', { name: 'Nước tiếp', exact: true }).click();
  await expect(controls).toContainText('1 / 4');
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
  await page.keyboard.press('ArrowRight');
  await expect(controls).toContainText('2 / 4');
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
  await controls.getByRole('button', { name: 'Nước trước', exact: true }).click();
  await expect(controls).toContainText('1 / 4');
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
  expect(calls.reviewRequests()).toBe(0);
  const bounds = await controls.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(controls).toHaveCount(0);
});

function finishedGame() {
  const board = new Chess();
  const moves = ['e4', 'e5', 'Nf3', 'Nc6'].map((san, index) => {
    const move = board.move(san);
    return {
      id: `move-${index + 1}`,
      ply: index + 1,
      color: move.color,
      san: move.san,
      lan: move.lan,
      from: move.from,
      to: move.to,
      promotion: move.promotion || null,
      fenAfter: board.fen(),
      createdAt: `2026-09-20T10:00:0${index + 1}.000Z`
    };
  });
  return {
    id: GAME_ID,
    status: 'draw',
    matchType: 'quick',
    mode: 'rapid',
    rated: true,
    fen: board.fen(),
    pgn: board.pgn(),
    turn: board.turn(),
    result: '1/2-1/2',
    timeControl: '600+0',
    playerColor: 'w',
    moves,
    stateVersion: 5,
    white: { id: uiUser.id, name: uiUser.displayName, rating: 850, ratingDelta: 0, you: true },
    black: { id: '22222222-2222-4222-8222-222222222222', name: 'Review Opponent', rating: 855, ratingDelta: 0, you: false },
    startedAt: '2026-09-20T10:00:00.000Z',
    finishedAt: '2026-09-20T10:05:00.000Z',
    updatedAt: '2026-09-20T10:05:00.000Z',
    clocks: { w: 570000, b: 568000 }
  };
}

async function mockReviewFlow(page, { quotaExhausted = false, active = false, playerColor = 'w' } = {}) {
  await mockUiApi(page);
  const game = finishedGame();
  game.playerColor = playerColor;
  game.white.you = playerColor === 'w';
  game.black.you = playerColor === 'b';
  if (active) { game.status = 'active'; game.result = '*'; }
  let reviewRequests = 0;
  const batches = [];
  let gameLoads = 0;
  let savedReviewMoves = [];
  await page.route(url => url.pathname === '/api/online/history', route => route.fulfill({
    json: { ok: true, games: [game], total: 1, totalPages: 1 }
  }));
  await page.route(url => url.pathname === `/api/online/games/${GAME_ID}`, route => {
    gameLoads += 1;
    return route.fulfill({ json: { ok: true, game, reviewMoves: savedReviewMoves } });
  });
  await page.route(url => url.pathname === '/api/analysis/review', route => {
    reviewRequests += 1;
    const body = route.request().postDataJSON();
    batches.push(body);
    expect(body.gameId).toBe(GAME_ID);
    for (const position of body.positions) {
      const replay = new Chess();
      const previous = game.moves.slice(0, position.ply - 1);
      previous.forEach(move => replay.move(move.lan));
      expect(position.fen).toBe(replay.fen());
      expect(position.priorMoves).toEqual(previous.map(move => move.lan));
      const played = replay.move(position.move);
      expect(played.color).toBe(game.moves[position.ply - 1].color);
      expect(replay.fen()).toBe(game.moves[position.ply - 1].fenAfter);
    }
    if (quotaExhausted) {
      return route.fulfill({
        status: 429,
        json: { ok: false, code: 'REVIEW_QUOTA_EXHAUSTED', error: 'Bạn đã dùng hết lượt Review hôm nay. Hãy nâng cấp gói để tiếp tục.' }
      });
    }
    const results = body.positions.map(position => ({
      ...position,
      mover: new Chess(position.fen).turn(),
      tone: 'good',
      label: 'Good',
      bestMove: position.move,
      bestSan: position.san,
      centipawnLoss: 0,
      winLoss: 0,
      accuracy: 100,
      variations: []
    }));
    savedReviewMoves = [...savedReviewMoves, ...results]
      .filter((item, index, all) => all.findIndex(candidate => candidate.ply === item.ply) === index)
      .sort((left, right) => left.ply - right.ply);
    return route.fulfill({
      json: {
        ok: true,
        results,
        quota: { remaining: 2, unlimited: false, tier: 'pro' }
      }
    });
  });
  return {
    reviewRequests: () => reviewRequests,
    batches,
    gameLoads: () => gameLoads
  };
}

test('History opens replay without quota use, starts Review, survives Back and direct refresh', { timeout: 45_000 }, async ({ page }) => {
  const calls = await mockReviewFlow(page);
  await page.goto('/history');
  await page.locator('.history-row').click();
  await expect(page).toHaveURL(new RegExp(`/review/${GAME_ID}$`));
  const studio = page.locator('.review-studio');
  await expect(studio).toBeVisible();
  await expect(studio.locator('.review-replay-note')).toBeVisible();
  expect(calls.reviewRequests()).toBe(0);

  await studio.locator('.review-studio-controls button').first().click();
  await studio.locator('.review-studio-controls button').last().click();
  expect(calls.reviewRequests()).toBe(0);

  await studio.locator('.review-studio-progress button').click();
  await expect.poll(calls.reviewRequests).toBeGreaterThan(0);
  await expect(studio.locator('.review-selected-move')).toBeVisible();
  await expect(studio.getByRole('status')).toContainText('Đã phân tích toàn bộ');

  await page.evaluate(() => {
    window.history.pushState(null, '', '/leaderboard');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/leaderboard$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/review/${GAME_ID}$`));
  await expect(page.locator('.review-studio')).toBeVisible();

  const loadsBeforeRefresh = calls.gameLoads();
  const reviewRequestsBeforeRefresh = calls.reviewRequests();
  await page.reload();
  await expect(page.locator('.review-studio')).toBeVisible();
  await expect.poll(calls.gameLoads).toBeGreaterThan(loadsBeforeRefresh);
  await expect(page.locator('.review-studio').getByRole('status')).toContainText('Đã phân tích toàn bộ');
  await expect(page.locator('.review-selected-move')).toContainText('Tốt');
  expect(calls.reviewRequests()).toBe(reviewRequestsBeforeRefresh);
});

test('the online result opens the shared Review studio with correct Black orientation and engine positions', async ({ page }) => {
  const calls = await mockReviewFlow(page, { playerColor: 'b' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`/play/online?game=${GAME_ID}`);
  await page.getByRole('dialog', {name:'Online game result'}).getByRole('button', {name:'Game review',exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/review/${GAME_ID}$`));
  const studio = page.getByRole('region', {name:'Phân tích ván đấu',exact:true});
  await expect(studio).toBeVisible();
  await expect(page.locator('.online-review-dashboard, .online-review-legend, .online-chat-panel')).toHaveCount(0);
  expect(calls.reviewRequests()).toBe(0);
  const board = page.getByRole('region', {name:'Online chess board'});
  await expect(board.locator('button').first()).toHaveAttribute('aria-label','h1');
  await studio.getByRole('button',{name:'Về vị trí đầu'}).click();
  await expect(board.getByRole('button',{name:'e2',exact:true}).locator('img')).toHaveCount(1);
  await studio.getByRole('button',{name:'Nước tiếp',exact:true}).click();
  await expect(board.getByRole('button',{name:'e4',exact:true}).locator('img')).toHaveCount(1);
  await studio.getByRole('button',{name:'Bắt đầu Review'}).click();
  await expect(studio.getByRole('status')).toContainText('Đã phân tích toàn bộ');
  expect(calls.batches.flatMap(batch => batch.positions.map(position => position.ply))).toEqual([1,2,3,4]);
  await expect(studio.locator('.review-studio-players article')).toHaveCount(2);
  const boardBox = await board.boundingBox(), studioBox = await studio.boundingBox();
  const sidebarBox = await page.locator('.app-sidebar').boundingBox();
  expect(boardBox.x).toBeGreaterThanOrEqual(sidebarBox.x + sidebarBox.width);
  expect(boardBox.x + boardBox.width + 8).toBeLessThanOrEqual(studioBox.x);
  expect(studioBox.x + studioBox.width).toBeLessThanOrEqual(1440);
  await page.screenshot({path:'playwright-report/online-review-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await page.screenshot({path:'playwright-report/online-review-phone.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('an active online game cannot open engine Review by a direct URL', async ({ page }) => {
  const calls = await mockReviewFlow(page, {active:true});
  await page.goto(`/review/${GAME_ID}`);
  await expect(page.getByText('Chỉ có thể Review sau khi ván đấu kết thúc.')).toBeVisible();
  await expect(page.locator('.review-studio')).toHaveCount(0);
  expect(calls.reviewRequests()).toBe(0);
});

test('exhausted Review quota reports the server refusal and does not retry engine work', async ({ page }) => {
  const calls = await mockReviewFlow(page, { quotaExhausted: true });
  await page.goto(`/review/${GAME_ID}`);
  const studio = page.locator('.review-studio');
  await expect(studio.locator('.review-replay-note')).toBeVisible();
  expect(calls.reviewRequests()).toBe(0);
  await studio.locator('.review-studio-progress button').click();
  await expect(studio.getByRole('status')).toContainText('hết lượt Review');
  expect(calls.reviewRequests()).toBe(1);
  await page.waitForTimeout(350);
  expect(calls.reviewRequests()).toBe(1);
});

test('Review recovers an expired session, and a failed move can be retried without restarting successful analysis', async ({ page }) => {
  await mockReviewFlow(page);
  let requests = 0;
  let failMove = true;
  const plies = [];
  await page.route(url => url.pathname === '/api/analysis/review', route => {
    requests++;
    if (requests === 1) return route.fulfill({status:401,json:{ok:false,error:'Expired session'}});
    const body = route.request().postDataJSON();
    plies.push(body.positions.map(p => p.ply));
    return route.fulfill({json:{ok:true,results:body.positions.map(p => p.ply === 2 && failMove
      ? {...p,tone:'unavailable',analysisError:true,error:'Temporary engine failure'}
      : {...p,tone:'good',mover:new Chess(p.fen).turn(),bestMove:p.move,centipawnLoss:0,accuracy:100})}});
  });
  await page.goto(`/review/${GAME_ID}`);
  const studio=page.locator('.review-studio');
  await studio.getByRole('button',{name:'Bắt đầu Review'}).click();
  await expect(studio.getByRole('status')).toContainText('Một số nước chưa phân tích');
  await expect.poll(()=>plies.flat()).toEqual([1,2,3,4]);
  await expect(studio.locator('.review-studio-progress')).toContainText('3/4');
  failMove=false;
  await studio.locator('.review-studio-progress button').click();
  await expect(studio.getByRole('status')).toContainText('Đã phân tích toàn bộ');
  expect(plies.at(-1)).toEqual([2]);
  expect(requests).toBe(4);
});
