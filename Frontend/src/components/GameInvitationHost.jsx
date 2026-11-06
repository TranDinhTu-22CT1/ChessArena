import React from 'react';
import { Swords, X } from 'lucide-react';
import { fetchGameInvitations, respondGameInvitation, openInvitedGame } from '../api/gameInvitations';
import { pollWhileActive } from '../api/polling';
import './game-invitations.css';

export default function GameInvitationHost({ authUser }) {
  const [inbox, setInbox] = React.useState([]);
  const [userId, setUserId] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const [now, setNow] = React.useState(Date.now());
  const seen = React.useRef(new Set());
  const identity = authUser?.uid || authUser?.id || authUser?.email;

  const enter = React.useCallback((invitation, viewer) => {
    if (!invitation.game_id) return;
    const key = `chessarena:invitation:${viewer}:${invitation.id}`;
    let visited = seen.current.has(key);
    try { visited ||= Boolean(window.sessionStorage.getItem(key)); } catch { /* Optional persistence. */ }
    if (visited) return;
    seen.current.add(key);
    try { window.sessionStorage.setItem(key, 'entered'); } catch { /* The in-memory guard remains. */ }
    openInvitedGame(invitation.game_id);
  }, []);

  React.useEffect(() => {
    setInbox([]);
    setError('');
    if (!identity) return undefined;
    let disposed = false;
    const stop = pollWhileActive(async (signal) => {
        const data = await fetchGameInvitations(signal);
        if (disposed) return;
        setUserId(data.userId);
        setInbox(data.invitations.filter((v) => v.status === 'pending'));
        // Navigation follows a committed acceptance, for both participants.
        data.invitations.filter((v) => v.status === 'accepted').forEach((v) => enter(v, data.userId));
    }, { interval: 2000, maxDelay: 30_000 });
    return () => { disposed = true; stop(); };
  }, [identity, enter]);

  React.useEffect(() => {
    if (!inbox.length) return undefined;
    setNow(Date.now());
    const tick = window.setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 1000);
    return () => window.clearInterval(tick);
  }, [inbox.length]);

  const respond = async (invitation, action) => {
    setBusy(invitation.id);
    setError('');
    try {
      const result = await respondGameInvitation(invitation.id, action);
      setInbox((rows) => rows.filter((v) => v.id !== invitation.id));
      if (result.invitation.status === 'accepted') enter(result.invitation, userId);
      else if (action === 'accept') setError('Lời mời đã hết hạn hoặc được hủy.');
    } catch (reason) { setError(reason.message); }
    finally { setBusy(''); }
  };
  const visible = inbox.filter((v) => Date.parse(v.expires_at) > now).slice(0, 3);
  if (!identity || (!visible.length && !error)) return null;
  return (
    <aside className="game-invitation-host" aria-label="Lời mời chơi cờ" aria-live="polite">
      {error && <div className="game-invitation-error" role="alert">{error}<button aria-label="Đóng thông báo" onClick={() => setError('')}><X size={16} /></button></div>}
      {visible.map((invitation) => {
        const incoming = invitation.recipient_id === userId;
        const player = incoming ? invitation.sender : invitation.recipient;
        const [seconds, increment] = invitation.time_control.split('+').map(Number);
        const color = invitation.sender_color === 'random' ? 'Ngẫu nhiên' : (incoming ? invitation.sender_color === 'w' : invitation.sender_color === 'b') ? 'Đen' : 'Trắng';
        return <section className="game-invitation-card" key={invitation.id}>
          <header><Swords size={20} /><strong>{incoming ? 'Lời mời chơi cờ' : 'Đang chờ bạn phản hồi'}</strong></header>
          <div className="game-invitation-player"><img src={player?.photo_url || '/chessarena-mark.svg'} alt="" /><b>{player?.display_name || 'Bạn bè'}</b></div>
          <p>{seconds / 60} phút{increment ? ` + ${increment} giây/nước` : ''} · Giao hữu, không tính Elo</p>
          <p aria-live="off">Quân của bạn: {color} · Còn {Math.max(0, Math.ceil((Date.parse(invitation.expires_at) - now) / 1000))} giây</p>
          <footer>{incoming ? <>
            <button disabled={Boolean(busy)} onClick={() => respond(invitation, 'decline')}>Từ chối</button>
            <button className="accept" disabled={Boolean(busy)} onClick={() => respond(invitation, 'accept')}>{busy === invitation.id ? 'Đang xử lý...' : 'Đồng ý'}</button>
          </> : <button disabled={Boolean(busy)} onClick={() => respond(invitation, 'cancel')}>Hủy lời mời</button>}</footer>
        </section>;
      })}
    </aside>
  );
}
