import React from 'react';
import { Award, CalendarDays, CheckCircle2, Copy, Dumbbell, History, ImagePlus, Mail, Medal, Save, ShieldCheck, Swords, Trophy, UserMinus, UserPlus, UserRound } from 'lucide-react';
import { createFriendGame } from '../../api/online';
import { fetchFriends, removeFriendship, sendFriendRequest } from '../../api/friends';
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
  if (game.outcome === 'draw') return 'Hòa';
  return game.outcome === 'win' ? 'Thắng' : 'Thua';
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
    ? 'Cần luyện lại các ván thua gần đây và tìm mẫu blunder lặp lại.'
    : 'Nên nâng mức khó puzzle và review các ván thắng để giữ độ ổn định.';

  return [
    { label: 'Phong độ hiện tại', value: formScore, note: 'Tính từ các trận gần nhất.' },
    { label: 'Tầm nhìn chiến thuật', value: tacticalVision, note: lab.reviewedGames ? `Accuracy TB ${lab.averageAccuracy ?? '--'}%, ${lab.totalBlunders || 0} blunder.` : 'Sẽ chính xác hơn sau khi bạn lưu Game Review.' },
    { label: 'Kỷ luật review', value: reviewDiscipline, note: lab.reviewedGames ? `${lab.reviewedGames} ván đã có review, ${lab.reviewedMoves} nước đã phân tích.` : 'Hãy review các ván online để mở khóa thống kê sau.' },
    { label: 'Mức sẵn sàng review', value: reviewReadiness, note: lab.totalRefundedRating ? `${weakSpot} Fair-play đã hoàn ${lab.totalRefundedRating} rating.` : weakSpot }
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
  const [friendship, setFriendship] = React.useState(null);
  const [socialBusy, setSocialBusy] = React.useState(false);
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

  React.useEffect(() => {
    if (!authUser || !isPublicProfile || !profile?.id) {
      setFriendship(null);
      return undefined;
    }
    let cancelled = false;
    fetchFriends()
      .then((data) => {
        if (cancelled) return;
        const all = [...(data.friends || []), ...(data.incoming || []), ...(data.outgoing || [])];
        setFriendship(all.find((item) => item.user?.id === profile.id) || { status: 'none', user: { id: profile.id } });
      })
      .catch(() => {
        if (!cancelled) setFriendship({ status: 'none', user: { id: profile.id } });
      });
    return () => {
      cancelled = true;
    };
  }, [authUser, isPublicProfile, profile?.id]);

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

  const addFriend = async () => {
    if (!profile?.id) return;
    setSocialBusy(true);
    setMessage('');
    try {
      await sendFriendRequest(profile.id);
      setFriendship((current) => ({ ...(current || {}), status: 'outgoing', user: { id: profile.id } }));
      setMessage('Đã gửi lời mời kết bạn.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSocialBusy(false);
    }
  };

  const removeFriend = async () => {
    if (!profile?.id) return;
    setSocialBusy(true);
    setMessage('');
    try {
      await removeFriendship({ friendshipId: friendship?.id, userId: profile.id });
      setFriendship({ status: 'none', user: { id: profile.id } });
      setMessage('Đã cập nhật quan hệ bạn bè.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSocialBusy(false);
    }
  };

  const challengeFriend = async () => {
    setSocialBusy(true);
    setMessage('');
    try {
      const data = await createFriendGame('600+0', 'random');
      const link = `${window.location.origin}/play/online?invite=${data.inviteCode}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      setMessage(`Đã tạo link thách đấu ${data.inviteCode}. Link đã được copy nếu trình duyệt cho phép.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSocialBusy(false);
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
  const skills = skillProfile(profile, summary);

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
        {isPublicProfile && authUser && (
          <div className="profile-social-actions">
            {friendship?.status === 'friends' ? (
              <>
                <button disabled={socialBusy} onClick={challengeFriend} type="button"><Swords size={17} /> Thách đấu</button>
                <button className="secondary danger" disabled={socialBusy} onClick={removeFriend} type="button"><UserMinus size={17} /> Hủy bạn</button>
              </>
            ) : friendship?.status === 'outgoing' ? (
              <button className="secondary" disabled={socialBusy} onClick={removeFriend} type="button"><UserMinus size={17} /> Hủy lời mời</button>
            ) : friendship?.status === 'incoming' ? (
              <button disabled type="button"><UserPlus size={17} /> Đang chờ ở trang Bạn bè</button>
            ) : (
              <button disabled={socialBusy} onClick={addFriend} type="button"><UserPlus size={17} /> Kết bạn</button>
            )}
          </div>
        )}
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

      <section className="profile-skill-lab">
        <div>
          <span>Skill Lab</span>
          <h2>Hồ sơ kỹ năng chuyên sâu</h2>
          <p>Hệ thống đọc lịch sử đấu online để gợi ý điểm mạnh, điểm yếu và mức ưu tiên khi review ván.</p>
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

      <section className="profile-skill-lab profile-achievements">
        <div>
          <span><Award size={16} /> Achievements</span>
          <h2>Huy hiệu tiến bộ</h2>
          <p>Huy hiệu được mở từ lịch sử online, rating và thói quen review của bạn.</p>
        </div>
        <div className="profile-skill-grid">
          {(profile?.achievements || []).map((achievement) => (
            <article className={achievement.unlocked ? 'unlocked' : 'locked'} key={achievement.id}>
              <strong>{achievement.label}</strong>
              <b>{achievement.unlocked ? 'Mở khóa' : `${achievement.progress ?? 0}/${achievement.target ?? 1}`}</b>
              <div><span style={{ width: `${achievement.unlocked ? 100 : Math.round(((achievement.progress ?? 0) / (achievement.target ?? 1)) * 100)}%` }} /></div>
              <small>{achievement.description}</small>
            </article>
          ))}
        </div>
      </section>

      {!isPublicProfile && (
        <section className="profile-skill-lab profile-training-card">
          <div>
            <span><Dumbbell size={16} /> Personal Training</span>
            <h2>Luyện từ ván thật</h2>
            <p>{profile?.training?.nextAction || 'Review ván online đã kết thúc để tạo bài tập cá nhân.'}</p>
          </div>
          <div className="profile-summary">
            <div><b>{profile?.training?.newPersonalPuzzles || 0}</b><span>Bài tập mới</span></div>
            <div><b>{profile?.training?.personalPuzzles || 0}</b><span>Tổng bài tập</span></div>
            <div><b>{profile?.training?.reviewedGames || 0}</b><span>Ván đã review</span></div>
          </div>
          <button className="profile-leaderboard-link" onClick={() => onNavigate?.('personal-puzzles')}>
            <Dumbbell size={17} /> Mở Puzzle cá nhân
          </button>
        </section>
      )}

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
                {game.review && <small>Review: accuracy {game.review.accuracy}% - {game.review.blunders} blunder - CPL {game.review.averageCentipawnLoss}</small>}
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
