import React from 'react';
import { Activity, Bot, CreditCard, Database, FileText, Gauge, MessageSquare, RefreshCw, Shield, ShieldAlert, Swords, Users } from 'lucide-react';
import { LoadingBlock } from '../../components/LoadingSpinner';
import StatCard from './StatCard';

function quotaLabel(value, suffix, fallback = 'Chưa đặt giới hạn') {
  return value ? `${value.toLocaleString('vi-VN')} ${suffix}` : fallback;
}

function waitLabel(value) {
  const ms = Math.round(Number(value || 0));
  if (!ms) return '0 ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10_000 ? 1 : 2)} giây`;
  return `${ms} ms`;
}

export default function OverviewSection({ summary, admin, loading, onLoad, onSectionChange }) {
  const chatLimits = summary?.chatRateLimits;
  const matchmaking = summary?.matchmakingHealth;
  const gateway = chatLimits?.gateway;
  const gatewayUsage = gateway?.requestsPerMinute
    ? Math.min(100, Math.round(((gateway.peakClientUsage || 0) / gateway.requestsPerMinute) * 100))
    : 0;

  return (
    <>
      {loading && !summary && (
        <section className="admin-panel">
          <LoadingBlock label="Đang tải tổng quan admin" />
        </section>
      )}

      <section className="admin-stats admin-stats-wide">
        <StatCard icon={Users} label="Tổng người chơi" value={summary?.users} />
        <StatCard icon={Activity} label="Đang online" value={summary?.onlineUsers} />
        <StatCard icon={Swords} label="Trận đang chơi" value={summary?.onlineGames} />
        <StatCard icon={Swords} label="Trận có dấu hiệu treo" value={summary?.staleActiveGames} tone={summary?.staleActiveGames ? 'danger' : ''} />
        <StatCard icon={RefreshCw} label="Hàng đợi ghép trận" value={summary?.queueCount} />
        <StatCard icon={Swords} label="Trận hôm nay" value={summary?.todayGames} />
        <StatCard icon={Activity} label="Giải đang mở" value={summary?.openTournaments} />
        <StatCard icon={Activity} label="Giải sắp diễn ra" value={summary?.scheduledTournaments} />
        <StatCard icon={ShieldAlert} label="Báo cáo chờ xử lý" value={summary?.openReports} tone="danger" />
        <StatCard icon={Shield} label="Báo cáo người chơi" value={summary?.openPlayerReports} tone={summary?.openPlayerReports ? 'danger' : ''} />
        <StatCard icon={MessageSquare} label="Yêu cầu hỗ trợ" value={summary?.openSupportRequests} tone={summary?.openSupportRequests ? 'danger' : ''} />
        <StatCard icon={Shield} label="Người chơi rủi ro cao" value={summary?.suspectedUsers} tone="danger" />
        <StatCard icon={CreditCard} label="Gói đang hoạt động" value={summary?.activeSubscriptions} />
        <StatCard icon={CreditCard} label="Thanh toán lỗi" value={summary?.failedPayments} tone="danger" />
        <StatCard icon={Database} label="Webhook" value={summary?.webhookConfigured ? 'Sẵn sàng' : 'Thiếu'} />
        <StatCard icon={Database} label="Supabase" value={summary?.supabaseStatus || '--'} />
        <StatCard icon={Database} label="Firebase" value={summary?.firebaseStatus || '--'} />
        <StatCard icon={Gauge} label="Ghép trận P95" value={waitLabel(matchmaking?.latestP95Ms)} tone={(matchmaking?.latestP95Ms || 0) > 10_000 ? 'danger' : ''} />
        <StatCard icon={Gauge} label="Ghép trận P99" value={waitLabel(matchmaking?.latestP99Ms)} tone={(matchmaking?.latestP99Ms || 0) > 15_000 ? 'danger' : ''} />
        <StatCard icon={ShieldAlert} label="Match integrity" value={matchmaking?.integrityIssues || 0} tone={matchmaking?.integrityIssues ? 'danger' : ''} />
        <StatCard icon={Database} label="Outbox pending" value={matchmaking?.pendingOutboxEvents || 0} tone={(matchmaking?.pendingOutboxEvents || 0) > 100 ? 'danger' : ''} />
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span>Matchmaking production</span>
            <h2>Độ trễ và tính toàn vẹn</h2>
          </div>
        </div>
        <div className="admin-session-grid">
          <div><strong>Tỷ lệ ghép</strong><span>{matchmaking?.successRate ?? 100}%</span></div>
          <div><strong>Thời gian ghép P50</strong><span>{waitLabel(matchmaking?.latestP50Ms)}</span></div>
          <div><strong>Rating gap</strong><span>{matchmaking?.latestAverageRatingGap || 0} Elo</span></div>
          <div><strong>Matched events</strong><span>{matchmaking?.matchedPlayers || 0}</span></div>
          <div><strong>Waiting events</strong><span>{matchmaking?.waitingEvents || 0}</span></div>
          <div><strong>Trạng thái</strong><span>{matchmaking?.available === false ? 'Cần migration v2' : matchmaking?.integrityIssues ? 'Cần xử lý' : 'Ổn định'}</span></div>
        </div>
        <p className="admin-metric-note">
          Đây là thời gian chờ ghép trận, không phải ping mạng. P95 nghĩa là khoảng 95% lượt ghép trong bucket mới nhất chờ không quá mốc này.
        </p>
      </section>
      <section className="admin-panel admin-chat-limit-panel">
        <div className="admin-panel-head">
          <div>
            <span>AI Coach</span>
            <h2>Giới hạn model chat</h2>
          </div>
          <div className="admin-chat-limit-mode">
            <Bot size={17} />
            <span>{chatLimits?.providerMode || 'multi'}</span>
          </div>
        </div>

        <div className="admin-chat-gateway">
          <div className="admin-chat-gateway-copy">
            <Gauge size={20} />
            <div>
              <strong>{gateway?.requestsPerMinute || 20} yêu cầu/phút/người dùng</strong>
              <span>
                {gateway?.trackingAvailable === false
                  ? 'Chưa có dữ liệu sử dụng từ Supabase'
                  : `${gateway?.requestsInWindow || 0} yêu cầu trong cửa sổ hiện tại · ${gateway?.activeClients || 0} người dùng`}
              </span>
            </div>
          </div>
          <div className="admin-chat-limit-progress" aria-label={`Mức sử dụng cao nhất ${gatewayUsage}%`}>
            <span style={{ width: `${gatewayUsage}%` }} />
          </div>
          <small>Mức dùng cao nhất của một người dùng: {gateway?.peakClientUsage || 0}/{gateway?.requestsPerMinute || 20}</small>
        </div>

        <div className="admin-chat-model-grid">
          {(chatLimits?.models || []).map((item) => (
            <article className="admin-chat-model-card" key={`${item.provider}:${item.model}`}>
              <div>
                <span>{item.provider}</span>
                <strong className={item.configured ? 'configured' : 'missing'}>
                  {item.configured ? 'Đã cấu hình' : 'Thiếu API key'}
                </strong>
              </div>
              <h3>{item.model}</h3>
              <dl>
                <div>
                  <dt>Hiệu lực</dt>
                  <dd>{quotaLabel(item.effectiveRequestsPerMinute, 'RPM')}</dd>
                </div>
                <div>
                  <dt>Ứng dụng</dt>
                  <dd>{quotaLabel(item.applicationRequestsPerMinute, 'RPM')}</dd>
                </div>
                <div>
                  <dt>Provider/phút</dt>
                  <dd>{quotaLabel(item.requestsPerMinute, 'RPM', 'Chưa khai báo')}</dd>
                </div>
                <div>
                  <dt>Provider/ngày</dt>
                  <dd>{quotaLabel(item.requestsPerDay, 'RPD', 'Chưa khai báo')}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
        <p className="admin-chat-limit-note">
          Thứ tự chuyển dự phòng: {(chatLimits?.providerOrder || []).join(' → ') || 'Chưa cấu hình'}.
          Hạn mức hiệu lực lấy số thấp hơn giữa giới hạn ứng dụng và quota provider đã khai báo.
        </p>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span>Phiên quản trị</span>
            <h2>{admin?.email || 'Admin'}</h2>
          </div>
        </div>
        <div className="admin-session-grid">
          <div>
            <strong>Vai trò</strong>
            <span>Chủ hệ thống</span>
          </div>
          <div>
            <strong>Đăng nhập lúc</strong>
            <span>{admin?.expiresAt ? new Date(admin.expiresAt).toLocaleString('vi-VN') : '--'}</span>
          </div>
          <div>
            <strong>Quyền đang có</strong>
            <span>Toàn quyền quản trị</span>
          </div>
        </div>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span>Quản lý nhanh</span>
            <h2>Các việc admin hay dùng</h2>
          </div>
        </div>
        <div className="admin-ops-grid">
          <button onClick={() => onSectionChange('players')}><Users size={18} /> Quản lý người chơi</button>
          <button onClick={() => onSectionChange('matches')}><Swords size={18} /> Trận đấu & giải đấu</button>
          <button onClick={() => onSectionChange('fairplay')}><ShieldAlert size={18} /> Chống gian lận</button>
          <button onClick={() => onSectionChange('support')}><MessageSquare size={18} /> Hỗ trợ người chơi</button>
          <button onClick={() => onSectionChange('payments')}><CreditCard size={18} /> Thanh toán</button>
          <button onClick={() => onSectionChange('audit')}><FileText size={18} /> Nhật ký</button>
          <button onClick={onLoad} disabled={loading}><RefreshCw size={18} /> Tải lại dữ liệu</button>
        </div>
      </section>
    </>
  );
}
