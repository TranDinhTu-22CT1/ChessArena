import React from 'react';
import { CreditCard, Database } from 'lucide-react';
import { billingCycleLabel, paymentStatusLabel, tierLabel, time } from './adminUtils';

export default function PaymentsSection({
  payments,
  paypalDiagnostics,
  onRunDiagnostics,
  onRunCreateTest
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Goi PayPal</span>
          <h2>Quan ly thanh toan</h2>
        </div>
        <div className="admin-inline-actions">
          <button onClick={onRunDiagnostics}><Database size={16} /> Kiem tra goi</button>
          <button onClick={onRunCreateTest}><CreditCard size={16} /> Tao thu</button>
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
        {payments.map((payment) => (
          <article className="admin-report-card" key={payment.user_id}>
            <div>
              <strong>{payment.users?.display_name || payment.users?.email || payment.user_id}</strong>
              <span>
                Goi: {tierLabel(payment.tier)}
                {' | '}Trang thai: {paymentStatusLabel(payment.status)}
                {' | '}Chu ky: {billingCycleLabel(payment.billing_cycle)}
                {' | '}Ma dang ky: {payment.provider_subscription_id || 'Chua co'}
              </span>
              <small>Ma goi PayPal: {payment.provider_plan_id || '--'} | Gia han: {time(payment.current_period_end)} | Cap nhat: {time(payment.updated_at)}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
