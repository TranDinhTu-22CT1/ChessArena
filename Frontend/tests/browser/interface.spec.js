import { test, expect } from '@playwright/test';
import { mockUiApi } from './ui-data.js';

async function withinViewport(locator, page) {
  await expect(locator).toBeVisible();
  const rect = await locator.boundingBox();
  const { width, height } = page.viewportSize();
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
  expect(rect.y + rect.height).toBeLessThanOrEqual(height + 1);
}

test('tablet navigation stays inside its drawer and restores desktop navigation on resize', async ({ page }) => {
  await page.setViewportSize({ width: 950, height: 760 });
  await mockUiApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Điều hướng chính', exact: true });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Play', exact: true }).click();
  const history = drawer.getByRole('button', { name: 'Lịch sử trận đấu', exact: true });
  await history.scrollIntoViewIfNeeded();
  await withinViewport(history, page);
  await history.click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(drawer).toHaveCount(0);
  const opener = page.getByRole('button', { name: 'Mở menu', exact: true });
  await opener.click();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await opener.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(drawer).toHaveCount(0);
  await expect(page.locator('.app-sidebar')).toBeVisible();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Chơi online', exact: true }).click();
  await expect(page).toHaveURL(/\/play\/online$/);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('phone toolbar and profile controls remain usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockUiApi(page);
  await page.goto('/profile');
  const form = page.locator('.player-profile-form');
  await expect(form).toBeVisible();
  const toolbar = page.locator('.header-actions');
  const controls = toolbar.locator('button');
  for (const control of await controls.all()) {
    await withinViewport(control, page);
    const rect = await control.boundingBox();
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
  }
  expect((await page.locator('.player-profile-hero').boundingBox()).y).toBeGreaterThanOrEqual(70);
  const input = form.getByRole('textbox', { name: 'Tên hiển thị' });
  await input.fill('Tên tài khoản có nhiều ký tự');
  expect((await input.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.app-sidebar')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('settings fit a short phone screen, keep focus inside and return it on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await mockUiApi(page);
  await page.goto('/play/local');
  const opener = page.getByRole('button', { name: 'Cài đặt giao diện', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Cá nhân hóa giao diện' });
  const panel = dialog.locator('.theme-panel');
  await withinViewport(panel, page);
  await dialog.getByRole('combobox', { name: 'Chế độ giao diện', exact: true }).selectOption('dark');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-color-scheme', 'dark');
  await dialog.getByRole('combobox', { name: 'Mẫu quân cờ', exact: true }).scrollIntoViewIfNeeded();
  for (let index = 0; index < 16; index += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
});

test('initial notice stays above floating controls and its nested image closes independently', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 480 });
  await mockUiApi(page, { noticeSeen: false });
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Thông báo học thuật', exact: true });
  await expect(dialog).toBeVisible();
  await withinViewport(dialog.locator('.academic-notice-modal'), page);
  expect(await dialog.evaluate(el => el.matches(':modal'))).toBe(true);
  await dialog.locator('.academic-notice-image').click();
  const image = page.getByRole('dialog', { name: 'Xem ảnh thông báo', exact: true });
  await expect(image).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(image).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Đã hiểu', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('home layout fits phones, tablets and desktop and lesson card opens lessons', async ({ page }) => {
  await mockUiApi(page);
  await page.goto('/');
  await expect(page.locator('.home-hero')).toBeVisible();
  for (const width of [320, 390, 768, 950, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const hero = await page.locator('.home-hero').boundingBox();
    expect(hero.x).toBeGreaterThanOrEqual(0);
    expect(hero.x + hero.width).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  await page.getByRole('button', { name: 'Vào bài học Luyện theo lộ trình', exact: true }).click();
  await expect(page).toHaveURL(/\/learn$/);
});

test('compact pagination can advance and jump to distant pages without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/tests/browser/fixture.html?view=pagination');
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(page.locator('.pagination-summary')).toHaveText('Trang 2 / 30');
  await page.getByRole('spinbutton', { name: 'Đến trang', exact: true }).fill('30');
  await page.getByRole('button', { name: 'Đi', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Trang sau', exact: true })).toBeDisabled();
  await withinViewport(page.locator('.pagination'), page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('button', { name: 'Trang 30', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('local board and both clocks fit a laptop screen and play still responds', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 640 });
  await mockUiApi(page);
  await page.goto('/play/local');
  const board = page.locator('.local-board-shell');
  await withinViewport(board, page);
  for (const bar of await page.locator('.local-player-bar').all()) await withinViewport(bar, page);
  const clock = page.locator('.local-player-bar > b').first();
  await expect(clock).toHaveCSS('color', 'rgb(245, 255, 233)');
  await page.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
  await expect(page.locator('.local-board-cover')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xoay bàn', exact: true }).click();
  await withinViewport(board, page);
  const logout = page.getByRole('button', { name: 'Đăng xuất', exact: true });
  await logout.scrollIntoViewIfNeeded();
  await withinViewport(logout, page);
  await page.goto('/play/bot');
  await withinViewport(page.locator('.board').first(), page);
  for (const clock of await page.locator('.player-card .clock').all()) await withinViewport(clock, page);
});

test('friend invitation options fit a phone and retain the selected time and color', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mockUiApi(page);
  await page.goto('/friends');
  const options = page.locator('.friends-challenge-options');
  const time = options.getByRole('combobox', { name: 'Thời gian trận mời', exact: true });
  const color = options.getByRole('combobox', { name: 'Quân của bạn', exact: true });
  await time.selectOption('900+10');
  await color.selectOption('b');
  await expect(time).toHaveValue('900+10');
  await expect(color).toHaveValue('b');
  for (const control of [time, color]) {
    await control.scrollIntoViewIfNeeded();
    await withinViewport(control, page);
    expect((await control.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
});
