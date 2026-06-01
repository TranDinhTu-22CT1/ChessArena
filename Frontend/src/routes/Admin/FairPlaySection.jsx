import React from 'react';
import { pct, time } from './adminUtils';

export default function FairPlaySection({ reports, onUpdateReport }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Anti-cheat nang cao</span>
          <h2>Hang doi xu ly fair play</h2>
        </div>
      </div>
      <div className="admin-report-list">
        {reports.length === 0 && <p>Chua co bao cao anti-cheat.</p>}
        {reports.map((report) => {
          const details = report.details || {};
          return (
            <article className="admin-report-card" key={report.id}>
              <div>
                <strong>{report.users?.display_name || report.users?.email || report.user_id}</strong>
                <span>
                  Rui ro {report.risk_score}/100
                  {' | '}{details.band || 'can xem tung van'}
                  {' | '}Engine {pct(report.engine_match_rate)}
                  {' | '}Nuoc quan trong {pct(details.criticalMatchRate)}
                  {' | '}The kho {pct(details.complexMatchRate)}
                  {' | '}CPL TB {Math.round(details.averageCpLoss ?? 0)}
                </span>
                <small>{time(report.created_at)} | {report.status} | {details.guidance || 'Can xem ngu canh truoc khi xu ly.'}</small>
              </div>
              <div>
                <button onClick={() => onUpdateReport(report.id, 'reviewed')}>Dang xem</button>
                <button onClick={() => onUpdateReport(report.id, 'dismissed')}>Bo qua</button>
                <button onClick={() => onUpdateReport(report.id, 'actioned')}>Da xu ly</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
