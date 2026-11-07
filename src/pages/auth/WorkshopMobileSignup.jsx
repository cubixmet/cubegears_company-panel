import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, Eye, EyeOff, Lock, Mail, Phone, UserRound } from 'lucide-react';
import { API_BASE_URL } from '../../api/apiConfig';
import '../../styles/login-system.css';

export default function WorkshopMobileSignup() {
  const [form, setForm] = useState({ workshopName: '', ownerName: '', mobile: '', email: '', password: '', confirmPassword: '', whatsappConsent: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const change = (key, value) => setForm((previous) => ({ ...previous, [key]:value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.workshopName.trim() || !form.ownerName.trim() ||
        !/^\+[\d\s().-]{8,22}$/.test(form.mobile.trim())) {
      setError('Enter workshop name, owner name and an international mobile number with country code.');
      return;
    }
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      setError('Create a password with at least 8 characters, letters and a number.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method:'POST', credentials:'omit', referrerPolicy:'no-referrer',
        headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({
          workshop_name:form.workshopName.trim(), owner_name:form.ownerName.trim(),
          mobile:form.mobile.trim(), whatsapp_consent: Boolean(form.whatsappConsent),
          password:form.password, confirm_password:form.confirmPassword,
          ...(form.email.trim() ? {email:form.email.trim()} : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = Object.entries(data || {})
          .filter(([field]) => field !== 'status' && field !== 'code')
          .flatMap(([, value]) => Array.isArray(value) ? value : [value])
          .filter((value) => typeof value === 'string')
          .join(' ');
        const retry = response.headers.get('Retry-After');
        throw new Error(response.status === 429
          ? `Too many registration attempts. Try again later${retry ? ` (retry after ${retry} seconds)` : ''}.`
          : details || 'Unable to register your workshop.');
      }
      change('password', '');
      change('confirmPassword', '');
      setRegistered(data);
    } catch (cause) {
      setError(cause.message || 'Unable to register your workshop.');
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="login-page" data-workshop-mobile-signup>
    <div className="login-shell">
      <section className="login-card">
        <div className="login-brand-row"><div className="login-brand-mark">CG</div>
          <div><strong className="login-brand-name">CubeGears</strong>
            <span className="login-brand-subtitle">Workshop Management</span></div></div>
        {registered ? <>
          <CheckCircle2 size={32} aria-hidden="true"/>
          <h1 className="login-title">Workshop registered</h1>
          <p className="login-description">{registered.message || 'Your workshop account is ready.'}</p>
          <p className="login-description">Workshop code: <strong>{registered.workshop?.slug}</strong>. Keep this code for logging in when your mobile belongs to multiple workshops.</p>
          {registered.setupDelivery === 'password_created' ?
            <p className="login-description">Your password is ready. Sign in with your mobile number and password; no OTP is required.</p> :
            <p className="login-description">{registered.setupDelivery === 'platform_whatsapp_pending'
              ? 'Your password invitation is pending official WhatsApp delivery. The registration confirmation does not mean the message was delivered.'
              : 'Check the registered contact method for your secure setup link. Contact support if it does not arrive.'}</p>}
          <Link className="login-submit" to="/login">Go to Login</Link>
        </> : <>
          <h1 className="login-title">Create a workshop</h1>
          <p className="login-description">Register with your mobile number and create a secure password. Email and WhatsApp are optional. No OTP login.</p>
          {error && <div className="login-error" role="alert">{error}</div>}
          <form onSubmit={submit} className="login-form">
            <label className="block"><span className="login-field-label">Workshop Name *</span>
              <div className="login-input-shell">
                <span className="login-input-icon"><Building2 size={16}/></span>
                <input className="login-input" type="text" required maxLength={180}
                  value={form.workshopName} onChange={(e) => change('workshopName',e.target.value)}
                  placeholder="Your car workshop"/></div></label>
            <label className="block"><span className="login-field-label">Owner Full Name *</span>
              <div className="login-input-shell"><span className="login-input-icon"><UserRound size={16}/></span>
                <input className="login-input" type="text" required maxLength={150}
                  value={form.ownerName} onChange={(e) => change('ownerName',e.target.value)}
                  placeholder="Workshop owner name"/></div></label>
            <label className="block"><span className="login-field-label">Mobile Number with Country Code *</span>
              <div className="login-input-shell"><span className="login-input-icon"><Phone size={16}/></span>
                <input className="login-input" type="tel" required autoComplete="tel" inputMode="tel"
                  value={form.mobile} onChange={(e) => change('mobile',e.target.value)}
                  placeholder="+919876543210"/></div></label>
            <label className="block"><span className="login-field-label">Email (optional)</span>
              <div className="login-input-shell"><span className="login-input-icon"><Mail size={16}/></span>
                <input className="login-input" type="email" autoComplete="email"
                  value={form.email} onChange={(e) => change('email',e.target.value)}
                  placeholder="name@example.com"/></div></label>
            <label className="block">
              <span className="login-field-label">Create Password *</span>
              <div className="login-input-shell">
                <span className="login-input-icon" aria-hidden="true"><Lock size={16}/></span>
                <input className="login-input" type={showPassword ? 'text' : 'password'}
                  name="new-password" autoComplete="new-password" required minLength={8} maxLength={128}
                  value={form.password} onChange={(e) => change('password', e.target.value)}
                  placeholder="At least 8 characters" />
                <button type="button" className="login-password-toggle" onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}
                </button>
              </div>
            </label>
            <label className="block">
              <span className="login-field-label">Confirm Password *</span>
              <div className="login-input-shell">
                <span className="login-input-icon" aria-hidden="true"><Lock size={16}/></span>
                <input className="login-input" type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password" required minLength={8} maxLength={128}
                  value={form.confirmPassword} onChange={(e) => change('confirmPassword', e.target.value)}
                  placeholder="Re-enter password" />
                <button type="button" className="login-password-toggle" onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Hide confirmation' : 'Show confirmation'}>
                  {showConfirm ? <EyeOff size={17}/> : <Eye size={17}/>}
                </button>
              </div>
            </label>
            <p className="login-description">Your password stays private and is never sent through WhatsApp or email.</p>
            <label className="block" style={{display:'flex',alignItems:'flex-start',gap:'10px',fontSize:'14px',lineHeight:'1.5'}}>
              <input type="checkbox" checked={form.whatsappConsent}
                onChange={(event) => change('whatsappConsent',event.target.checked)}
                style={{width:'20px',height:'20px',minWidth:'20px',marginTop:'2px'}}/>
              I agree to receive workshop account messages through the official CubeGears WhatsApp Business channel (optional).
            </label>
            <button className="login-submit" type="submit" disabled={submitting}>
              {submitting ? 'Creating workshop…' : 'Register Workshop'}
            </button>
          </form>
          <p className="login-description">Already registered? <Link to="/login">Sign in</Link></p>
        </>}
      </section>
    </div>
  </main>;
}
