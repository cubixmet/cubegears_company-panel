import { useState } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CubixgearLogo } from '../../components/branding/CubixgearLogo';
import { authRecoveryService } from '../../services/authRecovery.service';
import { getAuthErrorMessage, getAuthFieldErrors } from '../../utils/authErrors';
import { isValidEmail, normalizeEmail } from '../../utils/validation';
import '../../styles/login-system.css';
import '../../styles/auth-recovery.css';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  const clearFeedback = () => {
    setMessage('');
    setIsError(false);
    setEmailError('');
    setPreviewUrl('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;

    clearFeedback();
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      // Request an actual password reset email, not a passwordless sign-in link.
      const result = await authRecoveryService.requestPasswordReset(cleanEmail);
      if (result?.previewUrl) setPreviewUrl(result.previewUrl);
      // Do not reveal whether the email is registered.
      setMessage('If an account exists for this email, a password reset link will be sent.');
      setIsError(false);
    } catch (error) {
      const backend = getAuthFieldErrors(error);
      if (backend.email) setEmailError(backend.email);
      else setMessage(getAuthErrorMessage(error, 'Unable to request a password reset link.'));
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page auth-recovery-page">
      <div className="login-shell">
        <section className="login-card auth-recovery-card">
          <Link to="/login" className="auth-back">
            <ArrowLeft size={14} aria-hidden="true" /> Back to sign in
          </Link>

          <div className="login-brand-row">
            <div className="login-brand-mark" aria-hidden="true"><CubixgearLogo /></div>
            <div>
              <div className="login-brand-name">cubixgear</div>
              <div className="login-brand-subtitle">Secure Account Access</div>
            </div>
          </div>

          <h1 className="login-title">Reset your password</h1>
          <p className="login-description">
            Enter your registered email to receive a password reset link.
          </p>

          {message && (
            <div className={'auth-message ' + (isError ? 'is-error' : 'is-success')}
              role={isError ? 'alert' : 'status'}>
              {message}
            </div>
          )}

          <form className="login-form" onSubmit={submit} noValidate>
            <label htmlFor="forgot-password-email" className="block">
              <span className="login-field-label">Email</span>
              <div className={'login-input-shell ' + (emailError ? 'is-error' : '')}>
                <span className="login-input-icon" aria-hidden="true"><Mail size={16} /></span>
                <input
                  id="forgot-password-email"
                  className="login-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  placeholder="name@example.com"
                  required
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'forgot-password-email-error' : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearFeedback();
                  }}
                />
              </div>
              {emailError && (
                <span id="forgot-password-email-error" className="auth-field-error" role="alert">
                  {emailError}
                </span>
              )}
            </label>
            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>

          {previewUrl && (
            <div className="auth-dev-link">
              <span>Development preview</span>
              <Link to={previewUrl}>Open reset link</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
