import React from 'react';
import { ArrowLeft, Brain, CheckCircle2, CreditCard, Crown, Gem, Loader2, LogIn, Puzzle, ShieldCheck, Sparkles, Trophy, Zap } from 'lucide-react';
import { activateMembership, fetchMembership } from '../../api/membership';
import { confirmMomoMembershipPayment, createMomoMembershipPayment } from '../../api/momo';
import { createPayPalSubscriptionCheckout, fetchPayPalPlan, fetchPayPalPlanPrices } from '../../api/paypalPlans';
import { notify } from '../../components/ToastHost';
import { activeTier, MEMBERSHIP_TIERS, PAID_TIERS } from '../../membership/plans';

const PAYPAL_CURRENCY = import.meta.env.VITE_PAYPAL_CURRENCY || 'USD';
const PAYPAL_PLAN_IDS = {
  plus: {
    monthly: import.meta.env.VITE_PAYPAL_PLUS_MONTHLY_PLAN_ID || '',
    yearly: import.meta.env.VITE_PAYPAL_PLUS_YEARLY_PLAN_ID || ''
  },
  pro: {
    monthly: import.meta.env.VITE_PAYPAL_PRO_MONTHLY_PLAN_ID || '',
    yearly: import.meta.env.VITE_PAYPAL_PRO_YEARLY_PLAN_ID || ''
  },
  master: {
    monthly: import.meta.env.VITE_PAYPAL_MASTER_MONTHLY_PLAN_ID || '',
    yearly: import.meta.env.VITE_PAYPAL_MASTER_YEARLY_PLAN_ID || ''
  }
};

const EMPTY_PRICES = {
  plus: { monthly: null, yearly: null },
  pro: { monthly: null, yearly: null },
  master: { monthly: null, yearly: null }
};

// Đã tối ưu lại Copywriting cho chuẩn tiếng Việt và hấp dẫn hơn
const PLAN_COPY = {
  plus: {
    icon: Sparkles,
    title: 'Plus',
    tag: 'Khởi động nhẹ nhàng',
    benefits: ['10 lần phân tích ván đấu (Game Review)/ngày', 'Mở khóa 80 bài tập chiến thuật (Puzzle)/ngày', 'Không giới hạn lượt chơi Puzzle Rush', 'Sở hữu huy hiệu Plus độc quyền']
  },
  pro: {
    icon: Gem,
    title: 'Pro',
    tag: 'Lựa chọn phổ biến nhất',
    benefits: ['Phân tích ván đấu (Game Review) không giới hạn', 'Không giới hạn Puzzle & Custom Puzzles', 'Mở khóa Explain Pro cho từng nước đi', 'Báo cáo thống kê chuyên sâu sau trận']
  },
  master: {
    icon: Crown,
    title: 'Master',
    tag: 'Đẳng cấp kiện tướng',
    benefits: ['Bao gồm toàn bộ đặc quyền của gói Pro', 'Huấn luyện viên AI định hướng lộ trình riêng', 'Huy hiệu Master danh giá', 'Quyền ưu tiên trải nghiệm tính năng mới']
  }
};

const FREE_LIMITS = [
  'Chỉ 5 bài tập chiến thuật (Puzzle) mỗi ngày',
  'Giới hạn 1 lần phân tích ván đấu (Game Review)',
  'Khóa chế độ sinh tồn Puzzle Rush',
  'Khóa tính năng luyện tập Custom Puzzles',
  'Không được hỗ trợ giải thích nước đi (Explain Pro)'
];

const MOMO_PRICES = {
  plus: { monthly: 125000, yearly: 1250000 },
  pro: { monthly: 250000, yearly: 2500000 },
  master: { monthly: 500000, yearly: 5000000 }
};

function currency(price) {
  if (!price?.value || !price?.currency) return 'Đang cập nhật...';
  const value = Number(price?.value ?? 0);
  const code = price?.currency || 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(value);
}

function vnd(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function planIdFor(tier, cycle) {
  return PAYPAL_PLAN_IDS[tier]?.[cycle] || '';
}

function mergePlanPrices(current, remote) {
  const next = { ...current };
  for (const tier of PAID_TIERS) {
    next[tier] = { ...current[tier] };
    for (const cycle of ['monthly', 'yearly']) {
      next[tier][cycle] = remote?.[tier]?.[cycle]?.value ? remote[tier][cycle] : null;
    }
  }
  return next;
}

function planHealthMessage(planId, planHealth, fallbackCurrency) {
  if (!planId) return 'Chưa cấu hình PayPal Plan ID cho gói này.';
  if (!planHealth) return 'Đang đồng bộ dữ liệu từ PayPal...';
  if (planHealth.ok === false) {
    return planHealth.error || 'Lỗi kết nối PayPal. Vui lòng kiểm tra lại cấu hình Client ID/Secret.';
  }
  if (planHealth.plan?.status && planHealth.plan.status !== 'ACTIVE') return `Gói hiện tại đang ở trạng thái ${planHealth.plan.status} (Yêu cầu ACTIVE).`;
  const planCurrency = planHealth.plan?.currency;
  if (planCurrency && planCurrency !== fallbackCurrency) {
    return `Gói đang sử dụng tiền tệ ${planCurrency}.`;
  }
  return '';
}

export default function MembershipPage({ authUser, membership, onLogin, onMembershipUpdated }) {
  const [cycle, setCycle] = React.useState('monthly');
  const [selectedTier, setSelectedTier] = React.useState('pro');
  const [checkoutTier, setCheckoutTier] = React.useState(null);
  const [message, setMessage] = React.useState('');
  const [prices, setPrices] = React.useState(EMPTY_PRICES);
  const [planHealth, setPlanHealth] = React.useState(null);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [momoLoading, setMomoLoading] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState('momo');
  const currentTier = activeTier(membership);

  React.useEffect(() => {
    let ignore = false;
    fetchPayPalPlanPrices()
      .then((remotePrices) => {
        if (!ignore && remotePrices) {
          setPrices((current) => mergePlanPrices(current, remotePrices));
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paypal') === 'cancelled') {
      setMessage('Bạn đã hủy giao dịch thanh toán PayPal.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    if (params.get('momo') === 'return') {
      confirmMomoMembershipPayment(params)
        .then(() => {
          notify('Gói Premium (MoMo) đã được kích hoạt thành công!', 'success');
          return fetchMembership();
        })
        .then((nextMembership) => onMembershipUpdated(nextMembership))
        .catch((error) => setMessage(error.message))
        .finally(() => window.history.replaceState({}, '', window.location.pathname));
      return;
    }
    if (params.get('paypal') !== 'approved') return;

    const subscriptionId = params.get('subscription_id') || params.get('subscriptionID') || '';
    const approvedTier = params.get('tier') || '';
    const approvedCycle = params.get('cycle') || 'monthly';
    const planId = planIdFor(approvedTier, approvedCycle);
    if (!subscriptionId || !planId) {
      setMessage('Giao dịch PayPal đã được duyệt nhưng thiếu dữ liệu. Hệ thống sẽ tự đồng bộ sau.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    activateMembership({ tier: approvedTier, billingCycle: approvedCycle, planId, subscriptionId })
      .then((data) => {
        onMembershipUpdated(data);
        notify('Gói Premium (PayPal) đã được kích hoạt thành công!', 'success');
      })
      .catch((error) => setMessage(error.message))
      .finally(() => window.history.replaceState({}, '', window.location.pathname));
  }, [onMembershipUpdated]);

  const checkoutPlan = checkoutTier ? PLAN_COPY[checkoutTier] : null;
  const checkoutPrice = checkoutTier ? prices[checkoutTier][cycle] : null;
  const checkoutMomoPrice = checkoutTier ? MOMO_PRICES[checkoutTier]?.[cycle] : 0;
  const checkoutPlanId = checkoutTier ? planIdFor(checkoutTier, cycle) : '';
  const planHealthNote = checkoutTier ? planHealthMessage(checkoutPlanId, planHealth, checkoutPrice?.currency || PAYPAL_CURRENCY) : '';
  const checkoutBlocked = !checkoutPlanId
    || !checkoutPrice?.value
    || planHealth?.ok === false
    || planHealth?.plan?.status !== 'ACTIVE';

  const startServerCheckout = async () => {
    setCheckoutLoading(true);
    setMessage('');
    try {
      const data = await createPayPalSubscriptionCheckout({
        tier: checkoutTier,
        billingCycle: cycle,
        planId: checkoutPlanId
      });
      window.location.assign(data.approveUrl);
    } catch (error) {
      const text = error.message || 'Lỗi khởi tạo giao dịch PayPal Sandbox.';
      setMessage(`${text} ID: ${checkoutPlanId}, Tiền tệ: ${checkoutPrice?.currency || PAYPAL_CURRENCY}.`);
      notify(text, 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const startMomoCheckout = async () => {
    setMomoLoading(true);
    setMessage('');
    try {
      const data = await createMomoMembershipPayment({
        tier: checkoutTier,
        billingCycle: cycle
      });
      window.location.assign(data.payUrl);
    } catch (error) {
      const text = error.message || 'Lỗi khởi tạo giao dịch MoMo Sandbox.';
      setMessage(text);
      notify(text, 'error');
    } finally {
      setMomoLoading(false);
    }
  };

  React.useEffect(() => {
    if (!checkoutPlanId) {
      setPlanHealth(null);
      return undefined;
    }
    let ignore = false;
    setPlanHealth(null);
    fetchPayPalPlan(checkoutPlanId)
      .then((data) => {
        if (ignore) return;
        setPlanHealth(data);
        if (data?.plan?.value) {
          setPrices((current) => ({
            ...current,
            [checkoutTier]: {
              ...current[checkoutTier],
              [cycle]: data.plan
            }
          }));
        }
      })
      .catch((error) => {
        if (!ignore) setPlanHealth({ ok: false, error: error.message });
      });
    return () => {
      ignore = true;
    };
  }, [checkoutPlanId, checkoutTier, cycle]);

  if (!authUser) {
    return (
      <section className="membership-auth-required" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <Crown size={64} color="#abc854" style={{ marginBottom: '20px' }} />
        <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>Chess Arena Premium</h1>
        <p style={{ fontSize: '16px', color: 'var(--text-muted, #6b7280)', marginBottom: '32px' }}>Đăng nhập để sở hữu ngay các đặc quyền tối thượng và bứt phá Elo của bạn.</p>
        <button
          onClick={onLogin}
          style={{ padding: '14px 28px', fontSize: '16px', fontWeight: 'bold', background: '#abc854', color: '#000', border: 'none', borderRadius: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <LogIn size={20} /> Đăng nhập để tiếp tục
        </button>
      </section>
    );
  }

  // TRANG THANH TOÁN (CHECKOUT VIEW)
  if (checkoutTier && checkoutPlan) {
    const Icon = checkoutPlan.icon;
    return (
      <section className="modern-checkout-page">
        <style>{`
          .modern-checkout-page { max-width: 800px; margin: 0 auto; padding: 20px; font-family: inherit; }
          .checkout-back-btn { background: transparent; border: none; color: var(--text-muted, #6b7280); font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 24px; transition: color 0.2s; }
          .checkout-back-btn:hover { color: var(--text-adaptive, #111827); }
          .checkout-container { background: var(--bg-surface-adaptive, #ffffff); border: 1px solid var(--border-adaptive, #e5e7eb); border-radius: 24px; display: grid; grid-template-columns: 1fr 1fr; overflow: hidden; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.1); }
          @media (max-width: 768px) { .checkout-container { grid-template-columns: 1fr; } }

          .checkout-summary { background: linear-gradient(135deg, rgba(171, 200, 84, 0.1) 0%, rgba(135, 165, 59, 0.05) 100%); padding: 40px; border-right: 1px solid var(--border-adaptive, #e5e7eb); }
          .checkout-summary h1 { display: flex; alignItems: center; gap: 12px; font-size: 28px; margin: 0 0 8px 0; color: var(--text-adaptive, #111827); }
          .checkout-summary p { color: var(--text-muted, #6b7280); font-size: 15px; margin: 0 0 24px 0; }
          .checkout-price-display { font-size: 40px; font-weight: 900; color: var(--text-adaptive, #111827); margin-bottom: 32px; display: block; }
          .checkout-price-display small { font-size: 16px; color: var(--text-muted, #6b7280); font-weight: 600; }
          .checkout-benefits { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 16px; }
          .checkout-benefits li { display: flex; align-items: flex-start; gap: 12px; font-size: 15px; font-weight: 500; color: var(--text-adaptive, #374151); line-height: 1.4; }

          .checkout-payment { padding: 40px; }
          .checkout-payment h2 { font-size: 20px; margin: 0 0 8px 0; color: var(--text-adaptive, #111827); }
          .checkout-payment > p { color: var(--text-muted, #6b7280); font-size: 14px; margin: 0 0 24px 0; line-height: 1.5; }

          .payment-methods { display: flex; gap: 12px; margin-bottom: 24px; }
          .payment-methods button { flex: 1; padding: 14px; border: 2px solid var(--border-adaptive, #e5e7eb); background: transparent; border-radius: 12px; font-weight: 700; font-size: 15px; color: var(--text-muted, #6b7280); cursor: pointer; transition: all 0.2s; }
          .payment-methods button.active { border-color: #abc854; color: var(--text-adaptive, #111827); background: rgba(171, 200, 84, 0.1); }

          .pay-btn { width: 100%; padding: 16px; border: none; border-radius: 12px; font-weight: bold; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: opacity 0.2s; }
          .pay-btn:disabled { opacity: 0.6; cursor: not-allowed; }
          .pay-btn.momo { background: #ae2070; color: #ffffff; }
          .pay-btn.paypal { background: #003087; color: #ffffff; }
          .pay-btn:hover:not(:disabled) { opacity: 0.9; }

          .sys-note { font-size: 12px; color: #ef4444; background: #fee2e2; padding: 12px; border-radius: 8px; margin-top: 16px; line-height: 1.5; }
        `}</style>

        <button className="checkout-back-btn" onClick={() => { setCheckoutTier(null); setMessage(''); }}>
          <ArrowLeft size={18} /> Quay lại bảng giá
        </button>

        <div className="checkout-container">
          <div className="checkout-summary">
            <span style={{ display: 'inline-block', padding: '4px 12px', background: '#abc854', color: '#000', borderRadius: '99px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '16px' }}>Hóa đơn của bạn</span>
            <h1><Icon size={32} color="#abc854" /> Gói {checkoutPlan.title}</h1>
            <p>{checkoutPlan.tag}</p>
            <strong className="checkout-price-display">
              {paymentMethod === 'momo' ? vnd(checkoutMomoPrice) : currency(checkoutPrice)}
              <small>/{cycle === 'monthly' ? 'tháng' : 'năm'}</small>
            </strong>
            <ul className="checkout-benefits">
              {checkoutPlan.benefits.map((benefit) => (
                <li key={benefit}><CheckCircle2 size={20} color="#abc854" style={{ flexShrink: 0 }} /> {benefit}</li>
              ))}
            </ul>
          </div>

          <div className="checkout-payment">
            <h2>Chọn phương thức thanh toán</h2>
            <p>Hệ thống hiện đang sử dụng môi trường thử nghiệm (Sandbox) để đảm bảo an toàn cho mọi giao dịch.</p>

            <div className="payment-methods">
              <button className={paymentMethod === 'momo' ? 'active' : ''} type="button" onClick={() => setPaymentMethod('momo')}>Ví MoMo</button>
              <button className={paymentMethod === 'paypal' ? 'active' : ''} type="button" onClick={() => setPaymentMethod('paypal')}>PayPal</button>
            </div>

            {paymentMethod === 'paypal' && (
              <button className="pay-btn paypal" onClick={startServerCheckout} disabled={checkoutLoading || checkoutBlocked}>
                {checkoutLoading ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
                {checkoutLoading ? 'Đang kết nối PayPal...' : 'Thanh toán qua PayPal'}
              </button>
            )}

            {paymentMethod === 'momo' && (
              <button className="pay-btn momo" onClick={startMomoCheckout} disabled={momoLoading}>
                {momoLoading ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
                {momoLoading ? 'Đang tạo mã QR MoMo...' : `Thanh toán ${vnd(checkoutMomoPrice)}`}
              </button>
            )}

            <div style={{ marginTop: '24px', fontSize: '13px', color: 'var(--text-muted, #6b7280)', background: 'var(--bg-input-adaptive, #f9fafb)', padding: '16px', borderRadius: '12px' }}>
              <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--text-adaptive, #374151)' }}>Thông tin kỹ thuật (Log):</strong>
              <div>Plan ID: {checkoutPlanId || 'Chưa cấu hình'}</div>
              <div>Trạng thái PayPal: {planHealth?.plan?.status || checkoutPrice?.status || 'Đang kiểm tra...'}</div>
              <div>Hỗ trợ MoMo: Tự động kích hoạt khi resultCode=0</div>
            </div>

            {planHealthNote && <div className="sys-note">{planHealthNote}</div>}
            {!checkoutPrice?.value && paymentMethod === 'paypal' && <div className="sys-note">Cảnh báo: Không tìm thấy giá trị của gói từ PayPal. Tính năng thanh toán tạm khóa để tránh lỗi hệ thống.</div>}
            {message && <div className="sys-note" style={{ background: '#e0e7ff', color: '#4338ca' }}>{message}</div>}
          </div>
        </div>
      </section>
    );
  }

  // TRANG BẢNG GIÁ (PRICING VIEW)
  return (
    <section className="modern-pricing-page">
      <style>{`
        /* CSS GIAO DIỆN BẢNG GIÁ HIỆN ĐẠI */
        :root {
          --pm-green: #abc854;
          --pm-green-dark: #87a53b;
        }

        .modern-pricing-page { max-width: 1100px; margin: 0 auto; padding: 20px 0; font-family: inherit; }

        .pm-hero { text-align: center; margin-bottom: 48px; }
        .pm-hero-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(171, 200, 84, 0.15); color: var(--pm-green-dark); padding: 8px 16px; border-radius: 99px; font-weight: 800; font-size: 14px; text-transform: uppercase; margin-bottom: 16px; }
        .pm-hero h1 { font-size: 40px; font-weight: 900; color: var(--text-adaptive, #111827); margin: 0 0 16px 0; }
        .pm-hero p { font-size: 16px; color: var(--text-muted, #6b7280); max-width: 700px; margin: 0 auto; line-height: 1.6; }
        .pm-current-status { margin-top: 24px; display: inline-block; background: var(--bg-surface-adaptive, #ffffff); border: 1px solid var(--border-adaptive, #e5e7eb); padding: 12px 24px; border-radius: 12px; font-weight: 600; font-size: 15px; color: var(--text-adaptive, #374151); box-shadow: 0 4px 10px rgba(0,0,0,0.03); }
        .pm-current-status strong { color: var(--pm-green-dark); margin-left: 8px; font-size: 16px; }

        .pm-toggle-wrapper { display: flex; justify-content: center; margin-bottom: 48px; }
        .pm-toggle { display: inline-flex; background: var(--bg-input-adaptive, #f3f4f6); padding: 4px; border-radius: 99px; border: 1px solid var(--border-adaptive, #e5e7eb); }
        .pm-toggle button { background: transparent; border: none; padding: 12px 24px; border-radius: 99px; font-weight: 700; font-size: 15px; color: var(--text-muted, #6b7280); cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
        .pm-toggle button.active { background: var(--bg-surface-adaptive, #ffffff); color: var(--text-adaptive, #111827); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .pm-toggle-save { background: #dcfce7; color: #166534; font-size: 11px; padding: 2px 8px; border-radius: 6px; font-weight: 800; text-transform: uppercase; }

        .pm-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 64px; align-items: center; }
        @media (max-width: 900px) { .pm-grid { grid-template-columns: 1fr; align-items: stretch; } }

        .pm-card { background: var(--bg-surface-adaptive, #ffffff); border: 1px solid var(--border-adaptive, #e5e7eb); border-radius: 24px; padding: 32px; display: flex; flex-direction: column; transition: all 0.3s ease; position: relative; }
        .pm-card:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.08); }

        .pm-card.popular { border: 2px solid var(--pm-green); transform: scale(1.05); box-shadow: 0 20px 40px rgba(171, 200, 84, 0.15); z-index: 2; }
        @media (max-width: 900px) { .pm-card.popular { transform: scale(1); } }
        .pm-card.popular:hover { transform: scale(1.05) translateY(-4px); }

        .popular-badge { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--pm-green); color: #000; padding: 6px 16px; border-radius: 99px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 10px rgba(171, 200, 84, 0.4); }

        .pm-card-head { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
        .pm-card-icon { width: 56px; height: 56px; border-radius: 16px; background: rgba(171, 200, 84, 0.1); display: flex; justify-content: center; align-items: center; color: var(--pm-green-dark); }
        .pm-card-head h2 { margin: 0; font-size: 24px; font-weight: 800; color: var(--text-adaptive, #111827); }
        .pm-card-head p { margin: 4px 0 0 0; font-size: 13px; color: var(--text-muted, #6b7280); font-weight: 600; }

        .pm-price-block { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border-adaptive, #e5e7eb); }
        .pm-price { font-size: 36px; font-weight: 900; color: var(--text-adaptive, #111827); display: block; line-height: 1; }
        .pm-price small { font-size: 15px; font-weight: 600; color: var(--text-muted, #6b7280); margin-left: 4px; }
        .pm-momo-price { font-size: 13px; color: var(--text-muted, #6b7280); display: block; margin-top: 8px; font-weight: 500; }

        .pm-benefits { list-style: none; padding: 0; margin: 0 0 32px 0; display: flex; flex-direction: column; gap: 16px; flex: 1; }
        .pm-benefits li { display: flex; align-items: flex-start; gap: 12px; font-size: 14px; font-weight: 500; color: var(--text-adaptive, #374151); line-height: 1.5; }

        .pm-btn { width: 100%; padding: 14px; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; text-align: center; border: none; transition: all 0.2s; }
        .pm-btn.primary { background: var(--pm-green); color: #000; box-shadow: 0 4px 12px rgba(171, 200, 84, 0.2); }
        .pm-btn.primary:hover { background: var(--pm-green-dark); }
        .pm-btn.secondary { background: var(--bg-input-adaptive, #f3f4f6); color: var(--text-adaptive, #111827); }
        .pm-btn.secondary:hover { background: var(--border-adaptive, #e5e7eb); }
        .pm-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Free Tier Note */
        .pm-free-tier { background: var(--bg-surface-adaptive, #ffffff); border: 1px solid var(--border-adaptive, #e5e7eb); border-radius: 24px; padding: 40px; display: flex; gap: 40px; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
        @media (max-width: 768px) { .pm-free-tier { flex-direction: column; gap: 24px; text-align: center; } .pm-free-tier ul { margin: 0 auto; } }
        .pm-free-info h3 { font-size: 24px; font-weight: 800; margin: 0 0 12px 0; display: flex; align-items: center; gap: 12px; color: var(--text-adaptive, #111827); }
        @media (max-width: 768px) { .pm-free-info h3 { justify-content: center; } }
        .pm-free-info p { color: var(--text-muted, #6b7280); font-size: 15px; line-height: 1.6; margin: 0; }
        .pm-free-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; min-width: 300px; }
        .pm-free-list li { display: flex; align-items: center; gap: 12px; font-size: 14px; color: var(--text-adaptive, #4b5563); font-weight: 500; }
      `}</style>

      <div className="pm-hero">
        <div className="pm-hero-badge"><Crown size={16} /> Dành Cho Kỳ Thủ Đam Mê</div>
        <h1>Nâng Tầm Kỹ Năng Cờ Vua Của Bạn</h1>
        <p>Trải nghiệm miễn phí là bước khởi đầu. Nâng cấp Premium để mở khóa hệ thống phân tích chuyên sâu, thư viện bài tập khổng lồ và huấn luyện viên AI độc quyền giúp bạn bứt phá Elo.</p>
        <div className="pm-current-status">
          Gói hiện tại của bạn: <strong>{MEMBERSHIP_TIERS[currentTier].name}</strong>
        </div>
      </div>

      <div className="pm-toggle-wrapper">
        <div className="pm-toggle">
          <button className={cycle === 'monthly' ? 'active' : ''} onClick={() => setCycle('monthly')}>Thanh toán hàng tháng</button>
          <button className={cycle === 'yearly' ? 'active' : ''} onClick={() => setCycle('yearly')}>
            Thanh toán hàng năm <span className="pm-toggle-save">Tiết kiệm 16%</span>
          </button>
        </div>
      </div>

      <div className="pm-grid">
        {PAID_TIERS.map((tier) => {
          const plan = PLAN_COPY[tier];
          const Icon = plan.icon;
          const isActive = currentTier === tier;
          const isPopular = tier === 'pro';

          return (
            <div className={`pm-card ${isPopular ? 'popular' : ''}`} key={tier}>
              {isPopular && <div className="popular-badge">Được khuyên dùng</div>}

              <div className="pm-card-head">
                <div className="pm-card-icon"><Icon size={28} /></div>
                <div>
                  <h2>{plan.title}</h2>
                  <p>{plan.tag}</p>
                </div>
              </div>

              <div className="pm-price-block">
                <strong className="pm-price">
                  {currency(prices[tier][cycle])}
                  <small>{prices[tier][cycle]?.value ? `/${cycle === 'monthly' ? 'tháng' : 'năm'}` : ''}</small>
                </strong>
                <span className="pm-momo-price">Hoặc thanh toán ví MoMo: {vnd(MOMO_PRICES[tier]?.[cycle])}</span>
              </div>

              <ul className="pm-benefits">
                {plan.benefits.map((benefit) => (
                  <li key={benefit}><CheckCircle2 size={20} color="#abc854" style={{ flexShrink: 0 }} /> {benefit}</li>
                ))}
              </ul>

              <button
                className={`pm-btn ${isPopular && !isActive ? 'primary' : 'secondary'}`}
                disabled={isActive}
                onClick={() => {
                  setSelectedTier(tier);
                  setCheckoutTier(tier);
                  setMessage('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {isActive ? 'Đang sử dụng' : 'Nâng cấp ngay'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="pm-free-tier">
        <div className="pm-free-info">
          <h3><ShieldCheck size={28} color="#9ca3af" /> Gói Tài Khoản Cơ Bản</h3>
          <p>Tài khoản miễn phí giúp bạn làm quen với nền tảng và cách thức hoạt động của Chess Arena. Tuy nhiên, nếu bạn muốn luyện tập nghiêm túc, gói này sẽ có những giới hạn nhất định:</p>
        </div>
        <ul className="pm-free-list">
          {FREE_LIMITS.map((limit) => (
            <li key={limit}>
              <div style={{ width: '6px', height: '6px', background: '#9ca3af', borderRadius: '50%' }}></div>
              {limit}
            </li>
          ))}
        </ul>
      </div>

    </section>
  );
}
