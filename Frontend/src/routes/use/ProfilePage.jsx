import React from 'react';
import { CalendarDays, CheckCircle2, Copy, History, ImagePlus, Mail, Medal, Save, ShieldCheck, Swords, Trophy, UserRound } from 'lucide-react';
import { fetchProfile, fetchPublicProfile, saveProfile } from '../../api/profile';

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
  if (game.outcome === 'draw') return 'HĂ²a';
  return game.outcome === 'win' ? 'Tháº¯ng' : 'Thua';
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function skillProfile(profile, summary) {
  const games = profile?.recentGames || [];
  const ratings = profile?.ratings || [];
  const lab = profile?.skillLab || {};
  const winPercent = summary?.gamesPlayed ? (summary.wins / summary.gamesPlayed) * 100 : 0;
  const averageRating = ratings.length
    ? ratings.reduce((sum, rating) => sum + Number(rating.rating || 0), 0) / ratings.length
    : 400;
  const activityScore = clampScore((summary?.gamesPlayed || games.length) * 7);
  const consistencyScore = clampScore(55 + winPercent * 0.45 + Math.min(20, games.length * 2));
  const ratingScore = clampScore((averageRating - 400) / 16);
  const formScore = clampScore(50 + games.slice(0, 8).reduce((score, game) => {
    if (game.outcome === 'win') return score + 7;
    if (game.outcome === 'draw') return score + 2;
    return score - 5;
  }, 0));
  const reviewReadiness = clampScore((activityScore + consistencyScore + ratingScore + formScore) / 4);
  const tacticalVision = lab.reviewedMoves
    ? clampScore((lab.averageAccuracy || 0) - (lab.totalBlunders || 0) * 2 - (lab.totalMistakes || 0))
    : reviewReadiness;
  const reviewDiscipline = lab.reviewedGames
    ? clampScore(Math.min(100, lab.reviewedGames * 12) + Math.min(20, lab.reviewedMoves / 8))
    : activityScore;
  const weakSpot = games.filter((game) => game.outcome === 'loss').length >= games.filter((game) => game.outcome === 'win').length
    ? 'Can luyen lai cac van thua gan day va tim mau blunder lap lai.'
    : 'Nen nang muc kho puzzle va review cac van thang de giu do on dinh.';

  return [
    { label: 'Phong do hien tai', value: formScore, note: 'Tinh tu cac tran gan nhat.' },
    { label: 'Tam nhin chien thuat', value: tacticalVision, note: lab.reviewedGames ? `Accuracy TB ${lab.averageAccuracy ?? '--'}%, ${lab.totalBlunders || 0} blunder.` : 'Se chinh xac hon sau khi ban luu Game Review.' },
    { label: 'Ky luat review', value: reviewDiscipline, note: lab.reviewedGames ? `${lab.reviewedGames} van da co review, ${lab.reviewedMoves} nuoc da phan tich.` : 'Hay review cac van online de mo khoa thong ke sau.' },
    { label: 'Muc san sang review', value: reviewReadiness, note: lab.totalRefundedRating ? `${weakSpot} Fair-play da hoan ${lab.totalRefundedRating} rating.` : weakSpot }
  ];
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
        reject(new Error('KhĂ´ng thá»ƒ xá»­ lĂ½ áº£nh Ä‘áº¡i diá»‡n.'));
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
      reject(new Error('KhĂ´ng thá»ƒ Ä‘á»c áº£nh Ä‘Ă£ chá»n.'));
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
      setMessage('ÄĂ£ copy link há»“ sÆ¡.');
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
      setMessage('Há»“ sÆ¡ Ä‘Ă£ Ä‘Æ°á»£c cáº­p nháº­t.');
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
      setMessage('Vui lĂ²ng chá»n áº£nh PNG, JPG hoáº·c WebP.');
      return;
    }
    if (file.size > MAX_AVATAR_UPLOAD_SIZE) {
      setMessage('áº¢nh gá»‘c tá»‘i Ä‘a 5 MB.');
      return;
    }
    try {
      const photoURL = await resizedAvatarData(file);
      setForm((current) => ({ ...current, photoURL }));
      setMessage('áº¢nh Ä‘Ă£ chá»n. Nháº¥n LÆ°u há»“ sÆ¡ Ä‘á»ƒ cáº­p nháº­t.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (!authUser && !profileUserId) {
    return (
      <section className="profile-auth-required">
        <UserRound size={48} />
        <h1>Há»“ sÆ¡ cĂ¡ nhĂ¢n</h1>
        <p>ÄÄƒng nháº­p Ä‘á»ƒ quáº£n lĂ½ avatar, tĂªn hiá»ƒn thá»‹, rating vĂ  lá»‹ch sá»­ online cá»§a báº¡n.</p>
        <button onClick={onLogin}>ÄÄƒng nháº­p</button>
      </section>
    );
  }

  if (loading) return <div className="profile-loading">Äang táº£i há»“ sÆ¡...</div>;
  if (!profile) {
    return (
      <section className="profile-auth-required">
        <UserRound size={48} />
        <h1>KhĂ´ng tĂ¬m tháº¥y há»“ sÆ¡</h1>
        <p>{message || 'Link há»“ sÆ¡ nĂ y khĂ´ng tá»“n táº¡i hoáº·c ngÆ°á»i chÆ¡i chÆ°a cĂ³ dá»¯ liá»‡u.'}</p>
        <button onClick={() => onNavigate?.('home')}>Vá» trang chá»§</button>
      </section>
    );
  }

  const summary = profile?.summary || { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
  const avatarURL = isPublicProfile ? profile?.photoURL : form.photoURL;
  const shareId = profile?.id || profile?.username || '';
  const skills = skillProfile(profile, summary);

  return (
    <section className="profile-page">
      <header className="profile-hero">
        <div className="profile-avatar">
          {avatarURL ? <img src={avatarURL} alt="Avatar ngÆ°á»i chÆ¡i" /> : <UserRound size={56} />}
        </div>
        <div>
          <span>{isPublicProfile ? 'Public Player Profile' : 'Player Profile'}</span>
          <h1>{profile?.displayName || authUser?.displayName || 'Player'}</h1>
          <p>@{profile?.username || 'player'}</p>
          {shareId && <small className="profile-id">ID: {shareId}</small>}
        </div>
        <div className="profile-verified">
          <ShieldCheck size={20} />
          {isPublicProfile ? 'Há»“ sÆ¡ cĂ´ng khai' : profile?.emailVerified ? 'TĂ i khoáº£n Ä‘Ă£ xĂ¡c thá»±c' : 'ChÆ°a xĂ¡c thá»±c email'}
        </div>
      </header>

      <div className="profile-grid">
        {!isPublicProfile ? (
          <form className="profile-editor" onSubmit={submitProfile}>
            <h2>ThĂ´ng tin cĂ¡ nhĂ¢n</h2>
            <label>
              <span>TĂªn hiá»ƒn thá»‹</span>
              <input value={form.displayName} maxLength={80} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} />
            </label>
            <label>
              <span><ImagePlus size={16} /> áº¢nh Ä‘áº¡i diá»‡n</span>
              <input className="profile-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} />
              <small>Chá»n áº£nh tá»« mĂ¡y cá»§a báº¡n (PNG, JPG hoáº·c WebP, tá»‘i Ä‘a 5 MB). áº¢nh sáº½ Ä‘Æ°á»£c tá»‘i Æ°u lĂ m avatar.</small>
            </label>
            <div className="profile-detail-line"><Mail size={17} /><span>{profile?.email || 'KhĂ´ng cĂ³ email'}</span></div>
            <div className="profile-detail-line"><CalendarDays size={17} /><span>Tham gia: {formattedDate(profile?.createdAt)}</span></div>
            <button className="profile-save" disabled={saving} type="submit">
              <Save size={17} /> {saving ? 'Äang lÆ°u...' : 'LÆ°u há»“ sÆ¡'}
            </button>
            <button className="profile-share-button" type="button" onClick={copyProfileLink}>
              <Copy size={17} /> Copy link há»“ sÆ¡
            </button>
            {message && <p className="profile-message">{message}</p>}
          </form>
        ) : (
          <aside className="profile-editor profile-public-card">
            <h2>ThĂ´ng tin ngÆ°á»i chÆ¡i</h2>
            <div className="profile-detail-line"><UserRound size={17} /><span>@{profile?.username || 'player'}</span></div>
            <div className="profile-detail-line"><CalendarDays size={17} /><span>Tham gia: {formattedDate(profile?.createdAt)}</span></div>
            <button className="profile-share-button" type="button" onClick={copyProfileLink}>
              <Copy size={17} /> Copy link há»“ sÆ¡
            </button>
            {message && <p className="profile-message">{message}</p>}
          </aside>
        )}

        <div className="profile-stats">
          <h2>ThĂ nh tĂ­ch online</h2>
          <div className="profile-summary">
            <div><Swords size={18} /><b>{summary.gamesPlayed}</b><span>VĂ¡n Ä‘Ă£ chÆ¡i</span></div>
            <div><Trophy size={18} /><b>{summary.wins}</b><span>Tháº¯ng</span></div>
            <div><b>{summary.losses}</b><span>Thua</span></div>
            <div><b>{summary.draws}</b><span>HĂ²a</span></div>
            <div><CheckCircle2 size={18} /><b>{winRate(summary)}</b><span>Tá»‰ lá»‡ tháº¯ng</span></div>
          </div>
          <div className="profile-ratings">
            {(profile?.ratings || []).map((rating) => {
              const mode = rating.mode;
              return (
                <div key={mode}>
                  <strong>{MODE_LABELS[mode] || mode}</strong>
                  <b>{rating.rating}</b>
                  <small>{rating.games_played} vĂ¡n{rating.provisional ? ' - táº¡m tĂ­nh' : ''}</small>
                </div>
              );
            })}
          </div>
          {profile?.ratings?.length === 0 && <p className="profile-empty">ChÆ°a cĂ³ rating online Ä‘Æ°á»£c ghi nháº­n.</p>}
          <button className="profile-leaderboard-link" onClick={() => onNavigate?.('leaderboard')}>
            <Medal size={17} /> Xem báº£ng xáº¿p háº¡ng
          </button>
        </div>
      </div>

      <section className="profile-skill-lab">
        <div>
          <span>Skill Lab</span>
          <h2>Ho so ky nang chuyen sau</h2>
          <p>He thong doc lich su dau online de goi y diem manh, diem yeu va muc uu tien khi review van.</p>
        </div>
        <div className="profile-skill-grid">
          {skills.map((skill) => (
            <article key={skill.label}>
              <strong>{skill.label}</strong>
              <b>{skill.value}/100</b>
              <div><span style={{ width: `${skill.value}%` }} /></div>
              <small>{skill.note}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="profile-recent">
        <div className="profile-recent-heading">
          <h2>Lá»‹ch sá»­ tráº­n Ä‘áº¥u</h2>
          {!isPublicProfile && <button onClick={() => onNavigate?.('history')}><History size={17} /> Xem lá»‹ch sá»­ vĂ  review</button>}
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
                <small>{game.mode || 'rapid'} - {game.timeControl || '--'} - {game.color === 'w' ? 'Tráº¯ng' : 'Äen'}</small>
                {game.review && <small>Review: accuracy {game.review.accuracy}% - {game.review.blunders} blunder - CPL {game.review.averageCentipawnLoss}</small>}
                <time>{formatMatchDate(game.finishedAt)}</time>
              </div>
            ))}
          </div>
        ) : (
          <p className="profile-empty">
            {isPublicProfile ? 'NgÆ°á»i chÆ¡i nĂ y chÆ°a cĂ³ tráº­n online hoĂ n thĂ nh.' : `Báº¡n Ä‘Ă£ chÆ¡i ${summary.gamesPlayed} tráº­n online Ä‘Æ°á»£c tĂ­nh káº¿t quáº£. Má»Ÿ danh sĂ¡ch lá»‹ch sá»­ Ä‘á»ƒ chá»n Ä‘Ăºng vĂ¡n cáº§n xem láº¡i.`}
          </p>
        )}
      </section>
    </section>
  );
}
