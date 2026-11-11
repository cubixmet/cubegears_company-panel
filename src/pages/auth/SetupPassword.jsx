import { useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { authRecoveryService } from '../../services/authRecovery.service';
import { getAuthErrorMessage, getAuthFieldErrors } from '../../utils/authErrors';
import { getStaffLandingPath } from '../../utils/staffLanding';
import '../../styles/login-system.css';
import '../../styles/auth-recovery.css';

export const SetupPassword = () => {
  const location = useLocation();
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
  const [landingPath, setLandingPath] = useState('/access-denied');
  const [doneMessage, setDoneMessage] = useState('');

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
    const nextErrors = {};

    if (!uid || !token) nextErrors.link = 'This setup link is invalid or incomplete. Please use the latest email link.';
    if (!password) nextErrors.password = 'Password is required.';
    else if (password.length < 8) nextErrors.password = 'Password must be at least 8 characters.';
    if (!confirm) nextErrors.confirm = 'Please confirm your password.';
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
      const result = await authRecoveryService.setupPassword({ uid, token, password });
      const accessToken = result?.access || result?.token || result?.accessToken || result?.access_token;
      const refreshToken = result?.refresh || result?.refreshToken || result?.refresh_token;
      const user = result?.user || result?.profile;

      // A disabled company/role can have a completed password setup without
      // being allowed to sign in. Never save or use a partial session.
      if (typeof accessToken !== 'string' || !accessToken ||
          typeof refreshToken !== 'string' || !refreshToken ||
          !user?.id || !user?.email) {
        setDoneMessage(result?.message || 'Password created. Sign in to continue.');
        setLandingPath('/login');
        setDone(true);
        return;
      }

      localStorage.setItem('auth_token', accessToken);
      localStorage.setItem('auth_refresh_token', refreshToken);
      localStorage.setItem('auth_user', JSON.stringify(user));

      const destination = getStaffLandingPath(user);
      setLandingPath(destination);
      setDoneMessage('Password created successfully. Signing you in…');
      setDone(true);
      window.setTimeout(() => window.location.replace(destination), 700);
    } catch (error) {
      const backend = getAuthFieldErrors(error);
      setFieldErrors({
        ...(backend.password ? { password: backend.password } : {}),
        ...((backend.uid || backend.token || backend.non_field_errors)
          ? { link: backend.uid || backend.token || backend.non_field_errors }
          : {}),
      });
      setFormError(getAuthErrorMessage(error, 'Unable to set password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page auth-recovery-page">
      <div className="login-shell">
        <section className="login-card auth-recovery-card">
          <div className="login-brand-row">
            <div className="login-brand-mark">CG</div>
            <div>
              <div className="login-brand-name">cubixgear</div>
              <div className="login-brand-subtitle">Workshop Account Setup</div>
            </div>
          </div>

          {done ? (
            <div className="auth-success-state">
              <span className="auth-success-icon"><CheckCircle2 size={24} /></span>
              <h1 className="login-title">Your account is ready</h1>
              <p className="login-description">{doneMessage}</p>
              <button type="button" className="login-submit" onClick={() => window.location.replace(landingPath)}>{landingPath === '/login' ? 'Go to Sign In' : 'Continue to Workspace'}</button>
            </div>
          ) : (
            <>
              <h1 className="login-title">Create your password</h1>
              <p className="login-description">{email ? 'Set the password for ' + email + '. You can use this email and password to sign in later.' : 'Secure your new cubixgear workshop account before signing in.'}</p>

              {(!uid || !token) && <div className="auth-message is-error" role="alert">This setup link is incomplete. Ask your administrator to resend the invitation.</div>}
              {formError && <div className="auth-message is-error" role="alert">{formError}</div>}
              {fieldErrors.link && <div className="auth-message is-warning">{fieldErrors.link}</div>}

              <form className="login-form" onSubmit={submit} noValidate>
                <label>
                  <span className="login-field-label">New password</span>
                  <div className={'login-input-shell ' + (fieldErrors.password ? 'is-error' : '')}>
                    <span className="login-input-icon"><Lock size={16} /></span>
                    <input className="login-input" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); clearField('password'); }} placeholder="Minimum 8 characters" aria-invalid={Boolean(fieldErrors.password)}/>
                    <button type="button" className="login-password-toggle" onClick={() => setShow((value) => !value)}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                  </div>
                  {fieldErrors.password && <span className="auth-field-error" role="alert">{fieldErrors.password}</span>}
                </label>

                <label>
                  <span className="login-field-label">Confirm password</span>
                  <div className={'login-input-shell ' + (fieldErrors.confirm ? 'is-error' : '')}>
                    <span className="login-input-icon"><Lock size={16} /></span>
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
