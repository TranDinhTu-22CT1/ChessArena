import React from 'react';
import { Chess } from 'chess.js';
import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Eye,
  FileText,
  Gauge,
  Loader2,
  Puzzle,
  Search,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { deleteOpening, fetchCoachInsights, fetchOpeningRepertoire, importOpening } from '../../api/training';
import { getPieceImage } from '../../game/pieces';

const EMPTY_OPENING = { name: '', color: 'w', eco: '', pgn: '', notes: '' };

const CARD_META = {
  onlineForm: { icon: Swords, tone: 'green' },
  bestRating: { icon: Gauge, tone: 'lime' },
  reviewRisk: { icon: ShieldAlert, tone: 'amber' },
  puzzleForm: { icon: Puzzle, tone: 'blue' }
};

const CARD_TRANSLATIONS = {
  'Online form': { key: 'onlineForm', title: 'Phong độ online' },
  'Best rating': { key: 'bestRating', title: 'Rating cao nhất' },
  'Review risk': { key: 'reviewRisk', title: 'Rủi ro khi review' },
  'Puzzle form': { key: 'puzzleForm', title: 'Phong độ puzzle' }
};

const PHASES = [
  { key: 'opening', label: 'Khai cuộc' },
  { key: 'middlegame', label: 'Trung cuộc' },
  { key: 'endgame', label: 'Tàn cuộc' }
];

function normalizeCard(card, index) {
  const translated = CARD_TRANSLATIONS[card.title];
  const key = card.key || translated?.key || Object.keys(CARD_META)[index] || 'onlineForm';
  return {
    ...card,
    key,
    title: translated?.title || card.title
  };
}

function getOpeningPreview(opening) {
  const content = opening.notes?.trim() || opening.pgn?.trim() || 'Chưa có ghi chú cho repertoire này.';
  return content.length > 180 ? `${content.slice(0, 180).trim()}...` : content;
}

function squareName(row, col, flipped) {
  const files = flipped ? 'hgfedcba' : 'abcdefgh';
  const ranks = flipped ? '12345678' : '87654321';
  return `${files[col]}${ranks[row]}`;
}

function buildOpeningReplay(pgn) {
  const parsed = new Chess();
  parsed.loadPgn(pgn, { strict: false });
  const headers = parsed.getHeaders();
  const moves = parsed.history({ verbose: true });
  const replay = headers.FEN ? new Chess(headers.FEN) : new Chess();
  const positions = [new Chess(replay.fen())];

  moves.forEach((move) => {
    replay.move(move.san);
    positions.push(new Chess(replay.fen()));
  });

  return { headers, moves, positions };
}

function OpeningViewer({ opening, onClose }) {
  const replay = React.useMemo(() => {
    try {
      return { ...buildOpeningReplay(opening.pgn), error: '' };
    } catch {
      return { headers: {}, moves: [], positions: [new Chess()], error: 'PGN này không thể dựng lại trên bàn cờ.' };
    }
  }, [opening.pgn]);
  const [ply, setPly] = React.useState(0);
  const [flipped, setFlipped] = React.useState(opening.color === 'b');
  const moveListRef = React.useRef(null);
  const currentGame = replay.positions[Math.min(ply, replay.positions.length - 1)] || replay.positions[0];
  const currentMove = ply > 0 ? replay.moves[ply - 1] : null;

  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') setPly((current) => Math.max(0, current - 1));
      if (event.key === 'ArrowRight') setPly((current) => Math.min(replay.moves.length, current + 1));
      if (event.key === 'Home') setPly(0);
      if (event.key === 'End') setPly(replay.moves.length);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, replay.moves.length]);

  React.useEffect(() => {
    moveListRef.current?.querySelector(`[data-ply="${ply}"]`)?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });
  }, [ply]);

  return (
    <div className="opening-viewer-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="opening-viewer-dialog" role="dialog" aria-modal="true" aria-labelledby="opening-viewer-title">
        <header className="opening-viewer-head">
          <div>
            <span><BookOpen size={15} /> Trình học PGN</span>
            <h2 id="opening-viewer-title">{opening.name}</h2>
            <p>
              {opening.color === 'w' ? 'Repertoire Quân Trắng' : 'Repertoire Quân Đen'}
              {opening.eco ? ` · ECO ${opening.eco}` : ''}
              {replay.headers.Opening ? ` · ${replay.headers.Opening}` : ''}
            </p>
          </div>
          <button type="button" aria-label="Đóng trình xem" onClick={onClose}><X size={21} /></button>
        </header>

        <div className="opening-viewer-content">
          <div className="opening-viewer-board-column">
            <div className={`opening-viewer-board piece-set-neo ${flipped ? 'is-flipped' : ''}`}>
              {Array.from({ length: 8 }).map((_, row) =>
                Array.from({ length: 8 }).map((__, col) => {
                  const square = squareName(row, col, flipped);
                  const piece = currentGame.get(square);
                  const isDark = (row + col) % 2 === 1;
                  const isLastMove = currentMove && (currentMove.from === square || currentMove.to === square);
                  return (
                    <span
                      className={`opening-viewer-square ${isDark ? 'dark' : 'light'} ${isLastMove ? 'last-move' : ''}`}
                      key={square}
                    >
                      {piece && (
                        <img
                          src={getPieceImage('neo', `${piece.color}${piece.type}`)}
                          alt=""
                          draggable="false"
                        />
                      )}
                      {(row === 7 || col === 0) && (
                        <small>{row === 7 ? square[0] : square[1]}</small>
                      )}
                    </span>
                  );
                })
              )}
            </div>

            <div className="opening-viewer-controls">
              <button type="button" aria-label="Về vị trí đầu" disabled={ply === 0} onClick={() => setPly(0)}>
                <ChevronsLeft size={19} />
              </button>
              <button type="button" aria-label="Nước trước" disabled={ply === 0} onClick={() => setPly((current) => current - 1)}>
                <ChevronLeft size={20} />
              </button>
              <span>
                <b>{ply ? replay.moves[ply - 1]?.san : 'Bắt đầu'}</b>
                <small>Nước {ply} / {replay.moves.length}</small>
              </span>
              <button type="button" aria-label="Nước tiếp theo" disabled={ply === replay.moves.length} onClick={() => setPly((current) => current + 1)}>
                <ChevronRight size={20} />
              </button>
              <button type="button" aria-label="Tới vị trí cuối" disabled={ply === replay.moves.length} onClick={() => setPly(replay.moves.length)}>
                <ChevronsRight size={19} />
              </button>
            </div>

            <button className="opening-viewer-flip" type="button" onClick={() => setFlipped((current) => !current)}>
              Đổi hướng bàn cờ
            </button>
          </div>

          <aside className="opening-viewer-sidebar">
            {replay.error ? (
              <p className="opening-viewer-error">{replay.error}</p>
            ) : (
              <>
                <div className="opening-viewer-section-head">
                  <div>
                    <span>Biến khai cuộc</span>
                    <h3>Danh sách nước đi</h3>
                  </div>
                  <b>{replay.moves.length} ply</b>
                </div>

                <div className="opening-viewer-moves" ref={moveListRef}>
                  {Array.from({ length: Math.ceil(replay.moves.length / 2) }).map((_, index) => {
                    const whitePly = index * 2 + 1;
                    const blackPly = whitePly + 1;
                    return (
                      <div key={whitePly}>
                        <span>{index + 1}.</span>
                        <button
                          className={ply === whitePly ? 'active' : ''}
                          data-ply={whitePly}
                          type="button"
                          onClick={() => setPly(whitePly)}
                        >
                          {replay.moves[whitePly - 1]?.san}
                        </button>
                        {replay.moves[blackPly - 1] ? (
                          <button
                            className={ply === blackPly ? 'active' : ''}
                            data-ply={blackPly}
                            type="button"
                            onClick={() => setPly(blackPly)}
                          >
                            {replay.moves[blackPly - 1].san}
                          </button>
                        ) : <span />}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="opening-viewer-notes">
              <span>Ghi chú luyện tập</span>
              <p>{opening.notes?.trim() || 'Chưa có ghi chú cho repertoire này.'}</p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

export default function CoachLabPage({ authUser, onLogin, onNavigate }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [openings, setOpenings] = React.useState([]);
  const [openingForm, setOpeningForm] = React.useState(EMPTY_OPENING);
  const [openingBusy, setOpeningBusy] = React.useState(false);
  const [deleteBusyId, setDeleteBusyId] = React.useState('');
  const [showOpeningForm, setShowOpeningForm] = React.useState(false);
  const [viewingOpening, setViewingOpening] = React.useState(null);

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
        if (!cancelled) setError(loadError.message || 'Không thể tải dữ liệu Coach Lab.');
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

    try {
      const pgn = await file.text();
      setOpeningForm((current) => ({
        ...current,
        name: current.name || file.name.replace(/\.pgn$/i, ''),
        pgn
      }));
      setShowOpeningForm(true);
      setNotice(`Đã đọc tệp ${file.name}. Kiểm tra thông tin rồi lưu vào thư viện.`);
      setError('');
    } catch {
      setError('Không thể đọc tệp PGN đã chọn.');
    }
  };

  const submitOpening = async (event) => {
    event.preventDefault();
    setOpeningBusy(true);
    setError('');
    setNotice('');

    try {
      const result = await importOpening(openingForm);
      setOpenings((current) => [result.opening, ...current]);
      setOpeningForm(EMPTY_OPENING);
      setShowOpeningForm(false);
      setNotice('Đã lưu repertoire vào thư viện khai cuộc.');
    } catch (submitError) {
      setError(submitError.message || 'Không thể lưu repertoire.');
    } finally {
      setOpeningBusy(false);
    }
  };

  const removeOpening = async (opening) => {
    setDeleteBusyId(opening.id);
    setError('');
    setNotice('');

    try {
      await deleteOpening(opening.id);
      setOpenings((current) => current.filter((item) => item.id !== opening.id));
      setNotice(`Đã xóa “${opening.name}” khỏi thư viện.`);
    } catch (deleteError) {
      setError(deleteError.message || 'Không thể xóa repertoire.');
    } finally {
      setDeleteBusyId('');
    }
  };

  if (!authUser) {
    return (
      <section className="feature-page empty-feature">
        <Brain size={44} />
        <h1>Phòng huấn luyện</h1>
        <p>Đăng nhập để nhận lộ trình luyện tập dựa trên ván online, Game Review và puzzle của bạn.</p>
        <button onClick={onLogin}>Đăng nhập</button>
      </section>
    );
  }

  const cards = (data?.cards || []).map(normalizeCard);
  const phaseMistakes = data?.phaseMistakes || {};
  const totalPhaseMistakes = PHASES.reduce((sum, phase) => sum + (Number(phaseMistakes[phase.key]) || 0), 0);
  const weakestPhase = PHASES.find((phase) => phase.key === data?.weakestPhase)?.label || 'Trung cuộc';

  return (
    <section className="feature-page coach-lab-page">
      <header className="coach-lab-hero">
        <div className="coach-lab-hero-copy">
          <span className="coach-lab-eyebrow"><Sparkles size={16} /> Huấn luyện cá nhân hóa</span>
          <h1>Phòng huấn luyện</h1>
          <p>
            Biến dữ liệu ván đấu thành một kế hoạch rõ ràng: biết điểm yếu,
            ưu tiên bài tập phù hợp và theo dõi tiến bộ theo từng tuần.
          </p>
          <div className="coach-lab-hero-actions">
            <button type="button" onClick={() => onNavigate('review')}>
              <Search size={17} /> Mở Game Review
            </button>
            <button className="secondary" type="button" onClick={() => onNavigate('personal-puzzles')}>
              <Puzzle size={17} /> Puzzle cá nhân
            </button>
          </div>
        </div>

        <div className="coach-lab-focus-card">
          <span><Target size={17} /> Trọng tâm hiện tại</span>
          <strong>{weakestPhase}</strong>
          <p>
            {totalPhaseMistakes
              ? `${totalPhaseMistakes} lỗi đã được ghi nhận từ các ván review.`
              : 'Review thêm ván đấu để Coach xác định giai đoạn cần cải thiện.'}
          </p>
        </div>
      </header>

      {error && <p className="feature-message error coach-lab-message">{error}</p>}
      {notice && (
        <p className="coach-lab-message success">
          <CheckCircle2 size={17} /> {notice}
          <button type="button" aria-label="Đóng thông báo" onClick={() => setNotice('')}><X size={15} /></button>
        </p>
      )}

      {loading ? (
        <div className="coach-lab-loading">
          <Loader2 size={36} />
          <span>Đang phân tích dữ liệu luyện tập...</span>
        </div>
      ) : (
        <>
          <section className="coach-lab-section">
            <div className="coach-lab-section-head">
              <div>
                <span>Tổng quan</span>
                <h2>Chỉ số luyện tập</h2>
              </div>
              <Activity size={22} />
            </div>

            <div className="coach-metric-grid">
              {cards.map((card) => {
                const meta = CARD_META[card.key] || CARD_META.onlineForm;
                const Icon = meta.icon;
                return (
                  <article className={`coach-metric-card tone-${meta.tone}`} key={card.key}>
                    <span className="coach-metric-icon"><Icon size={21} /></span>
                    <div>
                      <span>{card.title}</span>
                      <strong>{card.value}</strong>
                      <p>{card.detail}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="coach-insight-layout">
            <section className="coach-lab-panel coach-phase-panel">
              <div className="coach-lab-section-head compact">
                <div>
                  <span>Phân tích ván đấu</span>
                  <h2>Lỗi theo giai đoạn</h2>
                </div>
                <BarChart3 size={22} />
              </div>

              <div className="coach-phase-list">
                {PHASES.map((phase) => {
                  const count = Number(phaseMistakes[phase.key]) || 0;
                  const percent = totalPhaseMistakes ? Math.round((count / totalPhaseMistakes) * 100) : 0;
                  return (
                    <div className={data?.weakestPhase === phase.key ? 'is-weakest' : ''} key={phase.key}>
                      <div>
                        <span>{phase.label}</span>
                        <b>{count} lỗi</b>
                      </div>
                      <i><span style={{ width: `${percent}%` }} /></i>
                    </div>
                  );
                })}
              </div>

              <button className="coach-panel-link" type="button" onClick={() => onNavigate('history')}>
                Xem lịch sử ván đấu <ChevronRight size={17} />
              </button>
            </section>

            <section className="coach-lab-panel coach-recommendation-panel">
              <div className="coach-lab-section-head compact">
                <div>
                  <span>Ưu tiên tiếp theo</span>
                  <h2>Khuyến nghị từ Coach</h2>
                </div>
                <ClipboardList size={22} />
              </div>

              <div className="coach-recommendation-list">
                {(data?.recommendations || []).map((item, index) => (
                  <article key={item}>
                    <span>{index + 1}</span>
                    <p>{item}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {(data?.weeklyPlan?.length > 0) && (
            <section className="coach-lab-section">
              <div className="coach-lab-section-head">
                <div>
                  <span>Lịch đề xuất</span>
                  <h2>Kế hoạch luyện tập tuần</h2>
                </div>
                <CalendarDays size={22} />
              </div>

              <div className="coach-week-grid">
                {data.weeklyPlan.map((item, index) => (
                  <article key={item.day}>
                    <span className="coach-week-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="coach-week-day">{item.day}</span>
                    <strong>{item.focus}</strong>
                    <p>{item.target}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="coach-opening-lab">
            <div className="coach-opening-toolbar">
              <div>
                <span><BookOpen size={16} /> Học theo repertoire</span>
                <h2>Thư viện khai cuộc</h2>
                <p>Lưu các biến PGN quan trọng để ôn tập theo màu quân và mã ECO.</p>
              </div>
              <div>
                <label className="coach-upload-button">
                  <Upload size={17} />
                  Chọn tệp PGN
                  <input type="file" accept=".pgn,text/plain,application/x-chess-pgn" onChange={readPgnFile} />
                </label>
                <button
                  className="coach-add-opening"
                  type="button"
                  aria-expanded={showOpeningForm}
                  onClick={() => setShowOpeningForm((current) => !current)}
                >
                  {showOpeningForm ? <X size={17} /> : <FileText size={17} />}
                  {showOpeningForm ? 'Đóng biểu mẫu' : 'Thêm thủ công'}
                </button>
              </div>
            </div>

            {showOpeningForm && (
              <form className="coach-opening-form" onSubmit={submitOpening}>
                <div className="coach-opening-form-grid">
                  <label>
                    <span>Tên repertoire</span>
                    <input
                      required
                      value={openingForm.name}
                      onChange={(event) => setOpeningForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Ví dụ: Italian Game"
                    />
                  </label>
                  <label>
                    <span>Màu quân</span>
                    <select
                      value={openingForm.color}
                      onChange={(event) => setOpeningForm((current) => ({ ...current, color: event.target.value }))}
                    >
                      <option value="w">Quân Trắng</option>
                      <option value="b">Quân Đen</option>
                    </select>
                  </label>
                  <label>
                    <span>Mã ECO</span>
                    <input
                      value={openingForm.eco}
                      onChange={(event) => setOpeningForm((current) => ({ ...current, eco: event.target.value }))}
                      placeholder="Ví dụ: C50"
                    />
                  </label>
                </div>

                <label>
                  <span>Nội dung PGN</span>
                  <textarea
                    required
                    rows={6}
                    value={openingForm.pgn}
                    onChange={(event) => setOpeningForm((current) => ({ ...current, pgn: event.target.value }))}
                    placeholder="Dán PGN hoặc chọn tệp từ máy..."
                  />
                </label>

                <label>
                  <span>Ghi chú luyện tập</span>
                  <textarea
                    rows={3}
                    value={openingForm.notes}
                    onChange={(event) => setOpeningForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Ý tưởng chính, kế hoạch trung cuộc hoặc vị trí cần ghi nhớ..."
                  />
                </label>

                <div className="coach-opening-form-actions">
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => {
                      setOpeningForm(EMPTY_OPENING);
                      setShowOpeningForm(false);
                    }}
                  >
                    Hủy
                  </button>
                  <button type="submit" disabled={openingBusy}>
                    {openingBusy ? <Loader2 size={16} /> : <BookOpen size={16} />}
                    {openingBusy ? 'Đang lưu...' : 'Lưu vào thư viện'}
                  </button>
                </div>
              </form>
            )}

            {openings.length > 0 ? (
              <div className="coach-opening-list">
                {openings.map((opening) => (
                  <article key={opening.id}>
                    <div className="coach-opening-card-head">
                      <span className={`coach-piece-color color-${opening.color}`} aria-hidden="true">
                        {opening.color === 'w' ? '♙' : '♟'}
                      </span>
                      <div>
                        <strong>{opening.name}</strong>
                        <span>
                          {opening.color === 'w' ? 'Quân Trắng' : 'Quân Đen'}
                          {opening.eco ? ` · ECO ${opening.eco}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={deleteBusyId === opening.id}
                        aria-label={`Xóa ${opening.name}`}
                        onClick={() => removeOpening(opening)}
                      >
                        {deleteBusyId === opening.id ? <Loader2 size={17} /> : <Trash2 size={17} />}
                      </button>
                    </div>
                    <p>{getOpeningPreview(opening)}</p>
                    <button
                      className="coach-opening-view-button"
                      type="button"
                      onClick={() => setViewingOpening(opening)}
                    >
                      <Eye size={16} /> Xem bàn cờ <ChevronRight size={16} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="coach-opening-empty">
                <BookOpen size={34} />
                <strong>Thư viện đang trống</strong>
                <span>Nhập tệp PGN đầu tiên để bắt đầu xây dựng repertoire cá nhân.</span>
              </div>
            )}
          </section>
        </>
      )}

      {viewingOpening && (
        <OpeningViewer opening={viewingOpening} onClose={() => setViewingOpening(null)} />
      )}
    </section>
  );
}
