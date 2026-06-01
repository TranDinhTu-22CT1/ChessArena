import React from 'react';
import { adminActionLabel, auditFallback, time } from './adminUtils';

export default function AuditSection({ logs }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Nhat ky he thong</span>
          <h2>Hoat dong cua admin</h2>
        </div>
      </div>
      <div className="admin-table-list">
        {logs.map((log) => (
          <article className="admin-report-card" key={log.id}>
            <div>
              <strong>{log.readableAction || adminActionLabel(log.action)}</strong>
              <span>{log.readableDetail || auditFallback(log)}</span>
              <small>Thoi gian: {time(log.created_at)} | Ma log: #{log.id}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
