import { test, expect } from '@playwright/test';
import { Chess } from 'chess.js';
import { mockUiApi } from './ui-data.js';

test('support keeps a failed draft, sends attachments once, and exposes the resulting request', async ({ page }) => {
  await mockUiApi(page);
  let attempts = 0;
  const bodies = [];
  await page.route('**/api/support/requests', async route => {
    attempts++; bodies.push(route.request().postDataJSON());
    await new Promise(resolve => setTimeout(resolve, 200));
    return route.fulfill({status:attempts === 1 ? 503 : 200,json:attempts === 1 ? {error:'Kết nối đang gián đoạn.'} : {ok:true,request:{id:'support-1234'}}});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/support');
  await expect(page.getByRole('heading',{name:'Mình có thể giúp gì cho bạn?'})).toBeVisible();
  await page.getByRole('button',{name:/Thanh toán & gói/}).click();
  await expect(page.getByRole('combobox')).toHaveValue('billing');
  await page.getByRole('textbox',{name:/Tiêu đề/}).fill('Gia hạn cần hỗ trợ');
  await page.getByRole('textbox',{name:'Nội dung cần hỗ trợ'}).fill('Tôi cần kiểm tra trạng thái gia hạn tháng này.');
  await page.getByLabel('Đính kèm ảnh hoặc video',{exact:true}).setInputFiles({name:'minh-chung.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf3sAAAAASUVORK5CYII=','base64')});
  await page.getByRole('button',{name:'Gửi yêu cầu',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Kết nối đang gián đoạn');
  await expect(page.getByRole('textbox',{name:'Nội dung cần hỗ trợ'})).toHaveValue('Tôi cần kiểm tra trạng thái gia hạn tháng này.');
  await page.getByRole('button',{name:'Gửi yêu cầu',exact:true}).click();
  await expect(page.getByText('Đã nhận yêu cầu của bạn')).toBeVisible();
  expect(attempts).toBe(2);
  expect(bodies[1].category).toBe('billing');
  expect(bodies[1].attachments[0].name).toBe('minh-chung.png');
  await page.getByRole('textbox',{name:'Tìm câu hỏi hỗ trợ'}).fill('OTP');
  await expect(page.locator('.support-answer-list details')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button',{name:'Xóa tìm kiếm'}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'playwright-report/ui-audit-current/support-phone.png',fullPage:true});
});

test('review requests stay serial as new moves arrive and failed analysis retries only on demand', async ({ page }) => {
  const batches = []; let release;
  await page.route('**/api/analysis/review', async route => {
    const {positions} = route.request().postDataJSON(); batches.push(positions);
    if (batches.length === 1) await new Promise(resolve=>{release=resolve;});
    if (batches.length === 2) return route.fulfill({status:503,json:{error:'Unavailable'}});
    return route.fulfill({json:{results:positions.map(position=>({...position,tone:'good'}))}});
  });
  await page.goto('/tests/browser/fixture.html?view=reviewQueue');
  await page.getByRole('button',{name:'Append'}).click();
  await expect.poll(()=>batches.length).toBe(1);
  await page.getByRole('button',{name:'Append'}).click();
  await page.waitForTimeout(200);
  expect(batches.length).toBe(1);
  release();
  await expect.poll(()=>batches.map(batch=>batch.map(position=>position.ply))).toEqual([[1],[2]]);
  await expect(page.getByTestId('review-status')).toContainText('Hãy thử lại');
  await page.waitForTimeout(300);
  expect(batches.length).toBe(2);
  expect(batches[0].map(p=>p.ply)).toEqual([1]);
  expect(batches[1].map(p=>p.ply)).toEqual([2]);
  await page.getByRole('button',{name:'Retry'}).click();
  await expect(page.getByTestId('review-results')).toHaveText('e4,e5');
  await page.getByRole('button',{name:'Reset'}).click();
  await expect(page.getByTestId('review-results')).toBeEmpty();
});

test('coach starts, speaks Vietnamese, receives one live review per move and can recover an opponent request', async ({ page }) => {
  const errors = []; page.on('pageerror',error=>errors.push(error.message));
  await mockUiApi(page);
  await page.addInitScript(() => {
    window.coachSpoken = [];
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', {value:{getVoices:()=>[{name:'Tiếng Việt',lang:'vi-VN'}],cancel(){},addEventListener(){},removeEventListener(){},speak(utterance){window.coachSpoken.push({text:utterance.text,lang:utterance.lang});}},configurable:true});
  });
  let opponentRequests = 0; const analyzed = []; const analysisModes = [];
  await page.route('**/api/analysis/move', async route => {
    const body = route.request().postDataJSON();
    if (!body.fullStrength && ++opponentRequests === 1) return route.fulfill({status:503,json:{error:'Engine restarting'}});
    const board = new Chess(body.fen);
    const move = board.moves({verbose:true}).find(move=>move.san==='e5') || board.moves({verbose:true})[0];
    return route.fulfill({json:{ok:true,move:{from:move.from,to:move.to,promotion:move.promotion}}});
  });
  await page.route('**/api/analysis/review', async route => {
    const {positions,analysisMode} = route.request().postDataJSON(); analyzed.push(...positions.map(p=>p.ply)); analysisModes.push(analysisMode);
    if(analysisMode==='live') expect(positions).toHaveLength(1);
    await new Promise(resolve=>setTimeout(resolve,200));
    return route.fulfill({json:{results:positions.map(p=>({...p,tone:'best',label:'Best',bestSan:p.san,whiteScore:20,winLoss:0,mover:new Chess(p.fen).turn()}))}});
  });
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/coach');
  await page.getByRole('button',{name:'Bắt đầu luyện',exact:true}).click();
  await expect(page.locator('.play-turn')).toContainText('Lượt Trắng');
  await page.locator('.board').getByRole('button',{name:'e2',exact:true}).click();
  await page.locator('.board').getByRole('button',{name:'e4',exact:true}).click();
  await expect(page.getByRole('button',{name:'Thử lại nước của đối thủ'})).toBeVisible();
  await page.getByRole('button',{name:'Thử lại nước của đối thủ'}).click();
  await expect(page.locator('.play-moves')).toContainText('e5');
  await expect(page.locator('.play-coach-assessment')).toContainText('Tốt nhất');
  await expect.poll(()=>analyzed.length).toBe(2);
  expect(analyzed).toEqual([1,2]);
  expect(analysisModes).toEqual(['live','live']);
  const speech = await page.evaluate(()=>window.coachSpoken);
  expect(speech.some(item=>item.text.includes('tốt đến e 4'))).toBe(true);
  expect(speech.every(item=>item.lang==='vi-VN')).toBe(true);
  await page.screenshot({path:'playwright-report/ui-audit-current/coach-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Đánh giá',exact:true}).click();
  await expect(page).toHaveURL(/\/review$/);
  await page.locator('.review-studio-head').getByRole('button',{name:'Về ván đấu',exact:true}).click();
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.locator('.play-moves')).toContainText('e5');
  await page.getByRole('button',{name:'Xoay bàn',exact:true}).click();
  await expect(page.locator('.game-stage > .player-card').first()).toHaveClass(/white/);
  await page.getByRole('button',{name:'Đầu hàng',exact:true}).click();
  await page.getByRole('button',{name:'Xác nhận',exact:true}).click();
  await expect(page.getByText('Huấn luyện viên thắng',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Luyện lại bài này'}).click();
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.locator('.play-turn')).toContainText('Lượt Trắng');
  await expect(page.locator('.play-moves')).not.toContainText('e5');
  expect(errors).toEqual([]);
});

test('support conversations show the latest server status/history, preserve text on failure and post a reply once', async ({ page }) => {
  await mockUiApi(page);
  const ticket={id:'ticket-1',subject:'Cần kiểm tra gói',category:'billing',status:'new',message:'Tôi đã thanh toán nhưng chưa thấy gói mới.',createdAt:'2026-09-14T08:00:00Z'};
  await page.route('**/api/support/requests?*',route=>route.fulfill({json:{ok:true,requests:[ticket],totalPages:1}}));
  let count=0;
  await page.route('**/api/support/requests/ticket-1/messages', async route => {
    if(route.request().method()==='POST') { count++; return route.fulfill({status:count===1?503:200,json:count===1?{error:'Chưa thể gửi phản hồi.'}:{ok:true}}); }
    return route.fulfill({json:{
      ok:true,
      ticket:{...ticket,status:'in_review',updatedAt:'2026-09-14T09:00:00Z'},
      messages:[{id:'reply',senderType:'admin',body:'Bạn gửi thêm mã giao dịch giúp mình nhé.',createdAt:'2026-09-14T09:00:00Z'}],
      events:[{id:'event-1',old_status:'new',new_status:'in_review',created_at:'2026-09-14T08:30:00Z'}]
    }});
  });
  await page.goto('/support/tickets');
  const opener=page.getByRole('button',{name:/Cần kiểm tra gói/});
  await opener.click();
  const dialog=page.getByRole('dialog',{name:'Trao đổi hỗ trợ'});
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Bạn gửi thêm mã giao dịch');
  await expect(dialog.locator('.support-status')).toHaveText('Đang xử lý');
  await expect(dialog.locator('.support-status-history')).toContainText('Mới → Đang xử lý');
  await dialog.getByRole('textbox',{name:'Nội dung phản hồi'}).fill('Mã giao dịch của tôi là DEMO-123.');
  await dialog.getByRole('button',{name:'Gửi',exact:true}).click();
  await expect(dialog).toContainText('Chưa thể gửi phản hồi.');
  await expect(dialog.getByRole('textbox',{name:'Nội dung phản hồi'})).toHaveValue('Mã giao dịch của tôi là DEMO-123.');
  await dialog.getByRole('button',{name:'Gửi',exact:true}).click();
  await expect(dialog.getByRole('textbox',{name:'Nội dung phản hồi'})).toBeEmpty();
  expect(count).toBe(2);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('a pending analysis from a reset game cannot populate the new board', async ({ page }) => {
  let firstReply; let count=0;
  await page.route('**/api/analysis/review', async route => {
    const {positions}=route.request().postDataJSON(); count++;
    if(count===1) await new Promise(resolve=>{firstReply=resolve;});
    await route.fulfill({json:{results:positions.map(position=>({...position,tone:'good'}))}}).catch(()=>{});
  });
  await page.goto('/tests/browser/fixture.html?view=reviewQueue');
  await page.getByRole('button',{name:'Append'}).click();
  await expect.poll(()=>count).toBe(1);
  await page.getByRole('button',{name:'Reset'}).click();
  firstReply();
  await page.waitForTimeout(150);
  await expect(page.getByTestId('review-results')).toBeEmpty();
  await page.getByRole('button',{name:'Append'}).click();
  await expect(page.getByTestId('review-results')).toHaveText('e4');
  expect(count).toBe(2);
});

test('all four playing workspaces fit phones and local chess still accepts legal moves', async ({ page }) => {
  await mockUiApi(page);
  await page.setViewportSize({width:390,height:844});
  for (const [route,selector,name] of [['/play/bot','.board','bot'],['/coach','.board','coach'],['/play/local','.local-chess-board','local'],['/play/online','.online-board','online']]) {
    await page.goto(route);
    await expect(page.locator(selector).first()).toBeVisible();
    await expect(page.locator('.route-loading')).toHaveCount(0);
    const box = await page.locator(selector).first().boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(391);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
    await page.screenshot({path:`playwright-report/ui-audit-current/${name}-phone.png`,fullPage:true});
  }
  await page.goto('/play/local');
  await page.getByRole('button',{name:'Bắt đầu',exact:true}).click();
  await page.getByRole('button',{name:'e2',exact:true}).click();
  await page.getByRole('button',{name:'e4',exact:true}).click();
  await expect(page.locator('.local-move-list')).toContainText('e4');
});
