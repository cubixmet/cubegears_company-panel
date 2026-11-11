import { CubixgearLogo } from '../../components/branding/CubixgearLogo';
import { useState } from "react";
import { Eye, EyeOff, Lock, Phone } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getCredentialError, getAuthFieldErrors } from '../../utils/authErrors';
import { getStaffLandingPath } from '../../utils/staffLanding';
import { isValidEmail, normalizeEmail } from '../../utils/validation';
import '../../styles/login-system.css';

export const Login = () => {
  const { login, loading, isMockMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const suggestedEmail = params.get('email') || '';
  const resetComplete = params.get('reset') === 'success';

  const [identifier, setIdentifier] = useState(isMockMode ? 'admin@cubixgear.com' : suggestedEmail);
  const [workshop, setWorkshop] = useState('');
  const [needsWorkshop, setNeedsWorkshop] = useState(false);
  const [password, setPassword] = useState(isMockMode ? 'password123' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const clearField = (field) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const identity = identifier.trim();
    const nextErrors = {};
    if (!identity) nextErrors.identifier = 'Email or mobile number is required.';
    else if (identity.includes('@') && !isValidEmail(normalizeEmail(identity)))
      nextErrors.identifier = 'Enter a valid email address.';
    else if (!identity.includes('@') && !/^\+[\d\s().-]{8,22}$/.test(identity))
      nextErrors.identifier = 'Enter mobile with country code, e.g. +919876543210.';
    if (!password) nextErrors.password = 'Password is required.';

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setFormError('');
      return;
    }

    setFieldErrors({});
    setFormError('');

    try {
      const authenticatedUser = await login({ identifier: identity.includes('@') ? normalizeEmail(identity) : identity, password, ...(workshop.trim() ? { workshop: workshop.trim().toLowerCase() } : {}) });
      navigate(getStaffLandingPath(authenticatedUser, params.get('next')), { replace: true });
    } catch (error) {
      const backendFields = getAuthFieldErrors(error);
      const credentialError = getCredentialError(error);

      const needsSelection = Boolean(backendFields.workshop);
      setNeedsWorkshop(needsSelection || needsWorkshop);
      const hasFieldError = Boolean(backendFields.identifier || backendFields.password || backendFields.workshop);
      // Show explicit field validation inline, but show generic invalid
      // credentials only once in the form banner (not in three places).
      setFieldErrors({
        ...(backendFields.identifier ? { identifier: backendFields.identifier } : {}),
        ...(backendFields.workshop ? { workshop: backendFields.workshop } : {}),
        ...(backendFields.password ? { password: backendFields.password } : {}),
      });
      setFormError(error?.status === 429
        ? `Too many sign-in attempts. Try again${error?.retryAfterSeconds ? ` in ${error.retryAfterSeconds} seconds` : ' later'}.`
        : hasFieldError ? '' : credentialError);
    }
  };

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-card">
          <div>
            <div className="login-brand-row">
              <div className="login-brand-mark" aria-hidden="true"><CubixgearLogo /></div>
              <div>
                <div className="login-brand-name">cubixgear</div>
                <div className="login-brand-subtitle">Workshop Management</div>
              </div>
            </div>

            <h1 className="login-title">Welcome back</h1>
            <p className="login-description">
              Staff: sign in using your international mobile number and password. Existing email accounts also remain supported. No OTP.
            </p>
          </div>

          {resetComplete && !formError && (
            <div className="login-success" role="status">
              Password updated successfully. Sign in with your new password.
            </div>
          )}

          {formError && (
            <div role="alert" className="login-error">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <label className="block">
              <span className="login-field-label">Mobile Number with Country Code or Email</span>
              <div className={'login-input-shell ' + (fieldErrors.identifier ? 'is-error' : '')}>
                <span className="login-input-icon" aria-hidden="true">
                  <Phone size={16} strokeWidth={1.8} />
                </span>
                <input
                  className="login-input"
                  type="text"
                  autoComplete="username"
                  inputMode={identifier.includes('@') ? 'email' : 'tel'}
                  value={identifier}
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    clearField('identifier');
                  }}
                  placeholder="+919876543210"
                  aria-invalid={Boolean(fieldErrors.identifier)}
                  aria-describedby={fieldErrors.identifier ? 'login-identifier-error' : undefined}
                />
              </div>
              {fieldErrors.identifier && (
                <span id="login-identifier-error" className="auth-field-error" role="alert">
                  {fieldErrors.identifier}
                </span>
              )}
            </label>

            {needsWorkshop && <label className="block">
              <span className="login-field-label">Workshop code</span>
              <div className={'login-input-shell ' + (fieldErrors.workshop ? 'is-error' : '')}>
                <input className="login-input" type="text" autoComplete="organization"
                  value={workshop} onChange={(event) => {
                    setWorkshop(event.target.value);
                    clearField('workshop');
                  }} placeholder="e.g. my-auto-workshop" />
              </div>
              {fieldErrors.workshop && <span className="auth-field-error" role="alert">{fieldErrors.workshop}</span>}
            </label>}

            <label className="block">
              <div className="login-password-label">
                <span className="login-field-label">Password</span>
                <Link to="/forgot-password" className="login-forgot">
                  Forgot password?
                </Link>
              </div>

              <div className={'login-input-shell ' + (fieldErrors.password ? 'is-error' : '')}>
                <span className="login-input-icon" aria-hidden="true">
                  <Lock size={17} strokeWidth={1.9} />
                </span>
                <input
                  className="login-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearField('password');
                  }}
                  placeholder="Enter your password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="login-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && (
                <span id="login-password-error" className="auth-field-error" role="alert">
                  {fieldErrors.password}
                </span>
              )}
            </label>

            <button type="submit" disabled={loading} className="login-submit">
              {loading && <span className="login-spinner" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="login-footer">
            <div className="login-secure">
              <span className="login-secure-dot" />
              Secure cubixgear workspace access
            </div>

            {isMockMode && <div className="login-mock">Development mock mode</div>}
            <p className="login-description">New workshop? <Link to="/signup">Register using mobile number</Link></p>
          </div>
        </section>
      </div>
    </main>
  );
};
