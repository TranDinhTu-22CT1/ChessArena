import {test,expect} from '@playwright/test';
import {mockUiApi} from './ui-data.js';
import {Chess} from 'chess.js';
import {answerCoachQuestion} from '../../../backend/src/lib/coachAnswer.js';

test('chat shows sourced facts, resolves a follow-up and marks unavailable current ratings',async({page})=>{
  await mockUiApi(page);
  await page.route('**/api/ai/coach-chat',async route=>{
    const body=route.request().postDataJSON();
    const reply=await answerCoachQuestion(body.question,{messages:body.messages,gameContext:body.context,select:async()=>null});
    return route.fulfill({json:{ok:true,...reply}});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');await page.getByRole('button',{name:'Mở AI Coach',exact:true}).click();
  const ask=async question=>{await page.getByRole('textbox',{name:'Nhắn cho AI Coach'}).fill(question);await page.getByRole('button',{name:'Gửi',exact:true}).click();};
  await ask('Nakamura sinh năm nào?');
  await expect(page.getByRole('log')).toContainText('1987');
  await expect(page.getByRole('link',{name:'Hồ sơ FIDE · Hikaru Nakamura'})).toHaveAttribute('href','https://ratings.fide.com/profile/2016192');
  await ask('Ông ấy được phong GM khi nào?');
  await expect(page.getByRole('log')).toContainText('2003');
  await ask('Elo hiện tại của Carlsen bao nhiêu?');
  await expect(page.getByRole('log')).toContainText('Chưa đủ dữ liệu');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({path:'playwright-report/ui-audit-current/chat-knowledge-phone.png',fullPage:true});
});

test('AI chat is transient, preserves paragraphs, and ignores a canceled old answer',async({page})=>{
  await mockUiApi(page);
  await page.addInitScript(()=>{localStorage.setItem('chessarena.ai-coach.v3:old','sensitive history');});
  let release;const requests=[];
  await page.route('**/api/ai/coach-chat',async route=>{
    const body=route.request().postDataJSON();requests.push(body);
    if(requests.length===1)await new Promise(resolve=>{release=resolve;});
    return route.fulfill({json:{ok:true,answer:requests.length===1?'Nội dung cũ':'Một: giữ an toàn vua.\nHai: kiểm tra nước chiếu.'}}).catch(()=>{});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Mở AI Coach',exact:true}).click();
  await page.getByRole('textbox',{name:'Nhắn cho AI Coach'}).fill('Tôi nên học khai cuộc thế nào?');
  await page.getByRole('button',{name:'Gửi',exact:true}).click();
  await expect.poll(()=>requests.length).toBe(1);
  await page.getByRole('button',{name:'Chat mới'}).click();release();
  await expect(page.getByRole('log')).not.toContainText('Nội dung cũ');
  await page.getByRole('textbox',{name:'Nhắn cho AI Coach'}).fill('Checklist trước khi đi?');
  await page.getByRole('button',{name:'Gửi',exact:true}).click();
  await expect(page.getByRole('log')).toContainText('Hai: kiểm tra nước chiếu');
  expect(requests[1].messages.some(m=>m.content.includes('khai cuộc thế nào'))).toBe(false);
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('chessarena.ai-coach.v')))).toEqual([]);
  await page.reload();await page.getByRole('button',{name:'Mở AI Coach',exact:true}).click();
  await expect(page.getByRole('log')).not.toContainText('Hai: kiểm tra nước chiếu');
});

test('a banned session receives an appeal dialog and sending it does not restore login',async({page})=>{
  await mockUiApi(page);
  const notice={ok:false,code:'ACCOUNT_BANNED',error:'Tài khoản đang bị khóa.',ban:{id:'ban-one',reason:'Vi phạm chính sách chat',createdAt:'2026-09-18T10:00:00Z',expiresAt:null},appealToken:'appeal-proof-only'};
  await page.route('**/api/auth/me',route=>route.fulfill({status:403,json:notice}));
  let appeal=null;const authPosts=[];
  await page.route('**/api/auth/session',route=>{authPosts.push(route.request().postDataJSON());return route.fulfill({status:403,json:notice});});
  await page.route('**/api/auth/ban-appeal',route=>{
    expect(route.request().headers().authorization).toBe('Bearer appeal-proof-only');
    if(route.request().method()==='POST')appeal={id:'request-one',context:{kind:'ban_appeal'},status:'new'};
    return route.fulfill({json:{ok:true,appeal}});
  });
  await page.setViewportSize({width:390,height:844});await page.goto('/login');
  const dialog=page.getByRole('dialog',{name:'Tài khoản đang bị khóa'});
  await expect(dialog).toContainText(notice.ban.reason);
  await dialog.getByRole('textbox',{name:'Nội dung xin xem xét'}).fill('Tôi muốn trình bày lại sự việc và xin admin kiểm tra.');
  await dialog.getByRole('button',{name:'Gửi yêu cầu đến Hỗ trợ'}).click();
  await expect(dialog).toContainText('Đã chuyển yêu cầu đến admin');
  await expect(dialog).toContainText('Tài khoản vẫn bị khóa');
  expect(authPosts.length).toBe(0);
  const box=await dialog.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(391);
  await page.screenshot({path:'playwright-report/ui-audit-current/account-ban-phone.png',fullPage:true});
  await dialog.getByRole('button',{name:'Đóng thông báo'}).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button',{name:'Đăng xuất',exact:true})).toHaveCount(0);
});

test('analysis studio reuses quick coach grades, navigates the board and fits desktop and phone',async({page})=>{
  await mockUiApi(page);const batches=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/analysis/move',route=>{const board=new Chess(route.request().postDataJSON().fen);const move=board.moves({verbose:true}).find(m=>m.san==='e5')||board.moves({verbose:true})[0];return route.fulfill({json:{ok:true,move}});});
  await page.route('**/api/analysis/review',route=>{
    const body=route.request().postDataJSON();batches.push(body);
    return route.fulfill({json:{ok:true,results:body.positions.map(p=>({...p,quality:body.quality,tone:'best',label:'Best',bestMove:p.move,bestSan:p.san,score:20,bestScore:20,whiteScore:20,depth:22,winLoss:0,accuracy:100,mover:new Chess(p.fen).turn(),centipawnLoss:0,variations:[{score:20,depth:22,san:[p.san]}]}))}});
  });
  await page.setViewportSize({width:1440,height:1000});await page.goto('/coach');
  await page.getByRole('button',{name:'Bắt đầu luyện',exact:true}).click();
  await page.locator('.board').getByRole('button',{name:'e2',exact:true}).click();await page.locator('.board').getByRole('button',{name:'e4',exact:true}).click();
  await expect(page.locator('.play-moves')).toContainText('e5');
  await page.getByRole('button',{name:'Đánh giá',exact:true}).click();
  const studio=page.getByRole('region',{name:'Phân tích ván đấu',exact:true});
  await expect(studio).toBeVisible();
  await expect.poll(()=>batches.some(b=>b.quality==='quick')).toBe(true);
  await expect(studio.getByRole('status')).toHaveText('Đã phân tích toàn bộ');
  await studio.getByRole('button',{name:'Về vị trí đầu'}).click();
  await expect(page.locator('.board').getByRole('button',{name:'e2',exact:true}).locator('img')).toHaveCount(1);
  await studio.getByRole('button',{name:'Nước tiếp',exact:true}).click();
  await expect(page.locator('.board').getByRole('button',{name:'e4',exact:true}).locator('img')).toHaveCount(1);
  await expect(studio).toContainText('Các biến từ trước nước đi');
  const boardBox=await page.locator('.board').boundingBox(),panelBox=await studio.boundingBox();
  expect(panelBox.x).toBeGreaterThan(boardBox.x+boardBox.width-1);
  await page.screenshot({path:'playwright-report/ui-audit-current/review-studio-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await page.screenshot({path:'playwright-report/ui-audit-current/review-studio-phone.png',fullPage:true});
  expect(errors).toEqual([]);
});
