import { createClient } from '@supabase/supabase-js';

let realtimeClient;

function client() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!realtimeClient) {
    realtimeClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return realtimeClient;
}

export function subscribeToMatchmakingSession(sessionId, onMatched) {
  const supabase = client();
  if (!supabase || !sessionId) return () => {};

  const channel = supabase
    .channel(`matchmaking:session:${sessionId}`)
    .on('broadcast', { event: 'matched' }, ({ payload }) => onMatched(payload || {}))
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
