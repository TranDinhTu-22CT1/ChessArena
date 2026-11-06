import { useEffect } from 'react';
import { apiFetch } from '../api/request';
import { apiUrl } from '../api/config';

export function useSitePresence(user) {
  const identity = user?.uid || user?.id;
  useEffect(() => {
    if (!identity) return undefined;
    let closed = false, busy = false, lastSent = -Infinity;
    const controller = new AbortController();
    const ping = async () => {
      if (closed || busy || document.visibilityState === 'hidden' || navigator.onLine === false || Date.now() - lastSent < 20_000) return;
      busy = true;
      lastSent = Date.now();
      try {
        await apiFetch(apiUrl('/api/online/presence'), { method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: '{}', signal: controller.signal });
      } catch { /* Presence failure must not interrupt a game or a form. */ }
      finally { busy = false; }
    };
    ping();
    const timer = window.setInterval(ping, 20_000);
    document.addEventListener('visibilitychange', ping);
    window.addEventListener('online', ping);
    return () => { closed = true; controller.abort(); window.clearInterval(timer);
      document.removeEventListener('visibilitychange', ping); window.removeEventListener('online', ping); };
  }, [identity]);
}
