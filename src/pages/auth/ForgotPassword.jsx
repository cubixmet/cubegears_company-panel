import { useState } from 'react';
import { ArrowLeft, Link2, Mail, Phone, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authRecoveryService } from '../../services/authRecovery.service';
import { getAuthErrorMessage, getAuthFieldErrors } from '../../utils/authErrors';
import { isValidEmail, normalizeEmail } from '../../utils/validation';
import '../../styles/login-system.css';
import '../../styles/auth-recovery.css';

export const ForgotPassword = () => {
  const [mode, setMode] = useState('reset');
  const [mobile, setMobile] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [previewUrl, setPreviewUrl] = useState('');

  const clearMessages = () => {
    setMessage('');
    setFieldErrors({});
    setIsError(false);
    setPreviewUrl('');
  };

  const submit = async event => {
    event.preventDefault();
    clearMessages();
    const isLegacyEmail = mode === 'magic';
    const cleanEmail = normalizeEmail(email);
    if (isLegacyEmail && (!cleanEmail || !isValidEmail(cleanEmail))) {
      setFieldErrors({ email: 'Enter a valid email address.' });
      return;
    }
    if (!isLegacyEmail && !/^\+[\d\s().-]{8,22}$/.test(mobile.trim())) {
      setFieldErrors({ mobile: 'Enter an international mobile number, e.g. +919876543210.' });
      return;
    }
    if (!isLegacyEmail && !workshop.trim()) {
      setFieldErrors({ workshop: 'Enter your workshop code to reset your password.' });
      return;
    }
    setLoading(true);
    try {
      const result = isLegacyEmail
        ? await authRecoveryService.requestMagicLink(cleanEmail)
        : await authRecoveryService.requestPasswordReset({ mobile: mobile.trim(), workshop: workshop.trim() });
      setMessage(isLegacyEmail
        ? 'If an eligible account exists, a sign-in link will be sent.'
        : 'For a staff account, ask your workshop administrator to share a secure reset link manually.');
      setIsError(false);
      if (result?.previewUrl) setPreviewUrl(result.previewUrl);
    } catch (error) {
      const backend = getAuthFieldErrors(error);
      const fields = {
        email: backend.email || '',
        mobile: backend.mobile || '',
        workshop: backend.workshop || '',
      };
      setFieldErrors(fields);
      setMessage(Object.values(fields).some(Boolean)
        ? '' : getAuthErrorMessage(error, 'Unable to request a secure password reset.'));
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page auth-recovery-page">
      <div className="login-shell">
        <section className="login-card auth-recovery-card">
          <Link to="/login" className="auth-back"><ArrowLeft size={14}/>Back to sign in</Link>
          <div className="login-brand-row">
            <div className="login-brand-mark">CG</div>
            <div><div className="login-brand-name">cubixgear</div><div className="login-brand-subtitle">Secure Account Access</div></div>
          </div>

          <h1 className="login-title">{mode === 'magic' ? 'Existing Account Magic Link' : 'Reset your password'}</h1>
          <p className="login-description">
            {mode === 'magic'
              ? 'Existing email-based accounts may request a secure sign-in link.'
              : 'Use your registered mobile and workshop code. Your administrator prepares and shares a secure reset link manually.'}
          </p>

          <div className="auth-mode-tabs">
            <button type="button" className={mode === 'reset' ? 'active' : ''}
              onClick={() => { setMode('reset'); clearMessages(); }}>
              <RotateCcw size={14}/>Staff Reset Help
            </button>
            <button type="button" className={mode === 'magic' ? 'active' : ''}
              onClick={() => { setMode('magic'); clearMessages(); }}>
              <Link2 size={14}/>Existing Email Login
            </button>
          </div>
          {message && <div className={'auth-message ' + (isError ? 'is-error' : 'is-success')} role="status">{message}</div>}
          <p className="auth-recovery-privacy-note">
            For staff, use the same mobile number and workshop code used to sign in.
            Your workshop administrator can manually resend a password setup or reset link.
          </p>

          <form className="login-form" onSubmit={submit} noValidate>
            {mode === 'magic' ? (
              <label>
                <span className="login-field-label">Existing account email</span>
                <div className={'login-input-shell ' + (fieldErrors.email ? 'is-error' : '')}>
                  <span className="login-input-icon"><Mail size={16}/></span>
                  <input className="login-input" type="email" autoComplete="email"
                    value={email} placeholder="name@company.com"
                    onChange={event => { setEmail(event.target.value); clearMessages(); }}
                    aria-invalid={Boolean(fieldErrors.email)}/>
                </div>
                {fieldErrors.email && <span className="auth-field-error" role="alert">{fieldErrors.email}</span>}
              </label>
            ) : (
              <>
                <label>
                  <span className="login-field-label">Mobile Number with Country Code</span>
                  <div className={'login-input-shell ' + (fieldErrors.mobile ? 'is-error' : '')}>
                    <span className="login-input-icon"><Phone size={16}/></span>
                    <input className="login-input" type="tel" autoComplete="tel"
                      inputMode="tel" value={mobile} placeholder="+919876543210"
                      onChange={event => { setMobile(event.target.value); clearMessages(); }}
                      aria-invalid={Boolean(fieldErrors.mobile)}/>
                  </div>
                  {fieldErrors.mobile && <span className="auth-field-error" role="alert">{fieldErrors.mobile}</span>}
                </label>
                <label>
                  <span className="login-field-label">Workshop Code</span>
                  <div className={'login-input-shell ' + (fieldErrors.workshop ? 'is-error' : '')}>
                    <span className="login-input-icon"><Link2 size={16}/></span>
                    <input className="login-input" type="text" autoComplete="organization"
                      value={workshop} placeholder="e.g. my-workshop"
                      onChange={event => { setWorkshop(event.target.value); clearMessages(); }}
                      aria-invalid={Boolean(fieldErrors.workshop)}/>
                  </div>
                  {fieldErrors.workshop && <span className="auth-field-error" role="alert">{fieldErrors.workshop}</span>}
                </label>
              </>
            )}
            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Requesting…' : mode === 'magic' ? 'Send Magic Link' : 'Request WhatsApp Reset Link'}
            </button>
          </form>
          {previewUrl && <div className="auth-dev-link"><span>Development preview</span>
            <Link to={previewUrl}>{mode === 'magic' ? 'Open magic link' : 'Open reset link'}</Link>
          </div>}
        </section>
      </div>
    </main>
  );
};
