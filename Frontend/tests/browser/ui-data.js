export const uiUser = { uid:'11111111-1111-4111-8111-111111111111',id:'11111111-1111-4111-8111-111111111111',displayName:'Nguyễn Minh Anh',email:'demo@example.test',emailVerified:true };
export const uiMembership = { tier:'pro',status:'active',provider:'paypal',billingCycle:'monthly',currentPeriodEnd:'2099-10-12T12:00:00Z',autoRenew:true };
export async function mockUiApi(page, { signedIn=true, noticeSeen=true }={}) {
 if (noticeSeen) await page.addInitScript((uid) => {
  for (const key of ['guest', uid]) localStorage.setItem(`chessarena-academic-notice-seen:${key}`, '1');
 }, uiUser.uid);
 await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
  const p=new URL(route.request().url()).pathname;
  let data={ok:true};
  if(p==='/api/auth/me')data={ok:true,user:signedIn?uiUser:null};
  else if(p==='/api/health')data={ready:true};
  else if(p==='/api/user/membership')data={ok:true,membership:uiMembership};
  else if(p==='/api/user/preferences')data={ok:true,preferences:{theme:{appearance:'light'}}};
  else if(p==='/api/online/invitations')data={ok:true,invitations:[]};
  else if(p==='/api/online/heartbeat')data={ok:true,me:{id:uiUser.id,rating:850},onlineCount:10,queueCount:2};
  else if(p==='/api/friends')data={ok:true,friends:[{id:'friendship',user:{id:'22222222-2222-4222-8222-222222222222',displayName:'Người bạn có tên hiển thị khá dài',username:'a_long_username_for_layout_testing',presence:{online:true,status:'online'}}}],incoming:[],outgoing:[]};
  else if(p==='/api/notifications')data={ok:true,notifications:[{id:'notice',title:'Lời mời kết bạn mới',body:'Một người chơi đã gửi lời mời kết bạn cho bạn.',createdAt:'2026-09-13T12:00:00Z',readAt:null,actionUrl:'/friends'}],unreadCount:1,total:1,totalPages:1};
  else if(p==='/api/online/history')data={ok:true,games:[{id:'game',result:'1-0',playerColor:'w',white:{you:true,ratingDelta:12},black:{name:'Người chơi có tên dài'},moves:[],mode:'rapid',timeControl:'600+0',finishedAt:'2026-09-13T12:00:00Z'}],total:1,totalPages:1};
  else if(p==='/api/user/profile')data={ok:true,user:uiUser,profile:{displayName:uiUser.displayName,email:uiUser.email},ratings:[],recentGames:[],summary:{gamesPlayed:24,wins:12,losses:8,draws:4},training:{},skillLab:{},achievements:[]};
  else if(p==='/api/social/follows')data={ok:true,followers:[],following:[],counts:{followers:0,following:0}};
  else if(p==='/api/social/activity')data={ok:true,activity:[]};
  else if(p==='/api/leaderboard')data={ok:true,players:[],leaderboard:[],totalPages:1};
  else if(p==='/api/achievements')data={ok:true,achievements:[]};
  else if(p==='/api/paypal/plans')data={ok:true,prices:{}};
  else if(p==='/api/bots')data={ok:true,bots:[]};
  else if(p==='/api/puzzles/session')data={ok:true,progress:{}};
  else if(p==='/api/puzzles/next')data={ok:false,error:'Chưa có câu đố trong dữ liệu kiểm thử.'};
  return route.fulfill({json:data});
 });
}
