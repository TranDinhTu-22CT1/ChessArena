const DEFAULT_API_URL = 'http://localhost:3000';

export function apiUrl(path) {
  const baseUrl = import.meta.env.VITE_API_URL || DEFAULT_API_URL;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}
