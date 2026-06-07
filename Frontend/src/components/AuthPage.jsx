import React from 'react';
import { Chrome, Github, LoaderCircle, Lock, Mail, ShieldCheck, Sparkles, Swords, UserRound } from 'lucide-react';
import BrandMark from './BrandMark';

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

  return (
    <section className="auth-page">
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
          <span className="auth-eyebrow">{text.secureAccount}</span>
          <h2>{text.heroTitle}</h2>
          <p>{text.heroCopy}</p>
        </div>

        <div className="auth-arena" aria-hidden="true">
          <div className="auth-arena-orbit auth-arena-orbit-outer" />
          <div className="auth-arena-orbit auth-arena-orbit-inner" />
          <div className="auth-arena-board">
            {Array.from({ length: 64 }, (_, index) => <span key={index} />)}
          </div>
          <span className="auth-arena-piece auth-arena-king">&#9812;</span>
          <span className="auth-arena-piece auth-arena-knight">&#9822;</span>
          <Sparkles className="auth-arena-spark auth-arena-spark-one" size={22} />
          <Sparkles className="auth-arena-spark auth-arena-spark-two" size={16} />
          <div className="auth-arena-callout">
            <span><Swords size={18} /> {text.arenaReady}</span>
            <strong>{text.arenaCallout}</strong>
          </div>
        </div>
      </div>

      <form className="auth-card" onSubmit={onSubmitAuth} noValidate aria-busy={authBusy}>
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
                  value={authForm.otp}
                  onChange={(event) => onAuthFormChange({ otp: event.target.value.replace(/\D/g, '').slice(0, 6) })}
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
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
                    type="password"
                    value={authForm.newPassword}
                    onChange={(event) => onAuthFormChange({ newPassword: event.target.value })}
                    placeholder={text.enterPassword}
                    disabled={authBusy}
                  />
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
                    value={authForm.displayName}
                    onChange={(event) => onAuthFormChange({ displayName: event.target.value })}
                    placeholder={text.exampleName}
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
                  type="email"
                  value={authForm.email}
                  onChange={(event) => onAuthFormChange({ email: event.target.value })}
                  placeholder="ban@example.com"
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
                    type="password"
                    value={authForm.password}
                    onChange={(event) => onAuthFormChange({ password: event.target.value })}
                    placeholder={text.enterPassword}
                    disabled={authBusy}
                  />
                </div>
              </label>
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

        <div className="auth-links">
          <button type="button" onClick={() => onSetAuthMode(authMode === 'login' ? 'register' : 'login')} disabled={authBusy}>
            {authMode === 'login' ? text.createNew : text.backToLogin}
          </button>
          {!isForgot && !isOtpStep && (
            <button type="button" onClick={() => onSetAuthMode('forgot')} disabled={authBusy}>{text.forgotPassword}</button>
          )}
        </div>
      </form>
    </section>
  );
}
