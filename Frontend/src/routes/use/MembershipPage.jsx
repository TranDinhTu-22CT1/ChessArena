import React from 'react';
import { ArrowLeft, Brain, CheckCircle2, CreditCard, Crown, Gem, LogIn, Puzzle, ShieldCheck, Sparkles, Trophy, Zap } from 'lucide-react';
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

const PLAN_COPY = {
  plus: {
    icon: Sparkles,
    title: 'Plus',
    tag: 'Tập tactics đều mỗi ngày',
    benefits: ['10 game review cơ bản mỗi ngày', '80 puzzle mỗi ngày', 'Mở Puzzle Rush không giới hạn lượt', 'Hồ sơ có huy hiệu Plus']
  },
  pro: {
    icon: Gem,
    title: 'Pro',
    tag: 'Gói đáng mua nhất',
    benefits: ['Game review không giới hạn', 'Puzzle và Custom Puzzles không giới hạn', 'Explain Pro cho từng nước đi', 'Thống kê sau trận rõ hơn']
  },
  master: {
    icon: Crown,
    title: 'Master',
    tag: 'Cho người chơi nghiêm túc',
    benefits: ['Toàn bộ quyền lợi Pro', 'Coach định hướng luyện tập nâng cao', 'Huy hiệu Master nổi bật', 'Ưu tiên khi mở tính năng giải đấu']
  }
};

const FREE_LIMITS = [
  '5 puzzle mỗi ngày',
  '1 game review cơ bản mỗi ngày',
  'Không có Puzzle Rush',
  'Không có Custom Puzzles',
  'Không có Explain Pro'
];

const MOMO_PRICES = {
  plus: { monthly: 50000, yearly: 500000 },
  pro: { monthly: 100000, yearly: 1000000 },
  master: { monthly: 150000, yearly: 1500000 }
};

function currency(price) {
  if (!price?.value || !price?.currency) return 'Đang lấy giá PayPal';
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
  if (!planId) return 'Thiếu PayPal plan id cho gói này.';
  if (!planHealth) return 'Đang kiểm tra plan PayPal...';
  if (planHealth.ok === false) {
    return planHealth.error || 'Backend PayPal credential hiện tại không nhìn thấy plan này. Hãy dùng đúng PAYPAL_CLIENT_ID/PAYPAL_SECRET của app đã tạo plan, hoặc tạo lại plan dưới app đang cấu hình.';
  }
  if (planHealth.plan?.status && planHealth.plan.status !== 'ACTIVE') return `Plan đang ở trạng thái ${planHealth.plan.status}, cần ACTIVE.`;
  const planCurrency = planHealth.plan?.currency;
  if (planCurrency && planCurrency !== fallbackCurrency) {
    return `Plan dùng ${planCurrency}, SDK sẽ tải lại theo currency này.`;
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
      setMessage('Bạn đã hủy thanh toán PayPal.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    if (params.get('momo') === 'return') {
      confirmMomoMembershipPayment(params)
        .then(() => {
          notify('Gói MoMo đã được kích hoạt.', 'success');
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
      setMessage('PayPal đã approve nhưng chưa trả subscription_id. Webhook sẽ đồng bộ khi PayPal gửi sự kiện.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    activateMembership({ tier: approvedTier, billingCycle: approvedCycle, planId, subscriptionId })
      .then((data) => {
        onMembershipUpdated(data);
        notify('Gói PayPal đã được kích hoạt.', 'success');
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
      const text = error.message || 'PayPal Sandbox chưa tạo được subscription.';
      setMessage(`${text} Gói đang dùng plan ${checkoutPlanId}, currency ${checkoutPrice?.currency || PAYPAL_CURRENCY}.`);
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
      const text = error.message || 'MoMo Sandbox chưa tạo được thanh toán.';
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
      <section className="membership-auth-required">
        <Crown size={48} />
        <h1>Chess Arena Premium</h1>
        <p>Đăng nhập để mua gói, lưu quyền lợi và đồng bộ với hồ sơ người chơi.</p>
        <button onClick={onLogin}><LogIn size={18} /> Đăng nhập</button>
      </section>
    );
  }

  if (checkoutTier && checkoutPlan) {
    const Icon = checkoutPlan.icon;
    return (
      <section className="membership-page membership-checkout-page">
        <button className="membership-back" onClick={() => {
          setCheckoutTier(null);
          setMessage('');
        }}>
          <ArrowLeft size={18} /> Quay lại chọn gói
        </button>

        <section className="membership-payment-shell">
          <div className="membership-payment-summary">
            <span><CreditCard size={18} /> Thanh toán Sandbox</span>
            <div className="membership-payment-title">
              <Icon size={34} />
              <div>
                <h1>{checkoutPlan.title}</h1>
                <p>{checkoutPlan.tag}</p>
              </div>
            </div>
            <strong className="membership-price payment-price">
              {paymentMethod === 'momo' ? vnd(checkoutMomoPrice) : currency(checkoutPrice)}
              <small>/{cycle === 'monthly' ? 'tháng' : 'năm'}</small>
            </strong>
            <div className="membership-payment-meta">
              <span>Plan ID: <b>{checkoutPlanId || 'Chưa cấu hình'}</b></span>
              <span>Currency: <b>{checkoutPrice?.currency || PAYPAL_CURRENCY}</b></span>
              <span>Status: <b>{planHealth?.plan?.status || checkoutPrice?.status || 'Đang kiểm tra'}</b></span>
              <span>MoMo: <b>{vnd(checkoutMomoPrice)}</b></span>
            </div>
            {planHealthNote && <p className="membership-config-note">{planHealthNote}</p>}
            {!checkoutPrice?.value && <p className="membership-config-note">Không hiển thị giá fallback để tránh sai tiền. Backend phải đọc được giá thật từ PayPal plan trước khi thanh toán.</p>}
            <ul>
              {checkoutPlan.benefits.map((benefit) => (
                <li key={benefit}><CheckCircle2 size={17} /> {benefit}</li>
              ))}
            </ul>
          </div>

          <div className="membership-payment-card">
            <span>Hoàn tất đăng ký</span>
            <h2>{checkoutPlan.title} - {cycle === 'monthly' ? 'theo tháng' : 'theo năm'}</h2>
            <p>Chọn MoMo hoặc PayPal Sandbox. Backend sẽ tạo phiên thanh toán, ký bảo mật ở server và chuyển bạn sang trang thanh toán tương ứng.</p>
            <div className="membership-payment-methods" aria-label="Phương thức thanh toán">
              <button className={paymentMethod === 'momo' ? 'active' : ''} type="button" onClick={() => setPaymentMethod('momo')}>MoMo</button>
              <button className={paymentMethod === 'paypal' ? 'active' : ''} type="button" onClick={() => setPaymentMethod('paypal')}>PayPal</button>
            </div>
            {paymentMethod === 'paypal' && (
            <button
              className="membership-paypal-primary"
              onClick={startServerCheckout}
              disabled={checkoutLoading || checkoutBlocked}
            >
              <CreditCard size={18} />
              {checkoutLoading ? 'Đang mở PayPal...' : 'Sang trang thanh toán PayPal'}
            </button>
            )}
            {paymentMethod === 'momo' && (
            <button
              className="membership-momo-primary"
              onClick={startMomoCheckout}
              disabled={momoLoading}
            >
              <CreditCard size={18} />
              {momoLoading ? 'Đang mở MoMo...' : `Thanh toán MoMo ${vnd(checkoutMomoPrice)}`}
            </button>
            )}
            <p className="membership-config-note">MoMo dùng môi trường test và sẽ tự kích hoạt gói khi MoMo trả `resultCode=0` với chữ ký hợp lệ.</p>
            {message && <p className="membership-message">{message}</p>}
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="membership-page">
      <header className="membership-hero">
        <div>
          <span><Crown size={18} /> Chess Arena Premium</span>
          <h1>Nâng cấp để luyện cờ hiệu quả hơn</h1>
          <p>Học theo mô hình premium của các nền tảng lớn: Free chỉ đủ trải nghiệm cơ bản, còn gói trả phí mở review sâu, puzzle nhiều hơn, coach hữu ích hơn và thống kê rõ sau trận.</p>
        </div>
        <div className="membership-current">
          <strong>{MEMBERSHIP_TIERS[currentTier].name}</strong>
          <span>Gói hiện tại</span>
        </div>
      </header>

      <div className="membership-value-grid">
        <div><Brain size={22} /><strong>Game Review</strong><span>Biết nước sai, nước tốt và xem lại ván nhanh hơn.</span></div>
        <div><Puzzle size={22} /><strong>Puzzle</strong><span>Mở thêm Rush và Custom để luyện theo chủ đề.</span></div>
        <div><Trophy size={22} /><strong>Rating</strong><span>Gắn với leaderboard, lịch sử và kết quả sau trận.</span></div>
        <div><Zap size={22} /><strong>Coach</strong><span>Gợi ý sâu hơn theo thế cờ và cấp độ người chơi.</span></div>
      </div>

      <section className="membership-free-limits">
        <div>
          <ShieldCheck size={22} />
          <strong>Free vẫn chơi được, nhưng bị giới hạn</strong>
          <span>Giữ free đủ dùng thử sản phẩm, còn giá trị luyện tập nghiêm túc nằm ở Plus/Pro/Master.</span>
        </div>
        <ul>
          {FREE_LIMITS.map((limit) => <li key={limit}>{limit}</li>)}
        </ul>
      </section>

      <div className="billing-toggle" aria-label="Billing cycle">
        <button className={cycle === 'monthly' ? 'active' : ''} onClick={() => setCycle('monthly')}>Theo tháng</button>
        <button className={cycle === 'yearly' ? 'active' : ''} onClick={() => setCycle('yearly')}>Theo năm <small>tiết kiệm 2 tháng</small></button>
      </div>

      <div className="membership-plans">
        {PAID_TIERS.map((tier) => {
          const plan = PLAN_COPY[tier];
          const Icon = plan.icon;
          const selected = selectedTier === tier;
          const active = currentTier === tier;
          return (
            <article className={`membership-plan ${selected ? 'selected' : ''} ${active ? 'active' : ''}`} key={tier}>
              <div className="membership-plan-head">
                <Icon size={28} />
                <div>
                  <span>{plan.tag}</span>
                  <h2>{plan.title}</h2>
                </div>
              </div>
              <strong className="membership-price">{currency(prices[tier][cycle])}<small>{prices[tier][cycle]?.value ? `/${cycle === 'monthly' ? 'tháng' : 'năm'}` : ''}</small></strong>
              <ul>
                {plan.benefits.map((benefit) => (
                  <li key={benefit}><CheckCircle2 size={17} /> {benefit}</li>
                ))}
              </ul>
              <button className="membership-select" onClick={() => {
                setSelectedTier(tier);
                if (!active) {
                  setCheckoutTier(tier);
                  setMessage('');
                }
              }}>
                {active ? 'Đang dùng' : 'Chọn gói'}
              </button>
            </article>
          );
        })}
      </div>

      <section className="membership-checkout">
        <div>
          <span>Bước tiếp theo</span>
          <h2>{PLAN_COPY[selectedTier].title} - {cycle === 'monthly' ? 'theo tháng' : 'theo năm'}</h2>
          <p>Giá hiển thị được lấy từ PayPal plan qua backend. Nhấn tiếp tục để sang trang thanh toán riêng, xem lại gói và hoàn tất bằng PayPal Sandbox.</p>
        </div>
        <button className="membership-checkout-button" onClick={() => {
          setCheckoutTier(selectedTier);
          setMessage('');
        }}>
          Tiếp tục thanh toán <CreditCard size={18} />
        </button>
      </section>
    </section>
  );
}
