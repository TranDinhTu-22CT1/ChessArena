import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { PUZZLE_POSITIONS } from '../src/lib/puzzlePositions.js';
import { checkCatalogMove, dailyPuzzle, selectPuzzle, publicPuzzle } from '../src/lib/puzzleRules.js';

test('all catalog combinations are legal, finite and reach their stated goal', () => {
  assert.equal(new Set(PUZZLE_POSITIONS.map(p=>p.id)).size,PUZZLE_POSITIONS.length);
  for (const puzzle of PUZZLE_POSITIONS) {
    const board = new Chess(puzzle.fen);
    const color = board.turn();
    assert.equal(puzzle.line.length % 2,1);
    const played = puzzle.line.map(lan => board.move(lan));
    if (puzzle.theme === 'mate') assert.ok(board.isCheckmate(),puzzle.id);
    if (puzzle.theme === 'promotion') assert.ok(played.at(-1).promotion,puzzle.id);
    if (puzzle.theme === 'material') assert.ok(played.some(m=>m.color===color && ['n','b','r','q'].includes(m.captured)),puzzle.id);
    assert.equal(board.isStalemate(),false,puzzle.id);
    assert.equal('line' in publicPuzzle(puzzle),false);
    assert.equal('solution' in publicPuzzle(puzzle),false);
  }
});

test('two-move exercises need both answers and reject forged progress or replayed completion', () => {
  const puzzle = PUZZLE_POSITIONS.find(p=>p.id==='mg-legal-mate-two');
  const first = checkCatalogMove(puzzle,'c4f7');
  assert.equal(first.accepted,true); assert.equal(first.complete,false); assert.equal(first.reply,'e8e7');
  assert.equal(new Chess(first.fen).turn(),'w');
  const final = checkCatalogMove(puzzle,'c3d5',first.playedMoves);
  assert.equal(final.complete,true); assert.ok(new Chess(final.fen).isCheckmate());
  assert.throws(()=>checkCatalogMove(puzzle,'c3d5',['a2a3','e8e7']),{status:400});
  assert.throws(()=>checkCatalogMove(puzzle,'c3d5',final.playedMoves),{status:400});
  assert.throws(()=>checkCatalogMove(puzzle,'c4c7'),{status:400});
  assert.equal(checkCatalogMove(puzzle,'a2a3').accepted,false);
});

test('daily assignment ignores client filters, history, preferred IDs and forged dates', () => {
  const today = dailyPuzzle();
  assert.equal(selectPuzzle({mode:'daily',excluded:PUZZLE_POSITIONS.map(p=>p.id),date:'1900-01-01',preferredId:'other',theme:'other'}).id,today.id);
  assert.equal(dailyPuzzle('2026-09-14').id,dailyPuzzle('2026-09-14').id);
  assert.notEqual(dailyPuzzle('2026-09-14').id,dailyPuzzle('2026-09-15').id);
});

test('rated selection follows the learner; filters and exhausted sets are respected', () => {
  assert.ok(selectPuzzle({mode:'rated',rating:1400},()=>0).rating>=1200);
  assert.ok(selectPuzzle({mode:'rated',rating:600},()=>0).rating<=750);
  const custom = selectPuzzle({mode:'custom',theme:'promotion',stage:'endgame',minRating:1000,maxRating:1100},()=>0);
  assert.equal(custom.theme,'promotion'); assert.ok(custom.rating>=1000&&custom.rating<=1100);
  assert.equal(selectPuzzle({mode:'rated',excluded:PUZZLE_POSITIONS.map(p=>p.id)}),null);
});
