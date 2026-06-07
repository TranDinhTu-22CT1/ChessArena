import React from 'react';
import { Ban, CheckCircle2, Filter, Search } from 'lucide-react';
import Pagination from '../../components/Pagination';
import { pct, time } from './adminUtils';

const STATUS_LABELS = {
  all: 'Tất cả trạng thái',
  open: 'Đang mở',
  reviewed: 'Đã review',
  dismissed: 'Đã bỏ qua',
  actioned: 'Đã xử lý'
};

export default function FairPlaySection({
  reports,
  filters,
  page,
  totalPages,
  onFilterChange,
  onPageChange,
  onUpdateReport,
  onBanUser,
  onUnbanUser
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Anti-cheat</span>
          <h2>Hàng đợi kiểm tra fair play</h2>
        </div>
      </div>

      <div className="admin-filter-bar">
        <label>
          <span><Filter size={15} /> Trạng thái</span>
          <select value={filters.status} onChange={(event) => onFilterChange({ status: event.target.value })}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Risk tối thiểu</span>
          <select value={filters.minRisk} onChange={(event) => onFilterChange({ minRisk: Number(event.target.value) })}>
            <option value={0}>0+</option>
            <option value={40}>40+</option>
            <option value={60}>60+</option>
            <option value={80}>80+</option>
            <option value={90}>90+</option>
          </select>
        </label>
        <form onSubmit={(event) => {
          event.preventDefault();
          onFilterChange({ search: filters.search });
        }}>
          <Search size={15} />
          <input
            value={filters.search}
            onChange={(event) => onFilterChange({ search: event.target.value })}
            placeholder="Tìm band/status..."
          />
        </form>
      </div>

      <div className="admin-report-list">
        {reports.length === 0 && <p>Không có báo cáo anti-cheat phù hợp bộ lọc hiện tại.</p>}
        {reports.map((report) => {
          const details = report.details || {};
          const isBanned = Boolean(report.activeBan);
          return (
            <article className="admin-report-card" key={report.id}>
              <div>
                <strong>{report.users?.display_name || report.users?.email || report.user_id}</strong>
                <span>
                  Risk {report.risk_score}/100
                  {' | '}{details.band || 'cần review ván'}
                  {' | '}Engine {pct(report.engine_match_rate)}
                  {' | '}Critical {pct(details.criticalMatchRate)}
                  {' | '}Complex {pct(details.complexMatchRate)}
                  {' | '}Avg CPL {Math.round(details.averageCpLoss ?? 0)}
                </span>
                <small>{time(report.created_at)} | {report.status} | {details.guidance || 'Cần xem ngữ cảnh ván trước khi xử lý.'}</small>
                {isBanned && <b className="admin-ban-note">Đang bị cấm: {report.activeBan.reason}</b>}
                {report.appeal && (
                  <div className="admin-appeal-note">
                    <b>Khiếu nại: {report.appeal.status}</b>
                    <p>{report.appeal.message}</p>
                    {report.appeal.attachments?.map((attachment) => (
                      <a href={attachment.url || attachment.dataUrl} target="_blank" rel="noreferrer" key={attachment.id || attachment.name}>
                        {attachment.name || 'Bằng chứng đính kèm'}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="admin-report-actions">
                <button onClick={() => onUpdateReport(report.id, 'reviewed')}>Đã review</button>
                <button onClick={() => onUpdateReport(report.id, 'dismissed')}>Bỏ qua</button>
                <button onClick={() => onUpdateReport(report.id, 'actioned')}>Đánh dấu xử lý</button>
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

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        label="Phân trang anti-cheat"
      />
    </section>
  );
}
