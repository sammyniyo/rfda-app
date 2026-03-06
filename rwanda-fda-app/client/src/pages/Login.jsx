import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

export default function Login() {
  const navigate = useNavigate();
  const { setToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('https://rwandafda.gov.rw/monitoring-tool/api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: email.trim(),
          user_passcode: password,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.error || payload.success === false) {
        setError(payload.error || payload.message || msg.login.invalidCredentials);
        setLoading(false);
        return;
      }

      const data = payload.data || payload;

      const baseUser = {
        id: data.user?.user_id ?? data.staff?.staff_id,
        email: data.user?.user_email || data.staff?.staff_email || email.trim(),
        access: data.user?.user_access ?? null,
        roleId: data.user?.role_id ?? null,
      };

      const staffProfile = data.staff
        ? {
            name: data.staff.staff_names || email.trim(),
            phone: data.staff.staff_phone || null,
            gender: data.staff.staff_gender || null,
            group: data.staff.staff_group || null,
            dutyStation: data.staff.staff_duty_station || null,
            employmentType: data.staff.staff_employment_type || null,
            hireDate: data.staff.staff_hire_date || null,
            degree: data.staff.staff_degree || null,
            qualifications: data.staff.staff_qualifications || null,
            supervisorId: data.staff.supervisor_id ?? null,
          }
        : {};

      const user = { ...baseUser, ...staffProfile };

      setToken(data.token || payload.token || 'php-session', user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(msg.login.connection);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-inner">
        <img src="/RwandaFDA.png" alt="Rwanda FDA" className="login-logo" />
        <p className="login-tagline">Staff Portal</p>
        <p className="login-subtitle">Sign in to manage tasks, track applications, and stay updated.</p>

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

          <div className="login-field">
            <div className="login-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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

          <Link to="/forgot-password" className="login-forgot">
            Forgot password?
          </Link>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
