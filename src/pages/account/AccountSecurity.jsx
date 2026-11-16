import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AccountHeader } from '../../components/account';
import { Eye, EyeOff, KeyRound, Link2, Lock } from 'lucide-react';
import { authRecoveryService } from '../../services/authRecovery.service';
import { useAuth } from '../../hooks/useAuth';
import { getAuthErrorMessage, getAuthFieldErrors } from '../../utils/authErrors';
import '../../styles/account-security.css';
import '../../styles/account-security-inputs.css';

export const AccountSecurity = () => {
  const { user, clearSession } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [passwordError, setPasswordError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const changing = useRef(false);

  const change = async (event) => {
    event.preventDefault();
    if (changing.current) return;
    setPasswordError(null);
    if (newPassword !== confirm) {
      setPasswordError({ field: 'confirm', message: 'New passwords do not match.' });
      event.currentTarget.elements.confirmPassword.focus();
      return;
    }
    changing.current = true;
    setLoading(true);
    try {
      await authRecoveryService.changePassword({ currentPassword, newPassword });
      // Django revokes the old session as part of a successful change.
      clearSession();
      window.location.replace('/login?reset=success');
    } catch (error) {
      const fields = getAuthFieldErrors(error);
      const message = getAuthErrorMessage(error, 'Unable to change password. Please try again.');
      const currentError = fields.current_password || fields.currentPassword ||
        (message === 'Current password is incorrect.' ? message : '');
      const newError = fields.new_password || fields.newPassword || fields.non_field_errors;
      setPasswordError(currentError ? { field: 'current', message: currentError }
        : newError ? { field: 'new', message: newError } : { message });
    } finally {
      changing.current = false;
      setLoading(false);
    }
  };

  const sendMagic = async () => {
    if (!user?.email) return setMessage('No account email is available.');
    setMagicLoading(true);
    setMessage('');
    try {
      await authRecoveryService.requestMagicLink(user.email);
      // Never expose preview URLs or one-time authentication tokens in the UI.
      setMessage('If this email supports magic-link sign-in, check your inbox.');
    } catch (error) {
      setMessage(error?.message || 'Unable to send magic link.');
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <div className="account-security-page">
      <AccountHeader
        title="Password & Security"
        active="security"
        onNavigate={navigate}
      />

      {message && <div className="account-security-message" role="status" aria-live="polite">{message}</div>}

      <div className="account-security-grid">
        <section className="account-security-card">
          <div className="account-security-card-head"><KeyRound size={18} aria-hidden="true"/><div><strong>Change Password</strong>
            <span>Use your current password to set a new one. You’ll sign in again after saving.</span></div></div>
          <form onSubmit={change} className="account-security-form">
            <label className="account-security-field">
              <span>Current Password</span>
              <div className="account-security-input-row">
                <Lock className="account-security-field-icon" size={18} aria-hidden="true" />
                <input className="account-security-password-input" autoComplete="current-password"
                  aria-label="Current password" type={showCurrent ? 'text' : 'password'}
                  value={currentPassword} onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(null); }}
                  readOnly={loading} aria-invalid={passwordError?.field === 'current'}
                  aria-describedby={passwordError?.field === 'current' ? 'change-password-error' : undefined} required />
                <button className="account-security-visibility-toggle" type="button"
                  aria-label={showCurrent ? "Hide current password" : "Show current password"}
                  aria-pressed={showCurrent} onClick={() => setShowCurrent((v) => !v)}>
                  {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError?.field === 'current' && <small id="change-password-error" className="account-security-error" role="alert">{passwordError.message}</small>}
            </label>
            <label className="account-security-field">
              <span>New Password</span>
              <div className="account-security-input-row">
                <Lock className="account-security-field-icon" size={18} aria-hidden="true" />
                <input className="account-security-password-input" autoComplete="new-password"
                  minLength={8} aria-label="New password" type={showNew ? 'text' : 'password'}
                  value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null); }}
                  readOnly={loading} aria-invalid={passwordError?.field === 'new'}
                  aria-describedby={passwordError?.field === 'new' ? 'change-password-error' : undefined}
                  placeholder="Minimum 8 characters" required />
                <button className="account-security-visibility-toggle" type="button"
                  aria-label={showNew ? "Hide new password" : "Show new password"}
                  aria-pressed={showNew} onClick={() => setShowNew((v) => !v)}>
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError?.field === 'new' && <small id="change-password-error" className="account-security-error" role="alert">{passwordError.message}</small>}
            </label>
            <label className="account-security-field">
              <span>Confirm New Password</span>
              <div className="account-security-input-row">
                <Lock className="account-security-field-icon" size={18} aria-hidden="true" />
                <input className="account-security-password-input" type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password" minLength={8} aria-label="Confirm new password"
                  name="confirmPassword" value={confirm} onChange={(e) => { setConfirm(e.target.value); setPasswordError(null); }}
                  readOnly={loading} aria-invalid={passwordError?.field === 'confirm'}
                  aria-describedby={passwordError?.field === 'confirm' ? 'change-password-error' : undefined}
                  placeholder="Confirm your new password" required />
                <button className="account-security-visibility-toggle" type="button"
                  aria-label={showConfirm ? "Hide confirmed password" : "Show confirmed password"}
                  aria-pressed={showConfirm} onClick={() => setShowConfirm((v) => !v)}>
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError?.field === 'confirm' && <small id="change-password-error" className="account-security-error" role="alert">{passwordError.message}</small>}
            </label>
            {passwordError && !passwordError.field && <p className="account-security-error" role="alert">{passwordError.message}</p>}
            <button type="submit" className="account-security-primary" disabled={loading}>
              {loading ? 'Updating…' : 'Change Password'}
            </button>
            <Link className="account-security-recovery-link" to="/forgot-password" state={{ email: user?.email }}>Forgot your current password?</Link>
          </form>
        </section>

        <section className="account-security-card">
          <div className="account-security-card-head"><Link2 size={18}/><div><strong>Magic Link</strong></div></div>
          <div className="account-security-info">
            <p>Sign in securely using your email.</p>
            <button type="button" className="account-security-secondary" onClick={sendMagic} disabled={magicLoading}>{magicLoading ? 'Sending…' : 'Send Magic Link'}</button>
          </div>
        </section>

      </div>
    </div>
  );
};
