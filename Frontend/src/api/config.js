const DEPLOYED_API_FALLBACK = 'https://chess-arena-seven.vercel.app';

function isLocalHostname(hostname) {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname);
}

function isLocalApiUrl(url) {
  try {
    return isLocalHostname(new URL(url).hostname);
  } catch {
    return false;
  }
}

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL || '';
  if (typeof window === 'undefined') return configured || '';

  const runningOnLocalhost = isLocalHostname(window.location.hostname);
  if (!runningOnLocalhost && (!configured || isLocalApiUrl(configured))) {
    return DEPLOYED_API_FALLBACK;
  }

  return configured || '';
}

export function apiUrl(path) {
  const baseUrl = resolveApiBaseUrl();
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}
