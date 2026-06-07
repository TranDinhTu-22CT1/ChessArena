import React from 'react';
import { CreditCard, Database } from 'lucide-react';
import Pagination from '../../components/Pagination';
import { billingCycleLabel, paymentStatusLabel, tierLabel, time } from './adminUtils';

export default function PaymentsSection({
  payments,
  page,
  totalPages,
  onPageChange,
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
        {payments.length === 0 && <p className="admin-message">Chưa có dữ liệu thanh toán ở trang này.</p>}
        {payments.map((payment) => (
          <article className="admin-report-card" key={payment.user_id}>
            <div>
              <strong>{payment.users?.display_name || payment.users?.email || payment.user_id}</strong>
              <span>
                Gói: {tierLabel(payment.tier)}
                {' | '}Trạng thái: {paymentStatusLabel(payment.status)}
                {' | '}Chu kỳ: {billingCycleLabel(payment.billing_cycle)}
                {' | '}Mã đăng ký: {payment.provider_subscription_id || 'Chưa có'}
              </span>
              {payment.latestTransaction && (
                <small>
                  Giao dịch gần nhất: {payment.latestTransaction.status}
                  {' | '}{payment.latestTransaction.amount ?? '--'} {payment.latestTransaction.currency}
                  {' | '}{payment.transactionCount || 1} giao dịch
                </small>
              )}
              <small>Mã gói PayPal: {payment.provider_plan_id || '--'} | Gia hạn: {time(payment.current_period_end)} | Cập nhật: {time(payment.updated_at)}</small>
            </div>
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
