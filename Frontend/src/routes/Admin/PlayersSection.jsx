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
          <span>Quản lý người chơi</span>
          <h2>Tài khoản, thiết bị và lệnh cấm</h2>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          onLoad(search);
        }}>
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Tìm username/email..." />
          <button disabled={loading}><Search size={16} /> Tìm</button>
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
                <small>UID: {user.id} | Elo: {topRating?.rating ?? 400} | Ván: {topRating?.games_played ?? 0} | Điểm gian lận: {risk}</small>
                {device && <em>Tín hiệu rủi ro: {device.device_fingerprint.slice(0, 16)}... | IP {device.ip_prefix || '--'} | UA {device.user_agent_hash?.slice(0, 10) || '--'} | {time(device.last_seen_at)}</em>}
                {ban && <b className="admin-ban-note">Đang bị cấm: {ban.reason}</b>}
                {mute && <b className="admin-ban-note mute">Đang bị tắt chat: {mute.reason}</b>}
              </div>
              <div className="admin-user-actions">
                <button onClick={() => onOpenDetail(user)}><UserCog size={16} /> Chi tiết</button>
                <button onClick={() => onOpenPublicProfile(user)}><ExternalLink size={16} /> Hồ sơ</button>
                <button onClick={() => onScanUser(user)}><ShieldAlert size={16} /> Quét</button>
                {mute ? (
                  <button onClick={() => onUnmuteUser(user)}><CheckCircle2 size={16} /> Mở chat</button>
                ) : (
                  <button onClick={() => onMuteUser(user)}><Shield size={16} /> Tắt chat</button>
                )}
                {ban ? (
                  <button onClick={() => onUnbanUser(user)}><CheckCircle2 size={16} /> Gỡ cấm</button>
                ) : (
                  <>
                    <button onClick={() => onOpenBan(user, 'account')}><Ban size={16} /> Cấm</button>
                    <button disabled={!device} onClick={() => onOpenBan(user, 'risk')}><Ban size={16} /> Cấm rủi ro</button>
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
