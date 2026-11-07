import test from 'node:test';
import assert from 'node:assert/strict';
import { publicBattle } from '../src/lib/puzzleBattle.js';
import { PUZZLE_POSITIONS } from '../src/lib/puzzlePositions.js';

const row = { id: 'battle', status: 'active', player_one_id: 'one', player_two_id: 'two', player_one_index: 2, player_two_index: 3,
  player_one_score: 1, player_two_score: 3, puzzle_ids: PUZZLE_POSITIONS.slice(0, 10).map(p => p.id),
  winner_user_id: null, expires_at: '2026-09-30T01:05:00Z', started_at: '2026-09-30T01:00:00Z' };
const profiles = [{ id: 'one', display_name: 'Trần Đình Tú', photo_url: '/avatar.svg', email: 'private@example.test', firebase_uid: 'private' }, { id: 'two', display_name: 'Đối thủ' }];

test('battle response identifies both players from each perspective without private profile data or solutions', () => {
  for (const [id, score, index, other] of [['one', 1, 2, 'two'], ['two', 3, 3, 'one']]) {
    const result = publicBattle(row, id, profiles, Date.parse('2026-09-30T01:01:00Z'));
    assert.equal(result.you.id, id); assert.equal(result.opponent.id, other);
    assert.equal(result.score, score); assert.equal(result.index, index); assert.equal(result.mistakes, index - score);
    assert.equal(result.puzzle.id, row.puzzle_ids[index]);
    assert.equal(result.puzzle.solution, undefined); assert.equal(result.puzzle.line, undefined);
    assert.equal(result.you.email, undefined); assert.equal(result.you.firebase_uid, undefined);
    assert.equal(Date.parse(result.expiresAt) - Date.parse(result.serverNow), 240000);
  }
  assert.equal(publicBattle(row, 'outsider'), null);
});
test('battle results distinguish completion, timeout, win and draw; finished players get no new puzzle', () => {
  const done = { ...row, status: 'finished', player_one_index: 10, player_two_index: 10, winner_user_id: 'one' };
  assert.equal(publicBattle(done, 'one').finishReason, 'completed');
  assert.equal(publicBattle(done, 'one').won, true); assert.equal(publicBattle(done, 'two').won, false);
  assert.equal(publicBattle(done, 'one').puzzle, null);
  const timed = publicBattle({ ...row, status: 'finished' }, 'one');
  assert.equal(timed.finishReason, 'timeout'); assert.equal(timed.winnerUserId, null);
  const waiting = publicBattle({ ...row, status: 'waiting', player_two_id: null }, 'one');
  assert.equal(waiting.opponent, null); assert.equal(waiting.puzzle, null);
});
