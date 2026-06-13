import React from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BadgeInfo,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Wallet,
  X
} from 'lucide-react';
import BrandMark from '../../components/BrandMark';
import vietnamFlag from '../../assets/flags/vietnam.svg';
import unitedKingdomFlag from '../../assets/flags/united-kingdom.svg';

const content = {
  vi: {
    home: 'Trang chủ',
    brand: 'Thông báo học thuật',
    badge: 'Đồ án học thuật',
    title: 'ChessArena là dự án học thuật cá nhân, được công khai để mọi người hiểu đúng phạm vi sử dụng.',
    intro: 'Trang này ghi rõ ai là chủ sở hữu dự án, tài sản nào chỉ được tham khảo cho mục đích học tập và cách kiểm thử thanh toán trong môi trường sandbox.',
    ownerLabel: 'Chủ sở hữu dự án',
    ownerTitle: 'Trần Đình Tú',
    ownerText: 'Nếu cần trao đổi trực tiếp hoặc xác minh thông tin về dự án, bạn có thể liên hệ Zalo qua số 0816931074.',
    copyrightLabel: 'Bản quyền / Copyright',
    copyrightTitle: 'Chess.com sở hữu các tài sản được tham khảo.',
    copyrightText: 'Một số bộ quân, màu bàn cờ hoặc tài sản giao diện liên quan đến Chess.com thuộc quyền sở hữu của Chess.com. ChessArena chỉ sử dụng trong bối cảnh học tập, không đại diện, liên kết hoặc được xác nhận bởi Chess.com.',
    scopeLabel: 'Phạm vi',
    scopeTitle: 'Không phải dịch vụ thương mại chính thức.',
    scopeText: 'Các tính năng như ghép trận, phân tích ván, gói thành viên và thanh toán được xây dựng để trình bày năng lực kỹ thuật, kiểm thử trải nghiệm người dùng và mô phỏng vận hành thực tế.',
    paymentTitle: 'Hướng dẫn thanh toán thử nghiệm',
    support: 'Liên hệ hỗ trợ',
    footer: 'ChessArena được phát triển như một sản phẩm học thuật độc lập.',
    close: 'Đóng ảnh',
    guides: [
      {
        id: 'paypal',
        icon: CreditCard,
        title: 'PayPal Sandbox',
        subtitle: 'Kiểm thử mua gói bằng PayPal.',
        accountTitle: 'Tài khoản người mua PayPal Sandbox',
        steps: [
          { label: 'Chọn gói thành viên.', image: '/Chọn gói prenium.png' },
          { label: 'Chọn phương thức PayPal.', image: '/Thanh toán bằng paypal.png' },
          { label: 'Đăng nhập tài khoản thử nghiệm.', image: '/Đăng nhập bằng paypay.png' },
          { label: 'Đồng ý thanh toán.', image: '/đồng ý thanh toán bằng paypal.png' },
          { label: 'Kiểm tra trạng thái gói.', image: '/Sau khi thanh toán hiển thị trạng thái gói.png' }
        ]
      },
      {
        id: 'momo',
        icon: Wallet,
        title: 'MoMo Sandbox',
        subtitle: 'Kiểm thử mua gói bằng thẻ ATM qua MoMo Sandbox.',
        accountTitle: 'Thông tin thẻ ATM Sandbox',
        steps: [
          { label: 'Chọn gói thành viên.', image: '/Chọn gói prenium.png' },
          { label: 'Chọn thanh toán MoMo.', image: '/Thanh toán bằng momo.png' },
          { label: 'Nhập thông tin thẻ ATM.', image: '/Nhập thông tin thẻ ATM.png' },
          { label: 'Nhập mã OTP thử nghiệm.', image: '/Nhập OTP.png' },
          { label: 'Kiểm tra trạng thái gói.', image: '/Sau khi thanh toán hiển thị trạng thái gói.png' }
        ]
      }
    ],
    testOnly: 'Chỉ dùng trong môi trường Sandbox',
    email: 'Email người mua',
    password: 'Mật khẩu',
    cardNumber: 'Số thẻ',
    cardHolder: 'Chủ thẻ',
    issueDate: 'Ngày phát hành',
    phone: 'Số điện thoại',
    reveal: 'Hiện mật khẩu',
    hide: 'Ẩn mật khẩu',
    copy: 'Sao chép',
    copied: 'Đã sao chép',
    stepImage: 'Nhấn để xem ảnh lớn'
  },
  en: {
    home: 'Home',
    brand: 'Academic notice',
    badge: 'Academic project',
    title: 'ChessArena is a personal academic project, published so visitors understand its intended scope.',
    intro: 'This page identifies the project owner, clarifies referenced asset ownership, and explains how sandbox payments are tested.',
    ownerLabel: 'Project owner',
    ownerTitle: 'Trần Đình Tú',
    ownerText: 'For direct contact or project verification, please use Zalo at 0816931074.',
    copyrightLabel: 'Copyright',
    copyrightTitle: 'Chess.com owns the referenced assets.',
    copyrightText: 'Some referenced piece sets, board themes, or interface assets related to Chess.com are the property of Chess.com. ChessArena uses them only in an academic context and is not affiliated with, endorsed by, or a substitute for Chess.com.',
    scopeLabel: 'Scope',
    scopeTitle: 'Not an official commercial service.',
    scopeText: 'Matchmaking, review, memberships, and payment features are built to demonstrate technical capability, test user experience, and simulate real product operations.',
    paymentTitle: 'Sandbox payment guide',
    support: 'Contact support',
    footer: 'ChessArena is developed as an independent academic product.',
    close: 'Close image',
    guides: [
      {
        id: 'paypal',
        icon: CreditCard,
        title: 'PayPal Sandbox',
        subtitle: 'Test membership purchase with PayPal.',
        accountTitle: 'PayPal Sandbox buyer account',
        steps: [
          { label: 'Choose a membership plan.', image: '/Chọn gói prenium.png' },
          { label: 'Select PayPal.', image: '/Thanh toán bằng paypal.png' },
          { label: 'Sign in to the test account.', image: '/Đăng nhập bằng paypay.png' },
          { label: 'Agree and complete payment.', image: '/đồng ý thanh toán bằng paypal.png' },
          { label: 'Verify the membership status.', image: '/Sau khi thanh toán hiển thị trạng thái gói.png' }
        ]
      },
      {
        id: 'momo',
        icon: Wallet,
        title: 'MoMo Sandbox',
        subtitle: 'Test membership purchase by ATM card through MoMo Sandbox.',
        accountTitle: 'ATM Sandbox card details',
        steps: [
          { label: 'Choose a membership plan.', image: '/Chọn gói prenium.png' },
          { label: 'Select MoMo payment.', image: '/Thanh toán bằng momo.png' },
          { label: 'Enter the ATM card details.', image: '/Nhập thông tin thẻ ATM.png' },
          { label: 'Enter the test OTP.', image: '/Nhập OTP.png' },
          { label: 'Verify the membership status.', image: '/Sau khi thanh toán hiển thị trạng thái gói.png' }
        ]
      }
    ],
    testOnly: 'Sandbox environment only',
    email: 'Buyer email',
    password: 'Password',
    cardNumber: 'Card number',
    cardHolder: 'Cardholder',
    issueDate: 'Issue date',
    phone: 'Phone number',
    reveal: 'Show password',
    hide: 'Hide password',
    copy: 'Copy',
    copied: 'Copied',
    stepImage: 'Open the full-size image'
  }
};

const sandboxCredentials = {
  paypal: [
    { id: 'paypal-email', type: 'email', value: 'sb-go9aa51399356@personal.example.com' },
    { id: 'paypal-password', type: 'password', value: 'L$U!*w@0' }
  ],
  momo: [
    { id: 'momo-card', type: 'cardNumber', value: '9704 0000 0000 0018' },
    { id: 'momo-holder', type: 'cardHolder', value: 'NGUYEN VAN A' },
    { id: 'momo-date', type: 'issueDate', value: '03/07' },
    { id: 'momo-phone', type: 'phone', value: '0816931074' }
  ]
};

export default function AcademicNoticePage({ onNavigate }) {
  const [language, setLanguage] = React.useState('vi');
  const [preview, setPreview] = React.useState(null);
  const [showPaypalPassword, setShowPaypalPassword] = React.useState(false);
  const [copiedField, setCopiedField] = React.useState('');
  const text = content[language];
  const previewGuide = preview ? text.guides.find((guide) => guide.id === preview.guideId) : null;
  const previewStep = previewGuide?.steps[preview.index] ?? null;

  const copyCredential = async (field) => {
    try {
      await navigator.clipboard.writeText(field.value);
      setCopiedField(field.id);
      window.setTimeout(() => setCopiedField(''), 1600);
    } catch {
      setCopiedField('');
    }
  };

  const movePreview = React.useCallback((direction) => {
    setPreview((current) => {
      if (!current) return current;
      const guide = content[language].guides.find((item) => item.id === current.guideId);
      if (!guide?.steps.length) return current;
      return {
        ...current,
        index: (current.index + direction + guide.steps.length) % guide.steps.length
      };
    });
  }, [language]);

  React.useEffect(() => {
    if (!preview) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        movePreview(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        movePreview(1);
      } else if (event.key === 'Escape') {
        setPreview(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movePreview, preview]);

  return (
    <main className="academic-page">
      <div className="academic-page-glow one" aria-hidden="true" />
      <div className="academic-page-glow two" aria-hidden="true" />

      <header className="academic-page-header">
        <button type="button" onClick={() => onNavigate('home')}>
          <ArrowLeft size={18} /> {text.home}
        </button>
        <div className="academic-page-brand">
          <BrandMark className="logo-mark-image" />
          <div>
            <strong>ChessArena</strong>
            <span>{text.brand}</span>
          </div>
        </div>
        <div className="academic-language-switch" aria-label="Language">
          <button type="button" className={language === 'vi' ? 'active' : ''} onClick={() => setLanguage('vi')}>
            <span><img src={vietnamFlag} alt="" /></span> VI
          </button>
          <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>
            <span><img src={unitedKingdomFlag} alt="" /></span> EN
          </button>
        </div>
      </header>

      <section className="academic-page-hero">
        <span><GraduationCap size={18} /> {text.badge}</span>
        <h1>{text.title}</h1>
        <p>{text.intro}</p>
      </section>

      <section className="academic-page-grid">
        <article className="academic-page-card owner">
          <BadgeInfo size={25} />
          <span>{text.ownerLabel}</span>
          <h2>{text.ownerTitle}</h2>
          <p>{text.ownerText}</p>
        </article>

        <article className="academic-page-card featured">
          <ShieldCheck size={25} />
          <span>{text.copyrightLabel}</span>
          <h2>{text.copyrightTitle}</h2>
          <p>{text.copyrightText}</p>
        </article>

        <article className="academic-page-card">
          <BadgeInfo size={25} />
          <span>{text.scopeLabel}</span>
          <h2>{text.scopeTitle}</h2>
          <p>{text.scopeText}</p>
        </article>
      </section>

      <section className="academic-payment-section">
        <div className="academic-section-heading">
          <CreditCard size={20} />
          <div>
            <span>Payment guide</span>
            <h2>{text.paymentTitle}</h2>
          </div>
        </div>

        <div className="academic-payment-grid">
          {text.guides.map((guide) => {
            const Icon = guide.icon;
            return (
              <article className="academic-payment-card" key={guide.id}>
                <div className="academic-payment-copy">
                  <span><Icon size={17} /> {guide.title}</span>
                  <h3>{guide.subtitle}</h3>
                  <div className="academic-sandbox-panel">
                    <div className="academic-sandbox-heading">
                      <strong>{guide.accountTitle}</strong>
                      <span><ShieldCheck size={14} /> {text.testOnly}</span>
                    </div>
                    <div className="academic-credential-grid">
                      {sandboxCredentials[guide.id].map((field) => {
                        const isPassword = field.type === 'password';
                        const hidden = isPassword && !showPaypalPassword;
                        const copied = copiedField === field.id;
                        return (
                          <div className="academic-credential" key={field.id}>
                            <span>{text[field.type]}</span>
                            <div>
                              <code>{hidden ? '••••••••' : field.value}</code>
                              {isPassword && (
                                <button
                                  type="button"
                                  onClick={() => setShowPaypalPassword((current) => !current)}
                                  aria-label={hidden ? text.reveal : text.hide}
                                  title={hidden ? text.reveal : text.hide}
                                >
                                  {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => copyCredential(field)}
                                aria-label={`${text.copy}: ${text[field.type]}`}
                                title={copied ? text.copied : text.copy}
                              >
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="academic-step-grid">
                    {guide.steps.map((step, index) => (
                      <button
                        type="button"
                        className="academic-step-card"
                        key={`${guide.id}-${step.image}`}
                        onClick={() => setPreview({
                          guideId: guide.id,
                          index
                        })}
                      >
                        <div className="academic-step-image">
                          <img src={step.image} alt="" loading="lazy" />
                          <b>{index + 1}</b>
                        </div>
                        <span>{step.label}</span>
                        <i>{text.stepImage}</i>
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="academic-page-footer">
        <p>{text.footer}</p>
        <button type="button" onClick={() => onNavigate('support')}>
          {text.support} <ExternalLink size={16} />
        </button>
      </footer>

      {preview && previewGuide && previewStep && createPortal(
        <div
          className="academic-image-lightbox page"
          role="dialog"
          aria-modal="true"
          aria-label={`${previewGuide.title}: ${previewStep.label}`}
          onClick={() => setPreview(null)}
        >
          <button type="button" className="academic-image-close" onClick={() => setPreview(null)} aria-label={text.close}>
            <X size={22} />
          </button>
          <figure
            className="academic-image-preview"
            role="group"
            aria-roledescription={language === 'vi' ? 'bộ sưu tập ảnh' : 'image carousel'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="academic-image-stage" aria-live="polite">
              <img src={previewStep.image} alt={previewStep.label} />
              <button
                type="button"
                className="academic-image-hit previous"
                onClick={() => movePreview(-1)}
                aria-label={language === 'vi' ? 'Ảnh trước' : 'Previous image'}
              >
                <span><ChevronLeft size={27} /></span>
              </button>
              <button
                type="button"
                className="academic-image-hit next"
                onClick={() => movePreview(1)}
                aria-label={language === 'vi' ? 'Ảnh tiếp theo' : 'Next image'}
              >
                <span><ChevronRight size={27} /></span>
              </button>
              <span className="academic-image-counter">
                {preview.index + 1} / {previewGuide.steps.length}
              </span>
            </div>
            <figcaption>
              <div>
                <strong>{previewGuide.title}</strong>
                <span>{previewStep.label}</span>
              </div>
              <div className="academic-image-picker" role="group" aria-label={language === 'vi' ? 'Chọn ảnh' : 'Choose image'}>
                {previewGuide.steps.map((step, index) => (
                  <button
                    type="button"
                    key={`${previewGuide.id}-picker-${step.image}`}
                    className={index === preview.index ? 'active' : ''}
                    onClick={() => setPreview((current) => ({ ...current, index }))}
                    aria-label={`${index + 1}: ${step.label}`}
                    aria-current={index === preview.index ? 'true' : undefined}
                  />
                ))}
              </div>
            </figcaption>
          </figure>
        </div>,
        document.body
      )}
    </main>
  );
}
