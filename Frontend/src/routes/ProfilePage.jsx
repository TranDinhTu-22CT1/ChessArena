import React from 'react';
import { CalendarDays, CheckCircle2, Copy, History, ImagePlus, Mail, Medal, Save, ShieldCheck, Swords, Trophy, UserRound } from 'lucide-react';
import { fetchProfile, fetchPublicProfile, saveProfile } from '../api/profile';

const MODE_LABELS = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  classical: 'Classical'
};

function formattedDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function winRate(summary) {
  if (!summary?.gamesPlayed) return '0%';
  return `${Math.round((summary.wins / summary.gamesPlayed) * 100)}%`;
}

function formatMatchDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function matchLabel(game) {
  if (game.outcome === 'draw') return 'Hòa';
  return game.outcome === 'win' ? 'Thắng' : 'Thua';
}

const MAX_AVATAR_UPLOAD_SIZE = 5 * 1024 * 1024;
const AVATAR_EDGE = 128;

function resizedAvatarData(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectURL = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_EDGE;
      canvas.height = AVATAR_EDGE;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(objectURL);
        reject(new Error('Không thể xử lý ảnh đại diện.'));
        return;
      }
      const crop = Math.min(image.naturalWidth, image.naturalHeight);
      const left = (image.naturalWidth - crop) / 2;
      const top = (image.naturalHeight - crop) / 2;
      context.drawImage(image, left, top, crop, crop, 0, 0, AVATAR_EDGE, AVATAR_EDGE);
      URL.revokeObjectURL(objectURL);
      resolve(canvas.toDataURL('image/webp', 0.84));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectURL);
      reject(new Error('Không thể đọc ảnh đã chọn.'));
    };
    image.src = objectURL;
  });
}

export default function ProfilePage({ authUser, profileUserId = '', onLogin, onNavigate, onProfileUpdated }) {
  const [profile, setProfile] = React.useState(null);
  const [form, setForm] = React.useState({ displayName: '', photoURL: '' });
  const [loading, setLoading] = React.useState(Boolean(authUser || profileUserId));
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const isPublicProfile = Boolean(profileUserId);

  React.useEffect(() => {
    if (!authUser && !profileUserId) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setMessage('');
    (profileUserId ? fetchPublicProfile(profileUserId) : fetchProfile())
      .then((nextProfile) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setForm({ displayName: nextProfile.displayName || '', photoURL: nextProfile.photoURL || '' });
      })
      .catch((error) => {
        if (!cancelled) setMessage(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser, profileUserId]);

  const copyProfileLink = async () => {
    if (!profile?.id && !profile?.username) return;
    const shareId = profile.id || profile.username;
    const url = `${window.location.origin}/profile/${encodeURIComponent(shareId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Đã copy link hồ sơ.');
    } catch {
      setMessage(url);
    }
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const nextProfile = await saveProfile(form);
      setProfile(nextProfile);
      setForm({ displayName: nextProfile.displayName || '', photoURL: nextProfile.photoURL || '' });
      onProfileUpdated?.({ displayName: nextProfile.displayName, photoURL: nextProfile.photoURL });
      setMessage('Hồ sơ đã được cập nhật.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const selectAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setMessage('Vui lòng chọn ảnh PNG, JPG hoặc WebP.');
      return;
    }
    if (file.size > MAX_AVATAR_UPLOAD_SIZE) {
      setMessage('Ảnh gốc tối đa 5 MB.');
      return;
    }
    try {
      const photoURL = await resizedAvatarData(file);
      setForm((current) => ({ ...current, photoURL }));
      setMessage('Ảnh đã chọn. Nhấn Lưu hồ sơ để cập nhật.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (!authUser && !profileUserId) {
    return (
      <section className="profile-auth-required">
        <UserRound size={48} />
        <h1>Hồ sơ cá nhân</h1>
        <p>Đăng nhập để quản lý avatar, tên hiển thị, rating và lịch sử online của bạn.</p>
        <button onClick={onLogin}>Đăng nhập</button>
      </section>
    );
  }

  if (loading) return <div className="profile-loading">Đang tải hồ sơ...</div>;
  if (!profile) {
    return (
      <section className="profile-auth-required">
        <UserRound size={48} />
        <h1>Không tìm thấy hồ sơ</h1>
        <p>{message || 'Link hồ sơ này không tồn tại hoặc người chơi chưa có dữ liệu.'}</p>
        <button onClick={() => onNavigate?.('home')}>Về trang chủ</button>
      </section>
    );
  }

  const summary = profile?.summary || { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
  const avatarURL = isPublicProfile ? profile?.photoURL : form.photoURL;
  const shareId = profile?.id || profile?.username || '';

  return (
    <section className="profile-page">
      <header className="profile-hero">
        <div className="profile-avatar">
          {avatarURL ? <img src={avatarURL} alt="Avatar người chơi" /> : <UserRound size={56} />}
        </div>
        <div>
          <span>{isPublicProfile ? 'Public Player Profile' : 'Player Profile'}</span>
          <h1>{profile?.displayName || authUser?.displayName || 'Player'}</h1>
          <p>@{profile?.username || 'player'}</p>
          {shareId && <small className="profile-id">ID: {shareId}</small>}
        </div>
        <div className="profile-verified">
          <ShieldCheck size={20} />
          {isPublicProfile ? 'Hồ sơ công khai' : profile?.emailVerified ? 'Tài khoản đã xác thực' : 'Chưa xác thực email'}
        </div>
      </header>

      <div className="profile-grid">
        {!isPublicProfile ? (
          <form className="profile-editor" onSubmit={submitProfile}>
            <h2>Thông tin cá nhân</h2>
            <label>
              <span>Tên hiển thị</span>
              <input value={form.displayName} maxLength={80} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} />
            </label>
            <label>
              <span><ImagePlus size={16} /> Ảnh đại diện</span>
              <input className="profile-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} />
              <small>Chọn ảnh từ máy của bạn (PNG, JPG hoặc WebP, tối đa 5 MB). Ảnh sẽ được tối ưu làm avatar.</small>
            </label>
            <div className="profile-detail-line"><Mail size={17} /><span>{profile?.email || 'Không có email'}</span></div>
            <div className="profile-detail-line"><CalendarDays size={17} /><span>Tham gia: {formattedDate(profile?.createdAt)}</span></div>
            <button className="profile-save" disabled={saving} type="submit">
              <Save size={17} /> {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </button>
            <button className="profile-share-button" type="button" onClick={copyProfileLink}>
              <Copy size={17} /> Copy link hồ sơ
            </button>
            {message && <p className="profile-message">{message}</p>}
          </form>
        ) : (
          <aside className="profile-editor profile-public-card">
            <h2>Thông tin người chơi</h2>
            <div className="profile-detail-line"><UserRound size={17} /><span>@{profile?.username || 'player'}</span></div>
            <div className="profile-detail-line"><CalendarDays size={17} /><span>Tham gia: {formattedDate(profile?.createdAt)}</span></div>
            <button className="profile-share-button" type="button" onClick={copyProfileLink}>
              <Copy size={17} /> Copy link hồ sơ
            </button>
            {message && <p className="profile-message">{message}</p>}
          </aside>
        )}

        <div className="profile-stats">
          <h2>Thành tích online</h2>
          <div className="profile-summary">
            <div><Swords size={18} /><b>{summary.gamesPlayed}</b><span>Ván đã chơi</span></div>
            <div><Trophy size={18} /><b>{summary.wins}</b><span>Thắng</span></div>
            <div><b>{summary.losses}</b><span>Thua</span></div>
            <div><b>{summary.draws}</b><span>Hòa</span></div>
            <div><CheckCircle2 size={18} /><b>{winRate(summary)}</b><span>Tỉ lệ thắng</span></div>
          </div>
          <div className="profile-ratings">
            {(profile?.ratings || []).map((rating) => {
              const mode = rating.mode;
              return (
                <div key={mode}>
                  <strong>{MODE_LABELS[mode] || mode}</strong>
                  <b>{rating.rating}</b>
                  <small>{rating.games_played} ván{rating.provisional ? ' - tạm tính' : ''}</small>
                </div>
              );
            })}
          </div>
          {profile?.ratings?.length === 0 && <p className="profile-empty">Chưa có rating online được ghi nhận.</p>}
          <button className="profile-leaderboard-link" onClick={() => onNavigate?.('leaderboard')}>
            <Medal size={17} /> Xem bảng xếp hạng
          </button>
        </div>
      </div>

      <section className="profile-recent">
        <div className="profile-recent-heading">
          <h2>Lịch sử trận đấu</h2>
          {!isPublicProfile && <button onClick={() => onNavigate?.('history')}><History size={17} /> Xem lịch sử và review</button>}
        </div>
        {(profile?.recentGames || []).length > 0 ? (
          <div className="profile-game-list">
            {profile.recentGames.map((game) => (
              <div className={`profile-game ${game.outcome}`} key={game.id}>
                <b>{matchLabel(game)}</b>
                <span>
                  vs {game.opponent?.name || 'Player'}
                  {Number.isFinite(game.ratingDelta) && (
                    <small className={game.ratingDelta > 0 ? 'rating-up' : game.ratingDelta < 0 ? 'rating-down' : ''}>
                      {game.ratingDelta > 0 ? '+' : ''}{game.ratingDelta} rating
                    </small>
                  )}
                </span>
                <small>{game.mode || 'rapid'} - {game.timeControl || '--'} - {game.color === 'w' ? 'Trắng' : 'Đen'}</small>
                <time>{formatMatchDate(game.finishedAt)}</time>
              </div>
            ))}
          </div>
        ) : (
          <p className="profile-empty">
            {isPublicProfile ? 'Người chơi này chưa có trận online hoàn thành.' : `Bạn đã chơi ${summary.gamesPlayed} trận online được tính kết quả. Mở danh sách lịch sử để chọn đúng ván cần xem lại.`}
          </p>
        )}
      </section>
    </section>
  );
}
