import { spawn } from 'node:child_process';
import path from 'node:path';

const STOCKFISH_MODULE_PATH = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  'node_modules',
  'stockfish',
  'src',
  'stockfish-17.1-lite-single-03e3232.js'
);

export const STOCKFISH_PATH = process.env.STOCKFISH_PATH || null;

export function parseStockfishScore(line) {
  const mateMatch = line.match(/\bscore mate (-?\d+)/);
  if (mateMatch) {
    const mate = Number(mateMatch[1]);
    return mate > 0 ? 100000 - mate : -100000 - mate;
  }

  const cpMatch = line.match(/\bscore cp (-?\d+)/);
  return cpMatch ? Number(cpMatch[1]) : null;
}

function createUciProtocol(write, terminate) {
  let lastScore = 0;
  let waiter = null;
  let closed = false;

  function consume(line) {
    const score = parseStockfishScore(line);
    if (score !== null) lastScore = score;

    if (waiter?.type === 'ready' && line === 'readyok') {
      const resolve = waiter.resolve;
      waiter = null;
      resolve();
    }

    if (waiter?.type === 'bestmove' && line.startsWith('bestmove ')) {
      const bestMove = line.split(/\s+/)[1];
      const resolve = waiter.resolve;
      waiter = null;
      resolve({ bestMove, score: lastScore });
    }
  }

  function markClosed() {
    closed = true;
  }

  function fail(error) {
    closed = true;
    if (waiter) {
      const reject = waiter.reject;
      waiter = null;
      reject(error);
    }
  }

  function waitFor(type, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiter = null;
        reject(new Error(`Stockfish ${type} timed out.`));
      }, timeoutMs);

      waiter = {
        type,
        reject,
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        }
      };
    });
  }

  async function init(options = {}) {
    if (closed) throw new Error('Stockfish process is closed.');
    write('uci');
    write(`setoption name Threads value ${options.threads ?? 1}`);
    write(`setoption name Hash value ${options.hash ?? 64}`);
    await configure(options);
  }

  async function configure(options = {}) {
    if (closed) throw new Error('Stockfish process is closed.');
    if (Number.isFinite(options.skillLevel)) {
      write(`setoption name Skill Level value ${options.skillLevel}`);
    }

    if (Number.isFinite(options.elo)) {
      write('setoption name UCI_LimitStrength value true');
      write(`setoption name UCI_Elo value ${Math.max(1320, Math.min(3190, Math.round(options.elo)))}`);
    } else {
      write('setoption name UCI_LimitStrength value false');
    }

    const ready = waitFor('ready');
    write('isready');
    await ready;
  }

  async function analyze({ fen, moves = [], depth, movetime }) {
    if (closed) throw new Error('Stockfish process is closed.');
    lastScore = 0;
    write(`position fen ${fen}${moves.length ? ` moves ${moves.join(' ')}` : ''}`);
    const bestMove = waitFor('bestmove', Math.max(15000, (movetime ?? 0) + 5000));
    write(movetime ? `go movetime ${movetime}` : `go depth ${depth}`);
    return bestMove;
  }

  function close() {
    if (!closed) {
      closed = true;
      terminate();
    }
  }

  return { init, configure, analyze, close, consume, fail, markClosed };
}

function createBinaryStockfish(executablePath, args = []) {
  const engine = spawn(executablePath, args, { windowsHide: true });
  const protocol = createUciProtocol(
    (command) => engine.stdin.write(`${command}\n`),
    () => engine.kill()
  );
  let buffer = '';

  engine.on('error', protocol.fail);
  engine.on('exit', (code) => {
    if (code && code !== 0) {
      protocol.fail(new Error(`Stockfish exited with code ${code}.`));
      return;
    }
    protocol.markClosed();
  });
  engine.stdout.on('data', (chunk) => {
    buffer += String(chunk);
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    lines.forEach(protocol.consume);
  });
  engine.stderr.on('data', () => {});

  return protocol;
}

export function createStockfish() {
  return STOCKFISH_PATH
    ? createBinaryStockfish(STOCKFISH_PATH)
    : createBinaryStockfish(process.execPath, [STOCKFISH_MODULE_PATH]);
}

const sharedStateKey = Symbol.for('chess-arena.stockfish-engine-state');

function getSharedState() {
  if (!globalThis[sharedStateKey]) {
    globalThis[sharedStateKey] = {
      engine: null,
      ready: null,
      queue: Promise.resolve()
    };
  }

  return globalThis[sharedStateKey];
}

export function withStockfishEngine(options, task) {
  const state = getSharedState();
  const run = state.queue.then(async () => {
    try {
      if (!state.engine) {
        state.engine = createStockfish();
        state.ready = state.engine.init({ threads: 1, hash: 96, ...options });
      }

      await state.ready;
      return await task(state.engine);
    } catch (error) {
      state.engine?.close?.();
      state.engine = null;
      state.ready = null;
      throw error;
    }
  });

  state.queue = run.catch(() => {});
  return run;
}
