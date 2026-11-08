import { test, expect } from '@playwright/test';
import { Chess } from 'chess.js';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const GAME='99999999-9999-4999-8999-999999999999';

test('two independent clients exchange moves and chat through the realtime stream without duplicates', {timeout:60_000}, async ({browser})=>{
  test.setTimeout(60_000);
  const contextA=await browser.newContext(),contextB=await browser.newContext();
  const chess=new Chess(); let version=1; let updatedAt=new Date().toISOString(); let status='active'; let result='*'; let drawOfferBy=null;
  const moves=[]; const messages=[]; const drawActions=[];
  let releaseFirstMove;
  const firstMoveResponse = new Promise(resolve=>{releaseFirstMove=resolve;});
  const responseGame=(id)=>({
    id:GAME,status,matchType:'friend',mode:'rapid',rated:false,fen:chess.fen(),pgn:chess.pgn(),turn:chess.turn(),result,
    timeControl:'600+0',playerColor:id===A?'w':'b',moves:[...moves],stateVersion:version,
    white:{id:A,name:'Player A',rating:800,you:id===A},black:{id:B,name:'Player B',rating:810,you:id===B},
    startedAt:'2026-09-21T10:00:00.000Z',lastMoveAt:updatedAt,updatedAt,clockSnapshotAt:updatedAt,clocks:{w:600000,b:600000},
    drawOffer:drawOfferBy?{byUserId:drawOfferBy,byYou:drawOfferBy===id}:null
  });
  const setup=async(context,id)=>{
    const page=await context.newPage();
    await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
      const request=route.request(),path=new URL(request.url()).pathname;
      if(path===`/api/online/games/${GAME}/events`){
        const latest=messages.at(-1);
        const body=`retry: 40\nevent: realtime-status\ndata: ${JSON.stringify({connected:true})}\n\nevent: game\ndata: ${JSON.stringify({game:responseGame(id)})}\n\n${latest?`event: chat\ndata: ${JSON.stringify({message:{...latest,you:latest.userId===id}})}\n\n`:''}`;
        return route.fulfill({status:200,contentType:'text/event-stream',body});
      }
      if(path===`/api/online/games/${GAME}/move`){
        const payload=request.postDataJSON(); const move=chess.move(payload);
        if(!move)return route.fulfill({status:400,json:{ok:false,error:'Invalid move'}});
        version++;updatedAt=new Date().toISOString();
        moves.push({id:version,ply:moves.length+1,color:move.color,san:move.san,lan:move.lan,from:move.from,to:move.to,promotion:move.promotion||null,fenAfter:chess.fen(),createdAt:updatedAt});
        const committed=responseGame(id);
        if (moves.length===1) await firstMoveResponse;
        return route.fulfill({json:{ok:true,game:committed}});
      }
      if(path===`/api/online/games/${GAME}/chat`){
        if(request.method()==='POST'){
          const item={id:messages.length+1,userId:id,name:id===A?'Player A':'Player B',body:request.postDataJSON().body,createdAt:new Date().toISOString()};
          messages.push(item); return route.fulfill({json:{ok:true,message:{...item,you:true}}});
        }
        return route.fulfill({json:{ok:true,messages:messages.map(item=>({...item,you:item.userId===id}))}});
      }
      if(path===`/api/online/games/${GAME}/draw`){
        const action=request.postDataJSON().action; drawActions.push({id,action});
        if(action==='offer'&&!drawOfferBy)drawOfferBy=id;
        else if(action==='cancel'&&drawOfferBy===id)drawOfferBy=null;
        else if(action==='decline'&&drawOfferBy&&drawOfferBy!==id)drawOfferBy=null;
        else if(action==='accept'&&drawOfferBy&&drawOfferBy!==id){drawOfferBy=null;status='draw';result='1/2-1/2';}
        version++;updatedAt=new Date().toISOString();
        return route.fulfill({json:{ok:true,game:responseGame(id)}});
      }
      if(path===`/api/online/games/${GAME}`)return route.fulfill({json:{ok:true,game:responseGame(id)}});
      if(path==='/api/online/heartbeat')return route.fulfill({json:{ok:true,me:{id,rating:800},game:responseGame(id),currentGameId:GAME,onlineCount:2,queueCount:0}});
      if(path==='/api/online/invitations')return route.fulfill({json:{ok:true,userId:id,invitations:[]}});
      return route.fulfill({json:{ok:true}});
    });
    await page.goto(`/tests/browser/fixture.html?view=online&user=${id}&game=${GAME}`);
    await expect(page.getByRole('region',{name:'Online chess board'})).toBeVisible();
    return page;
  };
  try{
    const one=await setup(contextA,A),two=await setup(contextB,B);
    const boardA=one.getByRole('region',{name:'Online chess board'}),boardB=two.getByRole('region',{name:'Online chess board'});
    await boardA.getByRole('button',{name:'e2',exact:true}).click(); await boardA.getByRole('button',{name:'e4',exact:true}).click();
    await expect(two.locator('.online-moves')).toContainText('e4');
    await boardB.getByRole('button',{name:'e7',exact:true}).click(); await boardB.getByRole('button',{name:'e5',exact:true}).click();
    await expect(one.locator('.online-moves')).toContainText('e5',{timeout:1500});
    releaseFirstMove();
    await one.waitForTimeout(150);
    await expect(one.locator('.online-moves')).toContainText('e5');
    await one.locator('.online-chat-composer input').fill('Xin chào từ A'); await one.locator('.online-chat-composer').press('Enter');
    await expect(two.locator('.online-chat-messages')).toContainText('Xin chào từ A');
    await two.locator('.online-chat-composer input').fill('Chào A, từ B'); await two.locator('.online-chat-composer').press('Enter');
    await expect(one.locator('.online-chat-messages')).toContainText('Chào A, từ B');
    await expect(one.locator('.online-move-row')).toHaveCount(1); await expect(two.locator('.online-move-row')).toHaveCount(1);
    await expect(one.locator('.online-chat-messages p')).toHaveCount(2); await expect(two.locator('.online-chat-messages p')).toHaveCount(2);

    const whiteClockBefore=await one.locator('.online-clock').last().textContent();
    await one.getByRole('button',{name:/Nước trước/}).click();
    await expect(one.getByText('Reviewing an earlier position. Your live game continues normally.')).toBeVisible();
    await one.waitForTimeout(1100);
    const whiteClockAfter=await one.locator('.online-clock').last().textContent();
    expect(whiteClockAfter).not.toBe(whiteClockBefore);
    await one.getByRole('button',{name:/Nước tiếp/}).click();
    await expect(one.getByText('Returned to the live position.')).toBeVisible();

    await one.getByRole('button',{name:'Đề nghị hòa',exact:true}).click();
    const confirm=one.getByRole('dialog',{name:/Gửi đề nghị hòa cho đối thủ/});
    await expect(confirm).toBeVisible(); expect(drawActions).toHaveLength(0);
    await confirm.getByRole('button',{name:'Quay lại ván'}).click(); expect(drawActions).toHaveLength(0);
    await one.getByRole('button',{name:'Đề nghị hòa',exact:true}).click();
    await one.getByRole('dialog',{name:/Gửi đề nghị hòa cho đối thủ/}).getByRole('button',{name:'Gửi đề nghị hòa'}).click();
    const desktopOffer=two.getByRole('dialog',{name:/Player A đề nghị hòa/i});
    await expect(desktopOffer).toBeVisible();
    const pendingClockBefore=await two.locator('.online-player-bar.active-clock .online-clock').textContent();
    await two.waitForTimeout(1100);
    const pendingClockAfter=await two.locator('.online-player-bar.active-clock .online-clock').textContent();
    expect(pendingClockAfter).not.toBe(pendingClockBefore);
    await desktopOffer.getByRole('button',{name:'Từ chối'}).click();
    await expect(one.getByRole('button',{name:'Đề nghị hòa',exact:true})).toBeVisible();
    await two.setViewportSize({width:390,height:844});
    await one.getByRole('button',{name:'Đề nghị hòa',exact:true}).click();
    await one.getByRole('dialog',{name:/Gửi đề nghị hòa cho đối thủ/}).getByRole('button',{name:'Gửi đề nghị hòa'}).click();
    const mobileOffer=two.getByRole('dialog',{name:/Player A đề nghị hòa/i});
    await expect(mobileOffer).toBeVisible();
    const mobileBox=await mobileOffer.boundingBox();
    expect(mobileBox).not.toBeNull();
    expect(mobileBox.x).toBeGreaterThanOrEqual(-1);
    expect(mobileBox.y).toBeGreaterThanOrEqual(-1);
    expect(mobileBox.x+mobileBox.width).toBeLessThanOrEqual(391);
    expect(mobileBox.y+mobileBox.height).toBeLessThanOrEqual(845);
    await mobileOffer.getByRole('button',{name:'Đồng ý hòa'}).click();
    await expect(one.getByText('1/2-1/2',{exact:true}).first()).toBeVisible(); await expect(two.getByText('1/2-1/2',{exact:true}).first()).toBeVisible();
    expect(drawActions.map(item=>item.action)).toEqual(['offer','decline','offer','accept']);
  }finally{await Promise.all([contextA.close(),contextB.close()]);}
});
