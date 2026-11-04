import { enginePosition } from './enginePosition.js';
import { isOpeningBookMove } from './openingBook.js';
import { reviewPosition } from './positionReview.js';
import { reviewMetrics } from './reviewMetrics.js';

const SAFE_MESSAGES = {
  INVALID_POSITION: 'Dữ liệu thế cờ hoặc nước đi không hợp lệ.',
  ENGINE_TIMEOUT: 'Stockfish phản hồi quá lâu. Hãy thử lại.',
  ENGINE_TERMINATED: 'Tiến trình phân tích bị gián đoạn. Hãy thử lại.',
  ENGINE_INIT_FAILED: 'Chưa thể khởi tạo Stockfish. Hãy thử lại.',
  ANALYSIS_PARSE_ERROR: 'Không đọc được kết quả phân tích. Hãy thử lại.',
  ANALYSIS_FAILED: 'Chưa thể phân tích thế cờ này. Hãy thử lại.'
};

export function classifyReviewError(error) {
  if (error?.code && SAFE_MESSAGES[error.code]) return error.code;
  if (error?.status === 400) return 'INVALID_POSITION';
  const message = String(error?.message || '').toLowerCase();
  if (error?.name === 'AbortError' || /timeout|timed out|quá lâu/.test(message)) return 'ENGINE_TIMEOUT';
  if (/terminat|closed|exited|broken pipe/.test(message)) return 'ENGINE_TERMINATED';
  if (/spawn|initialize|init|executable|enoent/.test(message)) return 'ENGINE_INIT_FAILED';
  if (/parse|bestmove|score|evaluation/.test(message)) return 'ANALYSIS_PARSE_ERROR';
  return 'ANALYSIS_FAILED';
}

export function publicReviewError(error) {
  const code = classifyReviewError(error);
  return Object.assign(new Error(SAFE_MESSAGES[code]), {
    code,
    status: code === 'INVALID_POSITION' ? 400 : 503
  });
}

function retryable(error) {
  return ['ENGINE_TIMEOUT', 'ENGINE_TERMINATED', 'ENGINE_INIT_FAILED', 'ANALYSIS_FAILED']
    .includes(classifyReviewError(error));
}

async function analyzeOne(position, options) {
  const board = enginePosition(position.fen);
  const actualMove = board.move(position.move);
  if (!actualMove) throw Object.assign(new Error('Illegal review move.'), { status: 400 });
  const analysis = await options.analyze(position.fen, position.move, {
    movetime: options.movetime,
    quality: options.quality,
    signal: options.signal
  });
  const metrics = reviewMetrics({
    fen: position.fen,
    move: position.move,
    ...analysis,
    book: position.variant === 'standard' && isOpeningBookMove(position.priorMoves, position.move)
  });
  return {
    ply: position.ply,
    san: actualMove.san,
    move: position.move,
    quality: options.quality,
    engine: analysis.engine,
    elapsedMs: analysis.elapsedMs,
    ...metrics
  };
}

export async function analyzeReviewBatch(positions, {
  movetime = 180,
  quality = 'quick',
  signal,
  analyze = reviewPosition,
  retries = 1
} = {}) {
  if (!Array.isArray(positions) || positions.length < 1 || positions.length > 24) {
    throw Object.assign(new Error('Invalid review batch.'), { status: 400, code: 'INVALID_POSITION' });
  }
  for (const position of positions) enginePosition(position?.fen, [position?.move]);

  const results = [];
  let successful = 0;
  let lastFailure = null;
  for (const position of positions) {
    let failure;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        results.push(await analyzeOne(position, { movetime, quality, signal, analyze }));
        successful += 1;
        failure = null;
        break;
      } catch (error) {
        failure = error;
        if (signal?.aborted || attempt >= retries || !retryable(error)) break;
      }
    }
    if (failure) {
      lastFailure = publicReviewError(failure);
      results.push({
        ply: position.ply,
        san: position.san || null,
        move: position.move,
        quality,
        tone: 'unavailable',
        label: 'Không thể phân tích',
        analysisError: true,
        errorCode: lastFailure.code,
        error: lastFailure.message
      });
    }
  }
  if (!successful && lastFailure) throw lastFailure;
  return results;
}
