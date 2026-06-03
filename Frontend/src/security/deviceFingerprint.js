async function sha256(value) {
  const encoded = new window.TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function getDeviceFingerprint() {
  const fingerprint = [
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
