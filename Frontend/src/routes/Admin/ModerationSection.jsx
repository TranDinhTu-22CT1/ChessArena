import React from 'react';
import { ExternalLink, Eye, Flag, Image, ShieldAlert, UserRound, X } from 'lucide-react';
import { LoadingBlock } from '../../components/LoadingSpinner';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { time } from './adminUtils';
import AdminFilterBar from './AdminFilterBar';

const STATUS = { pending: 'Chờ xử lý', in_review: 'Đang xem', escalated: 'Chuyển cấp', resolved: 'Đã xử lý', dismissed: 'Bỏ qua' };
const CATEGORY = { harassment: 'Quấy rối', toxic: 'Ngôn từ', stalling: 'Kéo dài trận', match_abuse: 'Lạm dụng trận', username: 'Tên người dùng', avatar: 'Ảnh đại diện', other: 'Khác' };

function userName(user, fallback) {
  return user?.display_name || user?.username || user?.email || fallback || 'Không rõ';
}

export default function ModerationSection({ reports, filters, loading = false, page, totalPages, onFiltersChange, onPageChange, onChangeStatus, onTakeAction, selectedReportId = '' }) {
  const [selected, setSelected] = React.useState(null);
  const [selectedImage, setSelectedImage] = React.useState(null);
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!selectedReportId) return;
    const target = reports.find((report) => report.id === selectedReportId);
    if (target) {
      setSelected(target);
      setNote(target.resolution_note || '');
    }
  }, [reports, selectedReportId]);

  React.useEffect(() => {
    if (!selected) return;
    const fresh = reports.find((report) => report.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [reports, selected?.id]);

  const open = (report) => {
    setSelected(report);
    setNote(report.resolution_note || '');
  };

  const updateStatus = async (status) => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await onChangeStatus(selected, status, note);
      setSelected((current) => current ? { ...current, status, resolution_note: note } : current);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel-head"><div><span>Báo cáo người chơi</span><h2>Hàng đợi kiểm duyệt</h2></div></div>
      <AdminFilterBar value={filters} onApply={onFiltersChange} searchPlaceholder="Mã báo cáo, reporter hoặc người bị báo cáo…" selects={[
        { key: 'status', label: 'Trạng thái', options: [{ value: '', label: 'Tất cả' }, ...Object.entries(STATUS).map(([value, label]) => ({ value, label }))] },
        { key: 'category', label: 'Lý do', options: [{ value: '', label: 'Tất cả' }, ...Object.entries(CATEGORY).map(([value, label]) => ({ value, label }))] }
      ]} />
      <div className="admin-report-list admin-moderation-list">
        {loading && <LoadingBlock label="Đang tải báo cáo người chơi" />}
        {!loading && reports.length === 0 && <p>Chưa có báo cáo người chơi.</p>}
        {reports.map((report) => (
          <article className="admin-report-card admin-moderation-row" key={report.id}>
            <span className={`admin-report-status ${report.status}`}>{STATUS[report.status] || report.status}</span>
            <div><strong>{userName(report.reported, report.reported_user_id)}</strong><small>Người gửi: {userName(report.reporter, report.reporter_user_id)}</small></div>
            <div><span>{CATEGORY[report.category] || report.category}</span><small>{time(report.created_at)}</small></div>
            <div><span>{report.game ? `${report.game.white_name} vs ${report.game.black_name}` : 'Không có trận liên quan'}</span><small>#{String(report.id).slice(0, 8)}</small></div>
            <button type="button" onClick={() => open(report)}><Eye size={15} /> Xem chi tiết</button>
          </article>
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} label="Phân trang báo cáo" />

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} className="surface-dialog admin-report-dialog" aria-label="Chi tiết báo cáo vi phạm">
        {selected && (
          <article>
            <header>
              <div><span>BÁO CÁO #{String(selected.id).slice(0, 8)}</span><h2>Chi tiết vi phạm</h2></div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Đóng báo cáo"><X size={18} /></button>
            </header>
            <div className="admin-report-people">
              <div><UserRound size={19} /><span><small>Người báo cáo</small><strong>{userName(selected.reporter, selected.reporter_user_id)}</strong></span></div>
              <div><ShieldAlert size={19} /><span><small>Người bị báo cáo</small><strong>{userName(selected.reported, selected.reported_user_id)}</strong></span></div>
            </div>
            <dl>
              <div><dt>Trạng thái</dt><dd>{STATUS[selected.status] || selected.status}</dd></div>
              <div><dt>Lý do</dt><dd>{CATEGORY[selected.category] || selected.category} · {selected.severity}</dd></div>
              <div><dt>Ngày tạo</dt><dd>{time(selected.created_at)}</dd></div>
              <div><dt>Cập nhật</dt><dd>{time(selected.updated_at)}</dd></div>
              <div><dt>Trận liên quan</dt><dd>{selected.game ? `${selected.game.white_name} vs ${selected.game.black_name} · ${selected.game.result || '*'}` : 'Không có'}</dd></div>
              <div><dt>Report ID</dt><dd>{selected.id}</dd></div>
            </dl>
            <section><strong>Mô tả đầy đủ</strong><p>{selected.description || 'Không có mô tả.'}</p></section>
            <section>
              <strong><Image size={16} /> Bằng chứng</strong>
              {selected.evidence?.url && <a href={selected.evidence.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Mở liên kết bằng chứng</a>}
              {Array.isArray(selected.evidence?.images) && selected.evidence.images.length > 0 ? (
                <div className="admin-report-evidence">
                  {selected.evidence.images.map((image) => <button type="button" key={image.id || image.url} onClick={() => setSelectedImage(image)}><img src={image.url} alt={image.name || 'Bằng chứng'} /></button>)}
                </div>
              ) : <p>Không có ảnh đính kèm.</p>}
            </section>
            <label><span>Ghi chú / kết quả xử lý</span><textarea aria-label="Ghi chú xử lý báo cáo" rows={3} maxLength={800} value={note} onChange={(event) => setNote(event.target.value)} /></label>
            <footer>
              <button type="button" disabled={saving} onClick={() => updateStatus('in_review')}>Bắt đầu xem</button>
              <button type="button" disabled={saving} onClick={() => updateStatus('dismissed')}>Từ chối</button>
              <button type="button" disabled={saving} onClick={() => updateStatus('resolved')}>Xử lý xong</button>
              <button className="danger" type="button" disabled={saving} onClick={() => onTakeAction?.(selected.reported)}><Flag size={15} /> Khóa tài khoản</button>
              <button type="button" onClick={() => setSelected(null)}>Đóng</button>
            </footer>
          </article>
        )}
      </Modal>

      <Modal open={Boolean(selectedImage)} onClose={() => setSelectedImage(null)} className="admin-report-lightbox" aria-label="Xem ảnh bằng chứng">
        {selectedImage && <figure><img src={selectedImage.url} alt={selectedImage.name || 'Ảnh bằng chứng'} /><figcaption>{selectedImage.name || 'Ảnh bằng chứng'}<button type="button" onClick={() => setSelectedImage(null)} aria-label="Đóng ảnh"><X size={18} /></button></figcaption></figure>}
      </Modal>
    </section>
  );
}
