import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errors as msg } from '../lib/messages';
import './Login.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || msg.forgotPassword.requestFailed);
        setLoading(false);
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(msg.forgotPassword.connection);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-page">
        <div className="login-inner">
          <img src="/RwandaFDA.png" alt="Rwanda FDA" className="login-logo" />
          <h1 className="login-title">Check your email</h1>
          <p className="login-subtext">
            If an account exists with that email, you will receive a password reset link shortly.
          </p>
          <p className="login-subtext">
            In development, the reset link may appear in the server console.
          </p>
          <Link to="/login" className="login-submit" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-inner">
        <img src="/RwandaFDA.png" alt="Rwanda FDA" className="login-logo" />
        <h1 className="login-title">Forgot password?</h1>
        <p className="login-subtext">Enter your email and we'll send you a reset link.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
              className="login-input"
            />
            <div className="login-input-underline" />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <Link to="/login" className="login-back">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
