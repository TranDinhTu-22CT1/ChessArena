import { Chess } from 'chess.js';
import { isOpeningBookMove } from './openingBook';
import { withStockfishEngine } from './stockfishEngine';

function moveLan(move) {
  return `${move.from_square}${move.to_square}${move.promotion || ''}`;
}

function sameMove(a, b) {
  return String(a || '').slice(0, 5) === String(b || '').slice(0, 5);
}

function riskFromSignals({ engineMatchRate, suspiciousMoveCount, totalMoves, lowTimeConsistency }) {
  if (totalMoves < 8) return 0;
  const matchScore = Math.round(engineMatchRate * 70);
  const suspiciousScore = Math.min(20, suspiciousMoveCount * 4);
  const timingScore = Math.round(lowTimeConsistency * 10);
  return Math.max(0, Math.min(100, matchScore + suspiciousScore + timingScore));
}

function longestMatchStreak(rows) {
  return rows.reduce((state, row) => {
    const next = row.matched ? state.current + 1 : 0;
    return { current: next, best: Math.max(state.best, next) };
  }, { current: 0, best: 0 }).best;
}

export async function analyzeOnlineGameForUser(game, moves, userId, options = {}) {
  const userColor = game.white_user_id === userId ? 'w' : game.black_user_id === userId ? 'b' : null;
  if (!userColor) throw new Error('User is not a player in this game.');

  const movetime = Math.max(70, Math.min(220, Number(options.movetime) || 90));
  const chess = new Chess();
  const priorMoves = [];
  const positions = [];
  let previousMoveAt = Date.parse(game.started_at || game.created_at || '');

  for (const move of moves) {
    const lan = moveLan(move);
    if (move.color === userColor) {
      const moveAt = Date.parse(move.created_at || '');
      positions.push({
        ply: move.ply,
        san: move.san,
        lan,
        fen: chess.fen(),
        priorMoves: [...priorMoves],
        elapsedMs: Number.isFinite(previousMoveAt) && Number.isFinite(moveAt)
          ? Math.max(0, moveAt - previousMoveAt)
          : null,
        book: isOpeningBookMove(priorMoves, lan)
      });
    }
    chess.move({ from: move.from_square, to: move.to_square, promotion: move.promotion || undefined });
    priorMoves.push(lan);
    const moveAt = Date.parse(move.created_at || '');
    if (Number.isFinite(moveAt)) previousMoveAt = moveAt;
  }

  const candidates = positions.filter((position) => !position.book && position.ply > 8).slice(0, 24);
  if (candidates.length === 0) {
    return {
      riskScore: 0,
      engineMatchRate: 0,
      lowTimeConsistency: 0,
      suspiciousMoveCount: 0,
      totalMoves: positions.length,
      details: { message: 'Not enough non-opening moves to analyze.', checked: 0 }
    };
  }

  const checked = await withStockfishEngine({ skillLevel: 20 }, async (engine) => {
    await engine.configure({ skillLevel: 20 });
    const rows = [];
    for (const position of candidates) {
      const best = await engine.analyze({ fen: position.fen, movetime });
      const matched = sameMove(position.lan, best.bestMove);
      rows.push({
        ply: position.ply,
        san: position.san,
        played: position.lan,
        bestMove: best.bestMove,
        matched,
        elapsedMs: position.elapsedMs
      });
    }
    return rows;
  });

  const matches = checked.filter((item) => item.matched);
  const fastMatches = matches.filter((item) => Number.isFinite(item.elapsedMs) && item.elapsedMs <= 2500);
  const timedRows = checked.filter((item) => Number.isFinite(item.elapsedMs));
  const averageMoveMs = timedRows.length
    ? Math.round(timedRows.reduce((sum, item) => sum + item.elapsedMs, 0) / timedRows.length)
    : null;
  const engineMatchRate = checked.length ? matches.length / checked.length : 0;
  const lowTimeConsistency = matches.length ? fastMatches.length / matches.length : 0;
  const suspiciousMoveCount = fastMatches.length;
  const riskScore = riskFromSignals({
    engineMatchRate,
    suspiciousMoveCount,
    totalMoves: checked.length,
    lowTimeConsistency
  });

  return {
    riskScore,
    engineMatchRate,
    lowTimeConsistency,
    suspiciousMoveCount,
    totalMoves: checked.length,
    details: {
      policy: 'engine_match_plus_timing_v1',
      movetime,
      checked,
      longestMatchStreak: longestMatchStreak(checked),
      averageMoveMs,
      fastBestMoveThresholdMs: 2500
    }
  };
}

export async function createAntiCheatReportsForGame(supabase, game, moves, options = {}) {
  if (!game?.id || !game.white_user_id || !game.black_user_id || !Array.isArray(moves) || moves.length < 12) {
    return [];
  }

  const reports = [];
  for (const userId of [game.white_user_id, game.black_user_id]) {
    const { data: existing } = await supabase
      .from('anti_cheat_reports')
      .select('id')
      .eq('game_id', game.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) continue;

    const analysis = await analyzeOnlineGameForUser(game, moves, userId, options);
    if (analysis.riskScore < 45) continue;

    const { data: report, error } = await supabase
      .from('anti_cheat_reports')
      .insert({
        user_id: userId,
        game_id: game.id,
        risk_score: analysis.riskScore,
        engine_match_rate: analysis.engineMatchRate,
        low_time_consistency: analysis.lowTimeConsistency,
        suspicious_move_count: analysis.suspiciousMoveCount,
        total_moves: analysis.totalMoves,
        details: analysis.details
      })
      .select('*')
      .single();
    if (!error && report) reports.push(report);
  }
  return reports;
}
