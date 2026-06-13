import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicGamesAnswer,
  describeGameStage,
  findChessPlayer,
  findOpeningKnowledge,
  isOpeningKnowledgeQuestion,
  openingKnowledgeAnswer,
  playerKnowledgeAnswer
} from '../src/lib/chessKnowledge.js';

test('game stage detection distinguishes opening, middlegame and endgame', () => {
  assert.equal(describeGameStage().id, 'opening');
  assert.equal(
    describeGameStage('r1bq1rk1/ppp2ppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQR1K1 w - - 4 11').id,
    'middlegame'
  );
  assert.equal(describeGameStage('8/8/4k3/8/3K4/4P3/8/8 w - - 0 40').id, 'endgame');
});

test('classic game knowledge returns readable numbered examples', () => {
  const answer = classicGamesAnswer('Cho tôi vài ván cờ kinh điển nổi tiếng');
  assert.match(answer, /1\. /);
  assert.match(answer, /Bài học:/);
  assert.match(answer, /\n2\. /);
});

test('opening knowledge understands common aliases such as Italy', () => {
  assert.equal(isOpeningKnowledgeQuestion('Italy là khai cuộc gì?'), true);
  const matches = findOpeningKnowledge('Cho tôi biết biến Italy', 3);
  assert.equal(matches[0].name, 'Italian Game');
  assert.equal(matches[0].eco, 'C50');

  const answer = openingKnowledgeAnswer('Hướng dẫn khai cuộc Italy');
  assert.match(answer, /Italian Game/);
  assert.match(answer, /1\. e4 e5 2\. Nf3 Nc6 3\. Bc4/);
  assert.match(answer, /Một số biến thể/);
});

test('opening knowledge searches named variations from the Lichess catalog', () => {
  const matches = findOpeningKnowledge('Sicilian Defense Najdorf Variation', 2);
  assert.match(matches[0].name, /Sicilian Defense.*Najdorf/i);
});

test('player knowledge returns updated structured biographies', () => {
  assert.equal(findChessPlayer('Gukesh là ai?')?.name, 'Gukesh Dommaraju');
  assert.equal(findChessPlayer('Nguyễn Ngọc Trường Sơn là ai?')?.country, 'Việt Nam');

  const answer = playerKnowledgeAnswer('Hikaru Nakamura là ai?');
  assert.match(answer, /Hikaru Nakamura/);
  assert.match(answer, /Dữ liệu hồ sơ được rà soát/);
});
