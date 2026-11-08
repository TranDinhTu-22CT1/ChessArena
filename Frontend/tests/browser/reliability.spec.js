import { test, expect } from '@playwright/test';
import { mockUiApi, uiUser } from './ui-data.js';

test('repeated tab switches and a simulated long AFK never reload or reset an active form', async ({ page }) => {
  await page.addInitScript(() => {
    const count = Number(sessionStorage.getItem('round2-document-boots') || '0') + 1;
    sessionStorage.setItem('round2-document-boots', String(count));
  });
  await mockUiApi(page);
  let authReads = 0;
  await page.route(url => url.pathname === '/api/auth/me', route => { authReads++; return route.fulfill({json:{ok:true,user:uiUser}}); });
  let invitationReads = 0;
  await page.route(url => url.pathname === '/api/online/invitations', route => {
    invitationReads += 1;
    return route.fulfill({ json: { ok: true, invitations: [] } });
  });
  await page.goto('/support');
  const description = page.getByRole('textbox', { name: 'Nội dung cần hỗ trợ' });
  await description.fill('Nội dung đang nhập phải sống qua nhiều chu kỳ nền và AFK dài.');
  await page.evaluate(() => { window.__loadingSeen = false; const observer = new MutationObserver(() => { if (document.querySelector('.route-loading')) window.__loadingSeen = true; }); observer.observe(document.body, {childList:true,subtree:true}); });
  const originalTimeOrigin = await page.evaluate(() => performance.timeOrigin);

  for (let index = 0; index < 6; index += 1) {
    await page.evaluate((hours) => {
      const nativeNow = Date.now;
      Date.now = () => nativeNow() + hours * 60 * 60 * 1000;
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('blur'));
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      Date.now = nativeNow;
    }, index === 5 ? 12 : 0.05);
  }

  await page.waitForTimeout(500);
  await expect(description).toHaveValue('Nội dung đang nhập phải sống qua nhiều chu kỳ nền và AFK dài.');
  expect(await page.evaluate(() => Number(sessionStorage.getItem('round2-document-boots')))).toBe(1);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(originalTimeOrigin);
  expect(invitationReads).toBeLessThanOrEqual(10);
  expect(authReads).toBe(1);
  expect(await page.evaluate(() => window.__loadingSeen)).toBe(false);
});

test('starting another game keeps the previous completed game save alive',async({page})=>{
  const requests=[];
  await page.route(url=>url.pathname==='/api/health',route=>route.fulfill({json:{ready:true}}));
  await page.route(url=>url.pathname==='/api/game/log',route=>{requests.push(route);});
  await page.goto('/tests/browser/fixture.html?view=log');
  await expect.poll(()=>requests.length).toBe(1);
  await page.getByRole('button',{name:'Next game'}).click();
  await expect.poll(()=>requests.length).toBe(2);
  expect(requests.map(route=>route.request().postDataJSON().gameId)).toEqual(['finished-first','finished-second']);
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/game/log'&&r.request().postDataJSON().gameId==='finished-first');
  await requests[0].fulfill({json:{ok:true}});
  expect((await response).status()).toBe(200);
  await requests[1].fulfill({json:{ok:true}});
  await expect(page.getByText('Saved',{exact:true})).toBeVisible();
});

test('a slow old history filter cannot replace the latest filter results', async ({ page }) => {
  let initialRoute;
  let started;
  const initialRequest = new Promise(resolve => { started = resolve; });
  const row = (name) => ({id:name,result:'1-0',playerColor:'w',white:{you:true},black:{name},moves:[],mode:'rapid',finishedAt:'2026-09-13T12:00:00Z'});
  await page.route('**/api/online/history?**',async route=>{
    if(new URL(route.request().url()).searchParams.get('result')==='all') { initialRoute=route; started(); return; }
    await route.fulfill({json:{ok:true,games:[row('Latest opponent')],total:1,totalPages:1}});
  });
  await page.goto('/tests/browser/fixture.html?view=history');
  await initialRequest;
  await page.getByRole('combobox',{name:'Kết quả',exact:true}).selectOption('win');
  await expect(page.getByText('vs Latest opponent')).toBeVisible();
  await initialRoute.fulfill({json:{ok:true,games:[row('Stale opponent')],total:1,totalPages:1}}).catch(()=>{});
  await expect(page.getByText('vs Stale opponent')).toHaveCount(0);
  await expect(page.getByRole('combobox',{name:'Kết quả',exact:true})).toHaveValue('win');
});

test('history sends date filters to the server before pagination', async ({ page }) => {
  const requests = [];
  const game = {id:'dated-game',result:'1-0',playerColor:'w',white:{you:true},black:{name:'Date opponent'},moves:[],mode:'rapid',finishedAt:'2026-09-13T12:00:00Z'};
  await page.route('**/api/online/history?**', async route => {
    requests.push(route.request().url());
    return route.fulfill({json:{ok:true,games:[game],total:1,totalPages:1}});
  });
  await page.goto('/tests/browser/fixture.html?view=history&page=4');
  await expect(page.getByText('vs Date opponent')).toBeVisible();
  await page.getByLabel('Từ ngày').fill('2026-09-01');
  await page.getByLabel('Đến ngày').fill('2026-09-21');
  await expect.poll(() => requests.at(-1) || '').toContain('dateTo=2026-09-21');
  const latest = new URL(requests.at(-1));
  expect(latest.searchParams.get('dateFrom')).toBe('2026-09-01');
  expect(latest.searchParams.get('dateTo')).toBe('2026-09-21');
  expect(latest.searchParams.get('page')).toBe('1');
});

test('failed mark-read stays visible and does not navigate or clear the unread notification',async({page})=>{
  let writes=0;
  await page.route(url => url.pathname === '/api/notifications',async route=>{
    if(route.request().method()==='PATCH') {
      writes++;
      return route.fulfill({status:503,json:{ok:false,error:'Không thể cập nhật thông báo lúc này.'}});
    }
    return route.fulfill({json:{ok:true,totalPages:1,unreadCount:1,notifications:[{
      id:'notice',title:'Lời mời kết bạn',body:'Nội dung thông báo',createdAt:'2026-09-13T12:00:00Z',readAt:null,actionUrl:'/friends'
    }]}});
  });
  await page.goto('/tests/browser/fixture.html?view=notifications');
  await page.getByRole('button',{name:/Lời mời kết bạn/}).click();
  await expect(page.getByText('Không thể cập nhật thông báo lúc này.')).toBeVisible();
  await expect(page).toHaveURL(/view=notifications/);
  await expect(page.getByRole('button',{name:/Lời mời kết bạn/})).toBeEnabled();
  expect(writes).toBe(1);
});

test('reading the last notification on an unread page returns to an existing page',async({page})=>{
  let read=false;
  await page.route(url => url.pathname === '/api/notifications',async route=>{
    const request=route.request();
    if(request.method()==='PATCH'){read=true;return route.fulfill({json:{ok:true}});}
    const pageNumber=Number(new URL(request.url()).searchParams.get('page'));
    return route.fulfill({json:{ok:true,totalPages:read?1:2,unreadCount:read?1:2,notifications:read&&pageNumber===2?[]:[{
      id:'notice',title:read?'Remaining notice':'Last notice',createdAt:'2026-09-13T12:00:00Z',readAt:null
    }]}});
  });
  await page.goto('/tests/browser/fixture.html?view=notifications&page=2');
  await page.getByRole('button',{name:/Last notice/}).click();
  await expect(page.getByRole('button',{name:/Remaining notice/})).toBeVisible();
  await expect(page).not.toHaveURL(/page=2/);
});
