import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isChessArenaSupportQuestion,
  isChessBiographyQuestion,
  isPotentialBiographyLookup,
  normalizeAiCoachText
} from '../src/lib/aiCoachIntent.js';

test('AI Coach normalization handles Vietnamese d with stroke', () => {
  assert.equal(normalizeAiCoachText('Giải đấu và đại kiện tướng'), 'giai dau va dai kien tuong');
});

test('AI Coach accepts chess player biographies from different eras', () => {
  assert.equal(isChessBiographyQuestion('Hikaru Nakamura là ai?'), true);
  assert.equal(isChessBiographyQuestion('Capablanca là ai?'), true);
  assert.equal(isChessBiographyQuestion('Đại kiện tướng Nguyễn Văn A là ai?'), true);
  assert.equal(isChessBiographyQuestion('Elon Musk là ai?'), false);
  assert.equal(isPotentialBiographyLookup('Nguyễn Ngọc Trường Sơn là ai?'), true);
  assert.equal(isPotentialBiographyLookup('Elon Musk là ai?'), true);
});

test('AI Coach accepts common ChessArena feature questions', () => {
  assert.equal(isChessArenaSupportQuestion('tôi mua hàng ở đâu'), true);
  assert.equal(isChessArenaSupportQuestion('tôi kết bạn như nào'), true);
  assert.equal(isChessArenaSupportQuestion('giải đấu của bạn như thế nào'), true);
});
