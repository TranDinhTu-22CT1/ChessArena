import React from 'react';
import { Ban, CheckCircle2, ExternalLink, Search, Shield, UserCog } from 'lucide-react';
import { LoadingBlock } from '../../components/LoadingSpinner';
import Pagination from '../../components/Pagination';
import { activeBan, activeMute, time } from './adminUtils';

export default function PlayersSection({
  users,
  search,
  loading,
  onSearchChange,
  onLoad,
  onOpenDetail,
  onOpenPublicProfile,
  onMuteUser,
  onUnmuteUser,
  onUnbanUser,
  onOpenBan,
  page,
  totalPages,
  onPageChange
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Quản lý người chơi</span>
          <h2>Tài khoản và lệnh cấm</h2>
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          onLoad(search);
        }}>
          <input aria-label="Tìm người chơi" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Tên người dùng hoặc email" />
          <button disabled={loading}><Search size={16} /> Tìm</button>
        </form>
      </div>

      <div className="admin-user-list">
        {loading && <LoadingBlock label="Đang tải danh sách người chơi" />}
        {!loading && users.length === 0 && <div className="admin-empty-state"><Search size={28} /><strong>Chưa tìm thấy người chơi</strong><p>Thử tìm bằng tên người dùng hoặc địa chỉ email khác.</p></div>}
        {users.map((user) => {
          const ban = activeBan(user);
          const mute = activeMute(user);
          const topRating = [...(user.ratings || [])].sort((a, b) => b.rating - a.rating)[0];
          return (
            <article className="admin-user-card" key={user.id}>
              <img src={user.photo_url || '/chessarena-mark.svg'} alt="" />
              <div>
                <strong>{user.display_name || user.username || user.email}</strong>
                <span>{user.email || user.username}</span>
                <small>UID: {user.id} | Elo: {topRating?.rating ?? 400} | Ván: {topRating?.games_played ?? 0}</small>
                {ban && <b className="admin-ban-note">Đang bị cấm: {ban.reason}</b>}
                {mute && <b className="admin-ban-note mute">Đang bị tắt chat: {mute.reason}</b>}
              </div>
              <div className="admin-user-actions">
                <button onClick={() => onOpenDetail(user)}><UserCog size={16} /> Chi tiết</button>
                <button onClick={() => onOpenPublicProfile(user)}><ExternalLink size={16} /> Hồ sơ</button>
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
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        label="Phân trang người chơi admin"
      />
    </section>
  );
}
