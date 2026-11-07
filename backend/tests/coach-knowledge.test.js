import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { answerCoachQuestion } from '../src/lib/coachAnswer.js';
import { resolveCoachKnowledge, selectedKnowledge, identifyOpening } from '../src/lib/coachKnowledge.js';
import { answerBoardQuestion, resolveBoardContext } from '../src/lib/coachBoardAnswer.js';
import { COACH_LIBRARY } from '../src/data/coachLibrary.js';
import { selectCoachKnowledge } from '../src/lib/coachProvider.js';

const cases=[
  ['Carlsen sinh năm nào?',/1990/,'grounded'],
  ['Nakamura được phong GM năm nào?',/2003/,'grounded'],
  ['Lê Quang Liêm được phong đại kiện tướng khi nào?',/2006/,'grounded'],
  ['So sánh phong cách Carlsen và Nakamura',/Carlsen[\s\S]*Nakamura|Nakamura[\s\S]*Carlsen/,'grounded'],
  ['Elo hiện tại của Carlsen bao nhiêu?',/chưa đủ dữ liệu/,'insufficient'],
  ['Gukesh có bao nhiêu trận thắng Carlsen?',/chưa đủ dữ liệu/,'insufficient'],
  ['Ai là đương kim vô địch thế giới?',/chưa có nguồn cập nhật/,'insufficient'],
  ['Grandmaster Nguyễn Văn KhôngTồnTại là ai?',/chưa xác định/,'clarify'],
  ['Khai cuộc Italy là gì?',/Italian Game/,'grounded'],
  ['Làm sao chơi khai cuộc Ý?',/Italian Game/,'grounded'],
  ['Sicilian Defense Najdorf Variation',/Najdorf/,'grounded'],
  ['Khai cuộc B90 là gì?',/B90/,'grounded'],
  ['Phòng thủ Alekhine là gì?',/Alekhine.*Defense/,'grounded'],
  ["Alekhine's Defense là gì?",/Alekhine.*Defense/,'grounded'],
  ['Gambit Hậu là gì?',/Queen's Gambit/,'grounded'],
  ['Phòng thủ Ấn Độ là gì?',/King's Indian Defense/,'grounded'],
  ['Caro-Kann là gì?',/Caro-Kann/,'grounded'],
  ['Anish Giri được phong GM năm nào?',/2009/,'grounded'],
  ['FIDE ID 2016192 sinh năm nào?',/1987/,'grounded'],
  ['Khai cuộc MoonDragon Quantum là gì?',/chưa tìm được đúng/,'clarify'],
  ['1. e4 e5 2. Nf3 Nc6 3. Bc4 là khai cuộc gì?',/Italian Game/,'grounded'],
  ['Luật bắt tốt qua đường?',/ngay lượt kế tiếp/,'grounded'],
  ['Nhập thành khi xe bị tấn công?',/Xe bị tấn công không tự cấm/,'grounded'],
  ['Phong cấp có phải chỉ được một hậu?',/nhiều Hậu/,'grounded'],
  ['Stalemate khác chiếu hết?',/không bị chiếu/,'grounded'],
  ['Cách hủy gia hạn gói?',/quyền lợi vẫn còn/,'grounded'],
  ['Gửi lời mời chơi cho bạn thế nào?',/popup góc phải trên/,'grounded'],
  ['Bị khóa tài khoản có thể xin gỡ không?',/không mở khóa/,'grounded'],
];
for(const [question,expected,status] of cases)test(`grounded answer: ${question}`,async()=>{
  const result=await answerCoachQuestion(question,{select:()=>{throw new Error('This answer must not depend on a provider');}});
  assert.match(result.answer,expected);assert.equal(result.knowledge.status,status);
});

test('follow-up questions resolve the user-mentioned player, never assistant inventions',()=>{
  const messages=[{role:'user',content:'Nakamura là ai?'},{role:'assistant',content:'Nakamura sinh năm 9999, GM năm 4444'}];
  const answer=resolveCoachKnowledge('Ông ấy được phong GM khi nào?',{messages});
  assert.match(answer.answer,/2003/);assert.doesNotMatch(answer.answer,/9999|4444/);
});
test('website identity comes only from Website Settings and missing owners are not invented',()=>{
  const configured=resolveCoachKnowledge('Ai là chủ website?',{websiteSettings:{siteTitle:'ChessArena',ownerName:'Nguyễn Văn A'}});
  assert.match(configured.answer,/Nguyễn Văn A/);assert.equal(configured.knowledge.status,'grounded');
  const missing=resolveCoachKnowledge('Ai phát triển ChessArena?',{websiteSettings:{siteTitle:'ChessArena'}});
  assert.match(missing.answer,/chưa công bố/i);assert.equal(missing.knowledge.status,'insufficient');
});
test('preset middlegame and puzzle questions have useful answers without a provider', async () => {
  for (const [question, pattern] of [['Chơi trung cuộc', /trung cuộc/i], ['Puzzle Battle chơi thế nào?', /5 phút/], ['Puzzle Rush là gì?', /3/]]) {
    const result = await answerCoachQuestion(question, { select: () => { throw new Error('Unneeded provider'); } });
    assert.equal(result.knowledge.status, 'grounded'); assert.match(result.answer, pattern);
  }
});
test('public source identity uses current settings, and a read failure is not called unpublished', () => {
  const websiteSettings = { ownerName: 'Trần Đình Tú', developerName: 'Trần Đình Tú' };
  for (const question of ['Chủ source web là ai?', 'Ai là chủ sở hữu?', 'Ai code ChessArena?', 'Website này của ai?']) {
    assert.match(resolveCoachKnowledge(question, { websiteSettings }).answer, /Trần Đình Tú/);
  }
  const unavailable = resolveCoachKnowledge('Chủ source web là ai?', { websiteSettings: null });
  assert.equal(unavailable.knowledge.status, 'unavailable');
  assert.doesNotMatch(unavailable.answer, /chưa công bố/);
});
test('product FAQ covers online, review, premium, report and support flows',()=>{
  const questions=[
    ['ChessArena có những chức năng gì?',/Play Coach.*Review/s],
    ['Làm sao để chơi online?',/Tìm trận/],
    ['Làm sao sử dụng Review?',/Bắt đầu Review/],
    ['Gói Premium mua thế nào?',/PayPal/],
    ['Làm sao báo cáo người chơi?',/Báo cáo người chơi/],
    ['Tôi cần tạo ticket hỗ trợ',/Hỗ trợ/]
  ];
  for(const [question,expected] of questions){
    const result=resolveCoachKnowledge(question);assert.match(result.answer,expected);assert.equal(result.knowledge.status,'grounded');
  }
});
test('selector rejects fabricated IDs and returns only stored text, not provider prose',()=>{
  assert.equal(selectedKnowledge('{"ids":["fabricated"]}',COACH_LIBRARY),null);
  assert.equal(selectedKnowledge('Nakamura có Elo 4000',COACH_LIBRARY),null);
  const result=selectedKnowledge('{"ids":["promotion"],"answer":"Có thể phong Vua", "sources":["javascript:alert(1)"]}',COACH_LIBRARY);
  assert.match(result.answer,/không được phong Vua/);assert.doesNotMatch(result.answer,/Có thể phong Vua/);
  assert.ok(result.sources.every(source=>!source.url.startsWith('javascript')));
});
test('provider selection returns curated content and stops on no evidence without another API call',async()=>{
  const configured={AI_COACH_PROVIDER:'multi',AI_COACH_PROVIDER_ORDER:'gemini,groq,gemini,local',GEMINI_API_KEY:'test-only',GROQ_API_KEY:'test-only'};
  const previous=Object.fromEntries(Object.keys(configured).map(key=>[key,process.env[key]]));
  Object.assign(process.env,configured);
  try{
    for(const raw of ['{"ids":["promotion"],"answer":"Phong thành Vua"}','{"ids":[]}','{"ids":["invented"]}']){
      let calls=0;
      const result=await selectCoachKnowledge('Tốt đi đến cuối bàn thì sao?',{fetcher:async(url,request)=>{
        calls++;
        assert.match(url,/generativelanguage\.googleapis\.com/);
        const prompt=JSON.parse(JSON.parse(request.body).contents[0].parts[0].text);
        assert.equal(prompt.question,'Tốt đi đến cuối bàn thì sao?');
        assert.ok(prompt.index.some(card=>card.id==='promotion'));
        return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:raw}]}}]})};
      }});
      assert.equal(calls,1);
      if(raw.includes('"promotion"')){
        assert.match(result.answer,/không được phong Vua/);
        assert.doesNotMatch(result.answer,/Phong thành Vua/);
      }else assert.equal(result,null);
    }
  }finally{
    for(const [key,value] of Object.entries(previous)){
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
});
test('opening recognition validates the supplied move sequence',()=>{
  assert.match(identifyOpening('1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6').name,/Najdorf/);
  assert.throws(()=>identifyOpening('1. e4 e9'));
});
test('an explicit board routes a tactical question to analysis even outside the board screen',async()=>{
  const question='Quân treo ở đây? FEN: '+new Chess().fen();
  let analyzed=false;
  const result=await answerCoachQuestion(question,{answerBoard:async(received)=>{
    analyzed=true;assert.equal(received,question);return {answer:'Checked supplied position'};
  }});
  assert.equal(analyzed,true);assert.equal(result.answer,'Checked supplied position');
});
test('missing/invalid boards and missing move history never fall back to the starting board',async()=>{
  let calls=0;const options={analyze:()=>{calls++;throw new Error('Should not run');},review:()=>{calls++;throw new Error('Should not run');}};
  assert.equal((await answerBoardQuestion('Nên đi nước nào?',{},options)).knowledge.status,'clarify');
  assert.equal((await answerBoardQuestion('Nên đi nước nào?',{hasBoardContext:true,fen:'invalid'},options)).knowledge.status,'clarify');
  assert.equal((await answerBoardQuestion('Nước vừa rồi sai ở đâu?',{hasBoardContext:true,fen:new Chess().fen(),review:{tone:'brilliant'}},options)).knowledge.status,'clarify');
  assert.equal(calls,0);
});
test('last-move analysis uses the actual prior FEN and LAN, not the client grade',async()=>{
  const board=new Chess();board.move('f3');board.move('e5');const move=board.move('g4');
  const context={hasBoardContext:true,fen:board.fen(),previousFen:move.before,latestLan:move.lan,review:{tone:'brilliant'}};
  const best={bestMove:'g1h3',score:0,depth:12,pv:['g1h3'],variations:[]};
  const played={score:-99999,mate:-1,depth:12,pv:['g2g4','d8h4']};
  const result=await answerBoardQuestion('Nước vừa rồi sai ở đâu?',context,{review:async(fen,lan)=>{assert.equal(fen,move.before);assert.equal(lan,'g2g4');return {best,played,engine:'test'};}});
  assert.match(result.answer,/Sai lầm|Bỏ lỡ/);assert.match(result.answer,/Qh4#/);assert.doesNotMatch(result.answer,/Thiên tài/);
});
test('explicit FEN overrides the visible board and invalid moves are not replaced silently',async()=>{
  const fen='7k/8/8/8/8/8/5P2/6K1 w - - 0 1';
  assert.equal(resolveBoardContext('Phân tích FEN: '+fen,{hasBoardContext:true,fen:new Chess().fen()}).board.fen(),fen);
  const result=await answerBoardQuestion('Nf3 có hợp lệ không?',{hasBoardContext:true,fen});
  assert.equal(result.knowledge.status,'clarify');assert.match(result.answer,/Nf3/);
});
test('position failure says unavailable instead of giving a made-up candidate',async()=>{
  const result=await answerBoardQuestion('Nên đi gì tiếp?',{hasBoardContext:true,fen:new Chess().fen()},{analyze:async()=>{throw new Error('Engine busy');}});
  assert.equal(result.knowledge.status,'unavailable');assert.doesNotMatch(result.answer,/e4|Nf3|Nc3/);
});
