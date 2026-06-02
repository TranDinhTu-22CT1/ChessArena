import React from 'react';
import { Ban, CheckCircle2 } from 'lucide-react';
import { pct, time } from './adminUtils';

export default function FairPlaySection({ reports, onUpdateReport, onBanUser, onUnbanUser }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Anti-cheat</span>
          <h2>Fair play review queue</h2>
        </div>
      </div>
      <div className="admin-report-list">
        {reports.length === 0 && <p>No anti-cheat reports yet.</p>}
        {reports.map((report) => {
          const details = report.details || {};
          const isBanned = Boolean(report.activeBan);
          return (
            <article className="admin-report-card" key={report.id}>
              <div>
                <strong>{report.users?.display_name || report.users?.email || report.user_id}</strong>
                <span>
                  Risk {report.risk_score}/100
                  {' | '}{details.band || 'needs game review'}
                  {' | '}Engine {pct(report.engine_match_rate)}
                  {' | '}Critical {pct(details.criticalMatchRate)}
                  {' | '}Complex {pct(details.complexMatchRate)}
                  {' | '}Avg CPL {Math.round(details.averageCpLoss ?? 0)}
                </span>
                <small>{time(report.created_at)} | {report.status} | {details.guidance || 'Review game context before taking action.'}</small>
                {isBanned && <b className="admin-ban-note">Active ban: {report.activeBan.reason}</b>}
              </div>
              <div className="admin-report-actions">
                <button onClick={() => onUpdateReport(report.id, 'reviewed')}>Reviewing</button>
                <button onClick={() => onUpdateReport(report.id, 'dismissed')}>Dismiss</button>
                <button onClick={() => onUpdateReport(report.id, 'actioned')}>Actioned</button>
                {isBanned ? (
                  <button onClick={() => onUnbanUser(report)}><CheckCircle2 size={16} /> Gỡ cấm</button>
                ) : (
                  <button className="danger" onClick={() => onBanUser(report)}><Ban size={16} /> Cấm trực tiếp</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
