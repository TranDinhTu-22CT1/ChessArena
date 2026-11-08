import { test, expect } from '@playwright/test';
import { mockUiApi } from './ui-data.js';

test('help and ticket creation stay separate from the combined ticket/report inbox', async ({ page }) => {
  await mockUiApi(page);
  await page.route(url => url.pathname === '/api/support/requests', route => route.fulfill({json:{ok:true,requests:[{
    id:'ticket-one',subject:'Cần hỗ trợ bàn cờ',message:'Kiểm tra bàn cờ',category:'technical',status:'new',created_at:'2026-09-21T10:00:00Z'
  }],total:1,totalPages:1}}));
  const reads = [];
  await page.route(url => url.pathname === '/api/reports', route => {
    reads.push('reports');
    return route.fulfill({json:{ok:true,reports:[]}});
  });
  await page.goto('/support');
  await expect(page.getByRole('textbox',{name:'Nội dung cần hỗ trợ'})).toBeVisible();
  await expect(page.locator('.support-hub-tabs')).toHaveCount(0);
  await expect(page.locator('.support-ticket-timeline')).toHaveCount(0);
  expect(reads).toEqual([]);

  await page.goto('/support/tickets');
  await expect(page.getByRole('heading',{name:'Ticket & Báo cáo',exact:true})).toBeVisible();
  await expect(page.locator('.support-ticket-timeline')).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Nội dung cần hỗ trợ'})).toHaveCount(0);
  expect(reads).toEqual([]);
  await page.getByRole('navigation',{name:'Hỗ trợ và báo cáo'}).getByRole('button',{name:'Báo cáo người chơi'}).click();
  await expect(page.getByRole('heading',{name:'Báo cáo của tôi'})).toBeVisible();
  expect(reads).toEqual(['reports']);
  await expect(page).toHaveURL(/\/support\/tickets\?tab=reports$/);
  await page.goBack();
  await expect(page.locator('.support-ticket-timeline')).toBeVisible();
  await page.getByRole('button',{name:'Gửi yêu cầu mới'}).click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByRole('textbox',{name:'Nội dung cần hỗ trợ'})).toBeVisible();
});
