import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { buildCoachInsight, coachLessonFromMode, COACH_LESSON_POSITIONS } from '../src/coach/coach.js';
import { vietnameseChessSpeech, vietnameseVoice } from '../src/coach/speech.js';
import { moveRows } from '../src/game/moveRows.js';
import { BOT_PERSONAS, mergeBotPersonas } from '../src/data/bots.js';

const move = { color:'w', from:'g1', to:'f3', san:'Nf3' };
const insight = (analysis, extra = {}) => buildCoachInsight({ analysis, latestMove:move, playerColor:'w', aiElo:1600, coachMode:'opening', ...extra });

test('built-in opponents remain selectable when no custom bots have been configured', () => {
  assert.equal(mergeBotPersonas([]).length, BOT_PERSONAS.length);
  assert.equal(mergeBotPersonas([{name:'Disabled',elo:1500,active:false}]).length, BOT_PERSONAS.length);
});

test('coach distinguishes pending, unavailable scores and actual engine evidence in Vietnamese', () => {
  assert.deepEqual(insight(null).voiceMessages, []);
  assert.equal(insight(null).evaluation, '');
  const result = insight({ tone:'mistake', label:'Mistake', whiteScore:null, winLoss:12.5, bestSan:'d4' });
  assert.equal(result.quality, 'Sai lầm');
  assert.equal(result.evaluation, '');
  assert.match(result.messages.join(' '), /12.5 điểm phần trăm/);
  assert.match(result.messages.join(' '), /so sánh với d4/);
  assert.doesNotMatch(result.messages.join(' '), /không làm mất|Mistake|quân treo/);
});
test('matching SAN is never presented as an alternative and centipawns retain their units', () => {
  const result = insight({ tone:'best', bestSan:'Nf3', bestMove:'g1f3', whiteScore:35, centipawnLoss:0 });
  assert.equal(result.bestMove, '');
  assert.equal(result.evaluation, '+0.35');
  assert.match(insight({ tone:'blunder', centipawnLoss:200 }).loss, /2.00 điểm tốt/);
  assert.equal(insight({ tone:'good' }).loss, '');
});
test('opening and ending introductions follow the selected lesson, all positions can be played', () => {
  assert.match(coachLessonFromMode('opening').goal, /khai cuộc/);
  const ending = coachLessonFromMode('endgame');
  assert.equal(new Chess(ending.fen).turn(), ending.playerColor);
  const ready = insight(null, { latestMove:null, coachMode:'endgame', lesson:ending });
  assert.equal(ready.plan, ending.goal);
  assert.equal(ready.evaluation, '');
  for (const position of Object.values(COACH_LESSON_POSITIONS).flat()) assert.ok(new Chess(position.fen).moves().length);
});
test('a black-starting lesson keeps move numbers, colors and exact review indices', () => {
  const fen = COACH_LESSON_POSITIONS.endgame.at(-1).fen;
  const game = new Chess(fen);
  const moves = [game.move(game.moves()[0]), game.move(game.moves()[0])];
  const rows = moveRows(moves, fen);
  assert.equal(rows[0].number, 41);
  assert.equal(rows[0].w, undefined);
  assert.equal(rows[0].b.ply, 1);
  assert.equal(rows[1].number, 42);
  assert.equal(rows[1].w.ply, 2);
});
test('speech reads SAN in Vietnamese and never selects an English fallback voice', () => {
  assert.match(vietnameseChessSpeech('Nf3, Qxe5+, e8=Q#, O-O-O.'), /mã đến ép 3/);
  assert.match(vietnameseChessSpeech('Nf3, Qxe5+, e8=Q#, O-O-O.'), /hậu ăn tại e 5, chiếu/);
  assert.match(vietnameseChessSpeech('e8=Q#'), /phong hậu, chiếu hết/);
  assert.equal(vietnameseChessSpeech('O-O-O'), 'nhập thành dài');
  assert.equal(vietnameseVoice([{ lang:'en-US' }]), null);
  assert.equal(vietnameseVoice([{lang:'en-US'}, {lang:'vi-VN', name:'Tiếng Việt'}]).name, 'Tiếng Việt');
});
