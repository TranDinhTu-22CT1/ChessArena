import { Chess } from 'chess.js';
import { isOpeningBookMove } from './openingBook';
import { withStockfishEngine } from './stockfishEngine';

function moveLan(move) {
  return `${move.from_square}${move.to_square}${move.promotion || ''}`;
}

function sameMove(a, b) {
  return String(a || '').slice(0, 5) === String(b || '').slice(0, 5);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalizeCpLoss(value) {
  if (!Number.isFinite(value)) return 0;
  if (Math.abs(value) > 50_000) return value > 0 ? 900 : 0;
  return clamp(value, 0, 900);
}

function evidenceBand(score) {
  if (score >= 85) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 55) return 'medium';
  if (score >= 40) return 'watch';
  return 'low';
}

function complexityForPosition(chess) {
  const legalMoves = chess.moves({ verbose: true });
  const captureOptions = legalMoves.filter((move) => move.captured).length;
  return {
    legalMoveCount: legalMoves.length,
    captureOptions,
    inCheck: chess.isCheck(),
    forced: legalMoves.length <= 1,
    complex: legalMoves.length >= 22 || captureOptions >= 4
  };
}

function timingUniformity(rows) {
  const seconds = rows
    .map((row) => Number.isFinite(row.elapsedMs) ? row.elapsedMs / 1000 : null)
    .filter((value) => value !== null && value >= 0.4 && value <= 90);
  if (seconds.length < 6) return 0;
  const mean = average(seconds);
  if (mean <= 0) return 0;
  const cv = standardDeviation(seconds) / mean;
  return clamp((0.55 - cv) / 0.45, 0, 1);
}

function riskFromSignals({
  engineMatchRate,
  suspiciousMoveCount,
  totalMoves,
  lowTimeConsistency,
  averageCpLoss,
  medianCpLoss,
  criticalMatchRate,
  complexMatchRate,
  longestMatchStreak,
  timingUniformityScore
}) {
  if (totalMoves < 8) return 0;

  const matchScore = clamp((engineMatchRate - 0.42) / 0.38, 0, 1) * 30;
  const cpScore = clamp((85 - averageCpLoss) / 75, 0, 1) * 16 + clamp((60 - medianCpLoss) / 55, 0, 1) * 10;
  const criticalScore = clamp((criticalMatchRate - 0.35) / 0.45, 0, 1) * 18;
  const complexScore = clamp((complexMatchRate - 0.38) / 0.42, 0, 1) * 10;
  const streakScore = clamp((longestMatchStreak - 4) / 7, 0, 1) * 10;
  const timingScore = clamp(lowTimeConsistency, 0, 1) * 9 + clamp(timingUniformityScore, 0, 1) * 7;
  const fastBestScore = Math.min(8, suspiciousMoveCount * 1.8);
  const samplePenalty = totalMoves < 14 ? 8 : totalMoves < 20 ? 4 : 0;

  return Math.round(clamp(matchScore + cpScore + criticalScore + complexScore + streakScore + timingScore + fastBestScore - samplePenalty));
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
      const complexity = complexityForPosition(chess);
      positions.push({
        ply: move.ply,
        san: move.san,
        lan,
        fen: chess.fen(),
        priorMoves: [...priorMoves],
        elapsedMs: Number.isFinite(previousMoveAt) && Number.isFinite(moveAt)
          ? Math.max(0, moveAt - previousMoveAt)
          : null,
        book: isOpeningBookMove(priorMoves, lan),
        ...complexity
      });
    }
    chess.move({ from: move.from_square, to: move.to_square, promotion: move.promotion || undefined });
    priorMoves.push(lan);
    const moveAt = Date.parse(move.created_at || '');
    if (Number.isFinite(moveAt)) previousMoveAt = moveAt;
  }

  const candidates = positions
    .filter((position) => !position.book && !position.forced && position.ply > 8)
    .slice(0, 32);
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
      const played = await engine.analyze({ fen: position.fen, moves: [position.lan], movetime: Math.max(60, Math.round(movetime * 0.72)) });
      const matched = sameMove(position.lan, best.bestMove);
      const playedScoreForMover = -Number(played.score || 0);
      const cpLoss = normalizeCpLoss(Number(best.score || 0) - playedScoreForMover);
      const critical = position.complex || cpLoss >= 110 || Math.abs(Number(best.score || 0)) <= 220;
      rows.push({
        ply: position.ply,
        san: position.san,
        played: position.lan,
        bestMove: best.bestMove,
        bestScore: best.score,
        playedScore: playedScoreForMover,
        cpLoss,
        matched,
        critical,
        complex: position.complex,
        legalMoveCount: position.legalMoveCount,
        captureOptions: position.captureOptions,
        elapsedMs: position.elapsedMs
      });
    }
    return rows;
  });

  const matches = checked.filter((item) => item.matched);
  const fastMatches = matches.filter((item) => Number.isFinite(item.elapsedMs) && item.elapsedMs <= 2500);
  const timedRows = checked.filter((item) => Number.isFinite(item.elapsedMs));
  const cpLosses = checked.map((item) => item.cpLoss).filter(Number.isFinite);
  const criticalRows = checked.filter((item) => item.critical);
  const complexRows = checked.filter((item) => item.complex);
  const averageMoveMs = timedRows.length
    ? Math.round(timedRows.reduce((sum, item) => sum + item.elapsedMs, 0) / timedRows.length)
    : null;
  const engineMatchRate = checked.length ? matches.length / checked.length : 0;
  const lowTimeConsistency = matches.length ? fastMatches.length / matches.length : 0;
  const averageCpLoss = Math.round(average(cpLosses));
  const medianCpLoss = Math.round(median(cpLosses));
  const criticalMatchRate = criticalRows.length ? criticalRows.filter((item) => item.matched).length / criticalRows.length : 0;
  const complexMatchRate = complexRows.length ? complexRows.filter((item) => item.matched).length / complexRows.length : 0;
  const timingUniformityScore = timingUniformity(checked);
  const suspiciousMoveCount = fastMatches.length;
  const longestStreak = longestMatchStreak(checked);
  const riskScore = riskFromSignals({
    engineMatchRate,
    suspiciousMoveCount,
    totalMoves: checked.length,
    lowTimeConsistency,
    averageCpLoss,
    medianCpLoss,
    criticalMatchRate,
    complexMatchRate,
    longestMatchStreak: longestStreak,
    timingUniformityScore
  });

  return {
    riskScore,
    engineMatchRate,
    lowTimeConsistency,
    suspiciousMoveCount,
    totalMoves: checked.length,
    details: {
      policy: 'multi_signal_fair_play_v2',
      band: evidenceBand(riskScore),
      movetime,
      checked,
      longestMatchStreak: longestStreak,
      averageMoveMs,
      averageCpLoss,
      medianCpLoss,
      criticalMatchRate,
      complexMatchRate,
      timingUniformityScore,
      fastBestMoveThresholdMs: 2500,
      excluded: {
        totalPlayerMoves: positions.length,
        analyzedMoves: checked.length,
        openingOrForced: positions.length - checked.length
      },
      guidance: riskScore >= 70
        ? 'High evidence: review multiple games before actioning.'
        : riskScore >= 55
          ? 'Medium evidence: keep under review and scan more games.'
          : 'Low evidence: do not action from this report alone.'
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
    if (analysis.riskScore < 55) continue;

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
