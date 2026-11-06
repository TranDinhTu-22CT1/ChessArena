import React from 'react';
import {
  Activity,
  Award,
  Brain,
  CalendarDays,
  Dumbbell,
  ExternalLink,
  Flag,
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
  Users,
  X
} from 'lucide-react';

import { fetchFriends, removeFriendship, sendFriendRequest } from '../../api/friends';
import { sendGameInvitation } from '../../api/gameInvitations';
import { createPlayerReport, fetchProfile, fetchPublicProfile, fetchReportOptions, saveProfile } from '../../api/profile';
import { changeFollow, fetchActivityFeed, fetchFollowSummary } from '../../api/social';
import MembershipBadge from '../../components/MembershipBadge';
import Modal from '../../components/Modal';

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

const REPORT_CATEGORY_LABELS = {
  harassment: 'Quấy rối', toxic: 'Ngôn từ xúc phạm', stalling: 'Cố tình kéo dài trận',
  match_abuse: 'Lạm dụng trận đấu', username: 'Tên không phù hợp', avatar: 'Ảnh không phù hợp', other: 'Khác'
};

const REPORT_REASONS = [
  ['harassment', 'Quấy rối', 'Đe dọa, làm phiền hoặc công kích cá nhân'],
  ['toxic', 'Ngôn từ xúc phạm', 'Tin nhắn hoặc nội dung không phù hợp'],
  ['stalling', 'Cố tình kéo dài', 'Câu giờ hoặc trì hoãn ván đấu'],
  ['match_abuse', 'Lạm dụng trận đấu', 'Dàn xếp hoặc hành vi bất thường'],
  ['username', 'Tên không phù hợp', 'Tên hiển thị vi phạm quy tắc'],
  ['avatar', 'Ảnh không phù hợp', 'Ảnh đại diện có nội dung vi phạm'],
  ['other', 'Lý do khác', 'Vấn đề chưa có trong danh sách']
];

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
      note: weakSpot
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

function readReportImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, mimeType: file.type, size: file.size, dataUrl: reader.result });
    reader.onerror = () => reject(new Error(`Không thể đọc ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

const reportAttachmentDrafts = new Map();

function reportDraftKey(reporterId, playerId) { return `chessarena:report-draft:${reporterId || 'guest'}:${playerId}`; }

function readReportDraft(reporterId, playerId) {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(reportDraftKey(reporterId, playerId)) || '{}');
    return {
      category: REPORT_CATEGORY_LABELS[parsed.category] ? parsed.category : 'harassment',
      description: String(parsed.description || '').slice(0, 1600),
      gameId: String(parsed.gameId || ''),
      evidenceUrl: String(parsed.evidenceUrl || '').slice(0, 500)
    };
  } catch {
    return { category: 'harassment', description: '', gameId: '', evidenceUrl: '' };
  }
}

function PlayerReportModal({ player, reporterId, onClose, onSubmitted }) {
  const attachmentDraftKey = reportDraftKey(reporterId, player.id);
  const draft = React.useMemo(() => readReportDraft(reporterId, player.id), [player.id, reporterId]);
  const [category, setCategory] = React.useState(draft.category);
  const [description, setDescription] = React.useState(draft.description);
  const [gameId, setGameId] = React.useState(draft.gameId);
  const [evidenceUrl, setEvidenceUrl] = React.useState(draft.evidenceUrl);
  const [games, setGames] = React.useState([]);
  const [attachments, setAttachments] = React.useState(() => reportAttachmentDrafts.get(attachmentDraftKey) || []);
  const attachmentsRef = React.useRef(reportAttachmentDrafts.get(attachmentDraftKey) || []);
  const [readingImages, setReadingImages] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let active = true;
    fetchReportOptions(player.id).then((data) => {
      if (active) setGames(data.games || []);
    }).catch((loadError) => {
      if (active) setError(loadError.message);
    });
    return () => { active = false; };
  }, [player.id]);

  React.useEffect(() => {
    window.sessionStorage.setItem(attachmentDraftKey, JSON.stringify({ category, description, gameId, evidenceUrl }));
  }, [attachmentDraftKey, category, description, evidenceUrl, gameId]);

  React.useEffect(() => {
    attachmentsRef.current = attachments;
    if (attachments.length) reportAttachmentDrafts.set(attachmentDraftKey, attachments);
    else reportAttachmentDrafts.delete(attachmentDraftKey);
  }, [attachmentDraftKey, attachments]);

  const addImages = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, Math.max(0, 3 - attachments.length));
    if (!files.length) return;
    if (files.some((file) => !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError('Chỉ nhận PNG, JPG, WebP hoặc GIF, tối đa 5 MB mỗi ảnh.');
      return;
    }
    setReadingImages(true);
    try {
      const nextImages = await Promise.all(files.map(readReportImage));
      setAttachments((current) => {
        const next = [...current, ...nextImages].slice(0, 3);
        attachmentsRef.current = next;
        return next;
      });
    } catch (readError) {
      setError(readError.message);
    } finally {
      setReadingImages(false);
    }
  };

  const selectImages = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    await addImages(files);
  };

  const highestRating = Math.max(0, ...(player.ratings || []).map((item) => Number(item.rating) || 0));

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const evidenceAttachments = attachmentsRef.current.length ? attachmentsRef.current : attachments;
      await createPlayerReport({ reportedUserId: player.id, category, description, gameId, evidenceUrl, attachments: evidenceAttachments });
      window.sessionStorage.removeItem(attachmentDraftKey);
      reportAttachmentDrafts.delete(attachmentDraftKey);
      onSubmitted?.();
      onClose();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} className="surface-dialog player-report-dialog" aria-label="Báo cáo người chơi">
      <form className="player-report-form" onSubmit={submit}>
        <header>
          <div>
            <span>AN TOÀN CỘNG ĐỒNG</span>
            <h2>Báo cáo người chơi</h2>
            <small>Thông tin của bạn được gửi riêng cho đội ngũ kiểm duyệt.</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </header>
        <div className="player-report-player">
          {player.photoURL || player.photo_url ? <img src={player.photoURL || player.photo_url} alt="" /> : <span><UserRound size={23} /></span>}
          <div><strong>{player.displayName || player.display_name || player.username || 'Người chơi'}</strong><small>@{player.username || 'player'}{highestRating > 0 ? ` · ${highestRating} rating` : ''}</small></div>
          <ShieldCheck size={20} aria-label="Tài khoản đã xác thực" />
        </div>

        <fieldset>
          <legend><b>1</b><span>Lý do báo cáo<small>Chọn lý do phù hợp nhất</small></span></legend>
          <div className="player-report-reasons">
            {REPORT_REASONS.map(([value, label, helper]) => (
              <label className={category === value ? 'selected' : ''} key={value}>
                <input type="radio" name="report-reason" value={value} checked={category === value} onChange={() => setCategory(value)} />
                <span><strong>{label}</strong><small>{helper}</small></span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend><b>2</b><span>Mô tả chi tiết<small>Giúp admin hiểu rõ điều đã xảy ra</small></span></legend>
          <label className="player-report-textarea">
            <textarea aria-label="Mô tả chi tiết" rows={5} maxLength={1600} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Mô tả hành vi, thời điểm và những chi tiết quan trọng (ít nhất 12 ký tự)…" />
            <small><span>Tối thiểu 12 ký tự</span><span>{description.length}/1600</span></small>
          </label>
        </fieldset>

        <fieldset>
          <legend><b>3</b><span>Trận đấu liên quan<small>Không bắt buộc</small></span></legend>
          <label>
            <select aria-label="Trận đấu liên quan" value={gameId} onChange={(event) => setGameId(event.target.value)}>
              <option value="">Không đính kèm trận</option>
              {games.map((game) => (
                <option value={game.id} key={game.id}>{game.white_name} – {game.black_name} · {game.result || '*'} · {game.time_control}</option>
              ))}
            </select>
            <small>Chỉ các trận mà hai tài khoản đã cùng tham gia mới được chấp nhận.</small>
          </label>
        </fieldset>

        <fieldset>
          <legend><b>4</b><span>Bằng chứng<small>Ảnh hoặc liên kết giúp việc xử lý chính xác hơn</small></span></legend>
          <label className="player-report-upload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addImages(event.dataTransfer.files); }}>
            <ImagePlus size={24} />
            <strong>{readingImages ? 'Đang xử lý ảnh…' : 'Thả ảnh vào đây hoặc nhấn để chọn'}</strong>
            <small>PNG, JPG, WebP, GIF · tối đa 3 ảnh · 5 MB/ảnh</small>
            <input aria-label="Chọn ảnh bằng chứng" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={selectImages} />
          </label>
          {attachments.length > 0 && (
            <div className="player-report-previews">
              {attachments.map((attachment, index) => (
                <button type="button" title={`Xóa ${attachment.name}`} aria-label={`Xóa ảnh ${attachment.name}`} onClick={() => setAttachments((current) => { const next = current.filter((_, itemIndex) => itemIndex !== index); attachmentsRef.current = next; return next; })} key={`${attachment.name}-${index}`}>
                  <img src={attachment.dataUrl} alt={attachment.name} /><X size={14} /><small>{attachment.name}</small>
                </button>
              ))}
            </div>
          )}
          <label className="player-report-url"><span>Liên kết bằng chứng</span><input type="url" maxLength={500} value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://…" /></label>
        </fieldset>
        {error && <p className="player-report-error" role="alert">{error}</p>}
        <footer>
          <button type="button" onClick={onClose}>Hủy</button>
          <button className="primary" type="submit" disabled={busy || readingImages || description.trim().length < 12}>{busy ? 'Đang gửi…' : readingImages ? 'Đang xử lý ảnh…' : 'Gửi báo cáo'}</button>
        </footer>
      </form>
    </Modal>
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
  const [reportOpen, setReportOpen] = React.useState(false);


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
      await sendGameInvitation(profile?.id);
      setMessage('Đã gửi lời mời chơi 10 phút, màu quân ngẫu nhiên. Hai bạn sẽ vào trận khi lời mời được chấp nhận.');
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
              <button className="danger" type="button" onClick={() => setReportOpen(true)}>
                <Flag size={16} /> Báo cáo người chơi
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

        {!isPublicProfile && (
          <section className="player-profile-card player-my-reports-entry">
            <ProfileSectionHead eyebrow="Trung tâm người dùng" title="Ticket & Báo cáo" icon={Flag} />
            <p className="player-profile-section-description">Theo dõi ticket hỗ trợ và các báo cáo người chơi tại trang quản lý thống nhất.</p>
            <button className="player-profile-primary-button" type="button" onClick={() => onNavigate?.('supportTickets')}>
              Mở Ticket & Báo cáo <ExternalLink size={15} />
            </button>
          </section>
        )}
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
      {reportOpen && isPublicProfile && authUser && (
        <PlayerReportModal
          player={profile}
          reporterId={authUser.uid || authUser.id}
          onClose={() => setReportOpen(false)}
          onSubmitted={() => {
            window.dispatchEvent(new window.CustomEvent('chessarena:report-submitted'));
            setMessage('Báo cáo đã được gửi. Theo dõi kết quả tại Ticket & Báo cáo.');
          }}
        />
      )}
    </section>
  );
}
