// An empty API URL always uses this frontend's /api proxy, including LAN and private VPN hosts.
export function apiUrl(path) {
  const baseUrl = import.meta.env?.VITE_API_URL || '';
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}
export function reportAccountBan(data) {
  if(data?.code==='ACCOUNT_BANNED' && data.ban && data.appealToken && typeof window!=='undefined') {
    window.dispatchEvent(new window.CustomEvent('chessarena:account-banned',{detail:data}));
    return true;
  }
  return false;
}
export function handleApiSession(response) {
  if(response.status===403) response.clone().json().then(reportAccountBan).catch(()=>{});
  return response;
}
