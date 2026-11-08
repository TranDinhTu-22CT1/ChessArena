import { test, expect } from '@playwright/test';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const INV='33333333-3333-4333-8333-333333333333';
const GAME='44444444-4444-4444-8444-444444444444';

test('a direct challenge appears top-right and acceptance opens the same board for both players', async ({ browser }) => {
  const sender=await browser.newContext(); const receiver=await browser.newContext({viewport:{width:390,height:844}});
  let invitation=null;
  const errors=[];
  async function setup(context,id,opponent) {
    const page=await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
    await page.route((url) => url.pathname.startsWith('/api/'),async(route)=>{
      const request=route.request(); const path=new URL(request.url()).pathname;
      let data={ok:true};
      const game=()=>({id:GAME,status:'active',matchType:'friend',mode:'rapid',rated:false,fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',pgn:'',turn:'w',result:'*',timeControl:'600+0',playerColor:id===A?'w':'b',moves:[],white:{id:A,name:'Người gửi',rating:800},black:{id:B,name:'Người nhận',rating:810},startedAt:new Date().toISOString(),lastMoveAt:new Date().toISOString(),updatedAt:new Date().toISOString(),clocks:{whiteMs:600000,blackMs:600000}});
      if(path==='/api/friends')data={ok:true,friends:[{id:'friendship',status:'friends',user:{id:opponent,displayName:id===A?'Người nhận':'Người gửi'}}],incoming:[],outgoing:[]};
      else if(path==='/api/online/invitations') {
        if(request.method()==='POST') { const body=request.postDataJSON(); invitation={id:INV,sender_id:A,recipient_id:B,status:'pending',time_control:body.timeControl,sender_color:body.side,expires_at:new Date(Date.now()+120000).toISOString(),sender:{id:A,display_name:'Người gửi'},recipient:{id:B,display_name:'Người nhận'}}; data={ok:true,invitation}; }
        else if(request.method()==='PATCH') { invitation={...invitation,status:'accepted',game_id:GAME}; data={ok:true,invitation}; }
        else data={ok:true,userId:id,invitations:invitation?[invitation]:[]};
      } else if(path==='/api/online/heartbeat')data={ok:true,me:{id,rating:800},onlineCount:2,queueCount:0,game:invitation?.status==='accepted'?game():null,currentGameId:invitation?.status==='accepted'?GAME:null};
      else if(path===`/api/online/games/${GAME}`)data={ok:true,game:game()};
      else if(path.endsWith('/history'))data={ok:true,games:[],totalPages:1};
      else if(path.endsWith('/chat'))data={ok:true,messages:[]};
      else if(path.endsWith('/events'))return route.fulfill({status:200,contentType:'text/event-stream',body:': ready\n\n'});
      return route.fulfill({json:data});
    });
    await page.goto(`/tests/browser/fixture.html?user=${id}`);
    return page;
  }
  try {
    const one=await setup(sender,A,B); const two=await setup(receiver,B,A);
    await one.getByLabel('Quân của bạn').selectOption('w');
    await one.getByRole('button',{name:/Thách đấu/}).click();
    const popup=two.getByRole('complementary',{name:'Lời mời chơi cờ'});
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('Người gửi');
    await expect(popup).toContainText('10 phút');
    await expect(popup).toContainText('Quân của bạn: Đen');
    const box=await popup.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(390); expect(box.y).toBeGreaterThanOrEqual(70); expect(box.y).toBeLessThan(120);
    await two.screenshot({path:'playwright-report/ui-audit-current/invitation-phone.png'});
    await two.getByRole('button',{name:'Đồng ý',exact:true}).click();
    await expect(two).toHaveURL(new RegExp(`game=${GAME}`));
    await expect(one).toHaveURL(new RegExp(`game=${GAME}`));
    await expect(one.getByRole('region',{name:'Online chess board'})).toBeVisible();
    await expect(two.getByRole('region',{name:'Online chess board'})).toBeVisible();
    await expect(one.locator('.online-player-bar').filter({hasText:'Người nhận'})).toHaveCount(1);
    await expect(one.locator('.online-player-bar').filter({hasText:'Người gửi'})).toHaveCount(1);
    await expect(two.locator('.online-player-bar').filter({hasText:'Người nhận'})).toHaveCount(1);
    await expect(two.locator('.online-player-bar').filter({hasText:'Người gửi'})).toHaveCount(1);
    expect(errors).toEqual([]);
  } finally { await sender.close(); await receiver.close(); }
});

test('premium blocks lower tiers and cancellation keeps the purchased tier and expiry visible', async ({ page }) => {
  let cancellations=0;
  await page.route((url) => url.pathname.startsWith('/api/'),async(route)=>{
    if(route.request().method()==='DELETE') {
      cancellations++;
      return route.fulfill({json:{ok:true,membership:{tier:'pro',status:'active',provider:'paypal',currentPeriodEnd:'2099-10-12T12:00:00Z',autoRenew:false,cancelAtPeriodEnd:true,cancelledAt:new Date().toISOString()}}});
    }
    return route.fulfill({json:{ok:true,prices:{}}});
  });
  await page.goto('/tests/browser/fixture.html?view=membership');
  await expect(page.getByRole('button',{name:'Đã có gói cao hơn'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Đang sử dụng'})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Nâng cấp ngay'})).toBeEnabled();
  await page.getByRole('button',{name:'Hủy gia hạn',exact:true}).click();
  expect(cancellations).toBe(0);
  await page.getByRole('button',{name:'Xác nhận hủy gia hạn'}).click();
  await expect(page.getByText(/Gia hạn đã tắt/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Đang sử dụng'})).toBeDisabled();
  await expect(page.getByText('Đã tắt gia hạn. Bạn vẫn sử dụng đầy đủ quyền lợi đến hết kỳ đã thanh toán.')).toBeVisible();
  expect(cancellations).toBe(1);
});
