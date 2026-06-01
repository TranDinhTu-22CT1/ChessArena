import React from 'react';
import { ArrowLeft, Brain, CheckCircle2, CreditCard, Crown, Gem, LogIn, Puzzle, ShieldCheck, Sparkles, Trophy, Zap } from 'lucide-react';
import { activateMembership } from '../../api/membership';
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
    tag: 'Táº­p tactics Ä‘á»u má»—i ngĂ y',
    benefits: ['10 game review cÆ¡ báº£n má»—i ngĂ y', '80 puzzle má»—i ngĂ y', 'Má»Ÿ Puzzle Rush khĂ´ng giá»›i háº¡n lÆ°á»£t', 'Há»“ sÆ¡ cĂ³ huy hiá»‡u Plus']
  },
  pro: {
    icon: Gem,
    title: 'Pro',
    tag: 'GĂ³i Ä‘Ă¡ng mua nháº¥t',
    benefits: ['Game review khĂ´ng giá»›i háº¡n', 'Puzzle vĂ  Custom Puzzles khĂ´ng giá»›i háº¡n', 'Explain Pro cho tá»«ng nÆ°á»›c Ä‘i', 'Thá»‘ng kĂª sau tráº­n rĂµ hÆ¡n']
  },
  master: {
    icon: Crown,
    title: 'Master',
    tag: 'Cho ngÆ°á»i chÆ¡i nghiĂªm tĂºc',
    benefits: ['ToĂ n bá»™ quyá»n lá»£i Pro', 'Coach Ä‘á»‹nh hÆ°á»›ng luyá»‡n táº­p nĂ¢ng cao', 'Huy hiá»‡u Master ná»•i báº­t', 'Æ¯u tiĂªn khi má»Ÿ tĂ­nh nÄƒng giáº£i Ä‘áº¥u']
  }
};

const FREE_LIMITS = [
  '5 puzzle má»—i ngĂ y',
  '1 game review cÆ¡ báº£n má»—i ngĂ y',
  'KhĂ´ng cĂ³ Puzzle Rush',
  'KhĂ´ng cĂ³ Custom Puzzles',
  'KhĂ´ng cĂ³ Explain Pro'
];

function currency(price) {
  if (!price?.value || !price?.currency) return 'Äang láº¥y giĂ¡ PayPal';
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
  if (!planId) return 'Thiáº¿u PayPal plan id cho gĂ³i nĂ y.';
  if (!planHealth) return 'Äang kiá»ƒm tra plan PayPal...';
  if (planHealth.ok === false) {
    return planHealth.error || 'Backend PayPal credential hiá»‡n táº¡i khĂ´ng nhĂ¬n tháº¥y plan nĂ y. HĂ£y dĂ¹ng Ä‘Ăºng PAYPAL_CLIENT_ID/PAYPAL_SECRET cá»§a app Ä‘Ă£ táº¡o plan, hoáº·c táº¡o láº¡i plan dÆ°á»›i app Ä‘ang cáº¥u hĂ¬nh.';
  }
  if (planHealth.plan?.status && planHealth.plan.status !== 'ACTIVE') return `Plan Ä‘ang á»Ÿ tráº¡ng thĂ¡i ${planHealth.plan.status}, cáº§n ACTIVE.`;
  const planCurrency = planHealth.plan?.currency;
  if (planCurrency && planCurrency !== fallbackCurrency) {
    return `Plan dĂ¹ng ${planCurrency}, SDK sáº½ táº£i láº¡i theo currency nĂ y.`;
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
      setMessage('Báº¡n Ä‘Ă£ há»§y thanh toĂ¡n PayPal.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    if (params.get('paypal') !== 'approved') return;

    const subscriptionId = params.get('subscription_id') || params.get('subscriptionID') || '';
    const approvedTier = params.get('tier') || '';
    const approvedCycle = params.get('cycle') || 'monthly';
    const planId = planIdFor(approvedTier, approvedCycle);
    if (!subscriptionId || !planId) {
      setMessage('PayPal Ä‘Ă£ approve nhÆ°ng chÆ°a tráº£ subscription_id. Webhook sáº½ Ä‘á»“ng bá»™ khi PayPal gá»­i sá»± kiá»‡n.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    activateMembership({ tier: approvedTier, billingCycle: approvedCycle, planId, subscriptionId })
      .then((data) => {
        onMembershipUpdated(data);
        notify('GĂ³i PayPal Ä‘Ă£ Ä‘Æ°á»£c kĂ­ch hoáº¡t.', 'success');
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
      const text = error.message || 'PayPal Sandbox chÆ°a táº¡o Ä‘Æ°á»£c subscription.';
      setMessage(`${text} GĂ³i Ä‘ang dĂ¹ng plan ${checkoutPlanId}, currency ${checkoutPrice?.currency || PAYPAL_CURRENCY}.`);
      notify(text, 'error');
    } finally {
      setCheckoutLoading(false);
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
        <p>ÄÄƒng nháº­p Ä‘á»ƒ mua gĂ³i, lÆ°u quyá»n lá»£i vĂ  Ä‘á»“ng bá»™ vá»›i há»“ sÆ¡ ngÆ°á»i chÆ¡i.</p>
        <button onClick={onLogin}><LogIn size={18} /> ÄÄƒng nháº­p</button>
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
          <ArrowLeft size={18} /> Quay láº¡i chá»n gĂ³i
        </button>

        <section className="membership-payment-shell">
          <div className="membership-payment-summary">
            <span><CreditCard size={18} /> Thanh toĂ¡n PayPal Sandbox</span>
            <div className="membership-payment-title">
              <Icon size={34} />
              <div>
                <h1>{checkoutPlan.title}</h1>
                <p>{checkoutPlan.tag}</p>
              </div>
            </div>
            <strong className="membership-price payment-price">
              {currency(checkoutPrice)}
              <small>{checkoutPrice?.value ? `/${cycle === 'monthly' ? 'thĂ¡ng' : 'nÄƒm'}` : ''}</small>
            </strong>
            <div className="membership-payment-meta">
              <span>Plan ID: <b>{checkoutPlanId || 'ChÆ°a cáº¥u hĂ¬nh'}</b></span>
              <span>Currency: <b>{checkoutPrice?.currency || PAYPAL_CURRENCY}</b></span>
              <span>Status: <b>{planHealth?.plan?.status || checkoutPrice?.status || 'Äang kiá»ƒm tra'}</b></span>
            </div>
            {planHealthNote && <p className="membership-config-note">{planHealthNote}</p>}
            {!checkoutPrice?.value && <p className="membership-config-note">KhĂ´ng hiá»ƒn thá»‹ giĂ¡ fallback Ä‘á»ƒ trĂ¡nh sai tiá»n. Backend pháº£i Ä‘á»c Ä‘Æ°á»£c giĂ¡ tháº­t tá»« PayPal plan trÆ°á»›c khi thanh toĂ¡n.</p>}
            <ul>
              {checkoutPlan.benefits.map((benefit) => (
                <li key={benefit}><CheckCircle2 size={17} /> {benefit}</li>
              ))}
            </ul>
          </div>

          <div className="membership-payment-card">
            <span>HoĂ n táº¥t Ä‘Äƒng kĂ½</span>
            <h2>{checkoutPlan.title} - {cycle === 'monthly' ? 'theo thĂ¡ng' : 'theo nÄƒm'}</h2>
            <p>NĂºt nĂ y táº¡o subscription tá»« backend báº±ng server credential rá»“i chuyá»ƒn sang trang approve cá»§a PayPal. Náº¿u lá»—i, backend sáº½ tráº£ Ä‘Ăºng lĂ½ do PayPal tá»« chá»‘i.</p>
            <button
              className="membership-paypal-primary"
              onClick={startServerCheckout}
              disabled={checkoutLoading || checkoutBlocked}
            >
              <CreditCard size={18} />
              {checkoutLoading ? 'Äang má»Ÿ PayPal...' : 'Sang trang thanh toĂ¡n PayPal'}
            </button>
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
          <h1>NĂ¢ng cáº¥p Ä‘á»ƒ luyá»‡n cá» hiá»‡u quáº£ hÆ¡n</h1>
          <p>Há»c theo mĂ´ hĂ¬nh premium cá»§a cĂ¡c ná»n táº£ng lá»›n: Free chá»‰ Ä‘á»§ tráº£i nghiá»‡m cÆ¡ báº£n, cĂ²n gĂ³i tráº£ phĂ­ má»Ÿ review sĂ¢u, puzzle nhiá»u hÆ¡n, coach há»¯u Ă­ch hÆ¡n vĂ  thá»‘ng kĂª rĂµ sau tráº­n.</p>
        </div>
        <div className="membership-current">
          <strong>{MEMBERSHIP_TIERS[currentTier].name}</strong>
          <span>GĂ³i hiá»‡n táº¡i</span>
        </div>
      </header>

      <div className="membership-value-grid">
        <div><Brain size={22} /><strong>Game Review</strong><span>Biáº¿t nÆ°á»›c sai, nÆ°á»›c tá»‘t vĂ  xem láº¡i vĂ¡n nhanh hÆ¡n.</span></div>
        <div><Puzzle size={22} /><strong>Puzzle</strong><span>Má»Ÿ thĂªm Rush vĂ  Custom Ä‘á»ƒ luyá»‡n theo chá»§ Ä‘á».</span></div>
        <div><Trophy size={22} /><strong>Rating</strong><span>Gáº¯n vá»›i leaderboard, lá»‹ch sá»­ vĂ  káº¿t quáº£ sau tráº­n.</span></div>
        <div><Zap size={22} /><strong>Coach</strong><span>Gá»£i Ă½ sĂ¢u hÆ¡n theo tháº¿ cá» vĂ  cáº¥p Ä‘á»™ ngÆ°á»i chÆ¡i.</span></div>
      </div>

      <section className="membership-free-limits">
        <div>
          <ShieldCheck size={22} />
          <strong>Free váº«n chÆ¡i Ä‘Æ°á»£c, nhÆ°ng bá»‹ giá»›i háº¡n</strong>
          <span>Giá»¯ free Ä‘á»§ dĂ¹ng thá»­ sáº£n pháº©m, cĂ²n giĂ¡ trá»‹ luyá»‡n táº­p nghiĂªm tĂºc náº±m á»Ÿ Plus/Pro/Master.</span>
        </div>
        <ul>
          {FREE_LIMITS.map((limit) => <li key={limit}>{limit}</li>)}
        </ul>
      </section>

      <div className="billing-toggle" aria-label="Billing cycle">
        <button className={cycle === 'monthly' ? 'active' : ''} onClick={() => setCycle('monthly')}>Theo thĂ¡ng</button>
        <button className={cycle === 'yearly' ? 'active' : ''} onClick={() => setCycle('yearly')}>Theo nÄƒm <small>tiáº¿t kiá»‡m 2 thĂ¡ng</small></button>
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
              <strong className="membership-price">{currency(prices[tier][cycle])}<small>{prices[tier][cycle]?.value ? `/${cycle === 'monthly' ? 'thĂ¡ng' : 'nÄƒm'}` : ''}</small></strong>
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
                {active ? 'Äang dĂ¹ng' : 'Chá»n gĂ³i'}
              </button>
            </article>
          );
        })}
      </div>

      <section className="membership-checkout">
        <div>
          <span>BÆ°á»›c tiáº¿p theo</span>
          <h2>{PLAN_COPY[selectedTier].title} - {cycle === 'monthly' ? 'theo thĂ¡ng' : 'theo nÄƒm'}</h2>
          <p>GiĂ¡ hiá»ƒn thá»‹ Ä‘Æ°á»£c láº¥y tá»« PayPal plan qua backend. Nháº¥n tiáº¿p tá»¥c Ä‘á»ƒ sang trang thanh toĂ¡n riĂªng, xem láº¡i gĂ³i vĂ  hoĂ n táº¥t báº±ng PayPal Sandbox.</p>
        </div>
        <button className="membership-checkout-button" onClick={() => {
          setCheckoutTier(selectedTier);
          setMessage('');
        }}>
          Tiáº¿p tá»¥c thanh toĂ¡n <CreditCard size={18} />
        </button>
      </section>
    </section>
  );
}
