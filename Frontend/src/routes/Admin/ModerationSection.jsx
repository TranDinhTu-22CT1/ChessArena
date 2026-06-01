import React from 'react';
import { time } from './adminUtils';

export default function ModerationSection({ reports, onChangeStatus }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Bao cao nguoi choi</span>
          <h2>Hang doi moderation</h2>
        </div>
      </div>
      <div className="admin-report-list">
        {reports.length === 0 && <p>Chua co bao cao nguoi choi.</p>}
        {reports.map((report) => (
          <article className="admin-report-card admin-moderation-card" key={report.id}>
            <div>
              <strong>{report.reported?.display_name || report.reported?.email || report.reported_user_id || 'Nguoi choi khong ro'}</strong>
              <span>{report.category} | {report.severity} | {report.status}</span>
              <small>
                Nguoi bao cao: {report.reporter?.display_name || report.reporter?.email || report.reporter_user_id}
                {' '}| Tran: {report.game?.white_name || 'Trang'} vs {report.game?.black_name || 'Den'}
                {' '}| {time(report.created_at)}
              </small>
              <em>{report.description}</em>
              <small>Bang chung: {report.evidence?.moveCount ?? 0} nuoc | Ket qua {report.evidence?.result || report.game?.result || '*'}</small>
            </div>
            <div>
              <button onClick={() => onChangeStatus(report, 'in_review')}>Dang xem</button>
              <button onClick={() => onChangeStatus(report, 'escalated')}>Chuyen cao hon</button>
              <button onClick={() => onChangeStatus(report, 'resolved')}>Da xu ly</button>
              <button onClick={() => onChangeStatus(report, 'dismissed')}>Bo qua</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
