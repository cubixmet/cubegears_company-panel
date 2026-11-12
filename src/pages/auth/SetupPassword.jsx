import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authRecoveryService } from '../../services/authRecovery.service';
import { CubixgearLogo } from '../../components/branding/CubixgearLogo';
import { getAuthFieldErrors } from '../../utils/authErrors';
import '../../styles/login-system.css';
import '../../styles/auth-recovery.css';

export const SetupPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const uid = params.get('uid') || '';
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [done, setDone] = useState(false);
  const submitting = useRef(false);

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
    if (submitting.current || done || !uid || !token) return;
    const nextErrors = {};

    if (!password) nextErrors.password = 'Password is required.';
    else if (password.length < 8) nextErrors.password = 'Password must be at least 8 characters.';
    if (!confirm) nextErrors.confirm = 'Please confirm your password.';
    else if (password !== confirm) nextErrors.confirm = 'Passwords do not match.';

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setFormError('');
      return;
    }

    submitting.current = true;
    setLoading(true);
    setFieldErrors({});
    setFormError('');

    try {
      await authRecoveryService.setupPassword({ uid, token, password });
      setPassword('');
      setConfirm('');
      setDone(true);
      navigate(location.pathname, { replace: true });
    } catch (error) {
      const backend = getAuthFieldErrors(error);
      const status = Number(error?.status || error?.response?.status || 0);
      const message = error?.data?.message;
      if (backend.password) {
        setFieldErrors({ password: backend.password });
      } else if (backend.uid || backend.token || message === 'Invalid or expired setup link.' ||
        message === 'Account is already set up. Use password reset.') {
        setFormError('This setup link is invalid, expired, or already used. Request a new link.');
      } else if (status === 429) {
        setFormError('Too many attempts. Please try again later.');
      } else if (!status) {
        setFormError('Unable to connect. Please try again.');
      } else {
        setFormError('Unable to set your password. Please try again or contact support.');
      }
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <main className="login-page auth-recovery-page">
      <div className="login-shell">
        <section className="login-card auth-recovery-card">
          <div className="login-brand-row">
            <div className="login-brand-mark" aria-hidden="true"><CubixgearLogo /></div>
            <div>
              <div className="login-brand-name">cubixgear</div>
              <div className="login-brand-subtitle">Workshop Account Setup</div>
            </div>
          </div>

          {done ? (
            <div className="auth-success-state">
              <span className="auth-success-icon"><CheckCircle2 size={24} /></span>
              <h1 className="login-title" role="status">Password Created Successfully</h1>
              <Link className="login-submit" to="/login" replace>Go to Sign In</Link>
            </div>
          ) : (
            <>
              <h1 className="login-title">Create your password</h1>
              <p className="login-description">Choose a password for your cubixgear workshop account.</p>

              {(!uid || !token) && <div className="auth-message is-error" role="alert">This setup link is incomplete. Ask your administrator to resend the invitation.</div>}
              {formError && <div className="auth-message is-error" role="alert">{formError}</div>}

              <form className="login-form" onSubmit={submit} noValidate aria-busy={loading}>
                <label>
                  <span className="login-field-label">New password</span>
                  <div className={'login-input-shell ' + (fieldErrors.password ? 'is-error' : '')}>
                    <span className="login-input-icon"><Lock size={16} /></span>
                    <input className="login-input" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); clearField('password'); }} placeholder="Minimum 8 characters" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'setup-password-error' : undefined} maxLength={128} />
                    <button type="button" className="login-password-toggle" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((value) => !value)}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                  </div>
                  {fieldErrors.password && <span id="setup-password-error" className="auth-field-error" role="alert">{fieldErrors.password}</span>}
                </label>

                <label>
                  <span className="login-field-label">Confirm password</span>
                  <div className={'login-input-shell ' + (fieldErrors.confirm ? 'is-error' : '')}>
                    <span className="login-input-icon"><Lock size={16} /></span>
                    <input className="login-input" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); clearField('confirm'); }} placeholder="Repeat new password" aria-invalid={Boolean(fieldErrors.confirm)} aria-describedby={fieldErrors.confirm ? 'setup-confirm-error' : undefined} maxLength={128} />
                    <button type="button" className="login-password-toggle" aria-label={showConfirm ? 'Hide confirmation' : 'Show confirmation'} onClick={() => setShowConfirm((value) => !value)}>{showConfirm ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                  </div>
                  {fieldErrors.confirm && <span id="setup-confirm-error" className="auth-field-error" role="alert">{fieldErrors.confirm}</span>}
                </label>

                <div className="password-rules">
                  <span className={password.length >= 8 ? 'ok' : ''}>8+ characters</span>
                </div>

                <button className="login-submit" type="submit" disabled={loading || !uid || !token}>
                  {loading ? 'Creating password…' : 'Create Password'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
};
