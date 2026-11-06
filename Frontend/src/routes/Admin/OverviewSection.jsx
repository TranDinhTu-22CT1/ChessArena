import React from 'react';
import { Activity, ArrowUpRight, Bot, CheckCircle2, CreditCard, Database, Gauge, MessageSquare, ShieldAlert, Swords, Users } from 'lucide-react';
import { LoadingBlock } from '../../components/LoadingSpinner';
import StatCard from './StatCard';
import { time } from './adminUtils';

function waitLabel(value) {
  if (value == null) return '—';
  const ms = Math.round(Number(value));
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10_000 ? 1 : 2)} giây` : `${ms} ms`;
}
function quotaLabel(value, suffix) { return value ? `${value.toLocaleString('vi-VN')} ${suffix}` : 'Chưa đặt giới hạn'; }

export default function OverviewSection({ summary, admin, loading, onSectionChange }) {
  const matchmaking = summary?.matchmakingHealth;
  const chatLimits = summary?.chatRateLimits;
  const gateway = chatLimits?.gateway;
  const gatewayUsage = gateway?.requestsPerMinute ? Math.min(100, Math.round(((gateway.peakClientUsage || 0) / gateway.requestsPerMinute) * 100)) : 0;
  const attention = [
    { id: 'moderation', icon: ShieldAlert, label: 'Báo cáo vi phạm', count: summary?.openPlayerReports ?? summary?.openReports, hint: 'Đang chờ xem xét' },
    { id: 'support', icon: MessageSquare, label: 'Yêu cầu hỗ trợ', count: summary?.openSupportRequests, hint: 'Cần phản hồi người chơi' },
    { id: 'matches', icon: Swords, label: 'Trận cần kiểm tra', count: summary?.staleActiveGames, hint: 'Có dấu hiệu mất kết nối' },
    { id: 'payments', icon: CreditCard, label: 'Thanh toán lỗi', count: summary?.failedPayments, hint: 'Kiểm tra giao dịch PayPal' }
  ];
  const services = [['Cơ sở dữ liệu', summary?.supabaseStatus], ['Xác thực tài khoản', summary?.firebaseStatus], ['PayPal webhook', summary ? (summary.webhookConfigured ? 'Sẵn sàng' : 'Chưa cấu hình') : null]];

  if (loading && !summary) return <section className="admin-panel"><LoadingBlock label="Đang tải tổng quan quản trị" /></section>;
  return <>
    <section className="admin-stats admin-headline-stats" aria-label="Số liệu chính">
      <StatCard icon={Users} label="Tổng người chơi" value={summary?.users} />
      <StatCard icon={Activity} label="Đang trực tuyến" value={summary?.onlineUsers} />
      <StatCard icon={Swords} label="Trận hôm nay" value={summary?.todayGames} />
      <StatCard icon={CreditCard} label="Gói đang hoạt động" value={summary?.activeSubscriptions} />
    </section>
    <div className="admin-overview-columns">
      <section className="admin-panel">
        <div className="admin-panel-head"><div><span>Công việc</span><h2>Cần chú ý</h2></div><span className="admin-section-tag">Hiện tại</span></div>
        <div className="admin-attention-list">{attention.map(({ id, icon: Icon, label, count, hint }) => <button key={id} className="admin-attention-row" onClick={() => onSectionChange(id)}>
          <span className={`admin-attention-icon ${count > 0 ? 'needs-action' : ''}`}><Icon size={19} /></span>
          <span className="admin-attention-copy"><strong>{label}</strong><small>{hint}</small></span>
          <b className={count > 0 ? 'needs-action' : ''}>{count ?? '—'}</b><ArrowUpRight size={16} />
        </button>)}</div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head"><div><span>Hoạt động online</span><h2>Ghép trận & kết nối</h2></div><Activity size={20} /></div>
        <div className="admin-live-counts"><div><strong>{summary?.onlineGames ?? '—'}</strong><span>trận đang chơi</span></div><div><strong>{summary?.queueCount ?? '—'}</strong><span>người đang tìm trận</span></div></div>
        <div className="admin-services">{services.map(([label, status]) => <div key={label}><span><Database size={15} /> {label}</span><strong>{status || 'Chưa có dữ liệu'}</strong></div>)}</div>
      </section>
    </div>
    <section className="admin-panel">
      <div className="admin-panel-head"><div><span>Chất lượng trải nghiệm</span><h2>Hiệu quả ghép trận</h2></div><span className={`admin-section-tag ${matchmaking?.integrityIssues ? 'warning' : ''}`}><CheckCircle2 size={14} />{!matchmaking || matchmaking.available === false ? 'Chưa có dữ liệu' : matchmaking.integrityIssues ? 'Cần kiểm tra' : 'Ổn định'}</span></div>
      <dl className="admin-metric-grid">
        <div><dt>Tỷ lệ ghép thành công</dt><dd>{matchmaking?.successRate == null ? '—' : `${matchmaking.successRate}%`}</dd></div>
        <div><dt>Thời gian chờ P50</dt><dd>{waitLabel(matchmaking?.latestP50Ms)}</dd></div>
        <div><dt>Thời gian chờ P95</dt><dd>{waitLabel(matchmaking?.latestP95Ms)}</dd></div>
        <div><dt>Chênh lệch Elo trung bình</dt><dd>{matchmaking?.latestAverageRatingGap ?? '—'}</dd></div>
      </dl>
      <p className="admin-metric-note">P95 là mốc thời gian mà 95% lượt ghép gần nhất không phải chờ quá. Số liệu này đo thời gian tìm đối thủ.</p>
      <details className="admin-inline-details"><summary><Gauge size={16} /> Xem chỉ số chi tiết</summary><dl className="admin-metric-grid compact">
        <div><dt>Thời gian chờ P99</dt><dd>{waitLabel(matchmaking?.latestP99Ms)}</dd></div>
        <div><dt>Lượt đã ghép / đang chờ</dt><dd>{matchmaking?.matchedPlayers ?? '—'} / {matchmaking?.waitingEvents ?? '—'}</dd></div>
        <div><dt>Lỗi toàn vẹn trận đấu</dt><dd>{matchmaking?.integrityIssues ?? '—'}</dd></div>
        <div><dt>Sự kiện chờ gửi</dt><dd>{matchmaking?.pendingOutboxEvents ?? '—'}</dd></div>
      </dl></details>
    </section>
    <details className="admin-panel admin-system-details">
      <summary><span className="admin-details-icon"><Bot size={21} /></span><span><strong>AI Coach & giới hạn sử dụng</strong><small>Theo dõi lưu lượng và cấu hình model</small></span></summary>
      <div className="admin-details-body">
        <div className="admin-chat-gateway">
          <div className="admin-chat-gateway-copy"><Gauge size={20} /><div><strong>{gateway?.requestsPerMinute ?? '—'} yêu cầu/phút/người dùng</strong><span>{gateway?.trackingAvailable === false ? 'Chưa có dữ liệu sử dụng' : `${gateway?.requestsInWindow || 0} yêu cầu · ${gateway?.activeClients || 0} người dùng trong cửa sổ hiện tại`}</span></div></div>
          <div className="admin-chat-limit-progress" role="progressbar" aria-label="Mức sử dụng cao nhất" aria-valuenow={gatewayUsage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${gatewayUsage}%` }} /></div>
          <small>Mức dùng cao nhất: {gateway?.peakClientUsage || 0}/{gateway?.requestsPerMinute ?? '—'} · Chế độ {chatLimits?.providerMode || '—'}</small>
        </div>
        <div className="admin-chat-model-grid">{(chatLimits?.models || []).map((item) => <article className="admin-chat-model-card" key={`${item.provider}:${item.model}`}>
          <div><span>{item.provider}</span><strong className={item.configured ? 'configured' : 'missing'}>{item.configured ? 'Đã cấu hình' : 'Thiếu API key'}</strong></div><h3>{item.model}</h3>
          <dl><div><dt>Hiệu lực</dt><dd>{quotaLabel(item.effectiveRequestsPerMinute, 'RPM')}</dd></div><div><dt>Ứng dụng</dt><dd>{quotaLabel(item.applicationRequestsPerMinute, 'RPM')}</dd></div><div><dt>Nhà cung cấp/phút</dt><dd>{quotaLabel(item.requestsPerMinute, 'RPM')}</dd></div><div><dt>Nhà cung cấp/ngày</dt><dd>{quotaLabel(item.requestsPerDay, 'RPD')}</dd></div></dl>
        </article>)}</div>
        <p className="admin-metric-note">Thứ tự dự phòng: {(chatLimits?.providerOrder || []).join(' → ') || 'Chưa cấu hình'}. Hạn mức hiệu lực lấy số thấp hơn giữa ứng dụng và nhà cung cấp đã khai báo.</p>
      </div>
    </details>
    <p className="admin-session-note">Phiên của <strong>{admin?.email || 'quản trị viên'}</strong> · Vai trò: {admin?.role || '—'} · Hết hạn: {time(admin?.expiresAt)}</p>
  </>;
}
