import React from 'react';
import {
  Award,
  CalendarDays,
  Check,
  Flame,
  Gauge,
  Loader2,
  Lock,
  Medal,
  Puzzle,
  SearchCheck,
  Swords,
  Target,
  Trophy,
  Zap
} from 'lucide-react';
import { fetchAchievements } from '../../api/achievements';

const ACHIEVEMENT_TEXT = {
  first_online_win: {
    title: 'Chiến thắng online đầu tiên',
    description: 'Thắng ván online tính điểm đầu tiên.'
  },
  ten_online_games: {
    title: 'Kỳ thủ Arena',
    description: 'Hoàn thành 10 ván online.'
  },
  rating_800: {
    title: 'Chạm mốc 800',
    description: 'Đạt rating 800 ở bất kỳ chế độ thời gian nào.'
  },
  review_5_games: {
    title: 'Nhà phân tích ván đấu',
    description: 'Review 5 ván đã hoàn thành.'
  },
  puzzle_50_correct: {
    title: 'Xây nền chiến thuật',
    description: 'Giải đúng 50 câu đố trong các chế độ luyện tập.'
  },
  rush_20: {
    title: 'Puzzle Rush 20',
    description: 'Ghi từ 20 điểm trở lên trong một lượt Puzzle Rush.'
  },
  streak_15: {
    title: 'Chuỗi puzzle 15',
    description: 'Đạt chuỗi 15 câu puzzle liên tiếp.'
  },
  daily_7: {
    title: 'Chuỗi daily 7 ngày',
    description: 'Giữ chuỗi Daily Puzzle trong 7 ngày.'
  },
  tournament_joined: {
    title: 'Người chơi giải đấu',
    description: 'Tham gia giải Arena đầu tiên.'
  }
};

const ACHIEVEMENT_META = {
  first_online_win: { icon: Trophy, category: 'Ván online' },
  ten_online_games: { icon: Swords, category: 'Ván online' },
  rating_800: { icon: Gauge, category: 'Xếp hạng' },
  review_5_games: { icon: SearchCheck, category: 'Phân tích' },
  puzzle_50_correct: { icon: Puzzle, category: 'Puzzle' },
  rush_20: { icon: Zap, category: 'Puzzle' },
  streak_15: { icon: Flame, category: 'Puzzle' },
  daily_7: { icon: CalendarDays, category: 'Puzzle' },
  tournament_joined: { icon: Medal, category: 'Giải đấu' }
};

const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'progress', label: 'Đang thực hiện' },
  { id: 'unlocked', label: 'Đã hoàn thành' }
];

function translateAchievement(item) {
  const text = ACHIEVEMENT_TEXT[item.key] || {};
  return {
    ...item,
    title: text.title || item.title,
    description: text.description || item.description
  };
}

function getPercent(item) {
  return Math.min(100, Math.round((item.progress / Math.max(1, item.target)) * 100));
}

function AchievementBadge({ item }) {
  const Icon = ACHIEVEMENT_META[item.key]?.icon || Award;

  return (
    <div className="achievement-earned-badge" aria-hidden="true">
      <span className="achievement-earned-glow" />
      <span className="achievement-earned-core">
        <Icon size={29} strokeWidth={2.1} />
      </span>
      <span className="achievement-earned-check">
        <Check size={13} strokeWidth={3} />
      </span>
    </div>
  );
}

export default function AchievementsPage({ authUser, onLogin, onNavigate }) {
  const [achievements, setAchievements] = React.useState([]);
  const [filter, setFilter] = React.useState('all');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!authUser) return undefined;

    let cancelled = false;
    setLoading(true);
    setError('');

    fetchAchievements()
      .then((data) => {
        if (!cancelled) {
          setAchievements((data.achievements || []).map(translateAchievement));
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError.message || 'Không thể tải danh sách thành tựu.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  if (!authUser) {
    return (
      <section className="feature-page empty-feature">
        <Award size={44} />
        <h1>Thành tựu</h1>
        <p>Đăng nhập để theo dõi thành tích từ ván online, puzzle, review và giải đấu.</p>
        <button onClick={onLogin}>Đăng nhập</button>
      </section>
    );
  }

  const unlockedCount = achievements.filter((item) => item.unlocked).length;
  const remainingCount = achievements.length - unlockedCount;
  const completionPercent = achievements.length
    ? Math.round((unlockedCount / achievements.length) * 100)
    : 0;
  const visibleAchievements = achievements.filter((item) => {
    if (filter === 'unlocked') return item.unlocked;
    if (filter === 'progress') return !item.unlocked;
    return true;
  });

  return (
    <section className="feature-page achievements-page">
      <header className="achievements-hero">
        <div className="achievements-hero-copy">
          <span className="achievements-eyebrow">
            <Award size={16} /> Hành trình kỳ thủ
          </span>
          <h1>Thành tựu của bạn</h1>
          <p>
            Theo dõi những cột mốc được ghi nhận trực tiếp từ ván online,
            bài tập chiến thuật, phân tích và giải đấu.
          </p>
        </div>

        <div
          className="achievements-completion-ring"
          style={{ '--achievement-completion': `${completionPercent * 3.6}deg` }}
          aria-label={`Đã hoàn thành ${completionPercent}%`}
        >
          <div>
            <strong>{completionPercent}%</strong>
            <span>hoàn thành</span>
          </div>
        </div>

        <div className="achievements-summary">
          <div>
            <strong>{unlockedCount}</strong>
            <span>Đã đạt</span>
          </div>
          <div>
            <strong>{remainingCount}</strong>
            <span>Đang chờ</span>
          </div>
          <div>
            <strong>{achievements.length}</strong>
            <span>Tổng cộng</span>
          </div>
        </div>
      </header>

      <div className="achievements-toolbar">
        <div>
          <h2>Danh sách thành tựu</h2>
          <p>Chọn một nhóm để theo dõi tiến độ dễ hơn.</p>
        </div>
        <div className="achievement-filters" role="group" aria-label="Lọc thành tựu">
          {FILTERS.map((item) => (
            <button
              className={filter === item.id ? 'active' : ''}
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="achievements-loading">
          <Loader2 size={34} />
          <span>Đang tải thành tựu...</span>
        </div>
      ) : error ? (
        <p className="feature-message error">{error}</p>
      ) : visibleAchievements.length === 0 ? (
        <div className="achievements-empty">
          <Award size={34} />
          <strong>Chưa có thành tựu trong nhóm này</strong>
          <span>Tiếp tục chơi để mở khóa những cột mốc mới.</span>
        </div>
      ) : (
        <div className="achievement-grid">
          {visibleAchievements.map((item) => {
            const percent = getPercent(item);
            const category = ACHIEVEMENT_META[item.key]?.category || 'Thành tựu';

            return (
              <article
                className={`achievement-card ${item.unlocked ? 'unlocked' : 'locked'}`}
                key={item.key}
              >
                <div className="achievement-card-topline">
                  <span className="achievement-category">{category}</span>
                  {!item.unlocked && (
                    <span className="achievement-locked-mark" aria-label="Chưa hoàn thành">
                      <Lock size={22} strokeWidth={1.9} />
                    </span>
                  )}
                </div>

                {item.unlocked && <AchievementBadge item={item} />}

                <div className="achievement-copy">
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                </div>

                <div className="achievement-progress">
                  <div>
                    <b>{item.unlocked ? 'Đã hoàn thành' : `${item.progress} / ${item.target}`}</b>
                    <span>{percent}%</span>
                  </div>
                  <i aria-hidden="true">
                    <span style={{ width: `${percent}%` }} />
                  </i>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="achievements-footer">
        <div>
          <Target size={22} />
          <span>
            <strong>Tiếp tục chinh phục</strong>
            Luyện tập mỗi ngày để hoàn thành các cột mốc còn lại.
          </span>
        </div>
        <button type="button" onClick={() => onNavigate('puzzle-streak')}>
          Luyện Puzzle Streak
        </button>
      </div>
    </section>
  );
}
