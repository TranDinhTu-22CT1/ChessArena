import React from 'react';
import { apiUrl } from '../api/config';
import {
  auth,
  fetchSignInMethodsForEmail,
  getAdditionalUserInfo,
  GithubAuthProvider,
  githubProvider,
  googleProvider,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from '../firebase';
import { getDeviceFingerprint } from '../security/deviceFingerprint';

function displayNameFromUser(user, fallback = 'Player') {
  const rawName = String(user?.displayName || user?.githubLogin || user?.githubName || '').trim();
  if (rawName && !rawName.includes('@')) return rawName;

  const emailName = user?.email ? String(user.email).split('@')[0] : '';
  return String(emailName || fallback).trim();
}

function providerFromName(provider) {
  return provider === 'github' ? githubProvider : googleProvider;
}

function validateAuthForm(mode, form) {
  const email = form.email.trim();

  if (!email) return 'Vui lòng nhập email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email không hợp lệ.';
  if (mode !== 'forgot' && !form.password) return 'Vui lòng nhập mật khẩu.';
  if (mode === 'register' && form.password.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.';
  if (mode === 'register' && !form.displayName.trim()) return 'Vui lòng nhập tên hiển thị.';

  return '';
}

export function useAuthSession() {
  const [userName, setUserName] = React.useState('Player');
  const [authMode, setAuthMode] = React.useState(null);
  const [authUser, setAuthUser] = React.useState(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [otpState, setOtpState] = React.useState(null);
  const [otpNow, setOtpNow] = React.useState(Date.now());
  const [authForm, setAuthForm] = React.useState(() => ({
    email: '',
    password: '',
    displayName: '',
    remember: false,
    otp: '',
    newPassword: ''
  }));
  const [authMessage, setAuthMessage] = React.useState('');
  const [authMessageTone, setAuthMessageTone] = React.useState('error');
  const [authBusy, setAuthBusy] = React.useState(false);

  const otpSecondsLeft = otpState?.expiresAt
    ? Math.max(0, Math.ceil((new Date(otpState.expiresAt).getTime() - otpNow) / 1000))
    : 0;

  const setAuthError = React.useCallback((message) => {
    setAuthMessageTone('error');
    setAuthMessage(message);
  }, []);

  const setAuthInfo = React.useCallback((message) => {
    setAuthMessageTone('info');
    setAuthMessage(message);
  }, []);

  const clearAuthMessage = React.useCallback(() => {
    setAuthMessage('');
    setAuthMessageTone('error');
  }, []);

  React.useEffect(() => {
    const adminView = new URLSearchParams(window.location.search).get('adminView') === '1';
    fetch(apiUrl(`/api/auth/me${adminView ? '?adminView=1' : ''}`), { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.user) {
          setAuthMode('login');
          return;
        }
        setAuthUser(data.user);
        setUserName(displayNameFromUser(data.user));
        setAuthMode(null);
      })
      .catch(() => setAuthMode('login'))
      .finally(() => setAuthReady(true));
  }, []);

  React.useEffect(() => {
    if (!otpState) return undefined;

    const timer = window.setInterval(() => setOtpNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [otpState]);

  const createBackendSession = async (firebaseUser, providerProfile = {}) => {
    const token = await firebaseUser.getIdToken();
    const deviceId = await getDeviceFingerprint().catch(() => null);
    const response = await fetch(apiUrl('/api/auth/session'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: token,
        remember: Boolean(authForm.remember),
        deviceId,
        profile: {
          displayName: providerProfile.displayName || firebaseUser.displayName || '',
          githubLogin: providerProfile.githubLogin || '',
          githubName: providerProfile.githubName || '',
          photoURL: providerProfile.photoURL || firebaseUser.photoURL || ''
        }
      })
    });
    const responseText = await response.text();
    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      const plainText = responseText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      data = {
        error: plainText.includes('TurbopackInternalError')
          ? 'Backend auth server đang lỗi dev cache/Turbopack. Hãy restart backend rồi thử lại.'
          : plainText.slice(0, 220) || 'Backend did not return JSON.'
      };
    }

    if (!response.ok) {
      throw new Error(data.error || 'Không thể tạo phiên đăng nhập.');
    }

    setAuthUser(data.user);
    setUserName(displayNameFromUser(data.user));
    setAuthMode(null);
    clearAuthMessage();
    setOtpState(null);
  };

  const formatAuthError = (error, provider = '') => {
    const message = error?.message || '';
    const code = error?.code || '';

    if (provider === 'github' && (
      code.includes('auth/unauthorized-domain') ||
      code.includes('auth/operation-not-allowed') ||
      message.toLowerCase().includes('redirect_uri') ||
      message.toLowerCase().includes('redirect uri')
    )) {
      return 'Cấu hình GitHub/Firebase chưa đúng. Kiểm tra GitHub OAuth callback và Firebase authorized domains.';
    }

    if (code.includes('auth/account-exists-with-different-credential')) {
      return 'Email này đã có tài khoản bằng phương thức khác. Hãy đăng nhập bằng phương thức cũ rồi liên kết lại.';
    }

    if (code.includes('auth/popup-closed-by-user')) return 'Bạn đã đóng cửa sổ đăng nhập trước khi hoàn tất.';
    if (code.includes('auth/popup-blocked') || code.includes('auth/cancelled-popup-request')) return 'Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép popup rồi thử lại.';
    if (code.includes('auth/redirect-cancelled-by-user')) return 'Bạn đã hủy đăng nhập trước khi hoàn tất.';
    if (code.includes('auth/redirect-operation-pending')) return 'Đang có một lần đăng nhập khác chưa hoàn tất. Hãy tải lại trang rồi thử lại.';
    if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password')) return 'Email hoặc mật khẩu không đúng.';
    if (code.includes('auth/user-not-found')) return 'Không tìm thấy tài khoản với email này.';
    if (code.includes('auth/too-many-requests')) return 'Bạn thử quá nhiều lần. Vui lòng đợi một chút rồi thử lại.';

    return message || 'Không thể đăng nhập. Vui lòng thử lại.';
  };

  const finishProviderSession = async (provider, credential) => {
    const providerInfo = getAdditionalUserInfo(credential);
    const profile = providerInfo?.profile || {};

    await createBackendSession(credential.user, {
      displayName: provider === 'github' ? profile.name || profile.login || credential.user.displayName || '' : credential.user.displayName || '',
      githubLogin: provider === 'github' ? profile.login || '' : '',
      githubName: provider === 'github' ? profile.name || '' : '',
      photoURL: profile.avatar_url || credential.user.photoURL || ''
    });
  };

  const tryLinkExistingProvider = async (error, provider) => {
    if (!String(error?.code || '').includes('auth/account-exists-with-different-credential')) return false;

    const pendingCredential = provider === 'github'
      ? GithubAuthProvider.credentialFromError(error)
      : GoogleAuthProvider.credentialFromError(error);
    const email = error?.customData?.email || error?.email;

    if (!pendingCredential || !email) return false;

    const methods = await fetchSignInMethodsForEmail(auth, email);

    if (provider === 'github' && methods.includes('google.com')) {
      setAuthError('Email GitHub này đang trùng với tài khoản Google. Đăng nhập bằng Google trước, sau đó vào tài khoản để liên kết GitHub.');
      return true;
    }

    if (methods.includes('google.com')) {
      setAuthInfo('Email này đang thuộc Google. Đang mở Google để liên kết tài khoản...');
      const googleCredential = await signInWithPopup(auth, googleProvider);
      await linkWithCredential(googleCredential.user, pendingCredential);
      await finishProviderSession('google', googleCredential);
      return true;
    }

    if (methods.includes('github.com')) {
      setAuthInfo('Email này đang thuộc GitHub. Đang mở GitHub để liên kết tài khoản...');
      const githubCredential = await signInWithPopup(auth, githubProvider);
      await linkWithCredential(githubCredential.user, pendingCredential);
      await finishProviderSession('github', githubCredential);
      return true;
    }

    if (methods.includes('password')) {
      if (authForm.email.trim().toLowerCase() !== email.toLowerCase() || !authForm.password) {
        setAuthForm((form) => ({ ...form, email }));
        setAuthError(`Email này đang dùng đăng nhập mật khẩu. Nhập mật khẩu của email này rồi bấm ${provider === 'github' ? 'GitHub' : 'Google'} lại để liên kết.`);
        return true;
      }

      const passwordCredential = await signInWithEmailAndPassword(auth, email, authForm.password);
      await linkWithCredential(passwordCredential.user, pendingCredential);
      await createBackendSession(passwordCredential.user);
      return true;
    }

    setAuthError('Email này đã tồn tại bằng phương thức khác. Hãy đăng nhập bằng phương thức cũ rồi bấm lại provider để liên kết.');
    return true;
  };

  const sendOtp = async (purpose) => {
    const response = await fetch(apiUrl('/api/auth/otp/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purpose,
        email: authForm.email
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Không thể gửi OTP.');
    }

    setOtpState({ purpose, email: data.email, expiresAt: data.expiresAt });
    setOtpNow(Date.now());
    setAuthForm((form) => ({ ...form, otp: '' }));
    setAuthInfo('Mã OTP đã được gửi. Vui lòng kiểm tra email.');
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    clearAuthMessage();

    const validationMessage = validateAuthForm(authMode, authForm);
    if (validationMessage) {
      setAuthError(validationMessage);
      return;
    }

    try {
      if (authMode === 'forgot') {
        await sendOtp('reset');
        return;
      }

      if (authMode === 'register') {
        await sendOtp('register');
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      await createBackendSession(credential.user);
    } catch (error) {
      setAuthError(formatAuthError(error));
    }
  };

  const verifyOtp = async () => {
    clearAuthMessage();

    if (!authForm.otp || authForm.otp.length !== 6) {
      setAuthError('Vui lòng nhập mã OTP gồm 6 số.');
      return;
    }

    if (otpState?.purpose === 'reset' && !authForm.newPassword) {
      setAuthError('Vui lòng nhập mật khẩu mới.');
      return;
    }

    try {
      if (!otpState) return;

      const response = await fetch(apiUrl('/api/auth/otp/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: otpState.purpose,
          email: otpState.email,
          otp: authForm.otp,
          password: authForm.password,
          displayName: authForm.displayName,
          newPassword: authForm.newPassword
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Không thể xác nhận OTP.');
      }

      if (otpState.purpose === 'register') {
        const credential = await signInWithEmailAndPassword(auth, otpState.email, authForm.password);
        await createBackendSession(credential.user);
        return;
      }

      setOtpState(null);
      setAuthMode('login');
      setAuthForm((form) => ({ ...form, password: '', newPassword: '', otp: '' }));
      setAuthInfo('Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới.');
    } catch (error) {
      setAuthError(error.message || 'Không thể xác nhận OTP.');
    }
  };

  const resendOtp = async () => {
    if (!otpState) return;
    clearAuthMessage();

    try {
      await sendOtp(otpState.purpose);
    } catch (error) {
      setAuthError(error.message || 'Không thể gửi lại OTP.');
    }
  };

  const signInProvider = async (provider) => {
    setAuthBusy(true);
    setAuthInfo(`Đang mở ${provider === 'github' ? 'GitHub' : 'Google'} để đăng nhập...`);
    try {
      const credential = await signInWithPopup(auth, providerFromName(provider));
      await finishProviderSession(provider, credential);
    } catch (error) {
      try {
        if (await tryLinkExistingProvider(error, provider)) return;
      } catch (linkError) {
        setAuthError(formatAuthError(linkError, provider));
        return;
      }
      setAuthError(formatAuthError(error, provider));
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = React.useCallback(async () => {
    await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include'
    }).catch(() => {});
    await signOut(auth).catch(() => {});
    setAuthUser(null);
    setOtpState(null);
    setAuthMode('login');
    setUserName('Player');
    setAuthForm((form) => ({ ...form, password: '', otp: '', newPassword: '', remember: false }));
    clearAuthMessage();
  }, [clearAuthMessage]);

  const updateSessionProfile = React.useCallback((profile) => {
    setAuthUser((current) => current ? { ...current, ...profile } : current);
    setUserName(displayNameFromUser(profile));
  }, []);

  return {
    userName,
    setUserName,
    authMode,
    setAuthMode,
    authUser,
    authReady,
    otpState,
    setOtpState,
    otpSecondsLeft,
    authForm,
    setAuthForm,
    authMessage,
    authMessageTone,
    setAuthMessage,
    clearAuthMessage,
    authBusy,
    submitAuth,
    signInProvider,
    verifyOtp,
    resendOtp,
    logout,
    updateSessionProfile
  };
}
