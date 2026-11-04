function unavailable(message) { return Object.assign(new Error(message), { status: 503 }); }
function aborted() { return Object.assign(new Error('Đã hủy yêu cầu phân tích.'), { name: 'AbortError', status: 499 }); }

// An engine belongs to exactly one task until that task settles. Timed-out workers
// are destroyed, so a late bestmove can never become the next player's response.
export function createEnginePool({ create, size = 2, maxQueue = 32, waitMs = 12000, jobMs = 20000,
  idleMs = 60000, initOptions = { threads: 1, hash: 64 } }) {
  const workers = Array.from({ length: size }, () => ({ engine: null, busy: false, timer: null }));
  const queue = [];
  let closed = false;

  function discard(worker) {
    clearTimeout(worker.timer);
    worker.engine?.close();
    worker.engine = null;
  }

  async function execute(worker, job) {
    worker.busy = true;
    clearTimeout(worker.timer);
    clearTimeout(job.timer);
    job.signal?.removeEventListener('abort', job.cancel);
    let timeout;
    let rejectStopped;
    const stopped = new Promise((_, reject) => { rejectStopped = reject; });
    const stop = (error) => { discard(worker); rejectStopped(error); };
    const cancel = () => stop(aborted());
    job.signal?.addEventListener('abort', cancel, { once: true });
    const work = async () => {
      if (job.signal?.aborted) throw aborted();
      let engine = worker.engine;
      if (!engine) {
        engine = create();
        worker.engine = engine;
        await engine.init(initOptions);
      }
      if (!engine || job.signal?.aborted) throw aborted();
      await engine.configure(job.options);
      await engine.newGame?.();
      return job.task(engine);
    };
    try {
      timeout = setTimeout(() => stop(unavailable('Phân tích quá thời gian. Hãy thử lại.')), jobMs);
      job.resolve(await Promise.race([work(), stopped]));
    } catch (error) {
      discard(worker);
      job.reject(error);
    } finally {
      clearTimeout(timeout);
      job.signal?.removeEventListener('abort', cancel);
      worker.busy = false;
      worker.timer = setTimeout(() => discard(worker), idleMs);
      worker.timer.unref?.();
      drain();
    }
  }

  function drain() {
    if (closed) return;
    for (const worker of workers) {
      if (worker.busy || !queue.length) continue;
      // Interactive moves first; aging prevents long reviews from starving.
      queue.sort((a, b) => (b.priority + (Date.now() - b.joined) / 2000)
        - (a.priority + (Date.now() - a.joined) / 2000));
      void execute(worker, queue.shift());
    }
  }

  function run(options = {}, task) {
    if (closed) return Promise.reject(unavailable('Stockfish đã dừng.'));
    if (options.signal?.aborted) return Promise.reject(aborted());
    if (queue.length >= maxQueue) return Promise.reject(unavailable('Stockfish đang bận. Hãy thử lại sau vài giây.'));
    return new Promise((resolve, reject) => {
      const job = { options, task, resolve, reject, signal: options.signal,
        priority: options.priority === 'interactive' ? 2 : 0, joined: Date.now() };
      const remove = (error) => {
        const index = queue.indexOf(job);
        if (index < 0) return;
        queue.splice(index, 1);
        clearTimeout(job.timer);
        job.signal?.removeEventListener('abort', job.cancel);
        reject(error);
      };
      job.cancel = () => remove(aborted());
      job.timer = setTimeout(() => remove(unavailable('Hàng đợi Stockfish đang đầy. Hãy thử lại.')), waitMs);
      job.signal?.addEventListener('abort', job.cancel, { once: true });
      queue.push(job);
      drain();
    });
  }

  function close() {
    closed = true;
    for (const job of [...queue]) job.cancel();
    workers.forEach(discard);
  }
  return { run, close, stats: () => ({ size, busy: workers.filter((w) => w.busy).length, queued: queue.length }) };
}
