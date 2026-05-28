const STORAGE_KEY = 'chessarena_device_seed';

function randomSeed() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function deviceSeed() {
  let seed = window.localStorage.getItem(STORAGE_KEY);
  if (!seed) {
    seed = randomSeed();
    window.localStorage.setItem(STORAGE_KEY, seed);
  }
  return seed;
}

async function sha256(value) {
  const encoded = new window.TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function getDeviceFingerprint() {
  const fingerprint = [
    deviceSeed(),
    navigator.userAgent,
    navigator.language,
    navigator.languages?.join(',') || '',
    navigator.platform,
    String(navigator.hardwareConcurrency || ''),
    String(navigator.deviceMemory || ''),
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
    String(window.devicePixelRatio || 1)
  ].join('|');

  return sha256(fingerprint);
}
