import React from 'react';
import { Chrome, Github, Lock, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import BrandMark from './BrandMark';

const text = {
  createAccount: 'T\u1ea1o t\u00e0i kho\u1ea3n',
  recoverPassword: 'Kh\u00f4i ph\u1ee5c m\u1eadt kh\u1ea9u',
  signIn: '\u0110\u0103ng nh\u1eadp',
  forgotSubtitle: 'Nh\u1eadp email \u0111\u00e3 \u0111\u0103ng k\u00fd \u0111\u1ec3 nh\u1eadn li\u00ean k\u1ebft \u0111\u1eb7t l\u1ea1i m\u1eadt kh\u1ea9u.',
  defaultSubtitle: 'L\u01b0u v\u00e1n \u0111\u1ea5u, xem l\u1ea1i l\u1ecbch s\u1eed v\u00e0 \u0111\u1ed3ng b\u1ed9 giao di\u1ec7n theo t\u00e0i kho\u1ea3n c\u1ee7a b\u1ea1n.',
  platform: 'N\u1ec1n t\u1ea3ng c\u1edd vua c\u00e1 nh\u00e2n',
  secureAccount: 'T\u00e0i kho\u1ea3n b\u1ea3o m\u1eadt',
  heroTitle: 'Ch\u01a1i c\u1edd, l\u01b0u v\u00e1n \u0111\u1ea5u v\u00e0 ti\u1ebfp t\u1ee5c \u1edf b\u1ea5t k\u1ef3 thi\u1ebft b\u1ecb n\u00e0o.',
  heroCopy: 'Phi\u00ean \u0111\u0103ng nh\u1eadp \u0111\u01b0\u1ee3c b\u1ea3o v\u1ec7 b\u1eb1ng cookie HttpOnly. M\u00e0u giao di\u1ec7n v\u00e0 l\u1ecbch s\u1eed v\u00e1n c\u1edd \u0111\u01b0\u1ee3c t\u00e1ch ri\u00eang theo t\u1eebng ng\u01b0\u1eddi ch\u01a1i.',
  benefitSession: 'Cookie HttpOnly cho phi\u00ean \u0111\u0103ng nh\u1eadp',
  benefitTheme: '\u0110\u1ed3ng b\u1ed9 m\u00e0u giao di\u1ec7n theo t\u00e0i kho\u1ea3n',
  benefitLogs: 'Nh\u1eadt k\u00fd v\u00e1n \u0111\u1ea5u ri\u00eang cho t\u1eebng ng\u01b0\u1eddi ch\u01a1i',
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
  const subtitle = isOtpStep ? text.otpCopy : isForgot ? text.forgotSubtitle : text.defaultSubtitle;

  return (
    <section className="auth-page">
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

        <div className="auth-benefits">
          <span><ShieldCheck size={17} /> {text.benefitSession}</span>
          <span><Sparkles size={17} /> {text.benefitTheme}</span>
          <span><UserRound size={17} /> {text.benefitLogs}</span>
        </div>
      </div>

      <form className="auth-card" onSubmit={onSubmitAuth} noValidate>
        <div className="auth-card-header">
          <span>{isOtpStep ? text.secureAccount : isRegister ? text.newPlayer : isForgot ? text.accountHelp : text.welcomeBack}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

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
                  />
                </div>
              </label>
            )}
            <button className="auth-primary" type="button" onClick={onVerifyOtp} disabled={authBusy || otpSecondsLeft <= 0 || authForm.otp.length !== 6}>
              {authBusy ? 'Đang xử lý...' : text.completeOtp}
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
                />
                <span>
                  {text.remember}
                  <small>{text.rememberNote}</small>
                </span>
              </label>
            )}

            <button className="auth-primary" type="submit" disabled={authBusy}>
              {authBusy ? 'Đang xử lý...' : isRegister ? text.createAccount : isForgot ? 'G\u1eedi m\u00e3 OTP' : text.signIn}
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
