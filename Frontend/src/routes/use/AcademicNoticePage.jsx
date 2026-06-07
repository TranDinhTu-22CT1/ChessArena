import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, BadgeInfo, CreditCard, ExternalLink, GraduationCap, ShieldCheck, Wallet, X } from 'lucide-react';
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
        steps: ['Chọn gói thành viên.', 'Chọn PayPal sandbox.', 'Đăng nhập và xác nhận.', 'Quay lại ChessArena kiểm tra gói.']
      },
      {
        id: 'momo',
        icon: Wallet,
        title: 'MoMo Sandbox',
        subtitle: 'Kiểm thử mua gói bằng MoMo.',
        steps: ['Chọn gói cần mua.', 'Chọn MoMo sandbox.', 'Kiểm tra QR hoặc mã giao dịch.', 'Xác nhận và chờ hệ thống cập nhật.']
      }
    ]
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
        steps: ['Choose a membership plan.', 'Select PayPal sandbox.', 'Sign in and confirm.', 'Return to ChessArena and check the plan.']
      },
      {
        id: 'momo',
        icon: Wallet,
        title: 'MoMo Sandbox',
        subtitle: 'Test membership purchase with MoMo.',
        steps: ['Choose a membership plan.', 'Select MoMo sandbox.', 'Check the QR or transaction code.', 'Confirm and wait for the plan update.']
      }
    ]
  }
};

export default function AcademicNoticePage({ onNavigate }) {
  const [language, setLanguage] = React.useState('vi');
  const [preview, setPreview] = React.useState(null);
  const text = content[language];

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
                  <div className="academic-step-grid">
                    {guide.steps.map((step, index) => (
                      <button
                        type="button"
                        className="academic-step-card"
                        key={step}
                        onClick={() => setPreview(`${guide.title} - Step ${index + 1}`)}
                      >
                        <b>{index + 1}</b>
                        <span>{step}</span>
                        <i>{language === 'vi' ? 'Ảnh bước' : 'Step image'}</i>
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

      {preview && createPortal(
        <div className="academic-image-lightbox page" role="dialog" aria-modal="true" aria-label={preview}>
          <button type="button" className="academic-image-close" onClick={() => setPreview(null)} aria-label={text.close}>
            <X size={22} />
          </button>
          <div className="academic-image-preview">
            <span>{preview}</span>
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}
