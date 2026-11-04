import { PUZZLE_POSITIONS } from './puzzlePositions.js';
import { publicPuzzle } from './puzzleRules.js';

export function publicBattle(row, userId, profiles = [], now = Date.now()) {
  if (!row || ![row.player_one_id, row.player_two_id].includes(userId)) return null;
  const one = row.player_one_id === userId;
  const index = one ? row.player_one_index : row.player_two_index;
  const opponentIndex = one ? row.player_two_index : row.player_one_index;
  const total = row.puzzle_ids.length;
  const score = one ? row.player_one_score : row.player_two_score;
  const opponentScore = one ? row.player_two_score : row.player_one_score;
  const puzzle = row.status === 'active' && PUZZLE_POSITIONS.find(item => item.id === row.puzzle_ids[index]);
  const profile = id => {
    if (!id) return null;
    const user = profiles.find(item => item.id === id);
    return { id, name: user?.display_name || 'Người chơi', photoURL: user?.photo_url || null };
  };
  return {
    id: row.id, status: row.status, player: one ? 'one' : 'two', index, opponentIndex,
    score, opponentScore, mistakes: Math.max(0, index - score), opponentMistakes: Math.max(0, opponentIndex - opponentScore),
    total, puzzle: puzzle ? publicPuzzle(puzzle) : null,
    you: profile(userId), opponent: profile(one ? row.player_two_id : row.player_one_id),
    winnerUserId: row.winner_user_id, won: row.status === 'finished' ? row.winner_user_id === userId : null,
    finishReason: row.status === 'finished' ? (row.player_one_index >= total && row.player_two_index >= total ? 'completed' : 'timeout') : null,
    expiresAt: row.expires_at, startedAt: row.started_at, finishedAt: row.finished_at,
    serverNow: new Date(now).toISOString(), updatedAt: row.updated_at,
    rules: { durationSeconds: 300, pointsPerCorrect: 1, pointsPerWrong: 0, maxMistakes: null }
  };
}
