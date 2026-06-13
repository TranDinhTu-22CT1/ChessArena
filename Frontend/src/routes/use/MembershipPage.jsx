import React from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, Crown, Gem, Loader2, LogIn, ShieldCheck, Sparkles } from 'lucide-react';
import { activateMembership, fetchMembership } from '../../api/membership';
import {
  confirmMomoMembershipPayment,
  createMomoMembershipPayment,
  queryMomoMembershipPayment
} from '../../api/momo';
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
const PENDING_MOMO_ORDER_KEY = 'chessarena:pending-momo-order';
const MOMO_STATUS_POLL_INTERVAL_MS = 2000;
const MOMO_STATUS_POLL_ATTEMPTS = 90;

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

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
  const [checkoutTier, setCheckoutTier] = React.useState(null);
  const [message, setMessage] = React.useState('');
  const [prices, setPrices] = React.useState(EMPTY_PRICES);
  const [planHealth, setPlanHealth] = React.useState(null);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [momoLoading, setMomoLoading] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState('momo-atm');
  const momoReturnHandledRef = React.useRef('');
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
      const callbackPayload = new URLSearchParams(params);
      const callbackKey = callbackPayload.get('orderId') || callbackPayload.toString();
      if (!callbackKey || momoReturnHandledRef.current === callbackKey) return;
      momoReturnHandledRef.current = callbackKey;
      window.history.replaceState({}, '', window.location.pathname);
      setMessage('Đang đối chiếu kết quả giao dịch MoMo...');
      confirmMomoMembershipPayment(params)
        .then(() => {
          notify('Gói Premium (MoMo) đã được kích hoạt thành công!', 'success');
          return fetchMembership();
        })
        .then((nextMembership) => {
          window.localStorage.removeItem(PENDING_MOMO_ORDER_KEY);
          onMembershipUpdated(nextMembership);
          setMessage('Thanh toán MoMo đã được xác nhận và gói đã được cập nhật.');
        })
        .catch(async (error) => {
          const orderId = callbackPayload.get('orderId')
            || window.localStorage.getItem(PENDING_MOMO_ORDER_KEY);
          if (orderId) {
            try {
              await queryMomoMembershipPayment(orderId);
              const nextMembership = await fetchMembership();
              window.localStorage.removeItem(PENDING_MOMO_ORDER_KEY);
              onMembershipUpdated(nextMembership);
              setMessage('Thanh toán MoMo đã được đối soát và gói đã được cập nhật.');
              return;
            } catch {
              // Preserve the provider error below when reconciliation is not complete.
            }
          }
          setMessage(error.pending
            ? `${error.message} Hệ thống sẽ tiếp tục đối soát với MoMo, bạn không cần thanh toán lại ngay.`
            : error.message);
        });
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

  React.useEffect(() => {
    const orderId = window.localStorage.getItem(PENDING_MOMO_ORDER_KEY);
    if (!orderId || new URLSearchParams(window.location.search).get('momo') === 'return') return;
    queryMomoMembershipPayment(orderId)
      .then(() => fetchMembership())
      .then((nextMembership) => {
        window.localStorage.removeItem(PENDING_MOMO_ORDER_KEY);
        onMembershipUpdated(nextMembership);
        setMessage('Giao dịch MoMo đã được đối soát thành công.');
      })
      .catch((error) => {
        if (!error.pending && error.resultCode !== 1000) {
          window.localStorage.removeItem(PENDING_MOMO_ORDER_KEY);
        }
      });
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
    const paymentWindow = window.open('', 'chessarena-momo-atm', 'popup,width=1100,height=760');
    if (!paymentWindow) {
      const text = 'Trình duyệt đang chặn cửa sổ thanh toán. Hãy cho phép popup cho ChessArena rồi thử lại.';
      setMessage(text);
      notify(text, 'error');
      return;
    }

    paymentWindow.document.title = 'Đang mở cổng thanh toán MoMo...';
    paymentWindow.document.body.innerHTML = '<p style="font:16px system-ui;padding:24px">Đang kết nối cổng thanh toán ATM...</p>';
    setMomoLoading(true);
    setMessage('');
    try {
      const data = await createMomoMembershipPayment({
        tier: checkoutTier,
        billingCycle: cycle,
        paymentMethod: 'atm'
      });
      if (data.requestType !== 'payWithATM') {
        throw new Error('Kênh thanh toán MoMo được tạo không đúng. Vui lòng khởi động lại backend và thử lại.');
      }
      window.localStorage.setItem(PENDING_MOMO_ORDER_KEY, data.orderId);
      paymentWindow.location.replace(data.payUrl);
      setMessage('Cổng ATM đã mở ở cửa sổ riêng. ChessArena đang tự động đối soát giao dịch...');

      for (let attempt = 0; attempt < MOMO_STATUS_POLL_ATTEMPTS; attempt += 1) {
        await wait(MOMO_STATUS_POLL_INTERVAL_MS);
        try {
          await queryMomoMembershipPayment(data.orderId);
          const nextMembership = await fetchMembership();
          window.localStorage.removeItem(PENDING_MOMO_ORDER_KEY);
          onMembershipUpdated(nextMembership);
          if (!paymentWindow.closed) paymentWindow.close();
          setMessage('Thanh toán ATM thành công. Gói Premium đã được kích hoạt.');
          notify('Thanh toán ATM thành công!', 'success');
          return;
        } catch (statusError) {
          if (statusError.pending || statusError.resultCode === 1000) continue;
          throw statusError;
        }
      }

      setMessage('Giao dịch vẫn đang được xử lý. ChessArena sẽ tiếp tục đối soát khi bạn mở lại trang Premium.');
    } catch (error) {
      if (!paymentWindow.closed) paymentWindow.close();
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
              {paymentMethod.startsWith('momo-') ? vnd(checkoutMomoPrice) : currency(checkoutPrice)}
              <small>/{cycle === 'monthly' ? 'tháng' : 'năm'}</small>
            </strong>
            <ul className="checkout-benefits">
              {checkoutPlan.benefits.map((benefit) => (
                <li key={benefit}><CheckCircle2 size={20} /> {benefit}</li>
              ))}
            </ul>
          </div>

          <div className="checkout-payment">
            <h2>Chọn phương thức thanh toán</h2>
            <p>Hệ thống hiện đang sử dụng môi trường thử nghiệm (Sandbox) để đảm bảo an toàn cho mọi giao dịch.</p>

            <div className="payment-methods">
              <button className={paymentMethod === 'momo-atm' ? 'active' : ''} type="button" onClick={() => setPaymentMethod('momo-atm')}>Thẻ ATM</button>
              <button className={paymentMethod === 'paypal' ? 'active' : ''} type="button" onClick={() => setPaymentMethod('paypal')}>PayPal</button>
            </div>

            {paymentMethod === 'paypal' && (
              <button className="pay-btn paypal" onClick={startServerCheckout} disabled={checkoutLoading || checkoutBlocked}>
                {checkoutLoading ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
                {checkoutLoading ? 'Đang kết nối PayPal...' : 'Thanh toán qua PayPal'}
              </button>
            )}

            {paymentMethod.startsWith('momo-') && (
              <>
                <div className="momo-channel-summary">
                  <strong>Thanh toán bằng thẻ ATM nội địa</strong>
                  <span>MoMo sẽ mở form để bạn nhập số thẻ, ngày phát hành, tên chủ thẻ và số điện thoại.</span>
                </div>
                <button className="pay-btn momo" onClick={startMomoCheckout} disabled={momoLoading}>
                  {momoLoading ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
                  {momoLoading
                    ? 'Đang mở form thẻ ATM...'
                    : `Thanh toán bằng thẻ ATM · ${vnd(checkoutMomoPrice)}`}
                </button>
              </>
            )}

            <div className="checkout-technical-note">
              <strong>Thông tin kỹ thuật</strong>
              <div>Plan ID: {checkoutPlanId || 'Chưa cấu hình'}</div>
              <div>Trạng thái PayPal: {planHealth?.plan?.status || checkoutPrice?.status || 'Đang kiểm tra...'}</div>
              <div>Hỗ trợ MoMo: Tự động kích hoạt khi resultCode=0</div>
              <div>MoMo Sandbox: cổng ATM mở ở cửa sổ riêng; ChessArena tự đối soát kết quả và không làm mất phiên đăng nhập.</div>
            </div>

            {planHealthNote && <div className="sys-note">{planHealthNote}</div>}
            {!checkoutPrice?.value && paymentMethod === 'paypal' && <div className="sys-note">Cảnh báo: Không tìm thấy giá trị của gói từ PayPal. Tính năng thanh toán tạm khóa để tránh lỗi hệ thống.</div>}
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
                  <li key={benefit}><CheckCircle2 size={20} /> {benefit}</li>
                ))}
              </ul>

              <button
                className={`pm-btn ${isPopular && !isActive ? 'primary' : 'secondary'}`}
                disabled={isActive}
                onClick={() => {
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
