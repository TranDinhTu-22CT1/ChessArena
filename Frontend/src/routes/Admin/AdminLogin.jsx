import React from 'react';
import { LockKeyhole, RefreshCw, Shield } from 'lucide-react';

export default function AdminLogin({
  loading,
  message,
  unlockEmail,
  unlockPassword,
  onEmailChange,
  onPasswordChange,
  onSubmit
}) {
  return (
    <main className="admin-login-shell">
      <form className="admin-unlock-card" onSubmit={onSubmit}>
        <div className="admin-login-banner">
          <Shield size={52} />
          <span>Phòng điều hành ChessArena</span>
        </div>
        <h1>Đăng nhập admin</h1>
        <label>
          Email admin
          <input type="email" value={unlockEmail} onChange={(event) => onEmailChange(event.target.value)} placeholder="admin@gmail.com" autoComplete="username" />
        </label>
        <label>
          Mật khẩu admin
          <input type="password" value={unlockPassword} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Nhập mật khẩu quản trị" autoComplete="current-password" />
        </label>
        {message && <p className="admin-message">{message}</p>}
        {loading && (
          <div className="admin-form-loading" role="status" aria-live="polite">
            <span />
            Đang xác thực phiên quản trị...
          </div>
        )}
        <button disabled={loading || !unlockEmail || !unlockPassword}>
          {loading ? <RefreshCw size={18} className="admin-spin" /> : <LockKeyhole size={18} />}
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
        <a className="admin-return-link" href="/">← Về ChessArena</a>
      </form>
    </main>
  );
}
