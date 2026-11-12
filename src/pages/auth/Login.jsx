import { CubixgearLogo } from '../../components/branding/CubixgearLogo';
import { useRef, useState } from "react";
import { Eye, EyeOff, Lock, Mail, Phone } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAuthFieldErrors } from '../../utils/authErrors';
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

  const initialEmail = isMockMode ? 'admin@cubixgear.com' : suggestedEmail;
  const [loginMethod, setLoginMethod] = useState('email');
  const [mobileNumber, setMobileNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState(initialEmail);
  const [countryCode, setCountryCode] = useState('+91');
  // Keep each identifier separate when the user switches sign-in methods.
  const identifier = loginMethod === 'email' ? emailAddress : mobileNumber;
  const isEmailIdentifier = loginMethod === 'email';
  const showCountryCode = !isEmailIdentifier && !mobileNumber.trim().startsWith('+');
  const [workshop, setWorkshop] = useState('');
  const [needsWorkshop, setNeedsWorkshop] = useState(false);
  const [password, setPassword] = useState(isMockMode ? 'password123' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [invalidCredentials, setInvalidCredentials] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const submitting = useRef(false);

  const clearField = (field) => {
    // Typing a correction clears the previous unsuccessful sign-in state.
    setInvalidCredentials(false);
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError('');
  };

  const selectLoginMethod = (method) => {
    setLoginMethod(method);
    setWorkshop('');
    setNeedsWorkshop(false);
    setFieldErrors({});
    setInvalidCredentials(false);
    setFormError('');
  };

  const clearWorkshop = () => {
    setNeedsWorkshop(false);
    setWorkshop('');
    clearField('workshop');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Prevent rapid double submits while React state is updating.
    if (loading || submitting.current) return;

    const enteredIdentifier = identifier.trim();
    const isEmail = loginMethod === 'email';
    // Keep the existing backend contract: normalized emails or E.164 mobile numbers.
    const identity = isEmail
      ? normalizeEmail(enteredIdentifier)
      : enteredIdentifier.startsWith('+')
        ? enteredIdentifier.replace(/[\s().-]/g, '')
        : `${countryCode}${enteredIdentifier.replace(/[\s().-]/g, '')}`;
    const nextErrors = {};
    if (!enteredIdentifier) nextErrors.identifier = isEmail ? 'Email address is required.' : 'Mobile number is required.';
    else if (isEmail && !isValidEmail(identity))
      nextErrors.identifier = 'Enter a valid email address.';
    else if (!isEmail && !/^\+[1-9]\d{7,14}$/.test(identity))
      nextErrors.identifier = 'Enter a valid mobile number.';
    if (!password) nextErrors.password = 'Password is required.';
    if (needsWorkshop && !workshop.trim()) nextErrors.workshop = 'Enter your workshop code.';

    if (Object.keys(nextErrors).length) {
      setInvalidCredentials(false);
      setFieldErrors(nextErrors);
      setFormError('');
      return;
    }

    setFieldErrors({});
    setFormError('');
    setInvalidCredentials(false);

    submitting.current = true;
    try {
      const authenticatedUser = await login({ identifier: identity, password, ...(workshop.trim() ? { workshop: workshop.trim().toLowerCase() } : {}) });
      navigate(getStaffLandingPath(authenticatedUser, params.get('next')), { replace: true });
    } catch (error) {
      const backendFields = getAuthFieldErrors(error);
      const status = Number(error?.status || error?.response?.status || 0);
      const identifierError = backendFields.identifier || backendFields.email || backendFields.mobile;
      const workshopError = backendFields.workshop;
      const hasFieldError = Boolean(identifierError || backendFields.password || workshopError);
      const credentialsRejected = status === 401 || (status === 400 &&
        backendFields.non_field_errors === 'Invalid credentials or workshop selection.');
      const serviceUnavailable = !status && (!error?.message ||
        ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error?.code));

      if (workshopError) setNeedsWorkshop(true);
      setInvalidCredentials(credentialsRejected && !hasFieldError);
      setFieldErrors({
        ...(identifierError ? { identifier: isEmail ? 'Enter a valid email address.' : 'Enter a valid mobile number.' } : {}),
        ...(workshopError ? { workshop: 'Enter your workshop code.' } : {}),
        ...(backendFields.password ? { password: backendFields.password } : {}),
      });
      setFormError(status === 429
        ? `Too many sign-in attempts. Try again${error?.retryAfterSeconds ? ` in ${error.retryAfterSeconds} seconds` : ' later'}.`
        : hasFieldError ? '' : credentialsRejected
          ? 'Unable to sign in with these details. Check your account setup or password.'
          : serviceUnavailable
            ? 'Unable to connect. Please try again.'
            : 'Something went wrong. Please try again.');
    } finally {
      submitting.current = false;
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
            <div id="login-form-error" role="alert" className="login-error">
              {formError}
            </div>
          )}
          {invalidCredentials && (
            <div className="login-help-note" role="note">
              {isEmailIdentifier
                ? 'Registered a new workshop? Complete password setup from your email first. If you use this email for more than one workshop, enter its workshop code. For expired links, use Password help.'
                : 'New staff account? Ask your workshop administrator for a valid password setup link. If your phone is linked to several workshops, enter the correct workshop code.'}
              <div>
                <Link to="/forgot-password" className="login-forgot">
                  Password help
                </Link>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="login-identifier-field">
              <div className="login-method-switch" role="group" aria-label="Sign in using">
                <button
                  type="button"
                  className={'login-method-option' + (isEmailIdentifier ? ' is-active' : '')}
                  aria-pressed={isEmailIdentifier}
                  onClick={() => selectLoginMethod('email')}
                >
                  <Mail size={15} strokeWidth={1.8} aria-hidden="true" />
                  Email
                </button>
                <button
                  type="button"
                  className={'login-method-option' + (!isEmailIdentifier ? ' is-active' : '')}
                  aria-pressed={!isEmailIdentifier}
                  onClick={() => selectLoginMethod('mobile')}
                >
                  <Phone size={15} strokeWidth={1.8} aria-hidden="true" />
                  Mobile Number
                </button>
              </div>
              <label htmlFor="login-identifier" className="login-field-label">
                {isEmailIdentifier ? 'Email Address' : 'Mobile Number'}
              </label>
              <div className={'login-input-shell ' + (fieldErrors.identifier || invalidCredentials ? 'is-error' : '')}>
                {showCountryCode ? (
                  <select
                    className="login-country-select"
                    aria-label="Country code"
                    value={countryCode}
                    onChange={(event) => {
                      setCountryCode(event.target.value);
                      clearWorkshop();
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
                  type={isEmailIdentifier ? 'email' : 'tel'}
                  autoComplete="username"
                  inputMode={isEmailIdentifier ? 'email' : 'tel'}
                  value={identifier}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (isEmailIdentifier) {
                      setEmailAddress(value);
                    } else {
                      const matchingCountry = value.startsWith('+')
                        ? LOGIN_COUNTRY_CODES.find((country) => value.startsWith(country.code))
                        : null;
                      clearWorkshop();
                      if (matchingCountry) {
                        setCountryCode(matchingCountry.code);
                        setMobileNumber(value.slice(matchingCountry.code.length).replace(/[\s().-]/g, ''));
                      } else {
                        setMobileNumber(value);
                      }
                    }
                    clearField('identifier');
                  }}
                  placeholder={isEmailIdentifier ? 'name@example.com' : '9876543210'}
                  aria-invalid={Boolean(fieldErrors.identifier || invalidCredentials)}
                  aria-describedby={fieldErrors.identifier ? 'login-identifier-error'
                    : invalidCredentials ? 'login-form-error' : undefined}
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
                  }} placeholder="e.g. my-auto-workshop" aria-invalid={Boolean(fieldErrors.workshop)}
                  aria-describedby={fieldErrors.workshop ? 'login-workshop-error' : undefined} />
              </div>
              {fieldErrors.workshop && <span id="login-workshop-error" className="auth-field-error" role="alert">{fieldErrors.workshop}</span>}
            </label>}

            <label className="block">
              <div className="login-password-label">
                <span className="login-field-label">Password</span>
                <Link to="/forgot-password" className="login-forgot">
                  Forgot password?
                </Link>
              </div>

              <div className={'login-input-shell ' + (fieldErrors.password || invalidCredentials ? 'is-error' : '')}>
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
                  aria-invalid={Boolean(fieldErrors.password || invalidCredentials)}
                  aria-describedby={fieldErrors.password ? 'login-password-error'
                    : invalidCredentials ? 'login-form-error' : undefined}
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
