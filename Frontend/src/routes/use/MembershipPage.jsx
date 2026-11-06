import React from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, CreditCard, Crown, Gem, Loader2, LogIn, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { activateMembership, cancelMembership } from '../../api/membership';

import { cancelPendingPayPalCheckout, createPayPalSubscriptionCheckout, fetchPayPalPlan, fetchPayPalPlanPrices } from '../../api/paypalPlans';
import { notify } from '../../components/ToastHost';
import { activeTier, MEMBERSHIP_TIERS, PAID_TIERS } from '../../membership/plans';
import '../../styles/membership.css';

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
  const [checkoutTier, setCheckoutTier] = React.useState(null);
  const [message, setMessage] = React.useState('');
  const [prices, setPrices] = React.useState(EMPTY_PRICES);
  const [planHealth, setPlanHealth] = React.useState(null);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const approvedSubscription = React.useRef('');

  const currentTier = activeTier(membership);
  const renewing = Boolean(membership?.autoRenew && !membership?.cancelAtPeriodEnd && !membership?.cancelledAt);
  const periodEnd = membership?.currentPeriodEnd ? new Date(membership.currentPeriodEnd) : null;
  const periodLabel = periodEnd && Number.isFinite(periodEnd.getTime())
    ? periodEnd.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Đang cập nhật';

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
      cancelPendingPayPalCheckout().catch((error) => setMessage(error.message));
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (params.get('paypal') !== 'approved') return;

    const subscriptionId = params.get('subscription_id') || params.get('subscriptionID') || '';
    const approvedTier = params.get('tier') || '';
    const approvedCycle = params.get('cycle') || 'monthly';
    const planId = planIdFor(approvedTier, approvedCycle);
    if (!subscriptionId) {
      setMessage('Giao dịch PayPal đã được duyệt nhưng thiếu dữ liệu. Hệ thống sẽ tự đồng bộ sau.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (approvedSubscription.current === subscriptionId) return;
    approvedSubscription.current = subscriptionId;
    activateMembership({ tier: approvedTier, billingCycle: approvedCycle, planId, subscriptionId })
      .then((data) => {
        onMembershipUpdated(data);
        const active = data?.status === 'active';
        setMessage(active ? 'Thanh toán đã được xác nhận.' : 'PayPal đang xác nhận thanh toán. Quyền lợi sẽ được cập nhật sau khi thanh toán thành công.');
        notify(active ? 'Gói Premium đã được kích hoạt!' : 'Đang chờ PayPal xác nhận thanh toán.', active ? 'success' : 'info');
      })
      .catch((error) => setMessage(error.message))
      .finally(() => window.history.replaceState({}, '', window.location.pathname));
  }, [onMembershipUpdated]);

  const checkoutPlan = checkoutTier ? PLAN_COPY[checkoutTier] : null;
  const checkoutPrice = checkoutTier ? prices[checkoutTier][cycle] : null;

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
      setMessage(text);
      notify(text, 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const stopRenewal = async () => {
    setCancelLoading(true);
    try {
      const next = await cancelMembership();
      onMembershipUpdated(next);
      setConfirmCancel(false);
      setMessage('Đã tắt gia hạn. Bạn vẫn sử dụng đầy đủ quyền lợi đến hết kỳ đã thanh toán.');
    } catch (error) { setMessage(error.message); }
    finally { setCancelLoading(false); }
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
      <section className="membership-auth-required">
        <span className="membership-auth-icon"><Crown size={38} /></span>
        <h1>ChessArena Premium</h1>
        <p>Đăng nhập để sở hữu các đặc quyền chuyên sâu và tiếp tục nâng cao Elo.</p>
        <button onClick={onLogin}>
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
        <button className="checkout-back-btn" onClick={() => { setCheckoutTier(null); setMessage(''); }}>
          <ArrowLeft size={18} /> Quay lại bảng giá
        </button>

        <div className="checkout-container">
          <div className="checkout-summary">
            <span className="checkout-label">Hóa đơn của bạn</span>
            <h1><Icon size={32} /> Gói {checkoutPlan.title}</h1>
            <p>{checkoutPlan.tag}</p>
            <strong className="checkout-price-display">
              {currency(checkoutPrice)}
              <small>/{cycle === 'monthly' ? 'tháng' : 'năm'}</small>
            </strong>
            <ul className="checkout-benefits">
              {checkoutPlan.benefits.map((benefit) => (
                <li key={benefit}><CheckCircle2 size={20} /> {benefit}</li>
              ))}
            </ul>
          </div>

          <div className="checkout-payment">
            <h2>Đăng ký qua PayPal</h2>
            <p>Gói tự động gia hạn theo tháng hoặc năm. Bạn có thể tắt gia hạn bất cứ lúc nào và vẫn dùng đến hết kỳ đã thanh toán.</p>

            {(
              <button className="pay-btn paypal" onClick={startServerCheckout} disabled={checkoutLoading || checkoutBlocked}>
                {checkoutLoading ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
                {checkoutLoading ? 'Đang kết nối PayPal...' : 'Thanh toán qua PayPal'}
              </button>
            )}

            {planHealthNote && <div className="sys-note">{planHealthNote}</div>}
            {!checkoutPrice?.value && <div className="sys-note">Giá gói đang được cập nhật. Vui lòng thử lại sau.</div>}
            {currentTier !== 'free' && <p>Nâng cấp bắt đầu một kỳ thanh toán mới với giá gói cao hơn. Gia hạn của gói cũ sẽ được tắt sau khi thanh toán thành công; không hoàn phần kỳ cũ còn lại.</p>}
            {message && <div className="sys-note info">{message}</div>}
          </div>
        </div>
      </section>
    );
  }

  // TRANG BẢNG GIÁ (PRICING VIEW)
  return (
    <section className="modern-pricing-page">
      <div className="pm-hero">
        <div className="pm-hero-badge"><Crown size={16} /> Dành Cho Kỳ Thủ Đam Mê</div>
        <h1>Nâng Tầm Kỹ Năng Cờ Vua Của Bạn</h1>
        <p>Trải nghiệm miễn phí là bước khởi đầu. Nâng cấp Premium để mở khóa hệ thống phân tích chuyên sâu, thư viện bài tập khổng lồ và huấn luyện viên AI độc quyền giúp bạn bứt phá Elo.</p>
      </div>

      <section className={`membership-account-card ${renewing ? 'is-renewing' : ''}`} aria-label="Gói hiện tại của bạn">
        <div className="membership-account-head">
          <div className="membership-plan-identity">
            <span className="membership-plan-emblem"><Crown size={26} /></span>
            <div><span>Gói hiện tại của bạn</span><h2>{MEMBERSHIP_TIERS[currentTier].name}</h2></div>
          </div>
          <span className={`membership-status-pill ${renewing ? 'active' : ''}`}>
            {renewing ? <RefreshCw size={14} /> : <ShieldCheck size={14} />}
            {currentTier === 'free' ? 'Miễn phí' : renewing ? 'Tự động gia hạn' : 'Gia hạn đã tắt'}
          </span>
        </div>
        {currentTier !== 'free' ? <>
          <dl className="membership-account-facts">
            <div><dt><CalendarDays size={16} /> {renewing ? 'Lần gia hạn tiếp theo' : 'Quyền lợi được giữ đến'}</dt><dd>{periodLabel}</dd></div>
            <div><dt>Chu kỳ đăng ký</dt><dd>{membership?.billingCycle === 'yearly' ? 'Hàng năm' : 'Hàng tháng'}</dd></div>
            <div><dt>Thanh toán qua</dt><dd>{membership?.provider === 'paypal' ? 'PayPal' : 'Hệ thống'}</dd></div>
          </dl>
          <div className="membership-account-footer">
            <p><ShieldCheck size={18} /> {renewing ? 'Bạn có thể tắt gia hạn bất cứ lúc nào. Quyền lợi luôn được giữ đến hết kỳ đã thanh toán.' : 'Bạn vẫn sử dụng đầy đủ quyền lợi đến ngày trên. Gói này sẽ không tự thu tiền cho kỳ tiếp theo.'}</p>
            {membership?.provider === 'paypal' && renewing && !confirmCancel &&
              <button type="button" className="membership-manage-button" onClick={() => setConfirmCancel(true)}>Hủy gia hạn</button>}
          </div>
          {confirmCancel && renewing && <div className="membership-cancel-confirm" role="group" aria-label="Xác nhận tắt gia hạn">
            <div><strong>Tắt gia hạn cho kỳ tiếp theo?</strong><p>Bạn vẫn dùng gói {MEMBERSHIP_TIERS[currentTier].name} đến {periodLabel}.</p></div>
            <div className="membership-confirm-actions">
              <button type="button" disabled={cancelLoading} onClick={() => setConfirmCancel(false)}>Giữ đăng ký</button>
              <button type="button" className="confirm-stop" disabled={cancelLoading} onClick={stopRenewal}>
                {cancelLoading ? <Loader2 size={16} className="animate-spin" /> : null}{cancelLoading ? 'Đang tắt gia hạn...' : 'Xác nhận hủy gia hạn'}
              </button>
            </div>
          </div>}
        </> : <p className="membership-free-note">Bắt đầu luyện tập miễn phí, nâng cấp khi bạn cần thêm công cụ phân tích.</p>}
        {message && <p className="sys-note info" role="status">{message}</p>}
      </section>
      <div className="membership-checkout-help">
        <span>Còn giao dịch PayPal đang chờ?</span>
        <button type="button" disabled={checkoutLoading} onClick={async () => {
          setCheckoutLoading(true);
          try { await cancelPendingPayPalCheckout(); setMessage('Đã đóng giao dịch PayPal đang chờ. Bạn có thể chọn gói mới.'); }
          catch (error) { setMessage(error.message); }
          finally { setCheckoutLoading(false); }
        }}>Hủy giao dịch chưa hoàn tất</button>
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
          const isLower = PAID_TIERS.indexOf(tier) < PAID_TIERS.indexOf(currentTier);
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

              </div>

              <ul className="pm-benefits">
                {plan.benefits.map((benefit) => (
                  <li key={benefit}><CheckCircle2 size={20} /> {benefit}</li>
                ))}
              </ul>

              <button
                className={`pm-btn ${isPopular && !isActive ? 'primary' : 'secondary'}`}
                disabled={isActive || isLower}
                onClick={() => {
                  setCheckoutTier(tier);
                  setMessage('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {isActive ? 'Đang sử dụng' : isLower ? 'Đã có gói cao hơn' : 'Nâng cấp ngay'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="pm-free-tier">
        <div className="pm-free-info">
          <h3><ShieldCheck size={28} /> Gói tài khoản cơ bản</h3>
          <p>Tài khoản miễn phí giúp bạn làm quen với nền tảng và cách thức hoạt động của Chess Arena. Tuy nhiên, nếu bạn muốn luyện tập nghiêm túc, gói này sẽ có những giới hạn nhất định:</p>
        </div>
        <ul className="pm-free-list">
          {FREE_LIMITS.map((limit) => (
            <li key={limit}>
              <span className="pm-limit-dot" />
              {limit}
            </li>
          ))}
        </ul>
      </div>

    </section>
  );
}
