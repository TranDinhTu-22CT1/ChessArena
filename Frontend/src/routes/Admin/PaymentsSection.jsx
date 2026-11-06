import React from 'react';
import { CreditCard, Database } from 'lucide-react';
import { LoadingBlock } from '../../components/LoadingSpinner';
import Pagination from '../../components/Pagination';
import { billingCycleLabel, paymentStatusLabel, tierLabel, time } from './adminUtils';
import AdminFilterBar from './AdminFilterBar';

export default function PaymentsSection({
  payments,
  filters,
  loading = false,
  page,
  totalPages,
  onPageChange,
  onFiltersChange,
  paypalDiagnostics,
  onRunDiagnostics,
  onRunCreateTest
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Gói PayPal</span>
          <h2>Quản lý thanh toán</h2>
        </div>
        <div className="admin-inline-actions">
          <button onClick={onRunDiagnostics}><Database size={16} /> Kiểm tra gói</button>
          <button onClick={onRunCreateTest}><CreditCard size={16} /> Tạo thử</button>
        </div>
      </div>
      <AdminFilterBar value={filters} onApply={onFiltersChange} searchPlaceholder="Giao dịch, người dùng, mã PayPal…" selects={[
        { key: 'status', label: 'Trạng thái', options: [{ value: '', label: 'Tất cả' }, { value: 'active', label: 'Đang hoạt động' }, { value: 'cancelled', label: 'Đã hủy' }, { value: 'expired', label: 'Hết hạn' }, { value: 'past_due', label: 'Quá hạn' }, { value: 'pending', label: 'Đang chờ' }] },
        { key: 'provider', label: 'Phương thức', options: [{ value: '', label: 'Tất cả' }, { value: 'paypal', label: 'PayPal' }, { value: 'manual', label: 'Thủ công' }] },
        { key: 'tier', label: 'Gói', options: [{ value: '', label: 'Tất cả' }, { value: 'plus', label: 'Plus' }, { value: 'pro', label: 'Pro' }, { value: 'master', label: 'Master' }] }
      ]} />
      {paypalDiagnostics && (
        <div className="admin-diagnostic-grid">
          {paypalDiagnostics.diagnostics?.map((item) => (
            <div className={`admin-diagnostic-card ${item.ok ? 'ok' : 'danger'}`} key={`${item.tier}-${item.cycle}`}>
              <strong>{item.tier} {item.cycle}</strong>
              <span>{item.plan?.id || item.planId}</span>
              <small>{item.ok ? `${item.plan?.status} | ${item.plan?.value || '--'} ${item.plan?.currency || ''}` : item.error}</small>
            </div>
          ))}
        </div>
      )}
      <div className="admin-table-list">
        {loading && <LoadingBlock label="Đang tải dữ liệu thanh toán" />}
        {!loading && payments.length === 0 && <p className="admin-message">Chưa có dữ liệu thanh toán ở trang này.</p>}
        {payments.map((payment) => (
          <article className="admin-payment-card" key={payment.user_id}>
            <header><div><strong>{payment.users?.display_name || payment.users?.email || payment.user_id}</strong><span>{payment.users?.email || 'Chưa có email'}</span></div>
              <span className={`admin-payment-badge ${payment.status === 'active' ? 'active' : ''}`}>{tierLabel(payment.tier)} · {paymentStatusLabel(payment.status)}</span>
            </header>
            <dl className="admin-payment-facts">
              <div><dt>Chu kỳ</dt><dd>{billingCycleLabel(payment.billing_cycle)}</dd></div>
              <div><dt>{payment.cancel_at_period_end || payment.cancelled_at ? 'Quyền lợi đến' : 'Kỳ thanh toán tiếp theo'}</dt><dd>{time(payment.current_period_end)}</dd></div>
              <div><dt>Gia hạn</dt><dd>{payment.cancel_at_period_end || payment.cancelled_at ? 'Đã tắt' : payment.status === 'active' && payment.provider === 'paypal' ? 'Tự động qua PayPal' : 'Không hoạt động'}</dd></div>
            </dl>
            <details className="admin-inline-details"><summary>Chi tiết đăng ký & giao dịch</summary>
              <dl className="admin-payment-facts">
                <div><dt>Mã đăng ký</dt><dd>{payment.provider_subscription_id || 'Chưa có'}</dd></div>
                <div><dt>Mã gói PayPal</dt><dd>{payment.provider_plan_id || 'Chưa có'}</dd></div>
                <div><dt>Cập nhật</dt><dd>{time(payment.updated_at)}</dd></div>
              </dl>
              {payment.latestTransaction && <p>Giao dịch gần nhất: {payment.latestTransaction.status} · {payment.latestTransaction.amount ?? '--'} {payment.latestTransaction.currency} · {payment.transactionCount || 1} giao dịch</p>}
            </details>
          </article>
        ))}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        label="Phân trang thanh toán"
      />
    </section>
  );
}
