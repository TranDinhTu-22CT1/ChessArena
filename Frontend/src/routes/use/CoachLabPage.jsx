import React from 'react';
import { Brain, ClipboardList, Puzzle, Search } from 'lucide-react';
import { fetchCoachInsights } from '../../api/training';

export default function CoachLabPage({ authUser, onLogin, onNavigate }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!authUser) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchCoachInsights()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || 'Could not load coach insights.');
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
        <Brain size={44} />
        <h1>Coach Lab</h1>
        <p>Đăng nhập để nhận gợi ý luyện tập dựa trên ván online, review và puzzle.</p>
        <button onClick={onLogin}>Đăng nhập</button>
      </section>
    );
  }

  return (
    <section className="feature-page">
      <header className="feature-hero">
        <div>
          <span>Training Coach</span>
          <h1>Coach Lab</h1>
          <p>Phân tích rule-based từ dữ liệu thật, phù hợp đồ án và dễ giải thích khi bảo vệ.</p>
        </div>
        <button onClick={() => onNavigate('review')}>Mở Game Review</button>
      </header>

      {loading && <p className="feature-message">Đang phân tích hồ sơ luyện tập...</p>}
      {error && <p className="feature-message error">{error}</p>}

      <div className="coach-card-grid">
        {(data?.cards || []).map((card) => (
          <article key={card.title}>
            <span>{card.title}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>

      <section className="coach-recommendations">
        <h2><ClipboardList size={22} /> Khuyến nghị tiếp theo</h2>
        {(data?.recommendations || []).map((item) => <p key={item}>{item}</p>)}
      </section>

      <div className="coach-actions">
        <button onClick={() => onNavigate('personal-puzzles')}><Puzzle size={18} /> Mistake Lab</button>
        <button onClick={() => onNavigate('history')}><Search size={18} /> Xem lịch sử</button>
      </div>
    </section>
  );
}
