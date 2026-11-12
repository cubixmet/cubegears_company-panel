import { CubixgearLogo } from '../../components/branding/CubixgearLogo';
import { useState } from "react";
import { Eye, EyeOff, Lock, Mail, Phone } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getCredentialError, getAuthFieldErrors } from '../../utils/authErrors';
import { getStaffLandingPath } from '../../utils/staffLanding';
import { isValidEmail, normalizeEmail } from '../../utils/validation';
import '../../styles/login-system.css';

const LOGIN_COUNTRY_CODES = [
  { code: '+91', label: 'India' },
  { code: '+971', label: 'UAE' },
  { code: '+966', label: 'Saudi Arabia' },
  { code: '+974', label: 'Qatar' },
  { code: '+968', label: 'Oman' },
  { code: '+965', label: 'Kuwait' },
  { code: '+973', label: 'Bahrain' },
  { code: '+1', label: 'USA / Canada' },
  { code: '+44', label: 'UK' },
  { code: '+61', label: 'Australia' },
];

export const Login = () => {
  const { login, loading, isMockMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const suggestedEmail = params.get('email') || '';
  const resetComplete = params.get('reset') === 'success';

  const [identifier, setIdentifier] = useState(isMockMode ? 'admin@cubixgear.com' : suggestedEmail);
  const [countryCode, setCountryCode] = useState('+91');
  const isEmailIdentifier = identifier.includes('@');
  const showCountryCode = !isEmailIdentifier && !identifier.trim().startsWith('+');
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

    const enteredIdentifier = identifier.trim();
    const isEmail = enteredIdentifier.includes('@');
    // Keep the existing backend contract: normalized emails or E.164 mobile numbers.
    const identity = isEmail
      ? normalizeEmail(enteredIdentifier)
      : enteredIdentifier.startsWith('+')
        ? enteredIdentifier.replace(/[\s().-]/g, '')
        : `${countryCode}${enteredIdentifier.replace(/[\s().-]/g, '')}`;
    const nextErrors = {};
    if (!enteredIdentifier) nextErrors.identifier = 'Email or mobile number is required.';
    else if (isEmail && !isValidEmail(identity))
      nextErrors.identifier = 'Enter a valid email address.';
    else if (!isEmail && !/^\+[1-9]\d{7,14}$/.test(identity))
      nextErrors.identifier = 'Enter a valid mobile number.';
    if (!password) nextErrors.password = 'Password is required.';

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setFormError('');
      return;
    }

    setFieldErrors({});
    setFormError('');

    try {
      const authenticatedUser = await login({ identifier: identity, password, ...(workshop.trim() ? { workshop: workshop.trim().toLowerCase() } : {}) });
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
            <div className="login-identifier-field">
              <label htmlFor="login-identifier" className="login-field-label">Mobile Number or Email</label>
              <div className={'login-input-shell ' + (fieldErrors.identifier ? 'is-error' : '')}>
                {showCountryCode ? (
                  <select
                    className="login-country-select"
                    aria-label="Country code"
                    value={countryCode}
                    onChange={(event) => {
                      setCountryCode(event.target.value);
                      clearField('identifier');
                    }}
                  >
                    {LOGIN_COUNTRY_CODES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.code} {country.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="login-input-icon" aria-hidden="true">
                    {isEmailIdentifier ? <Mail size={16} strokeWidth={1.8} /> : <Phone size={16} strokeWidth={1.8} />}
                  </span>
                )}
                <input
                  id="login-identifier"
                  className="login-input"
                  type="text"
                  autoComplete="username"
                  inputMode={isEmailIdentifier ? 'email' : 'text'}
                  value={identifier}
                  onChange={(event) => {
                    const value = event.target.value;
                    const matchingCountry = value.startsWith('+')
                      ? LOGIN_COUNTRY_CODES.find((country) => value.startsWith(country.code))
                      : null;
                    if (matchingCountry) {
                      setCountryCode(matchingCountry.code);
                      setIdentifier(value.slice(matchingCountry.code.length).replace(/[\s().-]/g, ''));
                    } else {
                      setIdentifier(value);
                    }
                    clearField('identifier');
                  }}
                  placeholder="90000000000"
                  aria-invalid={Boolean(fieldErrors.identifier)}
                  aria-describedby={fieldErrors.identifier ? 'login-identifier-error' : undefined}
                />
              </div>
              {fieldErrors.identifier && (
                <span id="login-identifier-error" className="auth-field-error" role="alert">
                  {fieldErrors.identifier}
                </span>
              )}
            </div>

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
            <p className="login-register">New workshop? <a href="https://cubixgear.tech/signup">Register</a></p>
          </div>
        </section>
      </div>
    </main>
  );
};
