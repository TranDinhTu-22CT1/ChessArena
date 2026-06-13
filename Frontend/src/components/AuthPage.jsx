import React from 'react';
import { createPortal } from 'react-dom';
import {
  Brain,
  Check,
  CheckCircle2,
  Chrome,
  CircleAlert,
  Copy,
  Eye,
  EyeOff,
  Github,
  KeyRound,
  LoaderCircle,
  Lock,
  Mail,
  Pointer,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  UserRound,
  X
} from 'lucide-react';
import BrandMark from './BrandMark';
import authKing from '../assets/chesscom/pieces/neo/wk.png';
import authKnight from '../assets/chesscom/pieces/neo/bn.png';

const text = {
  createAccount: 'T\u1ea1o t\u00e0i kho\u1ea3n',
  recoverPassword: 'Kh\u00f4i ph\u1ee5c m\u1eadt kh\u1ea9u',
  signIn: '\u0110\u0103ng nh\u1eadp',
  forgotSubtitle: 'Nh\u1eadp email \u0111\u00e3 \u0111\u0103ng k\u00fd \u0111\u1ec3 nh\u1eadn li\u00ean k\u1ebft \u0111\u1eb7t l\u1ea1i m\u1eadt kh\u1ea9u.',
  loginSubtitle: 'Tr\u1edf l\u1ea1i b\u00e0n c\u1edd v\u00e0 ti\u1ebfp t\u1ee5c chinh ph\u1ee5c nh\u1eefng th\u1eed th\u00e1ch m\u1edbi.',
  registerSubtitle: 'Ch\u1ecdn cho m\u00ecnh m\u1ed9t danh x\u01b0ng v\u00e0 s\u1eb5n s\u00e0ng b\u01b0\u1edbc v\u00e0o cu\u1ed9c \u0111\u1ea5u.',
  platform: 'N\u01a1i nh\u1eefng k\u1ef3 th\u1ee7 g\u1eb7p nhau',
  secureAccount: 'Chess Arena',
  heroTitle: 'B\u00e0n c\u1edd \u0111\u00e3 s\u1eb5n s\u00e0ng. \u0110\u1ebfn l\u01b0\u1ee3t b\u1ea1n.',
  heroCopy: 'Ch\u00e0o m\u1eebng k\u1ef3 th\u1ee7! H\u00e3y b\u01b0\u1edbc v\u00e0o \u0111\u1ea5u tr\u01b0\u1eddng v\u00e0 vi\u1ebft n\u00ean v\u00e1n c\u1edd c\u1ee7a ri\u00eang m\u00ecnh.',
  arenaReady: 'B\u00e0n c\u1edd \u0111ang ch\u1edd b\u1ea1n',
  arenaCallout: 'M\u1ed9t n\u01b0\u1edbc \u0111i hay c\u00f3 th\u1ec3 thay \u0111\u1ed5i c\u1ea3 v\u00e1n \u0111\u1ea5u.',
  newPlayer: 'Ng\u01b0\u1eddi ch\u01a1i m\u1edbi',
  accountHelp: 'H\u1ed7 tr\u1ee3 t\u00e0i kho\u1ea3n',
  welcomeBack: 'Ch\u00e0o m\u1eebng tr\u1edf l\u1ea1i',
  displayName: 'T\u00ean hi\u1ec3n th\u1ecb',
  exampleName: 'V\u00ed d\u1ee5: Minh Chess',
  password: 'M\u1eadt kh\u1ea9u',
  enterPassword: 'Nh\u1eadp m\u1eadt kh\u1ea9u',
  remember: 'Duy tr\u00ec phi\u00ean \u0111\u0103ng nh\u1eadp 48 gi\u1edd',
  rememberNote: 'Ch\u1ec9 d\u00f9ng cookie HttpOnly ph\u00eda server, kh\u00f4ng l\u01b0u phi\u00ean trong tr\u00ecnh duy\u1ec7t.',
  orContinue: 'ho\u1eb7c ti\u1ebfp t\u1ee5c v\u1edbi',
  createNew: 'T\u1ea1o t\u00e0i kho\u1ea3n m\u1edbi',
  backToLogin: 'Quay l\u1ea1i \u0111\u0103ng nh\u1eadp',
  forgotPassword: 'Qu\u00ean m\u1eadt kh\u1ea9u?',
  otpTitle: 'Nh\u1eadp m\u00e3 OTP',
  otpCopy: 'Ch\u00fang t\u00f4i \u0111\u00e3 g\u1eedi m\u00e3 OTP 6 s\u1ed1 qua email. M\u00e3 c\u00f3 hi\u1ec7u l\u1ef1c trong 5 ph\u00fat.',
  otpCode: 'M\u00e3 OTP',
  newPassword: 'M\u1eadt kh\u1ea9u m\u1edbi',
  completeOtp: 'X\u00e1c nh\u1eadn OTP',
  resendOtp: 'G\u1eedi l\u1ea1i OTP'
};

export default function AuthPage({
  authMode,
  authForm,
  authMessage,
  authMessageTone = 'error',
  authBusy = false,
  otpState,
  otpSecondsLeft,
  onAuthFormChange,
  onSubmitAuth,
  onProviderSignIn,
  onSetAuthMode,
  onVerifyOtp,
  onResendOtp
}) {
  const isRegister = authMode === 'register';
  const isForgot = authMode === 'forgot';
  const isOtpStep = Boolean(otpState);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [testNoticeOpen, setTestNoticeOpen] = React.useState(false);
  const [showTestPassword, setShowTestPassword] = React.useState(false);
  const [copiedTestField, setCopiedTestField] = React.useState('');
  const [testGuideOpen, setTestGuideOpen] = React.useState(false);
  const testAccount = React.useMemo(() => ({
    email: 'test@gmail.com',
    password: '123456'
  }), []);

  React.useEffect(() => {
    if (!testNoticeOpen && !testGuideOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (testGuideOpen) {
        setTestGuideOpen(false);
      } else {
        setTestNoticeOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [testGuideOpen, testNoticeOpen]);

  const copyTestValue = async (field) => {
    try {
      await navigator.clipboard.writeText(testAccount[field]);
      setCopiedTestField(field);
      window.setTimeout(() => setCopiedTestField(''), 1500);
    } catch {
      setCopiedTestField('');
    }
  };

  const useTestAccount = () => {
    onAuthFormChange({
      email: testAccount.email,
      password: testAccount.password
    });
    if (authMode !== 'login') onSetAuthMode('login');
    setTestNoticeOpen(false);
  };
  const minutes = String(Math.floor(otpSecondsLeft / 60)).padStart(2, '0');
  const seconds = String(otpSecondsLeft % 60).padStart(2, '0');
  const title = isOtpStep
    ? text.otpTitle
    : isRegister
      ? text.createAccount
      : isForgot
        ? text.recoverPassword
        : text.signIn;
  const subtitle = isOtpStep
    ? text.otpCopy
    : isForgot
      ? text.forgotSubtitle
      : isRegister
        ? text.registerSubtitle
        : text.loginSubtitle;
  const busyLabel = isOtpStep
    ? otpState?.purpose === 'register'
      ? 'Đang tạo tài khoản...'
      : 'Đang cập nhật mật khẩu...'
    : isRegister
      ? 'Đang gửi mã OTP...'
      : isForgot
        ? 'Đang kiểm tra tài khoản...'
        : 'Đang đăng nhập...';
  const modeClass = isOtpStep ? 'otp' : isRegister ? 'register' : isForgot ? 'forgot' : 'login';
  const modeContent = isOtpStep
    ? {
        eyebrow: 'Xác minh bảo mật',
        heroTitle: 'Chỉ còn một bước để tiếp tục.',
        heroCopy: 'Nhập mã OTP đã gửi tới email để bảo vệ tài khoản và hoàn tất yêu cầu của bạn.',
        trust: [
          [ShieldCheck, 'Mã xác minh chỉ dùng một lần'],
          [Mail, 'OTP được gửi tới email đăng ký'],
          [Lock, 'Thông tin tài khoản luôn được bảo vệ']
        ]
      }
    : isRegister
      ? {
          eyebrow: 'Bắt đầu hành trình',
          heroTitle: 'Tạo hồ sơ kỳ thủ của riêng bạn.',
          heroCopy: 'Một tài khoản giúp bạn lưu Elo, lịch sử thi đấu, thành tựu và tiến độ luyện tập trên mọi thiết bị.',
          trust: [
            [Trophy, 'Theo dõi Elo và thành tích'],
            [Brain, 'Lưu bài tập cùng AI Coach'],
            [ShieldCheck, 'Xác minh tài khoản bằng OTP']
          ]
        }
      : isForgot
        ? {
            eyebrow: 'Khôi phục an toàn',
            heroTitle: 'Trở lại bàn cờ mà không mất dữ liệu.',
            heroCopy: 'Xác nhận email, nhận mã OTP và đặt mật khẩu mới. Tiến độ thi đấu của bạn vẫn được giữ nguyên.',
            trust: [
              [Mail, 'Nhận OTP qua email đăng ký'],
              [KeyRound, 'Tạo mật khẩu mới an toàn'],
              [ShieldCheck, 'Không làm thay đổi dữ liệu hồ sơ']
            ]
          }
        : {
            eyebrow: text.secureAccount,
            heroTitle: text.heroTitle,
            heroCopy: text.heroCopy,
            trust: [
              [Trophy, 'Thi đấu và theo dõi Elo'],
              [Brain, 'Phân tích cùng AI Coach'],
              [ShieldCheck, 'Phiên đăng nhập bảo mật']
            ]
          };

  return (
    <section className={`auth-page auth-mode-${modeClass}`}>
      <div className="auth-background" aria-hidden="true">
        <div className="auth-glow auth-glow-one" />
        <div className="auth-glow auth-glow-two" />
      </div>

      <div className="auth-copy">
        <div className="auth-brand">
          <BrandMark className="logo-mark-image" />
          <div>
            <strong>Chess Arena</strong>
            <span>{text.platform}</span>
          </div>
        </div>

        <div className="auth-copy-main">
          <span className="auth-eyebrow">{modeContent.eyebrow}</span>
          <h2>{modeContent.heroTitle}</h2>
          <p>{modeContent.heroCopy}</p>
          <div className="auth-trust-list">
            {modeContent.trust.map(([Icon, label]) => (
              <span key={label}><Icon size={18} /><b>{label}</b></span>
            ))}
          </div>
        </div>

        <div className="auth-arena" aria-hidden="true">
          <div className="auth-arena-orbit auth-arena-orbit-outer" />
          <div className="auth-arena-orbit auth-arena-orbit-inner" />
          <div className="auth-arena-board">
            {Array.from({ length: 64 }, (_, index) => <span key={index} />)}
          </div>
          <img className="auth-arena-piece auth-arena-king" src={authKing} alt="" />
          <img className="auth-arena-piece auth-arena-knight" src={authKnight} alt="" />
          <Sparkles className="auth-arena-spark auth-arena-spark-one" size={22} />
          <Sparkles className="auth-arena-spark auth-arena-spark-two" size={16} />
          <div className="auth-arena-callout">
            <span><Swords size={18} /> {text.arenaReady}</span>
            <strong>{text.arenaCallout}</strong>
          </div>
        </div>
      </div>

      <form className={`auth-card auth-card-${modeClass}`} onSubmit={onSubmitAuth} noValidate aria-busy={authBusy}>
        <div className="auth-test-notice">
          {!testNoticeOpen && (
            <span className="auth-test-pointer" aria-hidden="true">
              <Pointer size={24} />
            </span>
          )}
          <button
            type="button"
            className={`auth-test-trigger ${testNoticeOpen ? 'active' : ''}`}
            onClick={() => setTestNoticeOpen((open) => !open)}
            aria-label="Mở thông tin tài khoản dùng thử"
            aria-expanded={testNoticeOpen}
          >
            <CircleAlert size={20} />
          </button>

          {testNoticeOpen && (
            <aside className="auth-test-popover" aria-label="Tài khoản dùng thử">
              <div className="auth-test-popover-head">
                <div>
                  <span>Trải nghiệm nhanh</span>
                  <h2>Tài khoản người dùng thử</h2>
                </div>
                <button type="button" onClick={() => setTestNoticeOpen(false)} aria-label="Đóng thông báo">
                  <X size={18} />
                </button>
              </div>

              <p>Không muốn đăng ký? Dùng tài khoản công khai này để khám phá các chức năng của ChessArena. Sau khi đăng nhập bạn nên truy cập trang thông báo học thuật để biết thêm 1 số thông tin</p>

              <div className="auth-test-credentials">
                <div>
                  <span>Email</span>
                  <code>{testAccount.email}</code>
                  <button type="button" onClick={() => copyTestValue('email')} aria-label="Sao chép email">
                    {copiedTestField === 'email' ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <div>
                  <span>Mật khẩu</span>
                  <code>{showTestPassword ? testAccount.password : '••••••'}</code>
                  <button
                    type="button"
                    onClick={() => setShowTestPassword((visible) => !visible)}
                    aria-label={showTestPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showTestPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button type="button" onClick={() => copyTestValue('password')} aria-label="Sao chép mật khẩu">
                    {copiedTestField === 'password' ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              <button type="button" className="auth-test-use" onClick={useTestAccount}>
                Điền vào form đăng nhập
              </button>

              <button type="button" className="auth-test-guide" onClick={() => setTestGuideOpen(true)}>
                <img src="/Hình ảnh mở lại popup.png" alt="Vị trí nút mở thông báo học thuật trên thanh đầu trang" />
                <span>
                  <strong>Thông báo học thuật</strong>
                  <small>Sau khi đăng nhập, nhấn icon Thông tin trên thanh đầu trang để mở lại.</small>
                </span>
              </button>
            </aside>
          )}
        </div>

        {(isRegister || isForgot || isOtpStep) && (
          <div className="auth-stepper" aria-label={isOtpStep ? 'Bước 2 trên 2' : 'Bước 1 trên 2'}>
            <span className={isOtpStep ? 'complete' : 'active'}>
              {isOtpStep ? <CheckCircle2 size={15} /> : <b>1</b>}
              {isForgot || otpState?.purpose === 'reset' ? 'Email' : 'Tài khoản'}
            </span>
            <i aria-hidden="true" />
            <span className={isOtpStep ? 'active' : ''}><b>2</b> Xác minh</span>
          </div>
        )}

        <div className="auth-card-header">
          <span>{isOtpStep ? text.secureAccount : isRegister ? text.newPlayer : isForgot ? text.accountHelp : text.welcomeBack}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {authBusy && (
          <div className="auth-progress visible" role="status" aria-live="polite">
            <LoaderCircle size={17} aria-hidden="true" />
            <span>{busyLabel}</span>
          </div>
        )}

        {isOtpStep ? (
          <div className="verification-panel">
            <div className="verification-mail">
              <Mail size={18} />
              <strong>{otpState.email}</strong>
            </div>
            <div className="otp-timer" aria-live="polite">
              OTP hết hạn sau <strong>{minutes}:{seconds}</strong>
            </div>
            <label>
              <span>{text.otpCode}</span>
              <div className="auth-input">
                <ShieldCheck size={17} />
                <input
                  id="auth-otp"
                  name="otp"
                  value={authForm.otp}
                  onChange={(event) => onAuthFormChange({ otp: event.target.value.replace(/\D/g, '').slice(0, 6) })}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  aria-label={text.otpCode}
                  disabled={authBusy}
                />
              </div>
            </label>
            {otpState.purpose === 'reset' && (
              <label>
                <span>{text.newPassword}</span>
                <div className="auth-input">
                  <Lock size={17} />
                  <input
                    id="auth-new-password"
                    name="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={authForm.newPassword}
                    onChange={(event) => onAuthFormChange({ newPassword: event.target.value })}
                    placeholder={text.enterPassword}
                    autoComplete="new-password"
                    disabled={authBusy}
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    onClick={() => setShowNewPassword((visible) => !visible)}
                    aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    disabled={authBusy}
                  >
                    {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
            )}
            <button className="auth-primary" type="button" onClick={onVerifyOtp} disabled={authBusy || otpSecondsLeft <= 0 || authForm.otp.length !== 6}>
              {authBusy && <LoaderCircle className="auth-button-spinner" size={18} aria-hidden="true" />}
              <span>{authBusy ? busyLabel : text.completeOtp}</span>
            </button>
            <button className="auth-secondary" type="button" onClick={onResendOtp} disabled={authBusy}>
              {text.resendOtp}
            </button>
          </div>
        ) : (
          <>
            {isRegister && (
              <label>
                <span>{text.displayName}</span>
                <div className="auth-input">
                  <UserRound size={17} />
                  <input
                    id="auth-display-name"
                    name="display-name"
                    value={authForm.displayName}
                    onChange={(event) => onAuthFormChange({ displayName: event.target.value })}
                    placeholder={text.exampleName}
                    autoComplete="name"
                    disabled={authBusy}
                  />
                </div>
              </label>
            )}

            <label>
              <span>Email</span>
              <div className="auth-input">
                <Mail size={17} />
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  value={authForm.email}
                  onChange={(event) => onAuthFormChange({ email: event.target.value })}
                  placeholder="ban@example.com"
                  autoComplete="email"
                  disabled={authBusy}
                />
              </div>
            </label>

            {!isForgot && (
              <label>
                <span>{text.password}</span>
                <div className="auth-input">
                  <Lock size={17} />
                  <input
                    id={isRegister ? 'auth-new-password' : 'auth-current-password'}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={authForm.password}
                    onChange={(event) => onAuthFormChange({ password: event.target.value })}
                    placeholder={text.enterPassword}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    disabled={authBusy}
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    disabled={authBusy}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {isRegister && <small className="auth-field-hint">Dùng ít nhất 6 ký tự và tránh mật khẩu dễ đoán.</small>}
              </label>
            )}

            {isForgot && (
              <div className="auth-recovery-note">
                <KeyRound size={18} />
                <p><strong>Quy trình 2 bước</strong><span>Chúng tôi sẽ gửi OTP trước khi cho phép đặt mật khẩu mới.</span></p>
              </div>
            )}

            {!isForgot && (
              <label className="remember-row">
                <input
                  type="checkbox"
                  checked={Boolean(authForm.remember)}
                  onChange={(event) => onAuthFormChange({ remember: event.target.checked })}
                  disabled={authBusy}
                />
                <span>
                  {text.remember}
                  <small>{text.rememberNote}</small>
                </span>
              </label>
            )}

            <button className="auth-primary" type="submit" disabled={authBusy}>
              {authBusy && <LoaderCircle className="auth-button-spinner" size={18} aria-hidden="true" />}
              <span>{authBusy ? busyLabel : isRegister ? text.createAccount : isForgot ? 'G\u1eedi m\u00e3 OTP' : text.signIn}</span>
            </button>

            {!isForgot && (
              <>
                <div className="auth-divider"><span>{text.orContinue}</span></div>
                <div className="auth-providers">
                  <button type="button" onClick={() => onProviderSignIn('google')} disabled={authBusy}>
                    <Chrome size={17} />
                    Google
                  </button>
                  <button type="button" onClick={() => onProviderSignIn('github')} disabled={authBusy}>
                    <Github size={17} />
                    GitHub
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {authMessage && (
          <small className={`auth-message ${authMessageTone}`} role={authMessageTone === 'error' ? 'alert' : 'status'}>
            {authMessage}
          </small>
        )}

        <div className={`auth-links ${authMode === 'login' && !isOtpStep ? '' : 'single'}`}>
          <button type="button" onClick={() => onSetAuthMode(authMode === 'login' ? 'register' : 'login')} disabled={authBusy}>
            {authMode === 'login' ? text.createNew : text.backToLogin}
          </button>
          {authMode === 'login' && !isOtpStep && (
            <button type="button" onClick={() => onSetAuthMode('forgot')} disabled={authBusy}>{text.forgotPassword}</button>
          )}
        </div>
      </form>
      {testGuideOpen && createPortal(
        <div
          className="academic-image-lightbox auth-guide-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Vị trí mở thông báo học thuật"
          onClick={() => setTestGuideOpen(false)}
        >
          <button type="button" className="academic-image-close" onClick={() => setTestGuideOpen(false)} aria-label="Đóng ảnh">
            <X size={22} />
          </button>
          <figure className="academic-image-preview" onClick={(event) => event.stopPropagation()}>
            <img src="/Hình ảnh mở lại popup.png" alt="Vị trí nút mở thông báo học thuật trên thanh đầu trang" />
            <figcaption>
              <strong>Nút Thông tin</strong>
              <span>Nằm trên thanh đầu trang, cạnh trạng thái kết nối.</span>
            </figcaption>
          </figure>
        </div>,
        document.body
      )}
    </section>
  );
}
