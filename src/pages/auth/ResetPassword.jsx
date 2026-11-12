import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authRecoveryService } from '../../services/authRecovery.service';
import { CubixgearLogo } from '../../components/branding/CubixgearLogo';
import { getAuthErrorMessage, getAuthFieldErrors } from '../../utils/authErrors';
import { getStaffLandingPath } from '../../utils/staffLanding';
import '../../styles/login-system.css';
import '../../styles/auth-recovery.css';

export const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const uid = params.get('uid') || '';
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [done, setDone] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');
  const [linkState, setLinkState] = useState('checking');

  useEffect(() => {
    if (!token || (!uid && !email)) {
      setLinkState('invalid');
      return;
    }
    let active = true;
    setLinkState('checking');
    authRecoveryService.validatePasswordResetLink({ uid, email, token })
      .then(() => { if (active) setLinkState('ready'); })
      .catch((error) => {
        if (active) setLinkState(error?.status === 400 ? 'invalid' : 'unavailable');
      });
    return () => { active = false; };
  }, [uid, email, token]);

  const clearField = (field) => {
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (linkState !== 'ready') {
      setFormError(linkState === 'invalid'
        ? 'This link has expired. Request a new one.'
        : 'Unable to connect. Please try again.');
      return;
    }
    const nextErrors = {};

    if ((!uid && !email) || !token) nextErrors.link = 'This reset link is invalid or incomplete. Request a new reset link.';
    if (!password) nextErrors.password = 'New password is required.';
    else if (password.length < 8) nextErrors.password = 'Password must be at least 8 characters.';
    if (!confirm) nextErrors.confirm = 'Please confirm your new password.';
    else if (password !== confirm) nextErrors.confirm = 'Passwords do not match.';

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setFormError(nextErrors.link || '');
      return;
    }

    setLoading(true);
    setFieldErrors({});
    setFormError('');

    try {
      const result = await authRecoveryService.resetPassword({ uid, token, email, password });
      const accessToken = result?.access;
      const refreshToken = result?.refresh;
      const user = result?.user;

      // Django verifies the single-use reset token and normal login eligibility
      // before issuing this session. Never manufacture a client-only login.
      if (typeof accessToken === 'string' && accessToken &&
          typeof refreshToken === 'string' && refreshToken &&
          user?.id && user?.email) {
        localStorage.setItem('auth_token', accessToken);
        localStorage.setItem('auth_refresh_token', refreshToken);
        localStorage.setItem('auth_user', JSON.stringify(user));
        // Reload the providers with the verified session, without leaving the
        // reset token in the URL or requiring a second password entry.
        window.location.replace(getStaffLandingPath(user));
        return;
      }

      // Old API deployments or accounts blocked from sign-in may save the
      // password without returning tokens. Never pretend they are signed in.
      setDoneMessage(result?.message || 'Password updated. Please sign in to continue.');
      setDone(true);
    } catch (error) {
      const backend = getAuthFieldErrors(error);
      setFieldErrors({
        ...(backend.password ? { password: backend.password } : {}),
        ...((backend.uid || backend.email || backend.token || backend.non_field_errors)
          ? { link: backend.uid || backend.email || backend.token || backend.non_field_errors }
          : {}),
      });
      setFormError(getAuthErrorMessage(error, 'Unable to reset password.'));
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    const query = new URLSearchParams({ reset: 'success' });
    if (email) query.set('email', email);
    navigate('/login?' + query.toString(), { replace: true });
  };

  return (
    <main className="login-page auth-recovery-page">
      <div className="login-shell">
        <section className="login-card auth-recovery-card">
          <div className="login-brand-row">
            <div className="login-brand-mark" aria-hidden="true"><CubixgearLogo /></div>
            <div>
              <div className="login-brand-name">cubixgear</div>
              <div className="login-brand-subtitle">Password Recovery</div>
            </div>
          </div>

          {done ? (
            <div className="auth-success-state">
              <span className="auth-success-icon"><CheckCircle2 size={24}/></span>
              <h1 className="login-title">Password updated</h1>
              <p className="login-description">{doneMessage}</p>
              <button type="button" className="login-submit" onClick={goToLogin}>Go to Sign In</button>
            </div>
          ) : (
            <>
              <h1 className="login-title">Create a new password</h1>
              <p className="login-description">{email ? 'Resetting access for ' + email + '.' : 'Choose a strong password for your account.'}</p>

              {linkState === 'checking' && <p className="login-description" role="status">Checking your secure reset link…</p>}
              {linkState === 'invalid' && <div className="auth-message is-error" role="alert">This link has expired or is invalid. Request a new one.</div>}
              {linkState === 'unavailable' && <div className="auth-message is-error" role="alert">Unable to connect. Please try again.</div>}
              {formError && <div className="auth-message is-error" role="alert">{formError}</div>}
              {fieldErrors.link && <div className="auth-message is-warning">{fieldErrors.link}</div>}

              <form className="login-form" onSubmit={submit} noValidate>
                <label>
                  <span className="login-field-label">New password</span>
                  <div className={'login-input-shell ' + (fieldErrors.password ? 'is-error' : '')}>
                    <span className="login-input-icon"><Lock size={16}/></span>
                    <input className="login-input" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); clearField('password'); }} placeholder="Minimum 8 characters" aria-invalid={Boolean(fieldErrors.password)}/>
                    <button type="button" className="login-password-toggle" onClick={() => setShow((value) => !value)}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                  </div>
                  {fieldErrors.password && <span className="auth-field-error" role="alert">{fieldErrors.password}</span>}
                </label>

                <label>
                  <span className="login-field-label">Confirm password</span>
                  <div className={'login-input-shell ' + (fieldErrors.confirm ? 'is-error' : '')}>
                    <span className="login-input-icon"><Lock size={16}/></span>
                    <input className="login-input" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); clearField('confirm'); }} placeholder="Repeat new password" aria-invalid={Boolean(fieldErrors.confirm)}/>
                    <button type="button" className="login-password-toggle" onClick={() => setShowConfirm((value) => !value)}>{showConfirm ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                  </div>
                  {fieldErrors.confirm && <span className="auth-field-error" role="alert">{fieldErrors.confirm}</span>}
                </label>

                <div className="password-rules">
                  <span className={password.length >= 8 ? 'ok' : ''}>8+ characters</span>
                  <span className={/[A-Z]/.test(password) ? 'ok' : ''}>Uppercase</span>
                  <span className={/[0-9]/.test(password) ? 'ok' : ''}>Number</span>
                </div>

                <button className="login-submit" type="submit" disabled={loading || linkState !== 'ready'}>
                  {loading ? 'Updating…' : 'Reset Password'}
                </button>
              </form>

              <div className="auth-bottom-link"><Link to="/forgot-password">Request another reset link</Link></div>
            </>
          )}
        </section>
      </div>
    </main>
  );
};
