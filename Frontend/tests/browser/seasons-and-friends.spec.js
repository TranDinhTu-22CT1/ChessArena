import { test, expect } from '@playwright/test';

const rating = value => ({ rapid: { rating: value, gamesPlayed: 12 }, blitz: { rating: 900, gamesPlayed: 5 } });

test('friend filters rank the full list, reset pagination and work on mobile', async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ json: { ok: true, invitations: [], notifications: [] } }));
  const now = new Date().toISOString();
  await page.route('**/api/friends', route => route.fulfill({ json: {
    ok: true, serverNow: now, viewer: { ratings: rating(600) }, incoming: [], outgoing: [],
    friends: Array.from({ length: 12 }, (_, i) => ({ id: `relation-${i}`, user: {
      id: `user-${i}`, displayName: `Bạn số ${i}`, username: `friend-${i}`, ratings: rating(900 - i * 25),
      presence: { online: i === 11, status: 'online', lastSeen: i === 11 ? now : '2020-01-01T00:00:00Z' },
      lastActiveAt: i === 11 ? now : '2020-01-01T00:00:00Z'
    } }))
  } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tests/browser/fixture.html');
  await expect(page.locator('.friends-list .friend-card').first()).toContainText('Bạn số 11');
  await expect(page.locator('.friends-list .friend-card')).toHaveCount(8);
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(page.locator('.friends-list .friend-card')).toHaveCount(4);
  await page.getByRole('combobox', { name: 'Hoạt động', exact: true }).selectOption('online');
  await expect(page.locator('.friends-list .friend-card')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Phân trang bạn bè' })).toContainText('Trang 1 / 1');
  await page.getByRole('combobox', { name: 'Chênh lệch Elo', exact: true }).selectOption('100');
  await expect(page.locator('.friends-list .friend-card')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Elo theo chế độ', exact: true }).selectOption('bullet');
  await expect(page.getByRole('combobox', { name: 'Chênh lệch Elo', exact: true })).toBeDisabled();
  await expect(page.locator('.friends-discovery')).toContainText('Bạn chưa có Elo bullet');
  await expect(page.locator('.friends-list .friend-card')).toContainText('Chưa có Elo thi đấu');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('weekly/monthly leaderboard shows previous rank separately and clears the previous board', async ({ page }) => {
  const requests = [];
  await page.route('**/api/leaderboard?**', async route => {
    const params = new URL(route.request().url()).searchParams;
    const period = params.get('period'), offset = Number(params.get('offset'));
    requests.push({ period, offset });
    const base = { ok: true, period, offset, page: 1, totalPages: 1, entries: [], currentUser: null,
      serverNow: '2026-10-15T00:00:00Z', periodStart: '2026-10-11T17:00:00Z', periodEnd: '2026-10-18T17:00:00Z',
      previousUser: period === 'all' ? null : { rank: 60, points: 9 } };
    if (period === 'all') {
      base.currentUser = { userId: 'me', rank: 60, rating: 600, gamesPlayed: 12, winRate: 50 };
      base.entries = [{ ...base.currentUser, rank: 1, displayName: 'Người dẫn đầu' }];
    }
    await route.fulfill({ json: base });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tests/browser/fixture.html?view=leaderboard');
  await expect(page.locator('.leaderboard-current')).toContainText('#60');
  await page.getByRole('combobox', { name: 'Bảng xếp hạng', exact: true }).selectOption('week');
  await expect(page.locator('.leaderboard-season-note')).toContainText('Kỳ liền trước: #60');
  await expect(page.locator('.leaderboard-current')).toHaveCount(0);
  await expect(page.getByText('Bạn chưa có hạng trong kỳ đã chọn.', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'Bảng xếp hạng', exact: true }).selectOption('month');
  await page.getByRole('combobox', { name: 'Kỳ thi đấu', exact: true }).selectOption('1');
  await expect.poll(() => requests.at(-1)).toEqual({ period: 'month', offset: 1 });
  await expect(page.locator('.leaderboard-season-note')).toContainText('Kỳ liền trước: #60');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
