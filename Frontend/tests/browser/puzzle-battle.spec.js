import { test, expect } from '@playwright/test';
import { mockUiApi, uiUser } from './ui-data.js';
import { PUZZLE_POSITIONS } from '../../../backend/src/lib/puzzlePositions.js';
import { publicPuzzle } from '../../../backend/src/lib/puzzleRules.js';

const id = '77777777-7777-4777-8777-777777777777';
const puzzle = { id: 'test', fen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', rating: 900 };
function activeBattle(overrides = {}) {
  return { id, status: 'active', index: 2, opponentIndex: 3, total: 10, score: 1, opponentScore: 3, mistakes: 1, opponentMistakes: 0,
    you: { id: uiUser.id, name: 'Trần Đình Tú' }, opponent: { id: 'opponent', name: 'Đối thủ có tên rất dài để kiểm tra bố cục' }, puzzle,
    serverNow: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), winnerUserId: null, ...overrides };
}
async function setup(page, initial) {
  await mockUiApi(page);
  let battle = initial;
  const actions = [];
  await page.route(url => url.pathname === '/api/puzzles/battle', async route => {
    if (route.request().method() === 'POST') {
      const action = route.request().postDataJSON(); actions.push(action);
      if (action.action === 'join') battle = activeBattle({ status: 'waiting', opponent: null, puzzle: null });
      if (action.action === 'cancel') battle = { ...battle, status: 'cancelled' };
    }
    await route.fulfill({ json: { ok: true, battle: battle ? { ...battle, serverNow: new Date().toISOString() } : null } });
  });
  return { actions, set: value => { battle = value; } };
}
for (const width of [390, 960, 1440]) test(`Puzzle Battle shows identities, countdown and all mode tabs within ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await setup(page, activeBattle());
  await page.goto('/puzzles/battle');
  const scoreboard = page.getByRole('region', { name: 'Bảng điểm Puzzle Battle' });
  await expect(scoreboard).toContainText('Trần Đình Tú');
  await expect(scoreboard).toContainText('Đối thủ có tên rất dài');
  await expect(scoreboard).toContainText('2/10 đã làm · 1 sai');
  await expect(page.getByLabel('Thời gian trận còn lại')).toContainText(/0:[0-5][0-9]|1:00/);
  await expect(page.locator('.puzzle-mode-nav button')).toHaveCount(7);
  const bounds = await page.locator('.puzzle-mode-nav button').evaluateAll(nodes => nodes.map(n => {
    const r = n.getBoundingClientRect(); return { x: r.x, right: r.right, width: n.clientWidth, content: n.scrollWidth };
  }));
  for (const b of bounds) { expect(b.x).toBeGreaterThanOrEqual(0); expect(b.right).toBeLessThanOrEqual(width); expect(b.content).toBeLessThanOrEqual(b.width + 1); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({ path: `test-results/puzzle-battle-${width}.png`, fullPage: true });
});
test('Battle restores on refresh, waits after own last puzzle, then shows server-confirmed result', async ({ page }) => {
  const server = await setup(page, activeBattle({ index: 10, score: 8, mistakes: 2, puzzle: null }));
  await page.goto('/puzzles/battle');
  await expect(page.getByRole('heading', { name: 'Bạn đã làm hết câu đố' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bạn đã làm hết câu đố' })).toBeVisible();
  server.set(activeBattle({ status: 'finished', index: 10, score: 8, opponentScore: 7, opponentIndex: 10, puzzle: null, winnerUserId: uiUser.id, won: true, finishReason: 'completed' }));
  await expect(page.getByRole('heading', { name: 'Bạn thắng!' })).toBeVisible();
  await expect(page.getByText('Cả hai đã hoàn thành bộ câu đố.')).toBeVisible();
  await expect(page.getByLabel('Thời gian trận còn lại')).toHaveCount(0);
});
test('Battle lobby joins and cancels; expired game locks the board until the server confirms a draw', async ({ page }) => {
  const server = await setup(page, null);
  await page.goto('/puzzles/battle');
  await page.getByRole('button', { name: 'Tìm đối thủ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đang chờ người chơi thứ hai' })).toBeVisible();
  await page.getByRole('button', { name: 'Hủy tìm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tìm đối thủ', exact: true })).toBeVisible();
  expect(server.actions.map(a => a.action)).toEqual(['join', 'cancel']);
  server.set(activeBattle({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
  await page.reload();
  await expect(page.getByLabel('Thời gian trận còn lại')).toContainText('0:00');
  await expect(page.getByRole('button', { name: 'e1', exact: true })).toBeDisabled();
  server.set(activeBattle({ status: 'finished', puzzle: null, finishReason: 'timeout', winnerUserId: null }));
  await expect(page.getByRole('heading', { name: 'Trận hòa', exact: true })).toBeVisible();
  await expect(page.getByText('Đã hết thời gian thi đấu.')).toBeVisible();
});

test('Battle submits one legal answer with its puzzle/index and displays only the server score', async ({ page }) => {
  await mockUiApi(page);
  const exercise = PUZZLE_POSITIONS.find(p => p.line.length === 1 && !p.line[0].slice(4));
  let battle = activeBattle({ index: 0, score: 0, mistakes: 0, puzzle: publicPuzzle(exercise) });
  const answers = [];
  await page.route(url => url.pathname === '/api/puzzles/battle', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); answers.push(body);
      battle = { ...battle, index: 1, score: 1 };
    }
    await route.fulfill({ json: { ok: true, correct: true, battle } });
  });
  await page.goto('/puzzles/battle');
  const board = page.getByRole('region', { name: 'Puzzle board' });
  await board.getByRole('button', { name: exercise.line[0].slice(0, 2), exact: true }).click();
  await board.getByRole('button', { name: exercise.line[0].slice(2, 4), exact: true }).click();
  await expect(page.locator('.battle-instructions').getByRole('status')).toContainText('Chính xác · +1 điểm');
  expect(answers).toEqual([{ action: 'answer', battleId: id, move: exercise.line[0], index: 0, puzzleId: exercise.id }]);
  await expect(page.getByLabel('Bạn: điểm', { exact: true })).toHaveText('1');
  await expect(page.locator('.battle-instructions h2')).toHaveText('Câu 2 / 10');
});

test('all puzzle modes remain reachable on a phone and show their own instructions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockUiApi(page);
  await page.route('**/api/puzzles/next', route => route.fulfill({ json: { ok: true, puzzle: publicPuzzle(PUZZLE_POSITIONS[0]) } }));
  await page.route('**/api/puzzles/battle*', route => route.fulfill({ json: { ok: true, battle: null } }));
  await page.goto('/puzzles');
  for (const name of ['Daily Puzzle', 'Puzzle Rush', 'Puzzle Streak', 'Custom Puzzles', 'Mistake Lab', 'Puzzle Battle', 'Puzzles']) {
    await page.locator('.puzzle-mode-nav').getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.puzzle-header h1')).toHaveText(name);
    await expect(page.locator('.puzzle-mode-help')).not.toBeEmpty();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
});
