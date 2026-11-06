// Foreground refreshes only. Queue leases and active-game heartbeats have their own lifecycle.
export function pollWhileActive(task, { interval = 45_000, maxDelay = 60_000 } = {}) {
  let stopped = false;
  let running = false;
  let timer;
  let failures = 0;
  let lastStarted = 0;
  const controller = new AbortController();
  const active = () => !document.hidden && navigator.onLine !== false;
  const poll = async () => {
    if (stopped || running || !active()) return;
    clearTimeout(timer);
    running = true;
    lastStarted = Date.now();
    try { await task(controller.signal); failures = 0; }
    catch { failures = Math.min(failures + 1, 6); }
    finally {
      running = false;
      if (!stopped && active()) timer = setTimeout(poll, Math.min(maxDelay, interval * 2 ** failures));
    }
  };
  const resume = () => {
    clearTimeout(timer);
    if (stopped || running || !active()) return;
    // A burst of visibility/online events must not trigger duplicate requests.
    const remaining = Math.min(maxDelay, interval * 2 ** failures) - (Date.now() - lastStarted);
    if (remaining > 0) timer = setTimeout(poll, remaining);
    else void poll();
  };
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
  window.addEventListener('offline', resume);
  void poll();
  return () => {
    stopped = true;
    clearTimeout(timer);
    controller.abort();
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', resume);
    window.removeEventListener('offline', resume);
  };
}
