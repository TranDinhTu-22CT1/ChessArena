import React from 'react';
import { pct, time } from './adminUtils';

export default function FairPlaySection({ reports, onUpdateReport }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Chống gian lận nâng cao</span>
          <h2>Hàng đợi xử lý công bằng</h2>
        </div>
      </div>
      <div className="admin-report-list">
        {reports.length === 0 && <p>Chưa có báo cáo chống gian lận.</p>}
        {reports.map((report) => {
          const details = report.details || {};
          return (
            <article className="admin-report-card" key={report.id}>
              <div>
                <strong>{report.users?.display_name || report.users?.email || report.user_id}</strong>
                <span>
                  Rủi ro {report.risk_score}/100
                  {' | '}{details.band || 'cần xem từng ván'}
                  {' | '}Engine {pct(report.engine_match_rate)}
                  {' | '}Nước quan trọng {pct(details.criticalMatchRate)}
                  {' | '}Thế khó {pct(details.complexMatchRate)}
                  {' | '}CPL TB {Math.round(details.averageCpLoss ?? 0)}
                </span>
                <small>{time(report.created_at)} | {report.status} | {details.guidance || 'Cần xem ngữ cảnh trước khi xử lý.'}</small>
              </div>
              <div>
                <button onClick={() => onUpdateReport(report.id, 'reviewed')}>Đang xem</button>
                <button onClick={() => onUpdateReport(report.id, 'dismissed')}>Bỏ qua</button>
                <button onClick={() => onUpdateReport(report.id, 'actioned')}>Đã xử lý</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
