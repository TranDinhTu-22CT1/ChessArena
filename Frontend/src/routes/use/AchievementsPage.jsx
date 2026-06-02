import React from 'react';
import { Award, CheckCircle2, Lock, Target } from 'lucide-react';
import { fetchAchievements } from '../../api/achievements';

export default function AchievementsPage({ authUser, onLogin, onNavigate }) {
  const [achievements, setAchievements] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!authUser) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchAchievements()
      .then((data) => {
        if (!cancelled) setAchievements(data.achievements || []);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || 'Could not load achievements.');
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
        <h1>Achievements</h1>
        <p>Đăng nhập để theo dõi huy hiệu theo ván online, puzzle, review và tournament.</p>
        <button onClick={onLogin}>Đăng nhập</button>
      </section>
    );
  }

  const unlocked = achievements.filter((item) => item.unlocked).length;

  return (
    <section className="feature-page">
      <header className="feature-hero">
        <div>
          <span>Progression</span>
          <h1>Achievements</h1>
          <p>Huy hiệu được tính từ dữ liệu thật: ván online, Game Review, puzzle sessions và tournament.</p>
        </div>
        <strong>{unlocked}/{achievements.length}</strong>
      </header>

      {loading && <p className="feature-message">Đang tải achievement...</p>}
      {error && <p className="feature-message error">{error}</p>}

      <div className="achievement-grid">
        {achievements.map((item) => {
          const percent = Math.min(100, Math.round((item.progress / Math.max(1, item.target)) * 100));
          return (
            <article className={`achievement-card ${item.unlocked ? 'unlocked' : ''}`} key={item.key}>
              <div className="achievement-icon">
                {item.unlocked ? <CheckCircle2 size={24} /> : <Lock size={24} />}
              </div>
              <div>
                <span>{item.tier}</span>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
              <div className="achievement-progress">
                <b>{item.progress}/{item.target}</b>
                <i><span style={{ width: `${percent}%` }} /></i>
              </div>
            </article>
          );
        })}
      </div>

      <button className="secondary-feature-action" onClick={() => onNavigate('puzzle-streak')}>
        <Target size={18} /> Luyện Puzzle Streak
      </button>
    </section>
  );
}
