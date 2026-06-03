import React from 'react';
import Pagination from '../../components/Pagination';
import { time } from './adminUtils';

export default function ModerationSection({ reports, page, totalPages, onPageChange, onChangeStatus }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Báo cáo người chơi</span>
          <h2>Hàng đợi kiểm duyệt</h2>
        </div>
      </div>
      <div className="admin-report-list">
        {reports.length === 0 && <p>Chưa có báo cáo người chơi.</p>}
        {reports.map((report) => (
          <article className="admin-report-card admin-moderation-card" key={report.id}>
            <div>
              <strong>{report.reported?.display_name || report.reported?.email || report.reported_user_id || 'Người chơi không rõ'}</strong>
              <span>{report.category} | {report.severity} | {report.status}</span>
              <small>
                Người báo cáo: {report.reporter?.display_name || report.reporter?.email || report.reporter_user_id}
                {' '}| Trận: {report.game?.white_name || 'Trắng'} vs {report.game?.black_name || 'Đen'}
                {' '}| {time(report.created_at)}
              </small>
              <em>{report.description}</em>
              <small>Bằng chứng: {report.evidence?.moveCount ?? 0} nước | Kết quả {report.evidence?.result || report.game?.result || '*'}</small>
            </div>
            <div>
              <button onClick={() => onChangeStatus(report, 'in_review')}>Đang xem</button>
              <button onClick={() => onChangeStatus(report, 'escalated')}>Chuyển cấp cao hơn</button>
              <button onClick={() => onChangeStatus(report, 'resolved')}>Đã xử lý</button>
              <button onClick={() => onChangeStatus(report, 'dismissed')}>Bỏ qua</button>
            </div>
          </article>
        ))}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        label="Phân trang báo cáo"
      />
    </section>
  );
}
