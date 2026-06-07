import React from 'react';
import { BookOpen, Brain, ClipboardList, Loader2, Puzzle, Search, Trash2, Upload } from 'lucide-react';
import { deleteOpening, fetchCoachInsights, fetchOpeningRepertoire, importOpening } from '../../api/training';

export default function CoachLabPage({ authUser, onLogin, onNavigate }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [openings, setOpenings] = React.useState([]);
  const [openingForm, setOpeningForm] = React.useState({ name: '', color: 'w', eco: '', pgn: '', notes: '' });
  const [openingBusy, setOpeningBusy] = React.useState(false);

  React.useEffect(() => {
    if (!authUser) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([fetchCoachInsights(), fetchOpeningRepertoire()])
      .then(([result, openingData]) => {
        if (!cancelled) {
          setData(result);
          setOpenings(openingData.openings || []);
        }
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

  const readPgnFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const pgn = await file.text();
    setOpeningForm((current) => ({ ...current, name: current.name || file.name.replace(/\.pgn$/i, ''), pgn }));
  };

  const submitOpening = async (event) => {
    event.preventDefault();
    setOpeningBusy(true);
    setError('');
    try {
      const result = await importOpening(openingForm);
      setOpenings((current) => [result.opening, ...current]);
      setOpeningForm({ name: '', color: 'w', eco: '', pgn: '', notes: '' });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setOpeningBusy(false);
    }
  };

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

  // Khai báo màu chữ ép buộc (Dark green đậm cho nền sáng)
  const headingColor = 'var(--coach-heading-color, #1a3323)';

  return (
    <section className="feature-page">
      {/* KHỐI CSS TÙY CHỈNH */}
      <style>{`
        /* 1. Vòng tròn loading */
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        .loading-container {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 60px 0;
          color: #888;
        }

        /* 2. Style cho Header Thư viện khai cuộc */
        .styled-opening-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-adaptive, #e5e7eb);
          flex-wrap: wrap;
          gap: 16px;
        }
        .styled-opening-head .badge {
          display: inline-block;
          background-color: #3b82f6;
          color: #ffffff !important;
          padding: 4px 12px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        /* Nút Upload PGN */
        .styled-upload-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background-color: var(--bg-surface-adaptive, #f3f4f6);
          color: var(--text-adaptive, #374151) !important;
          border: 1px solid var(--border-adaptive, #d1d5db);
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        .styled-upload-btn:hover {
          background-color: var(--bg-hover-adaptive, #e5e7eb);
        }
        .styled-upload-btn input {
          display: none;
        }

        /* 3. Tối ưu Form */
        .coach-opening-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 32px;
        }
        .coach-opening-form input,
        .coach-opening-form select,
        .coach-opening-form textarea {
          width: 100%;
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 14px;
          color: var(--text-adaptive, #111827) !important;
          background-color: var(--bg-input-adaptive, #ffffff) !important;
          border: 1px solid var(--border-adaptive, #d1d5db) !important;
        }
        .coach-opening-form input::placeholder,
        .coach-opening-form textarea::placeholder {
          color: var(--placeholder-adaptive, #9ca3af) !important;
        }

        /* 4. BIẾN MÀU SẮC & LIGHT/DARK MODE */
        :root {
          --coach-heading-color: #1a3323; /* Xanh lá siêu đậm cho nền sáng */
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --coach-heading-color: #f9fafb; /* Trắng sáng cho dark mode */
            --text-adaptive: #f9fafb;
            --bg-surface-adaptive: #374151;
            --bg-hover-adaptive: #4b5563;
            --bg-input-adaptive: #1f2937;
            --border-adaptive: #4b5563;
            --placeholder-adaptive: #9ca3af;
          }
        }
      `}</style>

      <header className="feature-hero">
        <div>
          <span>Training Coach</span>
          <h1>Coach Lab</h1>
          <p>Phân tích rule-based từ dữ liệu thật, phù hợp đồ án và dễ giải thích khi bảo vệ.</p>
        </div>
        <button onClick={() => onNavigate('review')}>Mở Game Review</button>
      </header>

      {error && <p className="feature-message error">{error}</p>}

      {loading ? (
        <div className="loading-container">
          <Loader2 size={40} className="animate-spin" />
        </div>
      ) : (
        <>
          <div className="coach-card-grid">
            {(data?.cards || []).map((card) => (
              <article key={card.title}>
                <span>{card.title}</span>
                <strong>{card.value}</strong>
                <p>{card.detail}</p>
              </article>
            ))}
          </div>

          {(data?.recommendations?.length > 0) && (
            <section className="coach-recommendations">
              {/* Ép màu trực tiếp bằng style inline */}
              <h2 style={{ color: headingColor, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList size={22} color={headingColor} />
                <span style={{ color: headingColor }}>Khuyến nghị tiếp theo</span>
              </h2>
              {data.recommendations.map((item) => <p key={item}>{item}</p>)}
            </section>
          )}

          {(data?.weeklyPlan?.length > 0) && (
            <section className="coach-weekly-plan">
              {/* Ép màu trực tiếp bằng style inline */}
              <h2 style={{ color: headingColor, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList size={22} color={headingColor} />
                <span style={{ color: headingColor }}>Kế hoạch tuần</span>
              </h2>
              <div className="coach-card-grid">
                {data.weeklyPlan.map((item) => (
                  <article key={item.day}>
                    <span>{item.day}</span>
                    <strong>{item.focus}</strong>
                    <p>{item.target}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="coach-opening-lab">
            <div className="styled-opening-head">
              <div>
                <span className="badge">Opening repertoire</span>
                {/* Ép màu trực tiếp bằng style inline */}
                <h2 style={{ color: headingColor, fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={24} color={headingColor} />
                  <span style={{ color: headingColor }}>Thư viện khai cuộc</span>
                </h2>
              </div>
              <label className="styled-upload-btn">
                <Upload size={18} />
                <span>Chọn PGN từ máy</span>
                <input type="file" accept=".pgn,text/plain,application/x-chess-pgn" onChange={readPgnFile} />
              </label>
            </div>

            <form className="coach-opening-form" onSubmit={submitOpening}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  style={{ flex: 2, minWidth: '200px' }}
                  required
                  value={openingForm.name}
                  onChange={(event) => setOpeningForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Tên repertoire (VD: Italian Game)"
                />
                <select
                  style={{ flex: 1, minWidth: '100px' }}
                  value={openingForm.color}
                  onChange={(event) => setOpeningForm((current) => ({ ...current, color: event.target.value }))}
                >
                  <option value="w">Trắng</option>
                  <option value="b">Đen</option>
                </select>
                <input
                  style={{ flex: 1, minWidth: '120px' }}
                  value={openingForm.eco}
                  onChange={(event) => setOpeningForm((current) => ({ ...current, eco: event.target.value }))}
                  placeholder="ECO (VD: C50)"
                />
              </div>
              <textarea
                required
                rows={5}
                value={openingForm.pgn}
                onChange={(event) => setOpeningForm((current) => ({ ...current, pgn: event.target.value }))}
                placeholder="Dán PGN hoặc nhấn 'Chọn PGN từ máy' ở trên..."
              />
              <textarea
                rows={3}
                value={openingForm.notes}
                onChange={(event) => setOpeningForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Ghi chú luyện tập (tùy chọn)..."
              />
              <button
                type="submit"
                disabled={openingBusy}
                style={{ alignSelf: 'flex-start', padding: '12px 24px', fontWeight: 'bold' }}
              >
                {openingBusy ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Loader2 size={16} className="animate-spin" /> Đang nhập...</span> : 'Lưu repertoire'}
              </button>
            </form>

            <div className="coach-opening-list">
              {openings.map((opening) => (
                <article key={opening.id}>
                  <div>
                    <strong>{opening.name}</strong>
                    <span>{opening.color === 'w' ? 'Trắng' : 'Đen'} {opening.eco ? `| ${opening.eco}` : ''}</span>
                  </div>
                  <p>{opening.notes || opening.pgn.slice(0, 180)}</p>
                  <button type="button" aria-label="Xóa repertoire" onClick={async () => {
                    await deleteOpening(opening.id);
                    setOpenings((current) => current.filter((item) => item.id !== opening.id));
                  }}><Trash2 size={17} /></button>
                </article>
              ))}
            </div>
          </section>

          <div className="coach-actions">
            <button onClick={() => onNavigate('personal-puzzles')}><Puzzle size={18} /> Mistake Lab</button>
            <button onClick={() => onNavigate('history')}><Search size={18} /> Xem lịch sử</button>
          </div>
        </>
      )}
    </section>
  );
}