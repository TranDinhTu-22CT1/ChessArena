import { apiUrl, handleApiSession } from './config';

async function request(method, payload, signal) {
  const response = await fetch(apiUrl('/api/online/invitations'), {
    method, credentials: 'include', signal: signal ? globalThis.AbortSignal.any([signal, globalThis.AbortSignal.timeout(12000)]) : globalThis.AbortSignal.timeout(12000),
    ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {})
  });
  handleApiSession(response);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || 'Không thể xử lý lời mời.');
  return data;
}
export const fetchGameInvitations = (signal) => request('GET', null, signal);
export const sendGameInvitation = (recipientId, timeControl = '600+0', side = 'random') => request('POST', { recipientId, timeControl, side });
export const respondGameInvitation = (invitationId, action) => request('PATCH', { invitationId, action });

export function openInvitedGame(gameId) {
  window.history.pushState(null, '', `/play/online?game=${encodeURIComponent(gameId)}`);
  window.dispatchEvent(new window.PopStateEvent('popstate'));
}
