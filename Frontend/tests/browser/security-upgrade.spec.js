import { test, expect } from '@playwright/test';
import { mockUiApi } from './ui-data.js';

test('late friend search responses cannot overwrite a newer search or a cleared input',async({page})=>{
  await mockUiApi(page);
  // Simulate a transport that has already received the response and ignores abort.
  // The request generation guard must still protect the result list.
  await page.addInitScript(()=>{
    const original=window.fetch;
    window.fetch=(url,options)=>original(url,String(url).includes('/api/users/search')?{...options,signal:undefined}:options);
  });
  const held=new Map();
  await page.route(url=>url.pathname==='/api/users/search',async route=>{
    const q=new URL(route.request().url()).searchParams.get('q');
    if(q==='old' || q==='clear')await new Promise(resolve=>held.set(q,resolve));
    await route.fulfill({json:{ok:true,users:[{id:q,displayName:`Result ${q}`,username:q}]}});
  });
  await page.goto('/friends');
  await page.getByRole('button',{name:'Tìm người chơi',exact:true}).click();
  const input=page.locator('input[type="search"], input[placeholder*="tên"], input[placeholder*="Tên"]').first();
  await input.fill('old');await expect.poll(()=>held.has('old')).toBe(true);
  await input.fill('new');await expect(page.getByText('Result new',{exact:true})).toBeVisible();
  held.get('old')();await page.waitForTimeout(200);
  await expect(page.getByText('Result new',{exact:true})).toBeVisible();
  await expect(page.getByText('Result old',{exact:true})).toHaveCount(0);
  await input.fill('clear');await expect.poll(()=>held.has('clear')).toBe(true);
  await input.fill('');held.get('clear')();await page.waitForTimeout(200);
  await expect(page.getByText('Result clear',{exact:true})).toHaveCount(0);
});

test('site presence runs outside online play, stops in a hidden tab and resumes',async({page})=>{
  await page.clock.install();
  await mockUiApi(page);
  const pings=[];
  await page.route(url=>url.pathname==='/api/online/presence',route=>{
    pings.push(route.request().postDataJSON());return route.fulfill({json:{ok:true}});
  });
  await page.goto('/friends');
  await expect.poll(()=>pings.length).toBe(1);
  expect(pings[0]).toEqual({});
  await page.clock.fastForward(21000);await expect.poll(()=>pings.length).toBe(2);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.clock.fastForward(60000);expect(pings).toHaveLength(2);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(()=>pings.length).toBe(3);
  await page.goto('/review');await expect.poll(()=>pings.length).toBe(4);
});

test('a guest browsing the site never sends a presence heartbeat',async({page})=>{
  await mockUiApi(page,{signedIn:false});
  let pings=0;
  await page.route(url=>url.pathname==='/api/online/presence',route=>{pings++;return route.fulfill({json:{ok:true}});});
  await page.goto('/');await expect(page.locator('body')).toBeVisible();
  await page.waitForTimeout(500);expect(pings).toBe(0);
});
