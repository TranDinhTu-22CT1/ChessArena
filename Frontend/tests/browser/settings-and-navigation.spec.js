import { test, expect } from '@playwright/test';
import { mockUiApi } from './ui-data.js';

test('maintenance is inside the content column and unobscured below the mobile header', async ({page}) => {
  await mockUiApi(page);
  await page.route(url=>url.pathname==='/api/config/public', route=>route.fulfill({json:{ok:true,settings:{
    showMaintenanceBanner:true,maintenanceMessage:'Bảo trì lúc 23 giờ'
  }}}));
  for (const width of [1440,960,390]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/friends');
    const banner=page.locator('.content-shell > .website-maintenance-banner');
    await expect(banner).toBeInViewport();
    await expect.poll(()=>banner.evaluate(el=>{
      const r=el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    })).toBe(true);
    const rect=await banner.boundingBox();
    if(width<=980)expect(rect.y).toBeGreaterThanOrEqual(70);
    else expect(rect.x).toBeGreaterThanOrEqual(250);
    await page.screenshot({path:`playwright-report/ui-audit-current/maintenance-${width}.png`});
  }
});

test('mobile navigation anchors to the left at tablet and phone widths', async ({page}) => {
  await mockUiApi(page);
  await page.goto('/play/local');
  for (const width of [960,390]) {
    await page.setViewportSize({width,height:844});
    await page.getByRole('button',{name:'Mở menu',exact:true}).click();
    const sidebar=page.locator('.mobile-navigation-dialog .app-sidebar');
    await expect(sidebar).toBeVisible();
    await expect.poll(async()=>Math.round((await sidebar.boundingBox()).x)).toBe(0);
    expect((await sidebar.boundingBox()).width).toBeLessThanOrEqual(330);
    await page.screenshot({path:`playwright-report/ui-audit-current/sidebar-${width}.png`,animations:'disabled'});
    await page.getByRole('button',{name:'Đóng menu',exact:true}).click();
  }
});

test('public defaults update theme and board without overwriting personal choices or saving on load', async ({page}) => {
  await page.clock.install();
  await mockUiApi(page);
  const writes=[];
  let personal={};
  let showBanner=true;
  await page.route(url=>url.pathname==='/api/user/preferences',route=>{
    if(route.request().method()==='POST')writes.push(route.request().postDataJSON());
    return route.fulfill({json:{ok:true,preferences:{theme:personal}}});
  });
  await page.route(url=>url.pathname==='/api/config/public',route=>route.fulfill({json:{ok:true,settings:{
    siteTitle:'Arena mới',accentColor:'#123456',defaultAppearance:'light',defaultBoardTheme:'ocean',
    showMaintenanceBanner:showBanner,maintenanceMessage:'Bảo trì lúc 23 giờ. Bạn vẫn có thể chơi.'
  }}}));
  await page.goto('/play/local');
  await expect(page).toHaveTitle('Arena mới');
  await expect(page.locator('.website-maintenance-banner')).toContainText('Bạn vẫn có thể chơi');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-color-scheme','light');
  await expect.poll(()=>page.locator('.app-shell').evaluate(el=>el.style.getPropertyValue('--dark-square'))).toBe('#27708a');
  expect(await page.locator('.app-shell').evaluate(el=>el.style.getPropertyValue('--accent'))).toBe('#123456');
  await page.waitForTimeout(700);
  expect(writes).toEqual([]);
  showBanner=false;
  await page.clock.runFor(30050);
  await expect(page.locator('.website-maintenance-banner')).toHaveCount(0);
  expect(writes).toEqual([]);
  await page.getByRole('button', {name:'Cài đặt giao diện', exact:true}).click();
  await page.getByRole('combobox', {name:'Màu bàn cờ có sẵn', exact:true}).selectOption('wood');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-color-scheme','light');
  await expect(page.getByRole('combobox', {name:'Chế độ giao diện', exact:true})).toHaveValue('light');
  await page.clock.runFor(600);
  await expect.poll(()=>writes.length).toBe(1);
  expect(writes[0].theme).not.toHaveProperty('appearance');
  expect(writes[0].theme).toHaveProperty('darkSquare');
  personal={appearance:'dark',accent:'#abcdef',lightSquare:'#dddddd',darkSquare:'#444444'};
  await page.reload();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-color-scheme','dark');
  await expect.poll(()=>page.locator('.app-shell').evaluate(el=>el.style.getPropertyValue('--accent'))).toBe('#abcdef');
  expect(await page.locator('.app-shell').evaluate(el=>el.style.getPropertyValue('--dark-square'))).toBe('#444444');
});

test('search timer starts while the join request is still pending', async ({page}) => {
  await mockUiApi(page);
  let release;
  const pending=new Promise(resolve=>{release=resolve;});
  await page.route(url=>url.pathname==='/api/online/matchmaking/find',async route=>{
    await pending;
    return route.fulfill({json:{ok:true,status:'waiting',queueTicketId:'ticket',ratingWindow:50}});
  });
  await page.goto('/play/online');
  await page.getByRole('button',{name:'Tìm trận',exact:true}).click();
  await expect(page.locator('.search-timer')).toContainText('Đang kết nối 00:00');
  await expect(page.locator('.search-timer')).toContainText('00:01');
  release();
  await expect(page.locator('.search-timer')).toContainText('Đang tìm');
});
