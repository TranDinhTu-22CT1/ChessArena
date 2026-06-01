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
          <span>ChessArena Control Room</span>
        </div>
        <h1>Admin Login</h1>
        <label>
          Admin email
          <input type="email" value={unlockEmail} onChange={(event) => onEmailChange(event.target.value)} placeholder="admin@gmail.com" autoComplete="username" />
        </label>
        <label>
          Admin password
          <input type="password" value={unlockPassword} onChange={(event) => onPasswordChange(event.target.value)} placeholder="ADMIN_PANEL_PASSWORD" autoComplete="current-password" />
        </label>
        {message && <p className="admin-message">{message}</p>}
        {loading && (
          <div className="admin-form-loading" role="status" aria-live="polite">
            <span />
            Securing admin session...
          </div>
        )}
        <button disabled={loading || !unlockEmail || !unlockPassword}>
          {loading ? <RefreshCw size={18} className="admin-spin" /> : <LockKeyhole size={18} />}
          {loading ? 'Loading admin...' : 'Login'}
        </button>
      </form>
    </main>
  );
}
