import React from 'react';
import { Activity, CreditCard, Database, FileText, RefreshCw, Shield, ShieldAlert, Swords, Users } from 'lucide-react';
import StatCard from './StatCard';

export default function OverviewSection({ summary, loading, onLoad, onSectionChange }) {
  return (
    <>
      <section className="admin-stats admin-stats-wide">
        <StatCard icon={Users} label="Tong nguoi choi" value={summary?.users} />
        <StatCard icon={Activity} label="Dang online" value={summary?.onlineUsers} />
        <StatCard icon={Swords} label="Tran dang choi" value={summary?.onlineGames} />
        <StatCard icon={RefreshCw} label="Hang doi ghep tran" value={summary?.queueCount} />
        <StatCard icon={Swords} label="Tran hom nay" value={summary?.todayGames} />
        <StatCard icon={ShieldAlert} label="Bao cao cho xu ly" value={summary?.openReports} tone="danger" />
        <StatCard icon={Shield} label="Bao cao nguoi choi" value={summary?.openPlayerReports} tone={summary?.openPlayerReports ? 'danger' : ''} />
        <StatCard icon={Shield} label="Nguoi choi rui ro cao" value={summary?.suspectedUsers} tone="danger" />
        <StatCard icon={CreditCard} label="Goi dang hoat dong" value={summary?.activeSubscriptions} />
        <StatCard icon={CreditCard} label="Thanh toan loi" value={summary?.failedPayments} tone="danger" />
        <StatCard icon={Database} label="Webhook" value={summary?.webhookConfigured ? 'Ready' : 'Missing'} />
        <StatCard icon={Database} label="Supabase" value={summary?.supabaseStatus || '--'} />
        <StatCard icon={Database} label="Firebase" value={summary?.firebaseStatus || '--'} />
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <span>Dieu hanh thoi gian thuc</span>
            <h2>Bang dieu khien nhanh</h2>
          </div>
        </div>
        <div className="admin-ops-grid">
          <button onClick={() => onSectionChange('players')}><Users size={18} /> Quan ly nguoi choi</button>
          <button onClick={() => onSectionChange('matches')}><Swords size={18} /> Xem tran dau</button>
          <button onClick={() => onSectionChange('fairplay')}><ShieldAlert size={18} /> Anti-cheat</button>
          <button onClick={() => onSectionChange('payments')}><CreditCard size={18} /> Thanh toan</button>
          <button onClick={() => onSectionChange('audit')}><FileText size={18} /> Nhat ky</button>
          <button onClick={onLoad} disabled={loading}><RefreshCw size={18} /> Tai lai du lieu</button>
        </div>
      </section>
    </>
  );
}
