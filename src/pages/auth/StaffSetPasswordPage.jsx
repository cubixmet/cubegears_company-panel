import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../../api/apiConfig';
import { getStaffLandingPath } from '../../utils/staffLanding';
import '../../styles/login-system.css';
import '../../styles/auth-recovery.css';

async function publicPasswordRequest(path, payload) {
  const response = await fetch(`${API_BASE_URL}/auth/staff-invitation/${path}`, {
    method: 'POST',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const problem = data?.password;
    throw new Error(Array.isArray(problem) ? problem.join(' ') : problem || data.message || 'Invalid or expired setup link.');
  }
  return data;
}

export default function StaffSetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState('checking');
  const [purpose, setPurpose] = useState('setup');
  const [expiry, setExpiry] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [landingPath, setLandingPath] = useState('/login');

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    let active = true;
    setState('checking');
    publicPasswordRequest('validate', { token })
      .then((result) => {
        if (!active) return;
        setPurpose(result.purpose || 'setup');
        setExpiry(result.expiresAt || '');
        setState('ready');
      })
      .catch(() => { if (active) setState('invalid'); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (state !== 'success') return undefined;
    const timer = window.setTimeout(() => navigate('/login?reset=success', { replace: true }), 1000);
    return () => window.clearTimeout(timer);
  }, [state, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('Use at least 8 characters including letters and a number.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const result = await publicPasswordRequest('consume', { token, password, confirmPassword: confirm });
      setPassword('');
      setConfirm('');

      const accessToken = result?.access;
      const refreshToken = result?.refresh;
      const user = result?.user;
      // A password may be saved for a restricted account without granting
      // access. Require the complete Django-verified JWT session; unlike
      // legacy owner accounts, mobile-only staff need not have an email.
      if (typeof accessToken !== 'string' || !accessToken ||
          typeof refreshToken !== 'string' || !refreshToken ||
          !user?.id || !(user?.phone || user?.email)) {
        setState('success');
        return;
      }

      // Replace any older user's saved login rather than mixing sessions.
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_refresh_token');
      localStorage.removeItem('auth_user');
      localStorage.setItem('auth_token', accessToken);
      localStorage.setItem('auth_refresh_token', refreshToken);
      localStorage.setItem('auth_user', JSON.stringify(user));

      const destination = getStaffLandingPath(user);
      setLandingPath(destination);
      setState('signed-in');
      // Full navigation remounts AuthProvider and rechecks /auth/me.
      window.location.replace(destination);
    } catch (cause) {
      setError(cause?.message || 'Could not set password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="login-page auth-recovery-page" data-staff-password-setup>
      <div className="login-shell">
        <section className="login-card auth-recovery-card">
          <div className="login-brand-row"><div className="login-brand-mark">CG</div>
            <div><strong className="login-brand-name">cubixgear</strong>
              <span className="login-brand-subtitle">Secure Workshop Staff Access</span></div>
          </div>
          {state === 'checking' && <p role="status">Checking your one-time password setup link…</p>}
          {state === 'invalid' && <>
            <h1 className="login-title">Link unavailable</h1>
            <p role="alert" className="login-description">This secure link has expired, was already used, or was replaced. Ask your workshop administrator to resend it.</p>
            <Link className="login-submit" to="/login">Go to Login</Link>
          </>}
          {(state === 'success' || state === 'signed-in') && <div className="auth-success-state">
            <CheckCircle2 size={32} aria-hidden="true"/>
            <h1 className="login-title">Password created</h1>
            <p className="login-description">
              {state === 'signed-in'
                ? 'Signing you in securely and opening your workshop…'
                : 'Your password is saved. Sign in with your registered mobile number and password, or contact your workshop administrator if access is restricted.'}
            </p>
            {state === 'signed-in'
              ? <a className="login-submit" href={landingPath}>Continue to Workspace</a>
              : <Link className="login-submit" to="/login">Continue to Login</Link>}
          </div>}
          {state === 'ready' && <>
            <h1 className="login-title">{purpose === 'reset' ? 'Reset your password' : 'Set your account password'}</h1>
            <p className="login-description">Enter your own password. Your workshop never receives it. This link works only once.</p>
            {expiry && <p className="login-description">Link valid until {new Date(expiry).toLocaleString()}.</p>}
            {error && <div className="login-error" role="alert">{error}</div>}
            <form className="login-form" onSubmit={submit} noValidate>
              <label className="block"><span className="login-field-label">New Password</span>
                <div className="login-input-shell">
                  <span className="login-input-icon"><Lock size={16}/></span>
                  <input className="login-input" type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password" value={password} minLength={8}
                    onChange={(event) => setPassword(event.target.value)} required/>
                  <button type="button" className="login-password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                    aria-pressed={showPassword}
                    title={showPassword ? 'Hide new password' : 'Show new password'}>
                    {showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}
                  </button>
                </div>
              </label>
              <label className="block"><span className="login-field-label">Confirm Password</span>
                <div className="login-input-shell">
                  <span className="login-input-icon"><ShieldCheck size={16}/></span>
                  <input className="login-input" type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password" value={confirm} minLength={8}
                    onChange={(event) => setConfirm(event.target.value)} required/>
                  <button type="button" className="login-password-toggle"
                    onClick={() => setShowConfirm((value) => !value)}
                    aria-label={showConfirm ? 'Hide confirmation' : 'Show confirmation'}
                    aria-pressed={showConfirm}
                    title={showConfirm ? 'Hide confirmation' : 'Show confirmation'}>
                    {showConfirm ? <EyeOff size={17}/> : <Eye size={17}/>}
                  </button>
                </div>
              </label>
              <div className="password-rules">
                <span className={password.length >= 8 ? 'ok' : ''}>8+ characters</span>
                <span className={/[A-Za-z]/.test(password) ? 'ok' : ''}>Letters</span>
                <span className={/\d/.test(password) ? 'ok' : ''}>Number</span>
              </div>
              <button className="login-submit" type="submit" disabled={saving}>
                {saving ? 'Saving password…' : 'Set Password'}
              </button>
            </form>
          </>}
        </section>
      </div>
    </main>
  );
}
