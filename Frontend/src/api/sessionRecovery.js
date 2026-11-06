let recoveryHandler = null;
let recoveryInFlight = null;

export function registerSessionRecovery(handler) {
  recoveryHandler = typeof handler === 'function' ? handler : null;
  return () => {
    if (recoveryHandler === handler) recoveryHandler = null;
  };
}

export async function recoverSession() {
  if (!recoveryHandler) return false;
  if (!recoveryInFlight) {
    recoveryInFlight = Promise.resolve()
      .then(() => recoveryHandler())
      .then(Boolean)
      .catch(() => false)
      .finally(() => { recoveryInFlight = null; });
  }
  return recoveryInFlight;
}

export function shouldRecoverSession(url, response) {
  const path = String(url || '');
  return response?.status === 401
    && !path.includes('/api/auth/session')
    && !path.includes('/api/auth/me')
    && !path.includes('/api/auth/logout')
    && !path.includes('/api/admin/session');
}

