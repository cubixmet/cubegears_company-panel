import { useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Info, KeyRound, Mail, WandSparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CubixgearLogo } from '../../components/branding/CubixgearLogo';
import { authRecoveryService } from '../../services/authRecovery.service';
import { getAuthErrorMessage, getAuthFieldErrors } from '../../utils/authErrors';
import { isValidEmail, normalizeEmail } from '../../utils/validation';
import '../../styles/login-system.css';
import '../../styles/auth-recovery.css';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState('reset');
  const isMagicLink = mode === 'magic';
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const [feedback, setFeedback] = useState(null);
  const [emailError, setEmailError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  const clearFeedback = () => {
    setFeedback(null);
    setEmailError('');
    setPreviewUrl('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (loading || submitting.current) return;

    clearFeedback();
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      // Django intentionally does not reveal whether this account exists.
      // Do not tell an anonymous user that an email definitely arrived.
      const result = isMagicLink
        ? await authRecoveryService.requestMagicLink(cleanEmail)
        : await authRecoveryService.requestPasswordReset(cleanEmail);

      if (result?.previewUrl) setPreviewUrl(result.previewUrl);
      setFeedback({
        type: 'info',
        title: 'Check your email if registered',
        message: isMagicLink
          ? 'Only registered, eligible accounts receive a magic sign-in link. No email or login link is created for an unknown address. If you have an account, check your inbox and spam folder.'
          : 'Only registered, eligible accounts receive password reset instructions. No email or reset link is created for an unknown address. If you have an account, check your inbox and spam folder.',
      });
    } catch (error) {
      const fields = getAuthFieldErrors(error);
      const fieldError = fields.email;
      if (fieldError) {
        setEmailError(fieldError);
      } else {
        const status = Number(error?.status || error?.response?.status || 0);
        const message = status === 429
          ? `Too many requests. Try again${error?.retryAfterSeconds ? ` in ${error.retryAfterSeconds} seconds` : ' later'}.`
          : getAuthErrorMessage(error, isMagicLink
            ? 'Unable to request a magic login link. Please try again.'
            : 'Unable to request a password reset link. Please try again.');
        setFeedback({ type: 'error', title: 'Request failed', message });
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

          <h1 className="login-title">{isMagicLink ? 'Sign in with a magic link' : 'Reset your password'}</h1>
          <p className="login-description">
            {isMagicLink
              ? 'Request a one-time email login link (valid for 15 minutes).'
              : 'Request a password reset link using your registered email address.'}
          </p>

          <div className="auth-recovery-methods" role="group" aria-label="Choose account recovery method">
            <button
              type="button"
              className={'auth-recovery-method' + (!isMagicLink ? ' is-active' : '')}
              aria-pressed={!isMagicLink}
              disabled={loading}
              onClick={() => {
                setMode('reset');
                clearFeedback();
              }}
            >
              <KeyRound size={16} strokeWidth={1.8} aria-hidden="true" />
              Reset Password
            </button>
            <button
              type="button"
              className={'auth-recovery-method' + (isMagicLink ? ' is-active' : '')}
              aria-pressed={isMagicLink}
              disabled={loading}
              onClick={() => {
                setMode('magic');
                clearFeedback();
              }}
            >
              <WandSparkles size={16} strokeWidth={1.8} aria-hidden="true" />
              Magic Login Link
            </button>
          </div>

          <form className="login-form" onSubmit={submit} noValidate>
            <label htmlFor="forgot-password-email" className="block">
              <span className="login-field-label">Email address</span>
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
              {loading ? 'Submitting…' : isMagicLink ? 'Send Magic Link' : 'Send Reset Link'}
            </button>

            {feedback && (
              <div
                className={'auth-recovery-feedback ' + (feedback.type === 'info' ? 'is-info' : 'is-error')}
                role={feedback.type === 'info' ? 'status' : 'alert'}
                aria-live={feedback.type === 'info' ? 'polite' : 'assertive'}
              >
                {feedback.type === 'info'
                  ? <Info size={19} aria-hidden="true" />
                  : <AlertCircle size={19} aria-hidden="true" />}
                <div>
                  <strong>{feedback.title}</strong>
                  <p>{feedback.message}</p>
                </div>
              </div>
            )}
          </form>

          {previewUrl && (
            <div className="auth-dev-link">
              <span>Development preview</span>
              <Link to={previewUrl}>{isMagicLink ? 'Open magic link' : 'Open reset link'}</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
