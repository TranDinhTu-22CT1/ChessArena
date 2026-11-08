import { test, expect } from '@playwright/test';
import { mockUiApi, uiMembership, uiUser } from './ui-data.js';

async function mockAdmin(page) {
  await mockUiApi(page);
  const requests = [];
  requests.writes = [];
  await page.route(url => url.pathname.startsWith('/api/admin/'), async route => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    let data = { ok: true };
    if (url.pathname.endsWith('/me')) data.admin = { email: 'admin@example.test', role: 'owner', expiresAt: '2099-10-12T12:00:00Z', csrfToken: 'test-csrf' };
    else if (url.pathname.endsWith('/summary')) data.summary = { users: 1284, onlineUsers: 24, todayGames: 86, onlineGames: 8, queueCount: 3, openPlayerReports: 2, openSupportRequests: 4, staleActiveGames: 0, activeSubscriptions: 126, failedPayments: 1, webhookConfigured: true, supabaseStatus: 'Sẵn sàng', firebaseStatus: 'Sẵn sàng', matchmakingHealth: { successRate: 98, latestP50Ms: 1400, latestP95Ms: 3200, latestP99Ms: 5600, latestAverageRatingGap: 48, matchedPlayers: 86, waitingEvents: 3, integrityIssues: 0, pendingOutboxEvents: 0 }, chatRateLimits: { gateway: { requestsPerMinute: 20, requestsInWindow: 12, activeClients: 4, peakClientUsage: 5 }, models: [] } };
    else if (url.pathname.endsWith('/users')) data = { ...data, users: [{ id: uiUser.id, display_name: url.searchParams.get('search') || uiUser.displayName, email: uiUser.email, ratings: [{ rating: 850, games_played: 24 }] }], totalPages: 3 };
    else if (url.pathname.endsWith('/payments')) data = { ...data, payments: [{ user_id: uiUser.id, tier: 'pro', status: 'active', billing_cycle: 'monthly', provider: 'paypal', provider_subscription_id: 'I-DEMO', provider_plan_id: 'P-DEMO', current_period_end: uiMembership.currentPeriodEnd, users: { display_name: uiUser.displayName, email: uiUser.email } }], totalPages: 1 };
    else if (url.pathname.endsWith('/matches')) data = { ...data, matches: [], totalPages: 1 };
    else if (url.pathname.endsWith('/moderation')) data = { ...data, reports: [], totalPages: 1 };
    else if (url.pathname.endsWith('/support')) data = { ...data, requests: [], totalPages: 1 };
    else if (url.pathname.endsWith('/config')) {
      const saved=route.request().method()==='PATCH' ? route.request().postDataJSON() : null;
      if(saved)requests.writes.push(saved);
      data = { ...data, config: saved?.settings || { siteTitle:'ChessArena', accentColor:'#7c3aed', defaultAppearance:'system', defaultBoardTheme:'classic', supportEmail:'support@example.test', homepageAnnouncement:'', maintenanceMessage:'', showMaintenanceBanner:false }, testAdmin:{email:'admintest@gmail.com',enabled:true,granted:false} };
    }
    return route.fulfill({ json: data });
  });
  return requests;
}

test('admin groups key metrics, keeps navigation usable on mobile and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockAdmin(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Tổng quan', exact: true })).toBeVisible();
  await expect(page.locator('.admin-headline-stats .admin-stat-card')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Cần chú ý' })).toBeVisible();
  await expect(page.getByText('Thời gian chờ P99', { exact: true })).toBeHidden();
  await page.getByText('Xem chỉ số chi tiết', { exact: true }).click();
  await expect(page.getByText('Thời gian chờ P99', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'playwright-report/ui-audit-current/admin-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const navigation = page.getByRole('navigation', { name: 'Danh mục quản trị' });
  await navigation.getByRole('button', { name: 'Thanh toán', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thanh toán', exact: true })).toBeVisible();
  await expect(page.getByText('Tự động qua PayPal', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: 'playwright-report/ui-audit-current/admin-phone.png', fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.admin-section-content').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('admin search waits for submit, pagination loads once and session lookup is reused', async ({ page }) => {
  const requests = await mockAdmin(page);
  const userRequests = () => requests.filter(url => url.startsWith('/api/admin/users'));
  await page.goto('/admin/players');
  await expect(page.getByText(uiUser.displayName, { exact: true })).toBeVisible();
  expect(userRequests()).toHaveLength(1);
  await page.getByRole('textbox', { name: 'Tìm người chơi' }).pressSequentially('Minh', { delay: 50 });
  await page.waitForTimeout(650);
  expect(userRequests()).toHaveLength(1);
  await page.getByRole('textbox', { name: 'Tìm người chơi' }).press('Enter');
  await expect(page.getByText('Minh', { exact: true })).toBeVisible();
  expect(userRequests()).toHaveLength(2);
  await page.getByRole('navigation', { name: 'Phân trang người chơi admin' }).getByRole('button', { name: 'Trang 2', exact: true }).click();
  await expect.poll(() => userRequests().length).toBe(3);
  await page.waitForTimeout(250);
  expect(userRequests()[2]).toContain('page=2');
  expect(userRequests()[2]).toContain('search=Minh');
  await page.getByRole('navigation', { name: 'Danh mục quản trị' }).getByRole('button', { name: 'Trận đấu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Trận đấu', exact: true })).toBeVisible();
  expect(requests.filter(url => url === '/api/admin/me')).toHaveLength(1);
  expect(userRequests()).toHaveLength(3);
});

test('loading saved preferences does not write them back and quick changes are coalesced', async ({ page }) => {
  await mockUiApi(page);
  const writes = [];
  await page.route(url => url.pathname === '/api/user/preferences', async route => {
    if (route.request().method() === 'POST') writes.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true, preferences: { theme: { appearance: 'light' } } } });
  });
  await page.goto('/play/local');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-color-scheme', 'light');
  await page.waitForTimeout(750);
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Cài đặt giao diện', exact: true }).click();
  const appearance = page.getByRole('combobox', { name: 'Chế độ giao diện', exact: true });
  await appearance.selectOption('dark');
  await appearance.selectOption('light');
  await appearance.selectOption('dark');
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].theme.appearance).toBe('dark');
});

test('invitation refresh pauses in hidden and offline tabs, then resumes without a burst', async ({ page }) => {
  await mockUiApi(page);
  let calls = 0;
  await page.route(url => url.pathname === '/api/online/invitations', async route => {
    calls++;
    return route.fulfill({ json: { ok: true, userId: uiUser.id, invitations: [] } });
  });
  await page.goto('/friends');
  await expect.poll(() => calls).toBe(1);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(2400);
  expect(calls).toBe(1);
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(2200);
  expect(calls).toBe(1);
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => calls).toBe(2);
});

test('membership card fits phone width and shows an explicit renewal date', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockUiApi(page);
  await page.goto('/membership');
  const card = page.getByRole('region', { name: 'Gói hiện tại của bạn' });
  await expect(card).toContainText('Tự động gia hạn');
  await expect(card).toContainText('12/10/2099');
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: 'playwright-report/ui-audit-current/membership-phone.png', fullPage: true });
});

test('admin locks only an account, with its reason and optional expiration', async ({ page }) => {
  await mockAdmin(page);
  const writes = [];
  await page.route(url => url.pathname === '/api/admin/users', async route => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    writes.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto('/admin/players');
  await page.getByRole('button', { name: 'Cấm', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Khóa tài khoản' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox')).toHaveCount(0);
  await dialog.getByLabel('Lý do khóa').fill('Vi phạm nhiều lần trong hội thoại.');
  await dialog.getByRole('button', { name: 'Xác nhận khóa tài khoản' }).click();
  await expect(dialog).toBeHidden();
  expect(writes).toEqual([{ action: 'ban', userId: uiUser.id, reason: 'Vi phạm nhiều lần trong hội thoại.', expiresAt: null }]);
});

test('admin appeal decision needs a note, survives a failed save and blocks double submission', async ({ page }) => {
  await mockAdmin(page);
  const request = { id: '44444444-4444-4444-8444-444444444444', user_id: uiUser.id,
    subject: 'Xin xem xét khóa tài khoản', message: 'Xin kiểm tra và xem xét lại lệnh khóa.',
    category: 'moderation', status: 'new', created_at: '2026-09-20T10:00:00Z',
    users: { display_name: uiUser.displayName }, context: { kind: 'ban_appeal', banId: '55555555-5555-4555-8555-555555555555' } };
  const writes = [];
  let allowSave;
  await page.route(url => url.pathname === '/api/admin/support', async route => {
    if (route.request().method() === 'PATCH') {
      writes.push(route.request().postDataJSON());
      expect(route.request().headers()['x-admin-csrf']).toBe('test-csrf');
      if (writes.length === 1) return route.fulfill({ status: 503, json: { ok: false, error: 'Chưa lưu được quyết định.' } });
      await new Promise(resolve => { allowSave = resolve; });
      request.context.decision = 'approved'; request.status = 'resolved';
    }
    return route.fulfill({ json: { ok: true, requests: [request], request, totalPages: 1 } });
  });
  await page.route(url => url.pathname.endsWith(`/support/${request.id}/messages`), route => route.fulfill({ json: { ok: true, messages: [] } }));
  await page.goto('/admin/support');
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  const dialog = page.getByRole('dialog');
  const approve = dialog.getByRole('button', { name: 'Duyệt gỡ khóa tài khoản', exact: true });
  await expect(approve).toBeDisabled();
  const note = dialog.getByRole('textbox', { name: 'Ghi chú xử lý' });
  await note.fill('Đã xác minh và đồng ý gỡ khóa.');
  await approve.click();
  await expect(approve).toBeEnabled();
  await expect(note).toHaveValue('Đã xác minh và đồng ý gỡ khóa.');
  await approve.click();
  await expect.poll(() => writes.length).toBe(2);
  await expect(dialog.getByRole('button', { name: 'Từ chối yêu cầu' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Đang lưu quyết định…' })).toBeDisabled();
  allowSave();
  await expect(dialog).toBeHidden();
  expect(writes[1]).toMatchObject({ requestId: request.id, appealDecision: 'approved', adminNote: 'Đã xác minh và đồng ý gỡ khóa.' });
});

test('admin list filters submit server queries and Website Settings saves only public values', async ({page})=>{
  const requests=await mockAdmin(page);
  await page.goto('/admin/matches');
  const matches=page.locator('.admin-filter-bar');
  await matches.locator('input[placeholder*="Mã trận"]').fill('game-42');
  await matches.getByLabel('Trạng thái').selectOption('active');
  await matches.getByLabel('Từ ngày').fill('2026-09-01');
  await matches.getByRole('button',{name:'Áp dụng'}).click();
  await expect.poll(()=>requests.filter(value=>value.startsWith('/api/admin/matches?')).at(-1)).toContain('search=game-42');
  const matchRequest=requests.filter(value=>value.startsWith('/api/admin/matches?')).at(-1);
  expect(matchRequest).toContain('status=active'); expect(matchRequest).toContain('dateFrom=2026-09-01');

  await page.getByRole('navigation',{name:'Danh mục quản trị'}).getByRole('button',{name:'Báo cáo người chơi'}).click();
  await expect(page).toHaveURL(/\/admin\/moderation$/);
  await expect(page.getByRole('navigation',{name:'Loại yêu cầu'})).toHaveCount(0);
  const reports=page.locator('.admin-filter-bar');
  await reports.locator('.admin-filter-search input').fill('reporter@example.test');
  await reports.getByLabel('Lý do').selectOption('harassment');
  await reports.getByRole('button',{name:'Áp dụng'}).click();
  await expect.poll(()=>requests.filter(value=>value.startsWith('/api/admin/moderation?')).at(-1)).toContain('category=harassment');

  await page.getByRole('navigation',{name:'Danh mục quản trị'}).getByRole('button',{name:'Website Settings'}).click();
  const form=page.locator('.admin-settings-form');
  await expect(page.getByRole('navigation',{name:'Danh mục quản trị'}).getByRole('button',{name:'Ticket hỗ trợ',exact:true})).toBeVisible();
  expect(await form.locator('fieldset').first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(247, 250, 245)');
  await page.screenshot({path:'playwright-report/ui-audit-current/settings-repaired.png',fullPage:true});
  await form.getByLabel('Tên website').fill('ChessArena Thesis');
  await form.getByLabel('Thông báo bảo trì',{exact:true}).fill('Bảo trì lúc 22:00');
  await form.getByLabel('Hiển thị thông báo bảo trì').check();
  await form.getByRole('button',{name:'Lưu Website Settings'}).click();
  await expect.poll(()=>requests.filter(value=>value.startsWith('/api/admin/config')).length).toBeGreaterThan(1);
  const configCalls=requests.filter(value=>value.startsWith('/api/admin/config'));
  expect(configCalls.every(value=>!value.includes('secret')&&!value.includes('token'))).toBe(true);
  expect(requests.writes).toHaveLength(1);
  expect(requests.writes[0].settings).toMatchObject({siteTitle:'ChessArena Thesis',maintenanceMessage:'Bảo trì lúc 22:00',showMaintenanceBanner:true});
  expect(Object.keys(requests.writes[0].settings)).not.toContain('jwtSecret');
});

test('closing a support attachment preview preserves the ticket modal and closed tickets can reopen',async({page})=>{
  await mockAdmin(page);
  const ticket={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:uiUser.id,subject:'Ảnh lỗi giao diện',message:'Ảnh minh họa lỗi trên màn hình.',category:'technical',status:'dismissed',created_at:'2026-09-21T10:00:00Z',users:{display_name:uiUser.displayName},attachments:[{id:'image',name:'evidence.png',mimeType:'image/png',url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl5sAAAAASUVORK5CYII='}]};
  let transition;
  await page.route(url=>url.pathname==='/api/admin/support',async route=>{
    if(route.request().method()==='PATCH'){transition=route.request().postDataJSON();ticket.status='in_review';}
    return route.fulfill({json:{ok:true,requests:[ticket],request:ticket,totalPages:1}});
  });
  await page.route(url=>url.pathname.endsWith(`/support/${ticket.id}/messages`),route=>route.fulfill({json:{ok:true,messages:[]}}));
  await page.goto('/admin/support');
  await page.getByRole('button',{name:'Xem chi tiết'}).click();
  const ticketDialog=page.getByRole('dialog').filter({hasText:ticket.subject});
  await ticketDialog.locator('.support-ticket-attachment').click();
  const preview=page.locator('.admin-media-preview-layer'); await expect(preview).toBeVisible();
  await preview.getByRole('button',{name:'Đóng ảnh'}).click();
  await expect(preview).toHaveCount(0); await expect(ticketDialog).toBeVisible();
  await ticketDialog.getByRole('button',{name:'Mở lại ticket'}).click();
  await expect.poll(()=>transition?.status).toBe('in_review');
});

test('admin report detail keeps its parent open after evidence lightbox and saves actions',async({page})=>{
  await mockAdmin(page);
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl5sAAAAASUVORK5CYII=';
  const report={id:'99999999-9999-4999-8999-999999999999',reporter_user_id:'reporter',reported_user_id:uiUser.id,
    reporter:{display_name:'Người báo cáo'},reported:{id:uiUser.id,display_name:uiUser.displayName},category:'harassment',severity:'high',status:'pending',
    description:'Mô tả đầy đủ hành vi cần kiểm tra trong trận.',created_at:'2026-09-22T10:00:00Z',updated_at:'2026-09-22T10:00:00Z',
    game:{white_name:'Người báo cáo',black_name:uiUser.displayName,result:'1-0'},evidence:{images:[{id:'proof',name:'proof.png',url:image}]}};
  let action;
  await page.route(url=>url.pathname==='/api/admin/moderation',async route=>{
    if(route.request().method()==='PATCH'){action=route.request().postDataJSON();report.status=action.status;report.resolution_note=action.resolutionNote;}
    return route.fulfill({json:{ok:true,reports:[report],report,totalPages:1}});
  });
  await page.goto('/admin/moderation');
  await page.getByRole('button',{name:'Xem chi tiết'}).click();
  const detail=page.getByRole('dialog',{name:'Chi tiết báo cáo vi phạm'});
  await expect(detail).toContainText('Mô tả đầy đủ hành vi');
  await detail.getByRole('button',{name:'proof.png'}).click();
  const lightbox=page.getByRole('dialog',{name:'Xem ảnh bằng chứng'});
  await expect(lightbox).toBeVisible();
  await lightbox.getByRole('button',{name:'Đóng ảnh'}).click();
  await expect(lightbox).toHaveCount(0);
  await expect(detail).toBeVisible();
  await detail.getByRole('textbox',{name:'Ghi chú xử lý báo cáo'}).fill('Đã xác minh vi phạm.');
  await detail.getByRole('button',{name:'Xử lý xong'}).click();
  await expect.poll(()=>action).toMatchObject({reportId:report.id,status:'resolved',resolutionNote:'Đã xác minh vi phạm.'});
});
