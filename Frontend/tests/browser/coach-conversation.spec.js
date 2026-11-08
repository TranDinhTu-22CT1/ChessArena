import { test, expect } from '@playwright/test';
import { mockUiApi } from './ui-data.js';
import { answerCoachQuestion } from '../../../backend/src/lib/coachAnswer.js';

async function setup(page) {
  await mockUiApi(page);
  const questions=[];
  await page.route('**/api/ai/coach-chat',async route=>{
    const body=route.request().postDataJSON(); questions.push(body);
    const result=await answerCoachQuestion(body.question,{messages:body.messages,playerListState:body.playerListState,gameContext:body.context,
      viewer:{displayName:'Trần Đình Tú'},websiteSettings:{ownerName:'Trần Đình Tú',developerName:'Trần Đình Tú'},select:async()=>null});
    return route.fulfill({json:{ok:true,...result}});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Mở AI Coach',exact:true}).click();
  return questions;
}
async function ask(page,question) {
  await page.getByRole('textbox',{name:'Nhắn cho AI Coach'}).fill(question);
  await page.getByRole('button',{name:'Gửi',exact:true}).click();
  await expect(page.locator('.cac-thinking')).toHaveCount(0);
}

test('repeated GM request uses distinct names, refers to the latest person and resets on Chat mới',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const calls=await setup(page);
  const latest=page.locator('.cac-message--ai').last();
  const question='nêu cho tôi tên của 1 đại kiện tướng bất kỳ';
  await ask(page,question);
  await expect(latest).toContainText('Magnus Carlsen');
  await ask(page,question);
  await expect(latest).toContainText('Hikaru Nakamura');
  await expect(latest).not.toContainText('Magnus Carlsen');
  expect(calls.at(-1).playerListState.seen['|']).toEqual(['1503014']);
  await ask(page,'Anh ấy sinh năm nào?');
  await expect(latest).toContainText('1987');
  await ask(page,question);
  await expect(latest).toContainText('Lê Quang Liêm');
  await expect(latest.locator('.cac-sources a')).toHaveCount(1);
  await page.getByRole('button',{name:'Chat mới',exact:true}).click();
  await ask(page,question);
  await expect(latest).toContainText('Magnus Carlsen');
  expect(calls.at(-1).playerListState).toEqual({version:1,seen:{},last:null});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});

test('failed request does not consume a GM and selection survives truncated request history',async({page})=>{
  test.setTimeout(60000);
  const calls=await setup(page);
  let failNext=true;
  await page.route('**/api/ai/coach-chat',route=>{
    if(!failNext) return route.fallback();
    failNext=false;
    return route.fulfill({status:503,json:{ok:false,error:'Thử lại sau'}});
  });
  const latest=page.locator('.cac-message--ai').last();
  const question='nêu cho tôi tên của 1 đại kiện tướng bất kỳ';
  await ask(page,question);
  await expect(page.getByText('Thử lại sau',{exact:true})).toBeVisible();
  await ask(page,question);
  await expect(latest).toContainText('Magnus Carlsen');
  // More than 24 messages: the list request leaves the API's ordinary history.
  for(let i=0;i<13;i++) {
    await ask(page,'Chào bạn');
    await expect(latest).toContainText('Chào bạn!');
  }
  await ask(page,question);
  await expect(latest).toContainText('Hikaru Nakamura');
  expect(calls.at(-1).messages.some(m=>m.content===question)).toBe(false);
  expect(calls.at(-1).playerListState.seen['|']).toEqual(['1503014']);
});

test('phone chat greets, teaches, accepts quiz choices and resets contextual suggestions',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const calls=await setup(page);
  const latest=page.locator('.cac-message--ai').last();
  await ask(page,'Chào bạn nha');
  await expect(latest).toContainText('Chào bạn!');
  await expect(latest.locator('.cac-warning')).toHaveCount(0);
  await ask(page,'Quân Mã đi thế nào?');
  await expect(latest).toContainText('chữ L');
  await page.getByLabel('Gợi ý hỏi tiếp').getByRole('button',{name:'Cho ví dụ',exact:true}).click();
  await expect(latest).toContainText('Mã ở e4');
  await ask(page,'Cho bài tập');
  await expect(latest).toContainText('Mã ở a1');
  await page.getByLabel('Gợi ý hỏi tiếp').getByRole('button',{name:'a2 và b1',exact:true}).click();
  await expect(latest).toContainText('Chưa đúng');
  await ask(page,'b3 và c2');
  await expect(latest).toContainText('Đúng rồi');
  await expect(page.locator('.cac-message--user .cac-message-text p').last()).toHaveCSS('color','rgb(255, 255, 255)');
  expect(calls.at(-1).messages.some(message=>message.content==='Cho bài tập')).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await expect.poll(()=>page.getByRole('log').evaluate(node=>node.scrollHeight-node.clientHeight-node.scrollTop)).toBeLessThan(3);
  await page.screenshot({path:'playwright-report/coach-conversation-phone.png',fullPage:true});
  await page.getByRole('button',{name:'Chat mới',exact:true}).click();
  await expect(page.getByLabel('Gợi ý hỏi tiếp')).toContainText('Tôi mới bắt đầu');
  await ask(page,'Cho ví dụ');
  await expect(latest).toContainText('chủ đề nào');
  expect(calls.at(-1).messages.some(message=>message.content.includes('Mã ở a1'))).toBe(false);
});

test('chat handles compound questions, public identity and support through the backend',async({page})=>{
  const calls=await setup(page), latest=page.locator('.cac-message--ai').last();
  await ask(page,'Xin chào, chủ source web là ai?');
  await expect(latest).toContainText('Trần Đình Tú');
  await ask(page,'Mã đi thế nào? Tượng đi thế nào?');
  await expect(latest).toContainText('chữ L'); await expect(latest).toContainText('chéo');
  await ask(page,'Tạo ticket hỗ trợ');
  await expect(latest).toContainText('Hỗ trợ');
  expect(calls.at(-1).question).toBe('Tạo ticket hỗ trợ');
  await page.getByRole('button',{name:'Mở trang Hỗ trợ',exact:true}).click();
  await expect(page).toHaveURL(/\/support$/);
});

test('phone chat lists grandmasters, follows up and handles outside topics',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await setup(page);
  const latest=page.locator('.cac-message--ai').last();
  await ask(page,'Cho tôi tên 3 đại kiện tướng hiện tại.');
  await expect(latest).toContainText('Magnus Carlsen');
  await expect(latest).toContainText('Hikaru Nakamura');
  await expect(latest).toContainText('Lê Quang Liêm');
  await expect(latest.locator('.cac-sources a')).toHaveCount(3);
  await page.getByLabel('Gợi ý hỏi tiếp').getByRole('button',{name:'Kể thêm',exact:true}).click();
  await expect(latest).toContainText('Hou Yifan');
  await expect(latest).not.toContainText('Magnus Carlsen');
  await ask(page,'Tôi buồn quá');
  await expect(latest).toContainText('không thoải mái');
  await ask(page,'Thời tiết Hà Nội hôm nay?');
  await expect(latest).toContainText('chưa có dữ liệu thời tiết trực tiếp');
  await ask(page,'Quân Mã đi thế nào?');
  await expect(latest).toContainText('chữ L');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});

test('chat resolves numbered people and keeps general learning followups on topic',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await setup(page);
  const latest=page.locator('.cac-message--ai').last();
  await ask(page,'Kể tên 3 đại kiện tướng');
  await ask(page,'Người thứ hai là ai?');
  await expect(latest).toContainText('Hikaru Nakamura');
  await ask(page,'Ông ấy sinh năm nào?');
  await expect(latest).toContainText('1987');
  await ask(page,'API là gì?');
  await expect(latest).toContainText('giao diện');
  await expect(latest.locator('.cac-sources a')).toHaveAttribute('href','https://developer.mozilla.org/en-US/docs/Glossary/API');
  await page.getByLabel('Gợi ý hỏi tiếp').getByRole('button',{name:'Cho ví dụ',exact:true}).click();
  await expect(latest).toContainText('quy ước');
  await page.getByLabel('Gợi ý hỏi tiếp').getByRole('button',{name:'Tóm tắt',exact:true}).click();
  await expect(latest).toContainText('tóm tắt');
  await ask(page,'20% của 150');
  await expect(latest).toContainText('= 30');
  await ask(page,'Đổi 1,5 giờ sang phút');
  await expect(latest).toContainText('90 phút');
  await page.getByRole('button',{name:'Chat mới',exact:true}).click();
  await ask(page,'Người thứ hai là ai?');
  await expect(latest).toContainText('chưa có danh sách');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});
