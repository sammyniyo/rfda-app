import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { errors as msg } from '../lib/messages';
import './Login.css';

function EyeIcon({ visible }) {
  return visible ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (password !== confirm) {
      setError(msg.resetPassword.passwordsMismatch);
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError(msg.resetPassword.tooShort);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || msg.resetPassword.requestFailed);
        setLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(msg.resetPassword.connection);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-inner">
          <img src="/RwandaFDA.png" alt="Rwanda FDA" className="login-logo" />
          <h1 className="login-title">Invalid link</h1>
          <p className="login-subtext">{msg.resetPassword.invalidToken}</p>
          <Link to="/forgot-password" className="login-submit" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="login-page">
        <div className="login-inner">
          <img src="/RwandaFDA.png" alt="Rwanda FDA" className="login-logo" />
          <h1 className="login-title">Password updated</h1>
          <p className="login-subtext">You can now sign in with your new password.</p>
          <Link to="/login" className="login-submit" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-inner">
        <img src="/RwandaFDA.png" alt="Rwanda FDA" className="login-logo" />
        <h1 className="login-title">Set new password</h1>
        <p className="login-subtext">Enter your new password below.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <div className="login-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                disabled={loading}
                className="login-input"
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>
            <div className="login-input-underline" />
          </div>

          <div className="login-field">
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              disabled={loading}
              className="login-input"
            />
            <div className="login-input-underline" />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <Link to="/login" className="login-back">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
