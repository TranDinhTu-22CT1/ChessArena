import React from 'react';
import { Award, Brain, CalendarDays, CheckCircle2, Copy, Dumbbell, History, ImagePlus, Loader2, Mail, Medal, Save, ShieldCheck, Swords, Trophy, UserMinus, UserPlus, UserRound } from 'lucide-react';
import { createFriendGame } from '../../api/online';
import { fetchFriends, removeFriendship, sendFriendRequest } from '../../api/friends';
import { fetchProfile, fetchPublicProfile, saveProfile } from '../../api/profile';
import { changeFollow, fetchActivityFeed, fetchFollowSummary } from '../../api/social';
import { createAppeal, fetchMyAppeals } from '../../api/fairPlay';
import MembershipBadge from '../../components/MembershipBadge';

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
    { label: 'Kỷ luật review', value: reviewDiscipline, note: lab.reviewedGames ? `${lab.reviewedGames} ván đã có review, ${lab.reviewedMoves} nước đã phân tích.` : 'Hãy review các ván online để mở khóa.' },
    { label: 'Sẵn sàng phân tích', value: reviewReadiness, note: lab.totalRefundedRating ? `${weakSpot} Fair-play đã hoàn ${lab.totalRefundedRating} rating.` : weakSpot }
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
  const [followSummary, setFollowSummary] = React.useState({ followers: 0, following: 0, followed: false });
  const [activities, setActivities] = React.useState([]);
  const [fairPlay, setFairPlay] = React.useState({ reports: [], appeals: [] });
  const [appealForm, setAppealForm] = React.useState({ reportId: '', message: '' });
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
      const data = await createFriendGame('600+0', 'random', profile?.id || '');
      const link = `${window.location.origin}/play/online?invite=${data.inviteCode}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      const expiresAt = data.expiresAt
        ? new Date(data.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : '10 phút';
      setMessage(`Đã tạo link thách đấu ${data.inviteCode}. Link hết hạn lúc ${expiresAt} và đã được copy.`);
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
      setMessage('Ảnh đã được chọn. Nhấn "Lưu hồ sơ" để hoàn tất.');
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

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: '#888' }}>
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .animate-spin { animation: spin 1s linear infinite; }
        `}</style>
        <Loader2 size={40} className="animate-spin" />
        <p style={{ marginTop: '16px' }}>Đang tải hồ sơ...</p>
      </div>
    );
  }

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
    <section className="modern-profile-page">
      {/* CSS CHO GIAO DIỆN HIỆN ĐẠI */}
      <style>{`
        /* Biến màu sắc toàn cục */
        :root {
          --brand-green: #abc854;
          --brand-green-dark: #87a53b;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --text-adaptive: #132118;
            --text-muted: #5b6b55;
            --bg-surface-adaptive: rgba(255, 255, 248, 0.9);
            --bg-input-adaptive: rgba(239, 247, 229, 0.88);
            --border-adaptive: rgba(73, 101, 49, 0.16);
          }
        }
        @media (prefers-color-scheme: light) {
          :root {
            --text-adaptive: #111827;
            --text-muted: #6b7280;
            --bg-surface-adaptive: #ffffff;
            --bg-input-adaptive: #f3f4f6;
            --border-adaptive: #e5e7eb;
          }
        }

        .modern-profile-page {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 6px 0 36px;
          color: var(--text-adaptive);
        }

        /* Hero Section */
        .modern-hero {
          position: relative;
          background: linear-gradient(135deg, #d8ed91 0%, #a8c45b 100%);
          border-radius: 20px;
          padding: 40px 32px;
          display: flex;
          align-items: center;
          gap: 32px;
          flex-wrap: wrap;
          box-shadow: 0 16px 42px rgba(94, 122, 49, 0.18);
          overflow: hidden;
        }
        /* Ép màu chữ đen tuyền cho phần Hero xanh lá */
        .modern-hero * {
          color: #000000 !important;
        }
        .modern-avatar {
          position: relative;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 4px solid #ffffff;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px rgba(0,0,0,0.15);
          flex-shrink: 0;
          overflow: hidden;
        }
        .modern-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .modern-hero-info h1 {
          font-size: 32px;
          font-weight: 800;
          margin: 0 0 4px 0;
        }
        .modern-profile-name {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin: 0 0 4px;
        }
        .modern-profile-name h1 {
          margin: 0;
        }
        .modern-hero-info p {
          font-size: 16px;
          opacity: 0.8;
          margin: 0 0 12px 0;
          font-weight: 500;
        }
        .modern-verified-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.3);
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          backdrop-filter: blur(4px);
        }

        /* Buttons in Hero */
        .modern-hero-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
          flex-wrap: wrap;
        }
        .modern-hero-actions button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          border: none;
          transition: transform 0.2s, opacity 0.2s;
          background: #ffffff; /* Nền nút trắng */
          color: #000000 !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }
        .modern-hero-actions button:hover {
          transform: translateY(-2px);
          opacity: 0.9;
        }
        .modern-hero-actions button.danger {
          background: #fee2e2;
          color: #b91c1c !important;
        }

        /* Cards Layout */
        .modern-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
        }
        .modern-card {
          background: var(--bg-surface-adaptive);
          border: 1px solid var(--border-adaptive);
          border-radius: 20px;
          padding: 28px;
          color: var(--text-adaptive);
          box-shadow: 0 16px 40px rgba(48, 72, 42, 0.1);
        }
        .modern-card h2 {
          font-size: 20px;
          font-weight: 700;
          margin-top: 0;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-adaptive);
        }

        /* Form Inputs */
        .modern-form label {
          display: block;
          margin-bottom: 16px;
        }
        .modern-form label span {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          margin-bottom: 8px;
          font-size: 14px;
          color: var(--text-adaptive);
        }
        .modern-form input[type="text"], .modern-form textarea, .modern-form select {
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1px solid var(--border-adaptive);
          background: var(--bg-input-adaptive);
          color: var(--text-adaptive);
          font-size: 14px;
          transition: border-color 0.2s;
        }
        .modern-form input[type="text"]:focus {
          outline: none;
          border-color: var(--brand-green);
        }
        .modern-file-input {
          font-size: 13px;
          color: var(--text-muted);
        }
        .modern-info-line {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid var(--border-adaptive);
          font-size: 14px;
          color: var(--text-adaptive);
        }
        .modern-info-line:last-of-type {
          border-bottom: none;
        }
        .modern-btn-primary {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          background: var(--brand-green);
          color: #000000;
          font-weight: 700;
          border: none;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          transition: opacity 0.2s;
        }
        .modern-btn-primary:hover { opacity: 0.9; }

        /* Stats Blocks */
        .modern-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }
        .modern-stat-box {
          background: var(--bg-input-adaptive);
          padding: 16px;
          border-radius: 16px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .modern-stat-box b { font-size: 20px; font-weight: 800; color: var(--text-adaptive); }
        .modern-stat-box span { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }

        .modern-rating-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .modern-rating-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: var(--bg-input-adaptive);
          border-radius: 12px;
          border-left: 4px solid var(--brand-green);
        }
        .modern-rating-item strong { font-size: 15px; color: var(--text-adaptive); }
        .modern-rating-item b { font-size: 20px; color: var(--text-adaptive); margin-left: auto; margin-right: 12px; }
        .modern-rating-item small { font-size: 12px; color: var(--text-muted); }

        /* Progress Bars (Skill Lab) */
        .modern-skill-item {
          margin-bottom: 20px;
        }
        .modern-skill-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .modern-skill-header strong { color: var(--text-adaptive); }
        .modern-skill-header b { color: var(--brand-green-dark); }
        .modern-progress-bg {
          height: 8px;
          background: var(--border-adaptive);
          border-radius: 99px;
          overflow: hidden;
        }
        .modern-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--brand-green), var(--brand-green-dark));
          border-radius: 99px;
          transition: width 1s ease-out;
        }
        .modern-skill-note {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 6px;
          display: block;
        }

        /* Achievements */
        .modern-achievements {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        .modern-badge {
          background: var(--bg-input-adaptive);
          padding: 16px;
          border-radius: 16px;
          border: 1px solid var(--border-adaptive);
          text-align: center;
          opacity: 0.6;
          filter: grayscale(1);
          transition: all 0.3s ease;
        }
        .modern-badge.unlocked {
          opacity: 1;
          filter: grayscale(0);
          border-color: var(--brand-green);
          box-shadow: 0 4px 12px rgba(171, 200, 84, 0.15);
        }

        /* Game History & Activities */
        .modern-game-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--border-adaptive);
          gap: 12px;
          flex-wrap: wrap;
        }
        .modern-game-item:last-child { border-bottom: none; }
        .modern-game-result {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .modern-game-result.win { background: #dcfce7; color: #166534; }
        .modern-game-result.loss { background: #fee2e2; color: #991b1b; }
        .modern-game-result.draw { background: #f3f4f6; color: #374151; }
        .modern-game-result.activity { background: var(--border-adaptive); color: var(--text-adaptive); }

        .modern-game-info strong { display: block; color: var(--text-adaptive); font-size: 14px; margin-bottom: 4px; }
        .modern-game-info small { color: var(--text-muted); font-size: 12px; }
        .rating-up { color: #16a34a !important; font-weight: bold; margin-left: 8px; }
        .rating-down { color: #dc2626 !important; font-weight: bold; margin-left: 8px; }
      `}</style>

      {/* 1. HERO SECTION */}
      <header className="modern-hero">
        <div className="modern-avatar">
          {avatarURL ? <img src={avatarURL} alt="Avatar người chơi" /> : <UserRound size={60} color="#ccc" />}
        </div>
        <div className="modern-hero-info">
          <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {isPublicProfile ? 'Public Player Profile' : 'Player Profile'}
          </span>
          <div className="modern-profile-name">
            <h1>{profile?.displayName || authUser?.displayName || 'Player'}</h1>
            <MembershipBadge tier={profile?.membershipTier} />
          </div>
          <p>@{profile?.username || 'player'} {shareId && `• ID: ${shareId}`}</p>

          <div className="modern-verified-badge">
            <ShieldCheck size={16} />
            {isPublicProfile ? 'Hồ sơ công khai' : profile?.emailVerified ? 'Tài khoản đã xác thực' : 'Chưa xác thực email'}
          </div>

          <div style={{ marginTop: '12px', fontSize: '14px', fontWeight: '600' }}>
            {followSummary.followers} người theo dõi | đang theo dõi {followSummary.following}
          </div>

          {/* Social Actions cho Public Profile */}
          {isPublicProfile && authUser && (
            <div className="modern-hero-actions">
              <button disabled={socialBusy} onClick={toggleFollow} type="button">
                {followSummary.followed ? <UserMinus size={16} /> : <UserPlus size={16} />}
                {followSummary.followed ? 'Bỏ theo dõi' : 'Theo dõi'}
              </button>

              {friendship?.status === 'friends' ? (
                <>
                  <button disabled={socialBusy} onClick={challengeFriend} type="button">
                    <Swords size={16} /> Thách đấu
                  </button>
                  <button className="danger" disabled={socialBusy} onClick={removeFriend} type="button">
                    <UserMinus size={16} /> Hủy bạn
                  </button>
                </>
              ) : friendship?.status === 'outgoing' ? (
                <button className="danger" disabled={socialBusy} onClick={removeFriend} type="button">
                  <UserMinus size={16} /> Hủy lời mời
                </button>
              ) : friendship?.status === 'incoming' ? (
                <button disabled type="button" style={{ opacity: 0.6 }}>
                  <UserPlus size={16} /> Đang chờ phản hồi
                </button>
              ) : (
                <button disabled={socialBusy} onClick={addFriend} type="button">
                  <UserPlus size={16} /> Kết bạn
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Thông báo chung */}
      {message && (
        <div style={{ padding: '16px', background: '#eef2ff', color: '#4338ca', borderRadius: '12px', fontWeight: '600' }}>
          {message}
        </div>
      )}

      {/* 2. MAIN GRID (Cột trái: Thông tin/Edit, Cột phải: Stats) */}
      <div className="modern-grid">

        {/* INFO CÁ NHÂN / EDITOR */}
        <div className="modern-card">
          <h2><UserRound size={22} /> {isPublicProfile ? 'Thông tin người chơi' : 'Cập nhật hồ sơ'}</h2>

          {!isPublicProfile ? (
            <form className="modern-form" onSubmit={submitProfile}>
              <label>
                <span>Tên hiển thị</span>
                <input type="text" value={form.displayName} maxLength={80} onChange={(e) => setForm((curr) => ({ ...curr, displayName: e.target.value }))} />
              </label>

              <label>
                <span><ImagePlus size={18} /> Ảnh đại diện</span>
                <input className="modern-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar} />
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                  PNG, JPG hoặc WebP, tối đa 5MB. Ảnh sẽ tự động được cắt vuông.
                </small>
              </label>

              <div className="modern-info-line"><Mail size={18} /> {profile?.email || 'Không có email'}</div>
              <div className="modern-info-line"><CalendarDays size={18} /> Tham gia: {formattedDate(profile?.createdAt)}</div>

              <button className="modern-btn-primary" disabled={saving} type="submit">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </button>

              <button
                type="button"
                onClick={copyProfileLink}
                style={{ width: '100%', marginTop: '12px', padding: '14px', borderRadius: '10px', background: 'var(--bg-input-adaptive)', border: '1px solid var(--border-adaptive)', color: 'var(--text-adaptive)', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px' }}
              >
                <Copy size={18} /> Copy link hồ sơ
              </button>
            </form>
          ) : (
            <div className="modern-form">
              <div className="modern-info-line"><UserRound size={18} /> @{profile?.username || 'player'}</div>
              <div className="modern-info-line"><CalendarDays size={18} /> Tham gia: {formattedDate(profile?.createdAt)}</div>
              <button
                type="button"
                onClick={copyProfileLink}
                style={{ width: '100%', marginTop: '24px', padding: '14px', borderRadius: '10px', background: 'var(--bg-input-adaptive)', border: '1px solid var(--border-adaptive)', color: 'var(--text-adaptive)', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px' }}
              >
                <Copy size={18} /> Copy link hồ sơ
              </button>
            </div>
          )}
        </div>

        {/* STATS ONLINE */}
        <div className="modern-card">
          <h2><Trophy size={22} /> Thành tích online</h2>

          <div className="modern-stats-grid">
            <div className="modern-stat-box"><Swords size={20} color="var(--brand-green-dark)"/><b>{summary.gamesPlayed}</b><span>Ván</span></div>
            <div className="modern-stat-box"><Trophy size={20} color="#eab308"/><b>{summary.wins}</b><span>Thắng</span></div>
            <div className="modern-stat-box"><b>{summary.losses}</b><span>Thua</span></div>
            <div className="modern-stat-box"><b>{summary.draws}</b><span>Hòa</span></div>
            <div className="modern-stat-box"><CheckCircle2 size={20} color="#3b82f6"/><b>{winRate(summary)}</b><span>Tỉ lệ</span></div>
          </div>

          <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Rating hiện tại</h3>

          {profile?.ratings?.length > 0 ? (
            <div className="modern-rating-list">
              {profile.ratings.map((rating) => (
                <div className="modern-rating-item" key={rating.mode}>
                  <div>
                    <strong>{MODE_LABELS[rating.mode] || rating.mode}</strong>
                    <br/>
                    <small>{rating.games_played} ván {rating.provisional ? '(Tạm tính)' : ''}</small>
                  </div>
                  <b>{rating.rating}</b>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', background: 'var(--bg-input-adaptive)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
              Chưa có rating online được ghi nhận.
            </p>
          )}

          <button
            onClick={() => onNavigate?.('leaderboard')}
            style={{ width: '100%', marginTop: '24px', padding: '14px', borderRadius: '10px', background: 'var(--bg-input-adaptive)', border: '1px solid var(--border-adaptive)', color: 'var(--text-adaptive)', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px' }}
          >
            <Medal size={18} /> Xem bảng xếp hạng
          </button>
        </div>
      </div>

      {/* 3. SKILL LAB & ACHIEVEMENTS */}
      <div className="modern-card">
        <h2><Brain size={22} /> Hồ sơ kỹ năng chuyên sâu (Skill Lab)</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Hệ thống AI đọc lịch sử đấu online để chấm điểm kỹ năng và phân tích điểm yếu của bạn.</p>

        <div>
          {skills.map((skill) => (
            <div className="modern-skill-item" key={skill.label}>
              <div className="modern-skill-header">
                <strong>{skill.label}</strong>
                <b>{skill.value}/100</b>
              </div>
              <div className="modern-progress-bg">
                <div className="modern-progress-fill" style={{ width: `${skill.value}%` }} />
              </div>
              <span className="modern-skill-note">{skill.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ACHIEVEMENTS */}
      <div className="modern-card">
        <h2><Award size={22} /> Huy hiệu tiến bộ</h2>
        <div className="modern-achievements">
          {(profile?.achievements || []).map((ach) => (
            <div className={`modern-badge ${ach.unlocked ? 'unlocked' : ''}`} key={ach.id}>
              <strong style={{ display: 'block', fontSize: '15px', color: 'var(--text-adaptive)', marginBottom: '8px' }}>{ach.label}</strong>
              <div className="modern-progress-bg" style={{ marginBottom: '8px' }}>
                <div className="modern-progress-fill" style={{ width: `${ach.unlocked ? 100 : Math.round(((ach.progress ?? 0) / (ach.target ?? 1)) * 100)}%` }} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                {ach.unlocked ? 'ĐÃ MỞ KHÓA' : `${ach.progress ?? 0}/${ach.target ?? 1}`}
              </span>
              <small style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ach.description}</small>
            </div>
          ))}
        </div>
      </div>

      {/* 4. TRAINING & FAIR PLAY (Chỉ hiện khi là chủ profile) */}
      {!isPublicProfile && (
        <div className="modern-grid">
          <div className="modern-card">
            <h2><Dumbbell size={22} /> Personal Training</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
              {profile?.training?.nextAction || 'Review ván online đã kết thúc để hệ thống tạo bài tập.'}
            </p>
            <div className="modern-stats-grid">
              <div className="modern-stat-box"><b>{profile?.training?.newPersonalPuzzles || 0}</b><span>Bài mới</span></div>
              <div className="modern-stat-box"><b>{profile?.training?.personalPuzzles || 0}</b><span>Tổng bài</span></div>
              <div className="modern-stat-box"><b>{profile?.training?.reviewedGames || 0}</b><span>Đã Review</span></div>
            </div>
            <button className="modern-btn-primary" onClick={() => onNavigate?.('personal-puzzles')}>
              <Dumbbell size={18} /> Mở Puzzle cá nhân
            </button>
          </div>

          {(fairPlay.reports?.length > 0 || fairPlay.appeals?.length > 0) && (
            <div className="modern-card">
              <h2><ShieldCheck size={22} color="#dc2626"/> Khiếu nại Fair-play</h2>
              {fairPlay.reports?.length > 0 && (
                <form className="modern-form" onSubmit={async (e) => {
                  e.preventDefault();
                  setSocialBusy(true);
                  try {
                    const result = await createAppeal(appealForm);
                    setFairPlay((cur) => ({ ...cur, appeals: [result.appeal, ...(cur.appeals || [])] }));
                    setAppealForm((cur) => ({ ...cur, message: '' }));
                    setMessage('Đã gửi khiếu nại thành công.');
                  } catch (err) { setMessage(err.message); }
                  finally { setSocialBusy(false); }
                }}>
                  <select value={appealForm.reportId} onChange={(e) => setAppealForm((cur) => ({ ...cur, reportId: e.target.value }))} style={{ marginBottom: '12px' }}>
                    {fairPlay.reports.map((r) => <option value={r.id} key={r.id}>Report #{r.id.slice(0, 8)} - Risk: {r.risk_score}</option>)}
                  </select>
                  <textarea required minLength={20} rows={3} value={appealForm.message} onChange={(e) => setAppealForm((cur) => ({ ...cur, message: e.target.value }))} placeholder="Trình bày lý do khiếu nại..." style={{ marginBottom: '12px' }}/>
                  <button className="modern-btn-primary" type="submit" disabled={socialBusy} style={{ background: '#ef4444', color: 'white' }}>
                    Gửi khiếu nại
                  </button>
                </form>
              )}
              {fairPlay.appeals?.length > 0 && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {fairPlay.appeals.map((app) => (
                    <div key={app.id} style={{ padding: '12px', background: 'var(--bg-input-adaptive)', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                      <strong style={{ display: 'block', fontSize: '13px' }}>Appeal #{app.id.slice(0, 8)} • {app.status}</strong>
                      <small style={{ color: 'var(--text-muted)' }}>{app.admin_note || app.message}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. RECENT GAMES */}
      <div className="modern-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ margin: 0 }}><History size={22} /> Lịch sử trận đấu</h2>
          {!isPublicProfile && (
            <button onClick={() => onNavigate?.('history')} style={{ background: 'transparent', border: '1px solid var(--border-adaptive)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-adaptive)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Xem toàn bộ <History size={14}/>
            </button>
          )}
        </div>

        {(profile?.recentGames || []).length > 0 ? (
          <div>
            {profile.recentGames.map((game) => {
              const resClass = game.outcome === 'win' ? 'win' : game.outcome === 'loss' ? 'loss' : 'draw';
              return (
                <div className="modern-game-item" key={game.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className={`modern-game-result ${resClass}`}>{matchLabel(game)}</span>
                    <div className="modern-game-info">
                      <strong>
                        vs {game.opponent?.name || 'Player'}
                        {Number.isFinite(game.ratingDelta) && (
                          <span className={game.ratingDelta > 0 ? 'rating-up' : game.ratingDelta < 0 ? 'rating-down' : ''}>
                            {game.ratingDelta > 0 ? '+' : ''}{game.ratingDelta}
                          </span>
                        )}
                      </strong>
                      <small>
                        {game.mode || 'rapid'} • {game.timeControl || '--'} • Cầm quân {game.color === 'w' ? 'Trắng' : 'Đen'}
                        {game.review && ` • Accuracy: ${game.review.accuracy}%`}
                      </small>
                    </div>
                  </div>
                  <small style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatMatchDate(game.finishedAt)}</small>
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
            {isPublicProfile ? 'Người chơi này chưa có trận online.' : 'Bạn chưa chơi trận online nào. Hãy tham gia một ván đấu để hệ thống ghi nhận.'}
          </p>
        )}
      </div>

      {/* 6. ACTIVITY FEED */}
      {activities.length > 0 && (
        <div className="modern-card">
          <h2 style={{ margin: 0, marginBottom: '20px' }}><CalendarDays size={22} /> Hoạt động gần đây</h2>
          <div>
            {activities.map((activity) => {
              const actLabel = activity.type === 'won_game' ? 'Thắng ván' : activity.type === 'drew_game' ? 'Hòa ván' : activity.type === 'followed_player' ? 'Theo dõi người chơi' : 'Hoạt động';
              return (
                <div className="modern-game-item" key={activity.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className="modern-game-result activity">{actLabel}</span>
                    <div className="modern-game-info">
                      <strong>{activity.metadata?.mode || activity.subject_id || 'Tương tác hệ thống'}</strong>
                    </div>
                  </div>
                  <small style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatMatchDate(activity.created_at)}</small>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </section>
  );
}
