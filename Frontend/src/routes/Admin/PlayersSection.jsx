import React from 'react';
import { Ban, CheckCircle2, ExternalLink, Search, Shield, ShieldAlert, UserCog } from 'lucide-react';
import { activeBan, activeMute, time } from './adminUtils';

export default function PlayersSection({
  users,
  search,
  loading,
  onSearchChange,
  onLoad,
  onOpenDetail,
  onOpenPublicProfile,
  onScanUser,
  onMuteUser,
  onUnmuteUser,
  onUnbanUser,
  onOpenBan
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Quan ly nguoi choi</span>
          <h2>Tai khoan, thiet bi va lenh cam</h2>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          onLoad(search);
        }}>
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Tim username/email..." />
          <button disabled={loading}><Search size={16} /> Tim</button>
        </form>
      </div>

      <div className="admin-user-list">
        {users.map((user) => {
          const ban = activeBan(user);
          const mute = activeMute(user);
          const device = user.devices?.[0];
          const topRating = [...(user.ratings || [])].sort((a, b) => b.rating - a.rating)[0];
          const risk = user.reports?.[0]?.risk_score ?? 0;
          return (
            <article className="admin-user-card" key={user.id}>
              <img src={user.photo_url || '/chessarena-mark.svg'} alt="" />
              <div>
                <strong>{user.display_name || user.username || user.email}</strong>
                <span>{user.email || user.username}</span>
                <small>UID: {user.id} | Elo: {topRating?.rating ?? 400} | Van: {topRating?.games_played ?? 0} | Diem gian lan: {risk}</small>
                {device && <em>Tin hieu rui ro: {device.device_fingerprint.slice(0, 16)}... | IP {device.ip_prefix || '--'} | UA {device.user_agent_hash?.slice(0, 10) || '--'} | {time(device.last_seen_at)}</em>}
                {ban && <b className="admin-ban-note">Dang bi cam: {ban.reason}</b>}
                {mute && <b className="admin-ban-note mute">Dang bi mute: {mute.reason}</b>}
              </div>
              <div className="admin-user-actions">
                <button onClick={() => onOpenDetail(user)}><UserCog size={16} /> Chi tiet</button>
                <button onClick={() => onOpenPublicProfile(user)}><ExternalLink size={16} /> Ho so</button>
                <button onClick={() => onScanUser(user)}><ShieldAlert size={16} /> Quet</button>
                {mute ? (
                  <button onClick={() => onUnmuteUser(user)}><CheckCircle2 size={16} /> Go mute</button>
                ) : (
                  <button onClick={() => onMuteUser(user)}><Shield size={16} /> Mute</button>
                )}
                {ban ? (
                  <button onClick={() => onUnbanUser(user)}><CheckCircle2 size={16} /> Go cam</button>
                ) : (
                  <>
                    <button onClick={() => onOpenBan(user, 'account')}><Ban size={16} /> Cam</button>
                    <button disabled={!device} onClick={() => onOpenBan(user, 'risk')}><Ban size={16} /> Risk ban</button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
