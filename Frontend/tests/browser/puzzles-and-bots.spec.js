import { test, expect } from '@playwright/test';
import { mockUiApi, uiUser } from './ui-data.js';
import { Chess } from 'chess.js';
import { PUZZLE_POSITIONS } from '../../../backend/src/lib/puzzlePositions.js';
import { checkCatalogMove, publicPuzzle } from '../../../backend/src/lib/puzzleRules.js';

test('combination needs both player moves, does not send illegal clicks, and saves only after completion', async ({page}) => {
  await mockUiApi(page);
  const puzzle = PUZZLE_POSITIONS.find(p=>p.id==='mg-legal-mate-two');
  const answers=[], sessions=[];
  const attemptId='88888888-8888-4888-8888-888888888888';
  const run={id:'99999999-9999-4999-8999-999999999999',status:'active',mode:'daily',score:0};
  let version=0, played=[];
  await page.route('**/api/puzzles/next',route=>route.fulfill({json:{ok:true,puzzle:{...publicPuzzle(puzzle),attemptId,version,run,playedMoves:played}}}));
  await page.route('**/api/puzzles/check',route=>{
    const body=route.request().postDataJSON(); answers.push(body);
    expect(body.attemptId).toBe(attemptId);expect(body.version).toBe(version);
    const checked=checkCatalogMove(puzzle,body.move,played);played=checked.playedMoves;
    version++;
    return route.fulfill({json:{ok:true,...checked,version,reward:checked.complete?20:0,run:{...run,status:checked.complete?'finished':'active'},progress:{rating:1200,points:checked.complete?20:0}}});
  });
  await page.route('**/api/puzzles/session',route=>{
    if(route.request().method()==='POST')sessions.push(route.request().postDataJSON());
    return route.fulfill({json:{ok:true,progress:{rating:1200},dailyClaims:[]}});
  });
  await page.goto('/puzzles/daily');
  const board=page.getByRole('region',{name:'Puzzle board'});
  await expect(page.getByText('Hoàn thành chuỗi 2 nước của bạn')).toBeVisible();
  await board.getByRole('button',{name:'a2',exact:true}).click();
  await board.getByRole('button',{name:'a5',exact:true}).click();
  expect(answers.length).toBe(0);
  await board.getByRole('button',{name:'c4',exact:true}).click();
  await board.getByRole('button',{name:'f7',exact:true}).click();
  await expect(page.locator('.puzzle-status [role="status"]')).toContainText('Hãy đi tiếp');
  expect(sessions.length).toBe(0);
  await board.getByRole('button',{name:'c3',exact:true}).click();
  await board.getByRole('button',{name:'d5',exact:true}).click();
  await expect(page.locator('.puzzle-status [role="status"]')).toContainText('Chính xác');
  expect(answers[1].playedMoves).toEqual(['c4f7','e8e7']);
  await expect.poll(()=>sessions.length).toBe(1);
  expect(sessions[0].runId).toBe(run.id);
});

test('puzzle promotion offers all four pieces, supports a rook mate, and fits a phone', async ({page}) => {
  await mockUiApi(page);
  const puzzle=PUZZLE_POSITIONS.find(p=>p.id==='eg-promotion-capture');
  const answers=[];
  await page.route('**/api/puzzles/next',route=>route.fulfill({json:{ok:true,puzzle:publicPuzzle(puzzle)}}));
  await page.route('**/api/puzzles/check',route=>{
    const body=route.request().postDataJSON();answers.push(body.move);
    return route.fulfill({json:{ok:true,...checkCatalogMove(puzzle,body.move,body.playedMoves)}});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/puzzles/daily');
  const board=page.getByRole('region',{name:'Puzzle board'});
  await board.getByRole('button',{name:'a7',exact:true}).click();
  await board.getByRole('button',{name:'b8',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Chọn quân phong cấp'});
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-promotion]')).toHaveCount(4);
  expect(answers).toEqual([]);
  const box=await dialog.boundingBox(), boardBox=await board.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(boardBox.x);
  expect(box.x+box.width).toBeLessThanOrEqual(boardBox.x+boardBox.width);
  await page.screenshot({path:'playwright-report/ui-audit-current/puzzle-promotion.png',fullPage:true});
  await dialog.getByRole('button',{name:'Phong cấp thành Xe'}).click();
  await expect(page.locator('.puzzle-status [role="status"]')).toContainText('Chính xác');
  expect(answers).toEqual(['a7b8r']);
});

test('a slow puzzle response from the previous mode cannot replace the new board', async ({page}) => {
  await mockUiApi(page);
  let release, waiting=false;
  await page.route('**/api/puzzles/next',async route=>{
    const {mode}=route.request().postDataJSON();
    if(mode==='rated'){waiting=true;await new Promise(resolve=>{release=resolve;});}
    return route.fulfill({json:{ok:true,puzzle:publicPuzzle(PUZZLE_POSITIONS.find(p=>p.id===(mode==='daily'?'eg-promotion-capture':'mg-fools-mate-black')))}});
  });
  await page.goto('/puzzles');
  await expect.poll(()=>waiting).toBe(true);
  await page.getByRole('button',{name:'Daily Puzzle',exact:true}).click();
  const board=page.getByRole('region',{name:'Puzzle board'});
  await expect(board.getByRole('button',{name:'a7',exact:true}).locator('img')).toHaveCount(1);
  release();
  await page.waitForTimeout(150);
  await expect(board.getByRole('button',{name:'a7',exact:true}).locator('img')).toHaveCount(1);
  await expect(page.getByText('Phong cấp · Tàn cuộc')).toBeVisible();
});

test('online waits for a promotion choice and sends the selected knight exactly once', async ({page}) => {
  await mockUiApi(page);
  const id='77777777-7777-4777-8777-777777777777';
  let game={id,status:'active',matchType:'friend',mode:'rapid',rated:false,
    fen:'7k/P7/8/8/8/8/7p/7K w - - 0 1',pgn:'',turn:'w',result:'*',timeControl:'600+0',
    playerColor:'w',moves:[],white:{id:uiUser.id,name:uiUser.displayName,rating:850},
    black:{id:'22222222-2222-4222-8222-222222222222',name:'Đối thủ',rating:850},
    startedAt:new Date().toISOString(),lastMoveAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    clocks:{whiteMs:600000,blackMs:600000}};
  const sent=[]; let resignations=0;
  await page.route(url=>url.pathname===`/api/online/games/${id}`,route=>route.fulfill({json:{ok:true,game}}));
  await page.route('**/api/online/heartbeat',route=>route.fulfill({json:{ok:true,me:{id:uiUser.id,rating:850},game,currentGameId:id}}));
  await page.route(url=>url.pathname===`/api/online/games/${id}/events`,route=>route.fulfill({contentType:'text/event-stream',body:': ready\n\n'}));
  await page.route(url=>url.pathname===`/api/online/games/${id}/move`,route=>{
    const body=route.request().postDataJSON();sent.push(body);
    const chess=new Chess(game.fen),move=chess.move(body);
    game={...game,fen:chess.fen(),turn:'b',moves:[{...move,ply:1,fenAfter:chess.fen()}],updatedAt:new Date().toISOString()};
    return route.fulfill({json:{ok:true,game}});
  });
  await page.route(url=>url.pathname===`/api/online/games/${id}/resign`,route=>{
    resignations++;
    game={...game,status:'resigned',result:'0-1',finishedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    return route.fulfill({json:{ok:true,game}});
  });
  await page.goto(`/play/online?game=${id}`);
  const board=page.getByRole('region',{name:'Online chess board'});
  await board.getByRole('button',{name:'a7',exact:true}).click();
  await board.getByRole('button',{name:'a8',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Chọn quân phong cấp'});
  await expect(dialog.locator('[data-promotion]')).toHaveCount(4);
  expect(sent).toHaveLength(0);
  await dialog.press('Escape');
  await expect(dialog).toBeHidden();
  expect(sent).toHaveLength(0);
  await board.getByRole('button',{name:'a7',exact:true}).click();
  await board.getByRole('button',{name:'a8',exact:true}).click();
  await dialog.getByRole('button',{name:'Phong cấp thành Mã'}).click();
  await expect.poll(()=>sent.length).toBe(1);
  expect(sent[0]).toMatchObject({from:'a7',to:'a8',promotion:'n'});
  await expect(dialog).toBeHidden();
  await page.getByRole('button',{name:'Đầu hàng',exact:true}).click();
  const resignDialog=page.getByRole('dialog',{name:/Bạn muốn kết thúc ván đấu/});
  await expect(resignDialog).toBeVisible(); expect(resignations).toBe(0);
  await resignDialog.getByRole('button',{name:'Quay lại ván'}).click(); expect(resignations).toBe(0);
  await page.getByRole('button',{name:'Đầu hàng',exact:true}).click();
  await page.getByRole('dialog',{name:/Bạn muốn kết thúc ván đấu/}).getByRole('button',{name:'Xác nhận đầu hàng'}).click();
  await expect.poll(()=>resignations).toBe(1);
});
