import {test,expect} from '@playwright/test';
import {mockUiApi,uiUser} from './ui-data.js';

test('user to admin switching makes Admin authoritative, then admin logout permits a user session',{timeout:45_000},async({page})=>{
  await mockUiApi(page);
  let adminActive=false,userActive=true;
  const admin={email:'admin@example.test',role:'owner',expiresAt:'2099-10-12T12:00:00Z',csrfToken:'csrf'};
  await page.route(url=>url.pathname==='/api/auth/me',route=>route.fulfill({json:{ok:true,user:adminActive?{id:'admin-id',uid:'admin:admin@example.test',email:admin.email,displayName:'ADMIN',username:'admin',role:'admin',isAdmin:true,emailVerified:true}:userActive?uiUser:null}}));
  await page.route(url=>url.pathname==='/api/auth/session',route=>{
    userActive=true;adminActive=false;
    return route.fulfill({json:{ok:true,user:uiUser}});
  });
  await page.route(url=>url.pathname.startsWith('/api/admin/'),route=>{
    const path=new URL(route.request().url()).pathname,method=route.request().method();
    if(path==='/api/admin/session'){
      if(method==='POST'){adminActive=true;userActive=false;return route.fulfill({json:{ok:true,admin,csrfToken:'csrf',expiresAt:admin.expiresAt}});}
      if(method==='DELETE'){adminActive=false;return route.fulfill({json:{ok:true}});}
      if(!adminActive)return route.fulfill({status:401,json:{ok:false,error:'Admin login required'}});
      return route.fulfill({json:{ok:true,admin}});
    }
    if(!adminActive)return route.fulfill({status:401,json:{ok:false,error:'Admin login required'}});
    if(path==='/api/admin/summary')return route.fulfill({json:{ok:true,summary:{users:1,onlineUsers:0,todayGames:0,onlineGames:0,queueCount:0,openPlayerReports:0,openSupportRequests:0,activeSubscriptions:0,failedPayments:0,matchmakingHealth:{},chatRateLimits:{gateway:{},models:[]}}}});
    return route.fulfill({json:{ok:true}});
  });

  await page.goto('/profile');
  await expect(page.getByText(uiUser.displayName,{exact:true}).first()).toBeVisible();
  await page.goto('/admin');
  await page.getByLabel('Email admin').fill(admin.email);
  await page.getByLabel('Mật khẩu admin').fill('password');
  await page.getByRole('button',{name:'Đăng nhập'}).click();
  await expect(page.getByText(admin.email,{exact:true})).toBeVisible();
  await page.locator('.admin-return-link').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('ADMIN',{exact:true}).first()).toBeVisible();

  await page.goto('/admin');
  await page.getByRole('button',{name:'Khóa quản trị'}).click();
  await expect(page.getByRole('heading',{name:'Đăng nhập admin'})).toBeVisible();
  await page.evaluate(async()=>{await fetch('/api/auth/session',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:'test-user-token-that-is-long-enough'})});});
  await page.goto('/profile');
  await expect(page.getByText(uiUser.displayName,{exact:true}).first()).toBeVisible();
  await expect(page.getByText('ADMIN',{exact:true})).toHaveCount(0);
});

test('an idle session recovers one expired matchmaking request without reloading the page', async ({ page }) => {
  await mockUiApi(page);
  let authChecks = 0;
  let findCalls = 0;
  let searching = false;
  const joinedAt = new Date().toISOString();

  await page.route(url => url.pathname === '/api/auth/me', route => {
    authChecks += 1;
    return route.fulfill({ json: { ok: true, user: uiUser } });
  });
  await page.route(url => url.pathname === '/api/online/matchmaking/find', route => {
    findCalls += 1;
    if (findCalls === 1) return route.fulfill({ status: 401, json: { ok: false, error: 'Session expired.' } });
    searching = true;
    return route.fulfill({ json: { ok: true, status: 'waiting', queueTicketId: 'idle-ticket', joinedAt, ratingWindow: 50, onlineCount: 10, queueCount: 1 } });
  });
  await page.route(url => url.pathname === '/api/online/heartbeat', route => route.fulfill({
    json: { ok: true, me: { id: uiUser.id, rating: 850 }, queueTicketId: searching ? 'idle-ticket' : null, joinedAt: searching ? joinedAt : null, onlineCount: 10, queueCount: searching ? 1 : 0 }
  }));

  await page.goto('/play/online');
  await expect(page.getByRole('button', { name: 'Tìm trận', exact: true })).toBeVisible();
  await page.evaluate(() => { window.__idleSessionMarker = 'preserved'; window.dispatchEvent(new Event('focus')); });
  expect(authChecks).toBe(1);
  await page.getByRole('button', { name: 'Tìm trận', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Hủy tìm trận', exact: true })).toBeVisible();
  expect(findCalls).toBe(2);
  expect(authChecks).toBe(2);
  expect(await page.evaluate(() => window.__idleSessionMarker)).toBe('preserved');
  await expect(page.getByText(/đăng nhập để tìm trận/i)).toHaveCount(0);
});
