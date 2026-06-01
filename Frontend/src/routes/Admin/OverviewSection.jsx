import React from 'react';
import { Activity, CreditCard, Database, FileText, RefreshCw, Shield, ShieldAlert, Swords, Users } from 'lucide-react';
import StatCard from './StatCard';

export default function OverviewSection({ summary, loading, onLoad, onSectionChange }) {
  return (
    <>
      <section className="admin-stats admin-stats-wide">
        <StatCard icon={Users} label="Tổng người chơi" value={summary?.users} />
        <StatCard icon={Activity} label="Đang online" value={summary?.onlineUsers} />
        <StatCard icon={Swords} label="Trận đang chơi" value={summary?.onlineGames} />
        <StatCard icon={RefreshCw} label="Hàng đợi ghép trận" value={summary?.queueCount} />
        <StatCard icon={Swords} label="Trận hôm nay" value={summary?.todayGames} />
        <StatCard icon={ShieldAlert} label="Báo cáo chờ xử lý" value={summary?.openReports} tone="danger" />
        <StatCard icon={Shield} label="Báo cáo người chơi" value={summary?.openPlayerReports} tone={summary?.openPlayerReports ? 'danger' : ''} />
        <StatCard icon={Shield} label="Người chơi rủi ro cao" value={summary?.suspectedUsers} tone="danger" />
        <StatCard icon={CreditCard} label="Gói đang hoạt động" value={summary?.activeSubscriptions} />
        <StatCard icon={CreditCard} label="Thanh toán lỗi" value={summary?.failedPayments} tone="danger" />
        <StatCard icon={Database} label="Webhook" value={summary?.webhookConfigured ? 'Sẵn sàng' : 'Thiếu'} />
        <StatCard icon={Database} label="Supabase" value={summary?.supabaseStatus || '--'} />
        <StatCard icon={Database} label="Firebase" value={summary?.firebaseStatus || '--'} />
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span>Điều hành thời gian thực</span>
            <h2>Bảng điều khiển nhanh</h2>
          </div>
        </div>
        <div className="admin-ops-grid">
          <button onClick={() => onSectionChange('players')}><Users size={18} /> Quản lý người chơi</button>
          <button onClick={() => onSectionChange('matches')}><Swords size={18} /> Xem trận đấu</button>
          <button onClick={() => onSectionChange('fairplay')}><ShieldAlert size={18} /> Chống gian lận</button>
          <button onClick={() => onSectionChange('payments')}><CreditCard size={18} /> Thanh toán</button>
          <button onClick={() => onSectionChange('audit')}><FileText size={18} /> Nhật ký</button>
          <button onClick={onLoad} disabled={loading}><RefreshCw size={18} /> Tải lại dữ liệu</button>
        </div>
      </section>
    </>
  );
}
