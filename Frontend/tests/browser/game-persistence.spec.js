import { test, expect } from '@playwright/test';
import { Chess } from 'chess.js';
import { mockUiApi } from './ui-data.js';

async function mockAiPlay(page) {
  await mockUiApi(page);
  await page.route('**/api/analysis/move', async route => {
    const body = route.request().postDataJSON();
    const board = new Chess(body.fen);
    const move = board.moves({ verbose: true })[0];
    return route.fulfill({ json: { ok: true, move: { from: move.from, to: move.to, promotion: move.promotion } } });
  });
  await page.route('**/api/analysis/review', async route => {
    const body = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true, results: body.positions.map(position => ({
      ...position, tone: 'best', label: 'Best', bestMove: position.move, bestSan: position.san,
      mover: new Chess(position.fen).turn(), whiteScore: 15, winLoss: 0, accuracy: 100
    })), quota: { consumed: false, mode: 'live' } } });
  });
}

for (const mode of [
  { path: '/play/bot', start: 'Bắt đầu ván đấu' },
  { path: '/coach', start: 'Bắt đầu luyện' }
]) {
  test(`${mode.path} restores its board and move history after a real reload without a countdown`, async ({ page }) => {
    await mockAiPlay(page);
    await page.goto(mode.path);
    await page.getByRole('button', { name: mode.start, exact: true }).click();
    await page.locator('.board').getByRole('button', { name: 'e2', exact: true }).click();
    await page.locator('.board').getByRole('button', { name: 'e4', exact: true }).click();
    await expect(page.locator('.play-moves')).toContainText('e4');
    await expect(page.locator('.clock')).toHaveText(['∞', '∞']);
    await page.waitForTimeout(350);
    await page.reload();
    await expect(page.locator('.play-moves')).toContainText('e4');
    await expect(page.locator('.clock')).toHaveText(['∞', '∞']);
    if (mode.path === '/coach') await expect(page.locator('.play-coach-assessment')).toContainText('Tốt nhất');
    await expect(page.getByRole('button', { name: mode.start, exact: true })).toHaveCount(0);
  });
}

test('pass-and-play restores legal moves and timed game state after reload', async ({ page }) => {
  await mockUiApi(page);
  await page.goto('/play/local');
  await page.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
  await page.getByRole('button', { name: 'e2', exact: true }).click();
  await page.getByRole('button', { name: 'e4', exact: true }).click();
  await expect(page.locator('.local-move-list')).toContainText('e4');
  await page.waitForTimeout(1100);
  await page.reload();
  await expect(page.locator('.local-move-list')).toContainText('e4');
  await expect(page.getByRole('button', { name: 'Bắt đầu', exact: true })).toHaveCount(0);
  await expect(page.locator('.local-player-bar b')).toHaveCount(2);
});
