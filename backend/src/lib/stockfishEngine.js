import { spawn } from 'node:child_process';
import { availableParallelism, totalmem } from 'node:os';
import path from 'node:path';
import { enginePosition, legalMove } from './enginePosition.js';
import { createEnginePool } from './enginePool.js';

export const STOCKFISH_PATH = process.env.STOCKFISH_PATH || null;
const modulePath = process.env.STOCKFISH_EDITION === 'lite'
  ? path.join(process.cwd(), 'node_modules/stockfish/bin/stockfish-18-lite-single.js')
  : path.join(process.cwd(), 'node_modules/stockfish/bin/stockfish-18-single.js');

export function parseStockfishScore(line) {
  const mate = line.match(/\bscore mate (-?\d+)/);
  if (mate) return Number(mate[1]) > 0 ? 100000 - Number(mate[1]) : -100000 - Number(mate[1]);
  const cp = line.match(/\bscore cp (-?\d+)/);
  return cp ? Number(cp[1]) : null;
}

export function createUciProtocol(write, terminate) {
  let waiter = null;
  let closed = false;
  let candidates = new Map();
  const capabilities = { name: 'Stockfish', options: {} };

  function settle(error, value) {
    const pending = waiter;
    waiter = null;
    if (!pending) return;
    clearTimeout(pending.timer);
    if (error) pending.reject(error); else pending.resolve(value);
  }

  function fail(error = new Error('Stockfish đã dừng.')) {
    if (!closed) { closed = true; terminate(); }
    settle(error);
  }

  function waitFor(type, timeoutMs = 15000) {
    if (closed) return Promise.reject(new Error('Stockfish đã dừng.'));
    if (waiter) return Promise.reject(new Error('Stockfish is already processing a command.'));
    return new Promise((resolve, reject) => {
      waiter = { type, resolve, reject, timer: setTimeout(() => {
        fail(Object.assign(new Error('Stockfish phản hồi quá chậm. Hãy thử lại.'), { status: 503 }));
      }, timeoutMs) };
    });
  }

  function consume(rawLine) {
    const line = rawLine.trim();
    if (closed) return;
    if (line.startsWith('id name ')) capabilities.name = line.slice(8);
    const option = line.match(/^option name (.+?) type (\w+)(.*)$/);
    if (option) {
      const min = option[3].match(/\bmin (-?\d+)/);
      const max = option[3].match(/\bmax (-?\d+)/);
      capabilities.options[option[1]] = { type: option[2], min: min ? Number(min[1]) : null, max: max ? Number(max[1]) : null };
    }
    if ((waiter?.type === 'uci' && line === 'uciok') || (waiter?.type === 'ready' && line === 'readyok')) settle(null);
    if (waiter?.type !== 'bestmove') return;
    if (line.startsWith('info ') && !/\b(?:lowerbound|upperbound)\b/.test(line)) {
      const score = parseStockfishScore(line);
      const pv = line.match(/\bpv (.+)$/)?.[1].split(/\s+/) || [];
      const index = Number(line.match(/\bmultipv (\d+)/)?.[1] || 1);
      if (score !== null && pv.length) candidates.set(index, {
        bestMove: pv[0], score, pv,
        depth: Number(line.match(/\bdepth (\d+)/)?.[1] || 0),
        nodes: Number(line.match(/\bnodes (\d+)/)?.[1] || 0),
        mate: line.match(/\bscore mate (-?\d+)/) ? Number(line.match(/\bscore mate (-?\d+)/)[1]) : null
      });
    }
    if (line.startsWith('bestmove ')) {
      const bestMove = line.split(/\s+/)[1];
      const variations = [...candidates.entries()].sort((a, b) => a[0] - b[0]).map(([, value]) => value);
      const selected = variations.find((item) => item.bestMove === bestMove);
      settle(null, { bestMove, score: selected?.score ?? null, depth: selected?.depth ?? 0,
        mate: selected?.mate ?? null, pv: selected?.pv || [], variations, engine: capabilities.name });
    }
  }

  function setOption(name, value) {
    if (closed) throw new Error('Stockfish đã dừng.');
    const supported = capabilities.options[name];
    if (!supported) return;
    if (supported.type === 'spin' && (!Number.isFinite(value) || value < supported.min || value > supported.max)) {
      throw new Error(`Stockfish ${name}: supported range ${supported.min}–${supported.max}.`);
    }
    write(`setoption name ${name} value ${value}`);
  }

  async function ready() {
    const pending = waitFor('ready');
    write('isready');
    await pending;
  }

  async function init(options = {}) {
    const pending = waitFor('uci');
    write('uci');
    await pending;
    setOption('Threads', options.threads ?? 1);
    setOption('Hash', options.hash ?? 64);
    await configure(options);
  }

  async function configure(options = {}) {
    // Reset every setting between customers and analysis, even when omitted.
    setOption('Skill Level', options.skillLevel ?? 20);
    setOption('MultiPV', options.multiPv ?? 1);
    setOption('Ponder', false);
    setOption('UCI_Chess960', false);
    const limited = Number.isFinite(options.elo);
    if (limited && (!capabilities.options.UCI_Elo || !capabilities.options.UCI_LimitStrength)) {
      throw new Error('Bản engine này không hỗ trợ giới hạn Elo.');
    }
    setOption('UCI_LimitStrength', limited);
    if (limited) setOption('UCI_Elo', Math.round(options.elo));
    await ready();
  }

  async function newGame() { write('ucinewgame'); await ready(); }

  async function analyze({ fen, moves = [], depth = 22, movetime = 1200, nodes, searchMoves = [] }) {
    if (closed || waiter) throw new Error('Stockfish không sẵn sàng.');
    const board = enginePosition(fen, moves);
    if (board.isGameOver()) return { bestMove: null, score: board.isCheckmate() ? -100000 : 0,
      mate: board.isCheckmate() ? 0 : null, depth: 0, pv: [], variations: [], terminal: true, engine: capabilities.name };
    if (!Array.isArray(searchMoves) || searchMoves.length > 218 || searchMoves.some((m) => !legalMove(board, m))) {
      throw Object.assign(new Error('Nước phân tích không hợp lệ.'), { status: 400 });
    }
    candidates = new Map();
    const time = Math.max(50, Math.min(5000, Math.round(Number(movetime) || 1200)));
    const targetDepth = Math.max(1, Math.min(40, Math.round(Number(depth) || 22)));
    // Keep the move sequence for repetitions and the fifty-move rule.
    write(`position fen ${enginePosition(fen).fen()}${moves.length ? ` moves ${moves.join(' ')}` : ''}`);
    const pending = waitFor('bestmove', time + 5000);
    write(`go depth ${targetDepth} movetime ${time}${Number.isFinite(nodes) ? ` nodes ${Math.max(100, Math.min(5000000, Math.round(nodes)))}` : ''}${searchMoves.length ? ` searchmoves ${searchMoves.join(' ')}` : ''}`);
    const result = await pending;
    if (!legalMove(board, result.bestMove)) { fail(new Error('Stockfish returned an illegal move.')); throw new Error('Stockfish không trả về nước đi hợp lệ.'); }
    return result;
  }

  return { init, configure, newGame, analyze, consume, fail, capabilities,
    close: () => fail(new Error('Stockfish đã dừng.')), markClosed: () => fail(new Error('Stockfish process exited.')) };
}

export function createStockfish() {
  // The engine assets are explicitly included by next.config.mjs. A configured
  // native executable is supplied separately on the host.
  const child = spawn(STOCKFISH_PATH || process.execPath, STOCKFISH_PATH ? [] : [modulePath], { windowsHide: true });
  const protocol = createUciProtocol((command) => child.stdin.write(`${command}\n`), () => child.kill());
  let buffer = '';
  child.on('error', protocol.fail);
  child.stdin.on('error', protocol.fail);
  child.on('exit', protocol.markClosed);
  child.stdout.on('data', (chunk) => {
    buffer += String(chunk);
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    lines.forEach(protocol.consume);
  });
  child.stderr.on('data', () => {});
  return protocol;
}

const sharedKey = Symbol.for('chess-arena.stockfish-pool-v2');
function pool() {
  if (!globalThis[sharedKey]) {
    const automatic = Math.max(1, Math.min(2, availableParallelism() - 1, Math.floor(totalmem() / (2 * 1024 ** 3))));
    const size = Math.max(1, Math.min(8, Math.floor(Number(process.env.STOCKFISH_POOL_SIZE) || automatic)));
    const hash = Math.max(16, Math.min(512, Math.floor(Number(process.env.STOCKFISH_HASH_MB) || 64)));
    globalThis[sharedKey] = createEnginePool({ create: createStockfish, size, initOptions: { threads: 1, hash } });
  }
  return globalThis[sharedKey];
}
export function withStockfishEngine(options, task) { return pool().run(options, task); }
export function stockfishPoolStats() { return pool().stats(); }
export function closeStockfishPool() { globalThis[sharedKey]?.close(); delete globalThis[sharedKey]; }
