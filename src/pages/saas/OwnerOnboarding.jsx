import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, ImagePlus, MapPin, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { onboardingService } from '../../services/onboarding.service';
import { settingsService } from '../../services/settings.service';
import '../../styles/owner-onboarding.css';

const STEPS = [
  {
    key: 'company', title: 'Workshop details', subtitle: 'Legal name, address and GST registration',
    fields: [
      ['name', 'Workshop / Company Name', 'text', true],
      ['legal_name', 'Legal Business Name', 'text', true],
      ['phone', 'Workshop Contact Number', 'tel', true],
      ['email', 'Official Email', 'email'],
      ['gstin', 'GSTIN (unless exempt)', 'text', true],
      ['address', 'Registered Address', 'textarea', true],
      ['city', 'City', 'text', true],
      ['state', 'State', 'text', true],
      ['country', 'Country', 'text', true],
      ['pincode', 'PIN / Postal Code', 'text', true],
    ],
  },
  {
    key: 'branch', title: 'Main branch & location', subtitle: 'Configure your actual workshop address and punch location',
    fields: [
      ['name', 'Main Branch Name', 'text', true],
      ['phone', 'Branch Contact Number', 'tel', true],
      ['address', 'Branch Address', 'textarea', true],
      ['city', 'City', 'text', true],
      ['state', 'State', 'text', true],
      ['pincode', 'PIN / Postal Code', 'text', true],
      ['latitude', 'Workshop Latitude', 'number'],
      ['longitude', 'Workshop Longitude', 'number'],
      ['punchRadiusMeters', 'Punch Radius (metres)', 'number'],
    ],
  },
  {
    key: 'operations', title: 'Working hours', subtitle: 'Service hours and job card defaults',
    fields: [
      ['workingStart', 'Working Day Starts', 'time', true],
      ['workingEnd', 'Working Day Ends', 'time', true],
      ['bookingSlotMinutes', 'Booking Slot (minutes)', 'number', true],
      ['jobPrefix', 'Job Card Number Prefix', 'text', true],
    ],
  },
  {
    key: 'billing', title: 'Invoice defaults', subtitle: 'Set payment terms and tax defaults for new invoices',
    fields: [
      ['invoicePrefix', 'Invoice Number Prefix', 'text', true],
      ['paymentTermsDays', 'Default Payment Terms (days)', 'number', true],
      ['defaultTaxRate', 'Default GST Rate (%)', 'number', true],
      ['rounding', 'Round invoice total', 'checkbox'],
    ],
  },
];

const integerFields = new Set(['punchRadiusMeters', 'bookingSlotMinutes', 'paymentTermsDays']);
const numberFields = new Set(['latitude', 'longitude', 'defaultTaxRate']);

const apiDataFor = (step, draft) => {
  const values = {};
  for (const [name, , type] of step.fields) {
    const input = draft?.[name];
    if (type === 'checkbox') {
      values[name] = Boolean(input);
    } else if (integerFields.has(name)) {
      values[name] = Number(input);
    } else if (numberFields.has(name)) {
      values[name] = input === '' || input == null ? null : String(input).trim();
    } else {
      values[name] = String(input ?? '').trim();
    }
  }
  // A workshop without GST registration must explicitly confirm that fact.
  if (step.key === 'company') {
    values.gstNotRegistered = Boolean(draft?.gstNotRegistered);
    if (values.gstNotRegistered) values.gstin = '';
  }
  // A missing default tax selection is not an API number.
  if (step.key === 'billing' && values.defaultTaxRate == null) {
    values.defaultTaxRate = '0';
  }
  return values;
};

export function OwnerOnboarding() {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const firstField = useRef(null);
  const current = STEPS[active];
  const completed = useMemo(() => new Set(state?.completedSteps || []), [state]);
  const completedCount = completed.size;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await onboardingService.get();
      setState(result);
      setDrafts(Object.fromEntries(STEPS.map(({ key }) => [key, result[key] || {}])));
      const next = STEPS.findIndex(({ key }) => !(result.completedSteps || []).includes(key));
      setActive(next < 0 ? 0 : next);
    } catch (cause) {
      setError(cause?.message || 'Unable to load workshop setup.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateGstExemption = (checked) => {
    setDrafts(previous => ({
      ...previous,
      company: { ...(previous.company || {}), gstNotRegistered: checked,
        gstin: checked ? '' : previous.company?.gstin || '' },
    }));
    setError('');
  };

  const update = (field, value) => {
    setDrafts(previous => ({
      ...previous,
      [current.key]: { ...(previous[current.key] || {}), [field]: value },
    }));
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving || !state) return;
    setSaving(true);
    setError('');
    try {
      let next = await onboardingService.saveStep(current.key, apiDataFor(current, drafts[current.key]));
      if (current.key === 'company' && logoFile) {
        await settingsService.uploadCompanyLogo(logoFile);
        setLogoFile(null);
        next = await onboardingService.get();
      }
      setState(next);
      setDrafts(previous => ({ ...previous, [current.key]: next[current.key] || previous[current.key] }));
      const missing = STEPS.findIndex(step => !next.completedSteps.includes(step.key));
      if (missing >= 0) {
        setActive(missing);
        firstField.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      } else {
        const finished = await onboardingService.complete();
        setState(finished);
        // Re-fetch the JWT profile with onboardingRequired=false after reload.
        window.location.replace('/account');
      }
    } catch (cause) {
      const first = Object.entries(cause?.fieldErrors || {}).find(([key]) => current.fields.some(([field]) => field === key));
      setError(first ? `${first[0]}: ${first[1]}` : (cause?.message || 'Unable to save. Please review this step.'));
    } finally {
      setSaving(false);
    }
  };

  if (user && !user.isCompanyOwner) {
    return <main className="cg-setup"><section className="cg-setup-card">
      <h1>Workshop owner access required</h1>
      <p>Only the verified workshop owner can complete organization setup.</p>
      <Link to="/dashboard">Return to Dashboard</Link>
    </section></main>;
  }

  if (loading) return <main className="cg-setup"><section className="cg-setup-card" role="status">
    Loading workshop setup…
  </section></main>;

  if (!state) return <main className="cg-setup"><section className="cg-setup-card">
    <h1>Unable to open workshop setup</h1>
    <p role="alert">{error}</p>
    <button type="button" onClick={load}>Retry</button>
  </section></main>;

  return (
    <main className="cg-setup">
      <header className="cg-setup-heading">
        <div><span className="cg-setup-eyebrow">CUBEGEARS · WORKSHOP SETUP</span>
          <h1>Set up your workshop</h1>
          <p>Real company settings saved securely to your workshop account. Continue where you left off.</p>
        </div>
        {state.completed && <Link className="cg-setup-later" to="/account">Return to account</Link>}
      </header>
      <section className="cg-setup-account" aria-label="Your workshop account details">
        <div>
          <span>Registered workshop</span>
          <strong>{state.account?.companyName || '—'}</strong>
          <small>{state.account?.ownerName || user?.name || 'Workshop owner'}</small>
        </div>
        <div>
          <span>Contact</span>
          <strong>{state.account?.contactPhone || '—'}</strong>
          <small>{state.account?.contactEmail || 'Mobile registration'}</small>
        </div>
        <div>
          <span>Wallet balance</span>
          <strong>{state.account?.walletAvailable
            ? `${state.account.walletBalanceCredits} credits`
            : 'Not available'}</strong>
          <small>Read-only balance from CubeGears billing</small>
        </div>
      </section>
      <p className="cg-setup-lock-note">Complete the required workshop details to unlock your Account,
        Wallet, feature activation, Dashboard and workspace. No charges are made during setup.</p>
      <div className="cg-setup-progress" role="status" aria-live="polite">
        <strong>{completedCount} of {STEPS.length} steps saved</strong>
        <div className="cg-setup-progress-track"><span style={{ width: `${completedCount / STEPS.length * 100}%` }} /></div>
      </div>
      <div className="cg-setup-layout">
        <nav aria-label="Workshop setup steps" className="cg-setup-nav">
          {STEPS.map((step, index) => (
            <button key={step.key} type="button" disabled={saving || (index > active && !completed.has(step.key))}
              className={`cg-setup-step ${active === index ? 'is-current' : ''}`}
              aria-current={active === index ? 'step' : undefined}
              onClick={() => { setActive(index); setError(''); }}>
              <span className="cg-setup-step-number">{completed.has(step.key) ? <Check size={16}/> : index + 1}</span>
              <span>{step.title}</span>
            </button>
          ))}
        </nav>
        <section className="cg-setup-card" ref={firstField}>
          <div className="cg-setup-step-heading">
            <span>STEP {active + 1} OF {STEPS.length}</span>
            <h2>{current.title}</h2>
            <p>{current.subtitle}</p>
          </div>
          {error && <p role="alert" className="cg-setup-error">{error}</p>}
          {state.completed && <p role="status" className="cg-setup-done">
            Setup previously completed. You can update these settings at any time.
          </p>}
          <form onSubmit={submit}>
            <div className="cg-setup-fields">
              {current.fields.map(([key, label, type, required]) => (
                <label key={key} className={type === 'textarea' ? 'cg-setup-wide' : ''}>
                  <span className="cg-setup-label">{label}{required && !(key === 'gstin' && drafts.company?.gstNotRegistered) ? ' *' : ''}</span>
                  {type === 'textarea' ? (
                    <textarea name={key} rows={3} maxLength={1200} required={Boolean(required)} value={drafts[current.key]?.[key] ?? ''}
                      onChange={e => update(key, e.target.value)}/>
                  ) : type === 'checkbox' ? (
                    <input name={key} type="checkbox" checked={Boolean(drafts[current.key]?.[key])}
                      onChange={e => update(key, e.target.checked)}/>
                  ) : (
                    <input name={key} type={type}
                      required={Boolean(required && !(key === 'gstin' && drafts.company?.gstNotRegistered))}
                      disabled={key === 'gstin' && drafts.company?.gstNotRegistered}
                      inputMode={type === 'number' ? 'decimal' : undefined}
                      step={type === 'number' ? (integerFields.has(key) ? '1' : 'any') : undefined}
                      value={drafts[current.key]?.[key] ?? ''}
                      onChange={e => update(key, e.target.value)}
                      autoComplete={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'off'}/>
                  )}
                </label>
              ))}
            </div>
            {current.key === 'company' && <label className="cg-setup-gst-exempt">
              <input type="checkbox" name="gstNotRegistered"
                checked={Boolean(drafts.company?.gstNotRegistered)}
                onChange={event => updateGstExemption(event.target.checked)}/>
              <span><strong>No GST registration</strong>
                <small>Tick if your workshop does not have a GSTIN. Otherwise enter a valid 15-character GSTIN above.</small>
              </span>
            </label>}
            {current.key === 'branch' && <p className="cg-setup-help">
              <MapPin size={16}/> GPS coordinates are optional. Provide both latitude and longitude to configure location-aware attendance. Accuracy depends on the staff device.
            </p>}
            {current.key === 'company' && <label className="cg-setup-logo">
              <ImagePlus size={20}/><span>Workshop logo (optional) {state.logoAvailable ? '· Uploaded' : ''}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp"
                onChange={e => setLogoFile(e.target.files?.[0] || null)}/>
              {logoFile && <small>Selected: {logoFile.name}</small>}
            </label>}
            {current.key === 'billing' && <p className="cg-setup-help">
              <ShieldCheck size={16}/> GST rates are configurable defaults, not a filing determination. Actual invoice tax depends on the applicable transaction.
            </p>}
            <div className="cg-setup-actions">
              <button type="button" className="cg-setup-back" disabled={saving || active === 0}
                onClick={() => { setActive(Math.max(0, active - 1)); setError(''); }}>
                <ChevronLeft size={16}/> Previous
              </button>
              <button type="submit" className="cg-setup-save" disabled={saving}>
                {saving ? 'Saving to workshop…' : completedCount === STEPS.length ? 'Save & finish setup' : 'Save & continue'}
                {!saving && <ChevronRight size={16}/>}
              </button>
            </div>
          </form>
          <p className="cg-setup-footer">Your customer, staff, invoice and inventory records are not changed by this wizard.</p>
        </section>
      </div>
    </main>
  );
}
