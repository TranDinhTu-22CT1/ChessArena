import React from 'react';
import {
  Activity,
  Award,
  Brain,
  CalendarDays,
  Dumbbell,
  ExternalLink,
  History,
  ImagePlus,
  Loader2,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Trophy,
  UserMinus,
  UserPlus,
  UserRound,
  Users
} from 'lucide-react';
import { createAppeal, fetchMyAppeals } from '../../api/fairPlay';
import { fetchFriends, removeFriendship, sendFriendRequest } from '../../api/friends';
import { createFriendGame } from '../../api/online';
import { fetchProfile, fetchPublicProfile, saveProfile } from '../../api/profile';
import { changeFollow, fetchActivityFeed, fetchFollowSummary } from '../../api/social';
import MembershipBadge from '../../components/MembershipBadge';

const MODE_LABELS = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  classical: 'Classical'
};

const ACHIEVEMENT_TEXT = {
  'first-blood': ['Chiến thắng đầu tiên', 'Thắng ván online đầu tiên.'],
  'arena-regular': ['Kỳ thủ Arena', 'Hoàn thành 20 ván online.'],
  'review-discipline': ['Kỷ luật phân tích', 'Lưu Game Review cho 10 ván đấu.'],
  'mode-climber': ['Chinh phục rating', 'Đạt 800 rating ở một chế độ.'],
  'training-ready': ['Sẵn sàng luyện tập', 'Có bài tập cá nhân được tạo từ ván thật.']
};

const MAX_AVATAR_UPLOAD_SIZE = 5 * 1024 * 1024;
const AVATAR_EDGE = 128;

function formattedDate(value, includeTime = false) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(new Date(value));
}

function winRate(summary) {
  if (!summary?.gamesPlayed) return '0%';
  return `${Math.round((summary.wins / summary.gamesPlayed) * 100)}%`;
}

function matchLabel(game) {
  if (game.outcome === 'draw') return 'Hòa';
  return game.outcome === 'win' ? 'Thắng' : 'Thua';
}

function activityLabel(type) {
  if (type === 'won_game') return 'Thắng ván';
  if (type === 'drew_game') return 'Hòa ván';
  if (type === 'followed_player') return 'Theo dõi kỳ thủ';
  return 'Hoạt động';
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
    ? 'Review lại các ván thua gần đây và tìm mẫu lỗi lặp lại.'
    : 'Tăng độ khó puzzle và review các ván thắng để giữ phong độ.';

  return [
    { label: 'Phong độ hiện tại', value: formScore, note: 'Tính từ kết quả các ván gần nhất.' },
    {
      label: 'Tầm nhìn chiến thuật',
      value: tacticalVision,
      note: lab.reviewedGames
        ? `Độ chính xác trung bình ${lab.averageAccuracy ?? '--'}%, ${lab.totalBlunders || 0} lỗi nghiêm trọng.`
        : 'Điểm số sẽ chính xác hơn sau khi có Game Review.'
    },
    {
      label: 'Kỷ luật review',
      value: reviewDiscipline,
      note: lab.reviewedGames
        ? `${lab.reviewedGames} ván và ${lab.reviewedMoves} nước đã được phân tích.`
        : 'Review các ván online để mở khóa dữ liệu này.'
    },
    {
      label: 'Sẵn sàng phân tích',
      value: reviewReadiness,
      note: lab.totalRefundedRating
        ? `${weakSpot} Fair-play đã hoàn ${lab.totalRefundedRating} rating.`
        : weakSpot
    }
  ];
}

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

function ProfileSectionHead({ eyebrow, title, icon: Icon, action }) {
  return (
    <div className="profile-section-head">
      <div>
        <span>{eyebrow}</span>
        <h2>{Icon && <Icon size={20} />}{title}</h2>
      </div>
      {action}
    </div>
  );
}

export default function ProfilePage({ authUser, profileUserId = '', onLogin, onNavigate, onProfileUpdated }) {
  const [profile, setProfile] = React.useState(null);
  const [form, setForm] = React.useState({ displayName: '', photoURL: '' });
  const [loading, setLoading] = React.useState(Boolean(authUser || profileUserId));
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [friendship, setFriendship] = React.useState(null);
  const [socialBusy, setSocialBusy] = React.useState(false);
  const [followSummary, setFollowSummary] = React.useState({ followers: 0, following: 0, followed: false });
  const [activities, setActivities] = React.useState([]);
  const [fairPlay, setFairPlay] = React.useState({ reports: [], appeals: [] });
  const [appealForm, setAppealForm] = React.useState({ reportId: '', message: '' });
  const [isOwnProfile, setIsOwnProfile] = React.useState(!profileUserId);
  const isPublicProfile = Boolean(profileUserId) && !isOwnProfile;

  React.useEffect(() => {
    if (!authUser && !profileUserId) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setMessage('');
    setProfile(null);
    setIsOwnProfile(!profileUserId);
    const loadProfile = async () => {
      if (!profileUserId) {
        return { nextProfile: await fetchProfile(), own: true };
      }

      if (!authUser) {
        return { nextProfile: await fetchPublicProfile(profileUserId), own: false };
      }

      const ownProfile = await fetchProfile();
      if (String(ownProfile?.id || '') === String(profileUserId)) {
        return { nextProfile: ownProfile, own: true };
      }

      return { nextProfile: await fetchPublicProfile(profileUserId), own: false };
    };

    loadProfile()
      .then(({ nextProfile, own }) => {
        if (cancelled) return;
        setIsOwnProfile(own);
        setProfile(nextProfile);
        setForm({ displayName: nextProfile.displayName || '', photoURL: nextProfile.photoURL || '' });
        if (own && nextProfile.id) {
          const canonicalPath = `/profile/${encodeURIComponent(nextProfile.id)}`;
          if (window.location.pathname !== canonicalPath) {
            window.history.replaceState(null, '', `${canonicalPath}${window.location.search}${window.location.hash}`);
          }
        }
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

  React.useEffect(() => {
    if (!profile?.id || !authUser) return undefined;

    let cancelled = false;
    Promise.all([
      fetchFollowSummary(profile.id),
      fetchActivityFeed({ userId: profile.id, limit: 8 })
    ]).then(([summaryData, activityData]) => {
      if (cancelled) return;
      setFollowSummary(summaryData);
      setActivities(activityData.activities || []);
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [authUser, profile?.id]);

  React.useEffect(() => {
    if (!authUser || isPublicProfile) return undefined;

    let cancelled = false;
    fetchMyAppeals().then((data) => {
      if (!cancelled) {
        setFairPlay(data);
        setAppealForm((current) => ({ ...current, reportId: current.reportId || data.reports?.[0]?.id || '' }));
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [authUser, isPublicProfile]);

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
      const data = await createFriendGame('600+0', 'random', profile?.id || '');
      const link = `${window.location.origin}/play/online?invite=${data.inviteCode}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      const expiresAt = data.expiresAt
        ? new Date(data.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : '10 phút';
      setMessage(`Đã tạo lời thách đấu ${data.inviteCode}. Liên kết hết hạn lúc ${expiresAt} và đã được sao chép.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSocialBusy(false);
    }
  };

  const toggleFollow = async () => {
    if (!profile?.id) return;
    setSocialBusy(true);
    try {
      const next = await changeFollow(profile.id, followSummary.followed ? 'unfollow' : 'follow');
      setFollowSummary((current) => ({
        ...current,
        followed: next.followed,
        followers: Math.max(0, current.followers + (next.followed ? 1 : -1))
      }));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSocialBusy(false);
    }
  };

  const selectAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
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
      setMessage('Ảnh đã được chọn. Nhấn “Lưu hồ sơ” để hoàn tất.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const submitAppeal = async (event) => {
    event.preventDefault();
    setSocialBusy(true);
    setMessage('');
    try {
      const result = await createAppeal(appealForm);
      setFairPlay((current) => ({ ...current, appeals: [result.appeal, ...(current.appeals || [])] }));
      setAppealForm((current) => ({ ...current, message: '' }));
      setMessage('Đã gửi khiếu nại thành công.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSocialBusy(false);
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

  if (loading) {
    return (
      <div className="profile-loading">
        <Loader2 size={38} />
        <span>Đang tải hồ sơ...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <section className="profile-auth-required">
        <UserRound size={48} />
        <h1>Không tìm thấy hồ sơ</h1>
        <p>{message || 'Liên kết hồ sơ không tồn tại hoặc người chơi chưa có dữ liệu.'}</p>
        <button onClick={() => onNavigate?.('home')}>Về trang chủ</button>
      </section>
    );
  }

  const summary = profile.summary || { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
  const avatarURL = isPublicProfile ? profile.photoURL : form.photoURL;
  const skills = skillProfile(profile, summary);
  const highestRating = Math.max(0, ...(profile.ratings || []).map((rating) => Number(rating.rating) || 0));
  const bestRating = (profile.ratings || []).reduce((best, rating) => (
    Number(rating.rating || 0) > Number(best?.rating || 0) ? rating : best
  ), null);
  const unlockedAchievements = (profile.achievements || []).filter((item) => item.unlocked).length;
  return (
    <section className="player-profile-page">
      <header className="player-profile-hero">
        <div className="player-profile-avatar">
          {avatarURL ? <img src={avatarURL} alt="" /> : <UserRound size={58} />}
          {!isPublicProfile && (
            <label title="Đổi ảnh đại diện">
              <ImagePlus size={16} />
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} />
            </label>
          )}
        </div>

        <div className="player-profile-identity">
          <span className="player-profile-eyebrow">
            <Sparkles size={15} />
            {isPublicProfile ? 'Hồ sơ kỳ thủ' : 'Không gian cá nhân'}
          </span>
          <div>
            <h1>{profile.displayName || authUser?.displayName || 'Player'}</h1>
            <MembershipBadge tier={profile.membershipTier} />
          </div>
          <p>@{profile.username || 'player'}</p>
          <div className="player-profile-meta">
            <div className="player-profile-verification">
              <ShieldCheck size={15} />
              {isPublicProfile ? 'Hồ sơ công khai' : profile.emailVerified ? 'Tài khoản đã xác thực' : 'Email chưa xác thực'}
            </div>
            <span><Users size={14} /> {followSummary.followers} người theo dõi</span>
            <span>{followSummary.following} đang theo dõi</span>
          </div>
        </div>

        <div className="player-profile-featured-rating">
          <span>Phong độ nổi bật</span>
          <strong>{highestRating ? `${highestRating} Elo` : 'Mới'}</strong>
          <small>{bestRating ? `${MODE_LABELS[bestRating.mode] || bestRating.mode} · ${bestRating.games_played} ván` : 'Chưa có rating online'}</small>
          <div>
            <i style={{ width: `${Math.min(100, Math.max(8, ((highestRating || 400) - 300) / 14))}%` }} />
          </div>
          <button type="button" onClick={() => onNavigate?.('leaderboard')}>
            Bảng xếp hạng <ExternalLink size={14} />
          </button>
        </div>

        <div className="player-profile-hero-actions">
          {isPublicProfile && authUser && (
            <>
              <button type="button" disabled={socialBusy} onClick={toggleFollow}>
                {followSummary.followed ? <UserMinus size={16} /> : <UserPlus size={16} />}
                {followSummary.followed ? 'Bỏ theo dõi' : 'Theo dõi'}
              </button>
              {friendship?.status === 'friends' ? (
                <>
                  <button className="primary" type="button" disabled={socialBusy} onClick={challengeFriend}>
                    <Swords size={16} /> Thách đấu
                  </button>
                  <button className="danger" type="button" disabled={socialBusy} onClick={removeFriend}>
                    <UserMinus size={16} /> Hủy bạn
                  </button>
                </>
              ) : friendship?.status === 'outgoing' ? (
                <button className="danger" type="button" disabled={socialBusy} onClick={removeFriend}>
                  <UserMinus size={16} /> Hủy lời mời
                </button>
              ) : friendship?.status === 'incoming' ? (
                <button type="button" disabled><Users size={16} /> Đang chờ phản hồi</button>
              ) : (
                <button className="primary" type="button" disabled={socialBusy} onClick={addFriend}>
                  <UserPlus size={16} /> Kết bạn
                </button>
              )}
            </>
          )}
        </div>

        <section className="player-profile-summary">
          <article><Swords size={19} /><div><strong>{summary.gamesPlayed}</strong><span>Ván đã chơi</span></div></article>
          <article><Trophy size={19} /><div><strong>{summary.wins}</strong><span>Chiến thắng</span></div></article>
          <article><Target size={19} /><div><strong>{winRate(summary)}</strong><span>Tỷ lệ thắng</span></div></article>
          <article><Award size={19} /><div><strong>{unlockedAchievements}</strong><span>Thành tựu</span></div></article>
        </section>
      </header>

      {message && <p className="player-profile-message">{message}</p>}

      <div className="player-profile-workspace">
        <div className="player-profile-main-grid player-profile-overview-grid">
        <section className="player-profile-card">
          <ProfileSectionHead
            eyebrow={isPublicProfile ? 'Thông tin kỳ thủ' : 'Thiết lập tài khoản'}
            title={isPublicProfile ? 'Thông tin hồ sơ' : 'Chỉnh sửa hồ sơ'}
            icon={UserRound}
          />

          {!isPublicProfile ? (
            <form className="player-profile-form" onSubmit={submitProfile}>
              <label>
                <span>Tên hiển thị</span>
                <input
                  type="text"
                  value={form.displayName}
                  maxLength={80}
                  onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                />
              </label>
              <label className="player-profile-upload">
                <span><ImagePlus size={16} /> Ảnh đại diện</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} />
                <small>PNG, JPG hoặc WebP, tối đa 5 MB. Ảnh được tự động cắt vuông.</small>
              </label>
              <div className="player-profile-details">
                <div><Mail size={17} /><span><small>Email</small>{profile.email || 'Không có email'}</span></div>
                <div><CalendarDays size={17} /><span><small>Ngày tham gia</small>{formattedDate(profile.createdAt)}</span></div>
              </div>
              <button className="player-profile-primary-button" disabled={saving} type="submit">
                {saving ? <Loader2 size={17} /> : <Save size={17} />}
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </form>
          ) : (
            <div className="player-profile-details public">
              <div><UserRound size={17} /><span><small>Tên người dùng</small>@{profile.username || 'player'}</span></div>
              <div><CalendarDays size={17} /><span><small>Ngày tham gia</small>{formattedDate(profile.createdAt)}</span></div>
            </div>
          )}
        </section>
        </div>

        <div className="player-profile-insights-grid">
        <section className="player-profile-card">
          <ProfileSectionHead eyebrow="Phân tích dữ liệu" title="Hồ sơ kỹ năng" icon={Brain} />
          <p className="player-profile-section-description">
            Điểm kỹ năng được ước tính từ phong độ, rating và dữ liệu Game Review hiện có.
          </p>
          <div className="player-profile-skill-grid">
            {skills.map((skill) => (
              <article key={skill.label}>
                <div><strong>{skill.label}</strong><b>{skill.value}</b></div>
                <i><span style={{ width: `${skill.value}%` }} /></i>
                <p>{skill.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="player-profile-card">
          <ProfileSectionHead
            eyebrow="Cột mốc cá nhân"
            title="Thành tựu"
            icon={Award}
            action={!isPublicProfile ? (
              <button className="player-profile-text-button" type="button" onClick={() => onNavigate?.('achievements')}>
                Xem tất cả <ExternalLink size={14} />
              </button>
            ) : null}
          />
          <div className="player-profile-achievement-grid">
            {(profile.achievements || []).map((achievement) => {
              const translation = ACHIEVEMENT_TEXT[achievement.id] || [achievement.label, achievement.description];
              const percent = achievement.unlocked
                ? 100
                : Math.min(100, Math.round(((achievement.progress || 0) / Math.max(1, achievement.target || 1)) * 100));
              return (
                <article className={achievement.unlocked ? 'unlocked' : 'locked'} key={achievement.id}>
                  <span>{achievement.unlocked ? <Award size={21} /> : <Lock size={19} />}</span>
                  <div>
                    <strong>{translation[0]}</strong>
                    <p>{translation[1]}</p>
                    <i><span style={{ width: `${percent}%` }} /></i>
                    <small>{achievement.unlocked ? 'Đã hoàn thành' : `${achievement.progress || 0} / ${achievement.target || 1}`}</small>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        </div>

        {!isPublicProfile && (
          <div className="player-profile-main-grid player-profile-support-grid">
          <section className="player-profile-card training">
            <ProfileSectionHead eyebrow="Lộ trình cá nhân" title="Luyện tập tiếp theo" icon={Dumbbell} />
            <p className="player-profile-training-copy">
              {profile.training?.nextAction || 'Review ván online đã kết thúc để hệ thống tạo bài tập.'}
            </p>
            <div className="player-profile-training-stats">
              <div><strong>{profile.training?.newPersonalPuzzles || 0}</strong><span>Bài mới</span></div>
              <div><strong>{profile.training?.personalPuzzles || 0}</strong><span>Tổng bài</span></div>
              <div><strong>{profile.training?.reviewedGames || 0}</strong><span>Đã review</span></div>
            </div>
            <button className="player-profile-primary-button" type="button" onClick={() => onNavigate?.('personal-puzzles')}>
              <Dumbbell size={17} /> Mở Puzzle cá nhân
            </button>
          </section>

          {(fairPlay.reports?.length > 0 || fairPlay.appeals?.length > 0) && (
            <section className="player-profile-card fair-play">
              <ProfileSectionHead eyebrow="Hỗ trợ tài khoản" title="Khiếu nại Fair-play" icon={ShieldCheck} />
              {fairPlay.reports?.length > 0 && (
                <form className="player-profile-appeal-form" onSubmit={submitAppeal}>
                  <select
                    value={appealForm.reportId}
                    onChange={(event) => setAppealForm((current) => ({ ...current, reportId: event.target.value }))}
                  >
                    {fairPlay.reports.map((report) => (
                      <option value={report.id} key={report.id}>
                        Báo cáo #{report.id.slice(0, 8)} · Mức rủi ro {report.risk_score}
                      </option>
                    ))}
                  </select>
                  <textarea
                    required
                    minLength={20}
                    rows={3}
                    value={appealForm.message}
                    onChange={(event) => setAppealForm((current) => ({ ...current, message: event.target.value }))}
                    placeholder="Trình bày lý do khiếu nại..."
                  />
                  <button type="submit" disabled={socialBusy}>Gửi khiếu nại</button>
                </form>
              )}
              {fairPlay.appeals?.length > 0 && (
                <div className="player-profile-appeal-list">
                  {fairPlay.appeals.map((appeal) => (
                    <article key={appeal.id}>
                      <strong>Khiếu nại #{appeal.id.slice(0, 8)} · {appeal.status}</strong>
                      <p>{appeal.admin_note || appeal.message}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
          </div>
        )}

        <div className="player-profile-timeline-grid">
        <section className="player-profile-card">
          <ProfileSectionHead
            eyebrow="Phong độ gần đây"
            title="Lịch sử trận đấu"
            icon={History}
            action={!isPublicProfile ? (
              <button className="player-profile-text-button" type="button" onClick={() => onNavigate?.('history')}>
                Xem toàn bộ <ExternalLink size={14} />
              </button>
            ) : null}
          />

          {(profile.recentGames || []).length > 0 ? (
            <div className="player-profile-game-list">
              {profile.recentGames.map((game) => (
                <article key={game.id}>
                  <span className={`player-profile-result ${game.outcome}`}>{matchLabel(game)}</span>
                  <div>
                    <strong>
                      vs {game.opponent?.name || 'Player'}
                      {Number.isFinite(game.ratingDelta) && (
                        <b className={game.ratingDelta > 0 ? 'up' : game.ratingDelta < 0 ? 'down' : ''}>
                          {game.ratingDelta > 0 ? '+' : ''}{game.ratingDelta}
                        </b>
                      )}
                    </strong>
                    <p>
                      {MODE_LABELS[game.mode] || game.mode || 'Rapid'} · {game.timeControl || '--'} ·
                      {' '}Quân {game.color === 'w' ? 'Trắng' : 'Đen'}
                      {game.review && ` · Chính xác ${game.review.accuracy}%`}
                    </p>
                  </div>
                  <time>{formattedDate(game.finishedAt, true)}</time>
                </article>
              ))}
            </div>
          ) : (
            <div className="player-profile-empty">
              {isPublicProfile ? 'Người chơi này chưa có ván online.' : 'Bạn chưa có ván online nào được ghi nhận.'}
            </div>
          )}
        </section>

        {activities.length > 0 && (
          <section className="player-profile-card">
            <ProfileSectionHead eyebrow="Dòng thời gian" title="Hoạt động gần đây" icon={Activity} />
            <div className="player-profile-activity-list">
              {activities.map((activity) => (
                <article key={activity.id}>
                  <span><Activity size={16} /></span>
                  <div>
                    <strong>{activityLabel(activity.type)}</strong>
                    <p>{activity.metadata?.mode || activity.subject_id || 'Tương tác trên ChessArena'}</p>
                  </div>
                  <time>{formattedDate(activity.created_at, true)}</time>
                </article>
              ))}
            </div>
          </section>
        )}
        </div>
      </div>
    </section>
  );
}
