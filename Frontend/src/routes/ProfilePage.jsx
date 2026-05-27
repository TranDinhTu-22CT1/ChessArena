import React from 'react';
import { CalendarDays, CheckCircle2, ImagePlus, Mail, Save, ShieldCheck, Swords, Trophy, UserRound } from 'lucide-react';
import { fetchProfile, saveProfile } from '../api/profile';

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

export default function ProfilePage({ authUser, onLogin, onProfileUpdated }) {
  const [profile, setProfile] = React.useState(null);
  const [form, setForm] = React.useState({ displayName: '', photoURL: '' });
  const [loading, setLoading] = React.useState(Boolean(authUser));
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    if (!authUser) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetchProfile()
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
  }, [authUser]);

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

  if (!authUser) {
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

  const summary = profile?.summary || { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };

  return (
    <section className="profile-page">
      <header className="profile-hero">
        <div className="profile-avatar">
          {form.photoURL ? <img src={form.photoURL} alt="Avatar người chơi" /> : <UserRound size={56} />}
        </div>
        <div>
          <span>Player Profile</span>
          <h1>{profile?.displayName || authUser.displayName || 'Player'}</h1>
          <p>@{profile?.username || 'player'}</p>
        </div>
        <div className="profile-verified">
          <ShieldCheck size={20} />
          {profile?.emailVerified ? 'Tài khoản đã xác thực' : 'Chưa xác thực email'}
        </div>
      </header>

      <div className="profile-grid">
        <form className="profile-editor" onSubmit={submitProfile}>
          <h2>Thông tin cá nhân</h2>
          <label>
            <span>Tên hiển thị</span>
            <input value={form.displayName} maxLength={80} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} />
          </label>
          <label>
            <span><ImagePlus size={16} /> Avatar URL</span>
            <input value={form.photoURL} placeholder="https://..." onChange={(event) => setForm((current) => ({ ...current, photoURL: event.target.value }))} />
          </label>
          <div className="profile-detail-line"><Mail size={17} /><span>{profile?.email || 'Không có email'}</span></div>
          <div className="profile-detail-line"><CalendarDays size={17} /><span>Tham gia: {formattedDate(profile?.createdAt)}</span></div>
          <button className="profile-save" disabled={saving} type="submit">
            <Save size={17} /> {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
          </button>
          {message && <p className="profile-message">{message}</p>}
        </form>

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
            {Object.keys(MODE_LABELS).map((mode) => {
              const rating = profile?.ratings?.find((entry) => entry.mode === mode);
              return (
                <div key={mode}>
                  <strong>{MODE_LABELS[mode]}</strong>
                  <b>{rating?.rating ?? 400}</b>
                  <small>{rating?.games_played ?? 0} ván{rating?.provisional ? ' - tạm tính' : ''}</small>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <section className="profile-recent">
        <h2>Trận online gần đây</h2>
        {profile?.recentGames?.length ? profile.recentGames.map((game) => (
          <div className={`profile-game ${game.result}`} key={game.id}>
            <b>{game.result === 'win' ? 'Thắng' : game.result === 'loss' ? 'Thua' : 'Hòa'}</b>
            <span>vs {game.opponent || 'Player'}</span>
            <small>{MODE_LABELS[game.mode] || game.mode} - {game.timeControl}</small>
            <time>{formattedDate(game.finishedAt)}</time>
          </div>
        )) : <p className="profile-empty">Bạn chưa có trận online hoàn thành.</p>}
      </section>
    </section>
  );
}
