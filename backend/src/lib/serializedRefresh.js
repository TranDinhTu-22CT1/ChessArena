// Coalesce bursts and serialize reads so a slow response cannot overtake a newer one.
export function serializedRefresh(load, deliver, onError, delayMs = 40) {
  let running = false;
  let dirty = false;
  let closed = false;
  let timer;
  const run = async () => {
    if (closed || running) return;
    running = true;
    dirty = false;
    try {
      const value = await load();
      if (!closed && value) deliver(value);
    } catch (error) {
      if (!closed) onError(error);
    } finally {
      running = false;
      if (!closed && dirty) timer = setTimeout(run, delayMs);
    }
  };
  return {
    schedule() {
      if (closed) return;
      dirty = true;
      if (!running) {
        clearTimeout(timer);
        timer = setTimeout(run, delayMs);
      }
    },
    close() { closed = true; clearTimeout(timer); }
  };
}
