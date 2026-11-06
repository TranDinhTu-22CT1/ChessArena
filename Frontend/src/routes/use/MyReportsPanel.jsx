import React from 'react';
import { ExternalLink, FileWarning, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { fetchMyReports } from '../../api/profile';
import Modal from '../../components/Modal';

const STATUS_LABELS = {
  pending: 'Chờ xử lý',
  in_review: 'Đang xem xét',
  escalated: 'Đã chuyển cấp',
  resolved: 'Đã xử lý',
  dismissed: 'Đã đóng'
};

const CATEGORY_LABELS = {
  harassment: 'Quấy rối',
  toxic: 'Ngôn từ xúc phạm',
  stalling: 'Cố tình kéo dài trận',
  match_abuse: 'Lạm dụng trận đấu',
  username: 'Tên không phù hợp',
  avatar: 'Ảnh không phù hợp',
  other: 'Khác'
};

function formatDate(value) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));
}

export default function MyReportsPanel({ authUser, onLogin, selectedReportId = '' }) {
  const [reports, setReports] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [loading, setLoading] = React.useState(Boolean(authUser));
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchMyReports();
      const next = data.reports || [];
      setReports(next);
      if (selectedReportId) setSelected(next.find((item) => item.id === selectedReportId) || null);
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải báo cáo của bạn.');
    } finally {
      setLoading(false);
    }
  }, [authUser, selectedReportId]);

  React.useEffect(() => { void load(); }, [load]);

  React.useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener('chessarena:report-submitted', refresh);
    return () => window.removeEventListener('chessarena:report-submitted', refresh);
  }, [load]);

  if (!authUser) {
    return (
      <section className="support-reports-panel support-auth-note">
        <ShieldCheck size={22} />
        <span>Đăng nhập để xem các báo cáo do chính bạn gửi.</span>
        <button type="button" onClick={onLogin}>Đăng nhập</button>
      </section>
    );
  }

  return (
    <section className="support-reports-panel" aria-labelledby="my-reports-title">
      <header>
        <div>
          <span>BÁO CÁO NGƯỜI CHƠI</span>
          <h2 id="my-reports-title">Báo cáo của tôi</h2>
          <p>Theo dõi trạng thái và kết quả xử lý. Ghi chú nội bộ của quản trị viên không được hiển thị tại đây.</p>
        </div>
        <button type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> Làm mới</button>
      </header>

      {loading && <div className="support-report-empty" role="status"><Loader2 className="animate-spin" size={22} /> Đang tải báo cáo…</div>}
      {error && <div className="support-report-empty error" role="alert">{error}</div>}
      {!loading && !error && reports.length === 0 && (
        <div className="support-report-empty"><FileWarning size={28} /><strong>Chưa có báo cáo</strong><p>Báo cáo được gửi từ hồ sơ công khai của người chơi khác sẽ xuất hiện tại đây.</p></div>
      )}
      {!loading && reports.length > 0 && (
        <div className="support-report-list">
          {reports.map((report) => (
            <button type="button" key={report.id} onClick={() => setSelected(report)}>
              <span className={`my-report-status ${report.status}`}>{STATUS_LABELS[report.status] || report.status}</span>
              <span>
                <strong>{report.reported?.display_name || report.reported?.username || 'Người chơi'}</strong>
                <small>{CATEGORY_LABELS[report.category] || report.category} · {formatDate(report.createdAt)}</small>
              </span>
              <p>{report.result}</p>
            </button>
          ))}
        </div>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} className="surface-dialog my-report-dialog" aria-label="Chi tiết báo cáo của tôi">
        {selected && (
          <article>
            <header>
              <div><span>BÁO CÁO #{selected.id.slice(0, 8)}</span><h2>{selected.reported?.display_name || selected.reported?.username || 'Người chơi'}</h2></div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Đóng"><X size={18} /></button>
            </header>
            <dl>
              <div><dt>Trạng thái</dt><dd>{STATUS_LABELS[selected.status] || selected.status}</dd></div>
              <div><dt>Lý do</dt><dd>{CATEGORY_LABELS[selected.category] || selected.category}</dd></div>
              <div><dt>Ngày gửi</dt><dd>{formatDate(selected.createdAt)}</dd></div>
              <div><dt>Kết quả</dt><dd>{selected.result}</dd></div>
              {selected.game && <div><dt>Trận liên quan</dt><dd>{selected.game.white_name} – {selected.game.black_name} · {selected.game.result || '*'}</dd></div>}
            </dl>
            <section><strong>Mô tả đã gửi</strong><p>{selected.description}</p></section>
            {selected.evidence?.url && <a href={selected.evidence.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Mở liên kết bằng chứng</a>}
            {Array.isArray(selected.evidence?.images) && selected.evidence.images.length > 0 && (
              <div className="my-report-images">
                {selected.evidence.images.map((image) => <a key={image.id || image.url} href={image.url} target="_blank" rel="noreferrer"><img src={image.url} alt={image.name || 'Ảnh bằng chứng'} /></a>)}
              </div>
            )}
          </article>
        )}
      </Modal>
    </section>
  );
}
