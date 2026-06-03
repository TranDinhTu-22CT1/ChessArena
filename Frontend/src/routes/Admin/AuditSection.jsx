import React from 'react';
import Pagination from '../../components/Pagination';
import { adminActionLabel, auditFallback, time } from './adminUtils';

export default function AuditSection({ logs, page, totalPages, onPageChange }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Nhật ký hệ thống</span>
          <h2>Hoạt động của admin</h2>
        </div>
      </div>
      <div className="admin-table-list">
        {logs.length === 0 && <p className="admin-message">Chưa có nhật ký ở trang này.</p>}
        {logs.map((log) => (
          <article className="admin-report-card" key={log.id}>
            <div>
              <strong>{log.readableAction || adminActionLabel(log.action)}</strong>
              <span>{log.readableDetail || auditFallback(log)}</span>
              <small>Thời gian: {time(log.created_at)} | Mã log: #{log.id}</small>
            </div>
          </article>
        ))}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        label="Phân trang nhật ký"
      />
    </section>
  );
}
