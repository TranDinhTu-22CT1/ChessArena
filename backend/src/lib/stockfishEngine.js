import { spawn } from 'node:child_process';

export const STOCKFISH_PATH = process.env.STOCKFISH_PATH
  || 'stockfish/stockfish-windows-x86-64-avx2.exe';

export function parseStockfishScore(line) {
  const mateMatch = line.match(/\bscore mate (-?\d+)/);
  if (mateMatch) {
    const mate = Number(mateMatch[1]);
    return mate > 0 ? 100000 - mate : -100000 - mate;
  }

  const cpMatch = line.match(/\bscore cp (-?\d+)/);
  return cpMatch ? Number(cpMatch[1]) : null;
}

export function createStockfish() {
  const engine = spawn(STOCKFISH_PATH, [], { windowsHide: true });
  let buffer = '';
  let lastScore = 0;
  let waiter = null;
  let closed = false;

  engine.on('exit', () => {
    closed = true;
  });

  engine.stdout.on('data', (chunk) => {
    buffer += String(chunk);
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
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
  });

  engine.stderr.on('data', () => {});

  function waitFor(type, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiter = null;
        reject(new Error(`Stockfish ${type} timed out.`));
      }, timeoutMs);

      waiter = {
        type,
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        }
      };
    });
  }

  async function init(options = {}) {
    if (closed) throw new Error('Stockfish process is closed.');
    engine.stdin.write('uci\n');
    engine.stdin.write(`setoption name Threads value ${options.threads ?? 2}\n`);
    engine.stdin.write(`setoption name Hash value ${options.hash ?? 128}\n`);
    await configure(options);
  }

  async function configure(options = {}) {
    if (closed) throw new Error('Stockfish process is closed.');
    if (Number.isFinite(options.skillLevel)) {
      engine.stdin.write(`setoption name Skill Level value ${options.skillLevel}\n`);
    }

    if (Number.isFinite(options.elo)) {
      engine.stdin.write('setoption name UCI_LimitStrength value true\n');
      engine.stdin.write(`setoption name UCI_Elo value ${Math.max(1320, Math.min(3190, Math.round(options.elo)))}\n`);
    } else {
      engine.stdin.write('setoption name UCI_LimitStrength value false\n');
    }

    engine.stdin.write('isready\n');
    await waitFor('ready');
  }

  async function analyze({ fen, moves = [], depth, movetime }) {
    if (closed) throw new Error('Stockfish process is closed.');
    lastScore = 0;
    engine.stdin.write(`position fen ${fen}${moves.length ? ` moves ${moves.join(' ')}` : ''}\n`);
    engine.stdin.write(movetime ? `go movetime ${movetime}\n` : `go depth ${depth}\n`);
    return waitFor('bestmove', Math.max(15000, (movetime ?? 0) + 5000));
  }

  function close() {
    if (!closed) engine.kill();
  }

  return { init, configure, analyze, close };
}
