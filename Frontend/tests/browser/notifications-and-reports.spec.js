import { test, expect } from '@playwright/test';
import { mockUiApi, uiUser } from './ui-data.js';

test('notification bell opens five-item popover, closes outside and navigates only after selection', async ({ page }) => {
  let reads=0;
  const notices=Array.from({length:5},(_,index)=>({
    id:`notice-${index}`,title:`Thông báo ${index+1}`,body:`Nội dung ${index+1}`,
    createdAt:`2026-09-21T10:0${index}:00Z`,readAt:index===0?null:'2026-09-21T11:00:00Z',actionUrl:'/friends'
  }));
  await page.route('**/api/notifications?*',route=>route.fulfill({json:{ok:true,notifications:notices,unreadCount:1,total:5,totalPages:1}}));
  await page.route('**/api/notifications',async route=>{
    if(route.request().method()==='PATCH') reads++;
    return route.fulfill({json:{ok:true}});
  });
  await page.goto('/tests/browser/fixture.html?view=notificationHeader');
  const bell=page.locator('.notification-bell');
  await bell.click();
  await expect(page.getByRole('dialog',{name:'Thông báo mới nhất'})).toBeVisible();
  await expect(page.locator('.notification-popover-item')).toHaveCount(5);
  const geometry = await page.locator('.notification-popover-item').first().evaluate(el => ({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
  expect(geometry.width).toBeGreaterThan(300);
  expect(geometry.height).toBeGreaterThanOrEqual(80);
  await page.screenshot({path:'playwright-report/ui-audit-current/notifications-repaired.png'});
  await expect(page.getByTestId('notification-path')).not.toHaveText('/notifications');
  await expect(page.locator('.notification-popover-item').first()).toHaveClass(/unread/);
  await page.getByTestId('outside').click();
  await expect(page.locator('.notification-popover')).toHaveCount(0);
  await bell.click();
  await page.locator('.notification-popover-item').first().click();
  await expect(page).toHaveURL(/\/friends$/);
  expect(reads).toBe(1);
  await page.goto('/tests/browser/fixture.html?view=notificationHeader');
  await page.locator('.notification-bell').click();
  await page.getByRole('button',{name:'Xem tất cả thông báo'}).click();
  await expect(page).toHaveURL(/\/notifications$/);
});

test('notification popover and player report modal stay within a phone viewport', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/notifications?*',route=>route.fulfill({json:{ok:true,notifications:[],unreadCount:0,total:0,totalPages:1}}));
  await page.goto('/tests/browser/fixture.html?view=notificationHeader');
  await page.locator('.notification-bell').click();
  const popover=await page.locator('.notification-popover').boundingBox();
  expect(popover.x).toBeGreaterThanOrEqual(0); expect(popover.x+popover.width).toBeLessThanOrEqual(390);

  await mockUiApi(page);
  const target={id:'22222222-2222-4222-8222-222222222222',username:'opponent',displayName:'Đối thủ',emailVerified:true,ratings:[],recentGames:[],summary:{gamesPlayed:1,wins:0,losses:1,draws:0},training:{},skillLab:{},achievements:[]};
  await page.route(`**/api/user/profile/${target.id}`,route=>route.fulfill({json:{ok:true,profile:target}}));
  await page.route('**/api/reports?*',route=>route.fulfill({json:{ok:true,games:[]}}));
  await page.goto(`/profile/${target.id}`);
  await page.getByRole('button',{name:'Báo cáo người chơi'}).click();
  const report=page.getByRole('dialog',{name:'Báo cáo người chơi'});
  await expect(report).toContainText(target.displayName);
  expect(await report.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  const box=await report.boundingBox();
  expect(box.height).toBeLessThan(844);
  await page.screenshot({path:'playwright-report/ui-audit-current/report-repaired-phone.png'});
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.goto('/profile');
  await expect(page.getByRole('button',{name:'Báo cáo người chơi'})).toHaveCount(0);
  await expect(page.getByText(uiUser.displayName,{exact:true})).toBeVisible();
});

test('player report submits immutable target, selected shared game and evidence', async ({ page }) => {
  await mockUiApi(page);
  const target={id:'22222222-2222-4222-8222-222222222222',username:'opponent',displayName:'Đối thủ',emailVerified:true,ratings:[],recentGames:[],summary:{gamesPlayed:1,wins:0,losses:1,draws:0},training:{},skillLab:{},achievements:[]};
  const game={id:'33333333-3333-4333-8333-333333333333',white_name:'Đối thủ',black_name:uiUser.displayName,result:'1-0',time_control:'600+0'};
  let submitted;
  const createdReport={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',reportedUserId:target.id,reported:{display_name:target.displayName},category:'harassment',status:'pending',description:'Người chơi gửi nội dung quấy rối trong trận đấu.',result:'Đang chờ đội kiểm duyệt tiếp nhận.',evidence:{images:[{id:'proof',name:'proof.png',url:'data:image/png;base64,iVBORw0KGgo='}]},createdAt:'2026-09-23T08:00:00Z'};
  await page.route(`**/api/user/profile/${target.id}`,route=>route.fulfill({json:{ok:true,profile:target}}));
  await page.route('**/api/reports?*',route=>route.fulfill({json:{ok:true,games:[game]}}));
  await page.route('**/api/reports',async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{ok:true,reports:submitted?[createdReport]:[]}});
    submitted=route.request().postDataJSON();return route.fulfill({status:201,json:{ok:true,report:createdReport}});
  });
  await page.goto(`/profile/${target.id}`);
  await page.getByRole('button',{name:'Báo cáo người chơi'}).click();
  const dialog=page.getByRole('dialog',{name:'Báo cáo người chơi'});
  await dialog.getByRole('textbox',{name:'Mô tả chi tiết'}).fill('Người chơi gửi nội dung quấy rối trong trận đấu.');
  await dialog.getByRole('combobox',{name:/Trận đấu liên quan/}).selectOption(game.id);
  await dialog.getByRole('textbox',{name:/Liên kết bằng chứng/}).fill('https://example.test/evidence');
  await dialog.getByLabel('Chọn ảnh bằng chứng').setInputFiles({name:'proof.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgo=','base64')});
  await expect(dialog.locator('.player-report-previews img')).toHaveCount(1);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('blur')); });
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
  await expect(dialog.getByRole('textbox',{name:'Mô tả chi tiết'})).toHaveValue('Người chơi gửi nội dung quấy rối trong trận đấu.');
  await dialog.getByRole('button',{name:'Gửi báo cáo'}).click();
  await expect(dialog).toHaveCount(0);
  expect(submitted).toMatchObject({reportedUserId:target.id,gameId:game.id,evidenceUrl:'https://example.test/evidence'});
  expect(submitted.attachments).toHaveLength(1);
  expect(submitted.reporterUserId).toBeUndefined();
  await page.goto('/support/tickets?tab=reports');
  await expect(page.getByRole('heading',{name:'Báo cáo của tôi'})).toBeVisible();
  await expect(page.getByRole('button',{name:/Đối thủ/})).toBeVisible();
});

test('My Reports shows only the authenticated reporter view and opens safe details', async ({ page }) => {
  await mockUiApi(page);
  const report={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',reportedUserId:'target',reported:{display_name:'Đối thủ'},category:'harassment',status:'resolved',description:'Nội dung tôi đã gửi.',result:'Đã xử lý và áp dụng biện pháp phù hợp.',evidence:{images:[]},createdAt:'2026-09-23T08:00:00Z'};
  const reportRequests=[];
  await page.route('**/api/reports',async route=>{
    if(route.request().method()!=='GET')return route.fallback();
    reportRequests.push(route.request().url());
    return route.fulfill({json:{ok:true,reports:[report]}});
  });
  await page.goto(`/support?tab=reports&report=${report.id}`);
  await expect(page.getByRole('heading',{name:'Báo cáo của tôi'})).toBeVisible();
  const detail=page.getByRole('dialog',{name:'Chi tiết báo cáo của tôi'});
  await expect(detail).toContainText('Nội dung tôi đã gửi.');
  await expect(detail).toContainText('Đã xử lý và áp dụng biện pháp phù hợp.');
  await expect(detail).not.toContainText('private admin note');
  expect(new URL(reportRequests[0]).searchParams.has('userId')).toBe(false);
});
