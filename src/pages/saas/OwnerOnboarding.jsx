import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, ImagePlus, MapPin, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { onboardingService } from '../../services/onboarding.service';
import { settingsService } from '../../services/settings.service';
import GstRateDropdown from '../../components/common/GstRateDropdown';
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
    key: 'bank', title: 'Bank & opening balance', subtitle: 'Connect an existing bank or add a new one (optional)',
    fields: [
      ['name', 'Account display name', 'text', true],
      ['bankName', 'Bank name', 'text', true],
      ['accountNumber', 'Bank account number', 'text'],
      ['ifsc', 'IFSC / routing code', 'text'],
      ['branchName', 'Bank branch', 'text'],
      ['openingBalance', 'Opening balance (₹)', 'number'],
      ['openingDate', 'Opening balance date', 'date'],
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
const LOCATION_FIELDS = new Set(['latitude', 'longitude', 'punchRadiusMeters']);
const PUNCH_RADIUS_OPTIONS = [50, 100, 150, 200, 300, 500, 1000];

const apiDataFor = (step, draft) => {
  if (step.key === 'bank') {
    if (draft?.configured) return { mode: 'existing', accountId: draft.accountId };
    const mode = draft?.mode || 'new';
    if (mode === 'skip') return { mode: 'skip' };
    if (mode === 'existing') {
      return { mode: 'existing', accountId: draft?.selectedAccountId || '' };
    }
    // Never send a masked account number from snapshot back as raw bank data.
    return {
      mode: 'new',
      name: String(draft?.name || '').trim(),
      bankName: String(draft?.bankName || '').trim(),
      accountNumber: String(draft?.accountNumber || '').trim(),
      ifsc: String(draft?.ifsc || '').trim(),
      branchName: String(draft?.branchName || '').trim(),
      openingBalance: draft?.openingBalance === '' ? '0.00' : String(draft?.openingBalance ?? '0.00'),
      openingDate: draft?.openingDate || null,
    };
  }
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
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [savedLogoUrl, setSavedLogoUrl] = useState('');
  const [logoVersion, setLogoVersion] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const locationRequestRef = useRef(0);
  const firstField = useRef(null);
  const previousActive = useRef(active);
  const current = STEPS[active];
  const completed = useMemo(() => new Set(state?.completedSteps || []), [state]);
  const completedCount = completed.size;
  const branchDraft = drafts.branch || {};
  const hasWorkshopLocation = (
    branchDraft.latitude !== null && branchDraft.latitude !== undefined &&
    String(branchDraft.latitude).trim() !== '' &&
    branchDraft.longitude !== null && branchDraft.longitude !== undefined &&
    String(branchDraft.longitude).trim() !== ''
  );
  const radius = Number(branchDraft.punchRadiusMeters ?? 100);
  const radiusChoices = PUNCH_RADIUS_OPTIONS.includes(radius)
    ? PUNCH_RADIUS_OPTIONS
    : [...PUNCH_RADIUS_OPTIONS, radius].sort((a, b) => a - b);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await onboardingService.get();
      setState(result);
      setDrafts(Object.fromEntries(STEPS.map(({ key }) => [
        key,
        key === 'bank'
          ? { ...(result.bank || {}), mode: result.bank?.skipped ? 'skip' : 'new',
              selectedAccountId: '' }
          : result[key] || {},
      ])));
      const next = STEPS.findIndex(({ key }) => !(result.completedSteps || []).includes(key));
      setActive(next < 0 ? 0 : next);
    } catch (cause) {
      setError(cause?.message || 'Unable to load workshop setup.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Ignore GPS callbacks after this page unmounts (or a newer request starts).
  useEffect(() => () => { locationRequestRef.current += 1; }, []);

  const locateWorkshop = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocationError('Location access needs HTTPS or localhost and a browser with location services.');
      return;
    }
    const requestId = ++locationRequestRef.current;
    setLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (locationRequestRef.current !== requestId) return;
        const { latitude, longitude, accuracy } = coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
          setLocationError('The device returned an invalid location. Please try again.');
          setLocating(false);
          return;
        }
        setDrafts(previous => ({
          ...previous,
          branch: {
            ...(previous.branch || {}),
            latitude: latitude.toFixed(6),
            longitude: longitude.toFixed(6),
            punchRadiusMeters: previous.branch?.punchRadiusMeters ?? 100,
          },
        }));
        setLocationAccuracy(Number.isFinite(accuracy) ? Math.round(accuracy) : null);
        setLocating(false);
      },
      (locationFailure) => {
        if (locationRequestRef.current !== requestId) return;
        const errors = {
          1: 'Location permission was denied. Allow location access in your browser settings and retry.',
          2: 'Your device could not determine its location. Check location services and retry.',
          3: 'Location request timed out. Move to an area with better GPS reception and retry.',
        };
        setLocationError(errors[locationFailure?.code] || 'Unable to read your location. Please retry.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const clearWorkshopLocation = () => {
    locationRequestRef.current += 1;
    setLocating(false);
    setLocationError('');
    setLocationAccuracy(null);
    setDrafts(previous => ({
      ...previous,
      branch: { ...(previous.branch || {}), latitude: null, longitude: null },
    }));
  };

  // Browser object URLs keep large logo files out of React state and are
  // revoked as soon as the selected file changes or the page unmounts.
  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [logoFile]);

  // Existing uploaded logos are private; fetch via the authenticated Django
  // endpoint instead of constructing a public media URL.
  useEffect(() => {
    if (!state?.logoAvailable) {
      setSavedLogoUrl('');
      return undefined;
    }
    let activeRequest = true;
    let objectUrl = '';
    settingsService.getCompanyLogo()
      .then((blob) => {
        if (!activeRequest || !(blob instanceof Blob)) return;
        objectUrl = URL.createObjectURL(blob);
        setSavedLogoUrl(objectUrl);
      })
      .catch(() => {
        if (activeRequest) setSavedLogoUrl('');
      });
    return () => {
      activeRequest = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [state?.logoAvailable, logoVersion]);

  // The wizard is a full-screen route outside the DashboardLayout scroll area.
  // Bring the newly selected step into view only when changing steps, not on
  // initial render (where the registration summary should remain visible).
  useEffect(() => {
    if (previousActive.current !== active) {
      firstField.current?.scrollIntoView?.({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    }
    previousActive.current = active;
  }, [active]);

  useEffect(() => {
    if (error && state) {
      firstField.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }
  }, [error, state]);

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
        setLogoVersion(version => version + 1);
        next = await onboardingService.get();
      }
      setState(next);
      setDrafts(previous => ({
        ...previous,
        [current.key]: current.key === 'bank'
          ? { ...(next.bank || {}), mode: next.bank?.skipped ? 'skip' : 'new',
              selectedAccountId: '' }
          : next[current.key] || previous[current.key],
      }));
      const missing = STEPS.findIndex(step => !next.completedSteps.includes(step.key));
      if (missing >= 0) {
        setActive(missing);
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

  if (loading) return <main className="cg-setup"><section className="cg-setup-card" role="status" aria-live="polite">
    <h1>Loading workshop setup…</h1>
    <p>Connecting to your workshop account and retrieving saved details.</p>
  </section></main>;

  if (!state) return <main className="cg-setup"><section className="cg-setup-card">
    <h1>Unable to open workshop setup</h1>
    <p role="alert">{error}</p>
    <p>Check your Django backend connection. Your existing workshop data has not been changed.</p>
    <button type="button" onClick={load}>Retry loading setup</button>
  </section></main>;

  return (
    <main className="cg-setup">
      <header className="cg-setup-heading">
        <div><span className="cg-setup-eyebrow">cubixgear · WORKSHOP SETUP</span>
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
          <small>Read-only balance from cubixgear billing</small>
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
              {current.fields.filter(([key]) => current.key !== 'bank' &&
                (current.key !== 'branch' || !LOCATION_FIELDS.has(key))).map(([key, label, type, required]) => (
                <label key={key} className={type === 'textarea' ? 'cg-setup-wide' : ''}>
                  <span className="cg-setup-label">{label}{required && !(key === 'gstin' && drafts.company?.gstNotRegistered) ? ' *' : ''}</span>
                  {type === 'textarea' ? (
                    <textarea name={key} rows={3} maxLength={1200} required={Boolean(required)} value={drafts[current.key]?.[key] ?? ''}
                      onChange={e => update(key, e.target.value)}/>
                  ) : type === 'checkbox' ? (
                    <input name={key} type="checkbox" checked={Boolean(drafts[current.key]?.[key])}
                      onChange={e => update(key, e.target.checked)}/>
                  ) : key === 'defaultTaxRate' ? (
                    <GstRateDropdown name={key} required={Boolean(required)}
                      selectLabel="Default GST Rate (%)" value={drafts.billing?.defaultTaxRate ?? ''}
                      onChange={rate => update(key, rate)}/>
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
              <span className="cg-setup-gst-copy">
                <strong>No GST registration</strong>
                <small>Tick if your workshop does not have a GSTIN. Otherwise enter a valid 15-character GSTIN above.</small>
              </span>
            </label>}
            {current.key === 'branch' && <div className="cg-setup-location">
              <div className="cg-setup-location-heading">
                <MapPin size={19} aria-hidden="true"/>
                <div>
                  <strong>Workshop location</strong>
                  <p>Capture the GPS location while you are physically at the workshop. No coordinates to type.</p>
                </div>
              </div>
              <div className="cg-setup-location-actions">
                <button type="button" className="cg-setup-locate" onClick={locateWorkshop}
                  disabled={locating || saving} aria-busy={locating}>
                  <MapPin size={17} aria-hidden="true"/>
                  {locating ? 'Detecting location…' : hasWorkshopLocation ? 'Update current location' : 'Use current location'}
                </button>
                {hasWorkshopLocation && (
                  <button type="button" className="cg-setup-clear-location"
                    onClick={clearWorkshopLocation} disabled={locating || saving}>
                    Clear location
                  </button>
                )}
              </div>
              {locationError && <p className="cg-setup-location-error" role="alert">{locationError}</p>}
              <div className="cg-setup-location-status" role="status" aria-live="polite">
                {hasWorkshopLocation ? (
                  <>
                    <strong>Location selected</strong>
                    <span>Latitude: {branchDraft.latitude} · Longitude: {branchDraft.longitude}</span>
                    {locationAccuracy !== null && <small>Device accuracy: approximately {locationAccuracy} m</small>}
                    <small>Press Save &amp; continue below to store this location.</small>
                  </>
                ) : (
                  <span>Location not selected. GPS is optional; you can save this step without it.</span>
                )}
              </div>
              <label className="cg-setup-radius" htmlFor="cg-punch-radius">
                <span className="cg-setup-label">Attendance punch radius</span>
                <select id="cg-punch-radius" name="punchRadiusMeters" value={String(radius)}
                  onChange={event => update('punchRadiusMeters', event.target.value)}>
                  {radiusChoices.map(value => (
                    <option value={value} key={value}>{value} metres</option>
                  ))}
                </select>
                <small>Staff must be within this distance of the saved workshop location to punch attendance.</small>
              </label>
            </div>}
            {current.key === 'company' && <div className="cg-setup-logo">
              <div className="cg-setup-logo-picker">
                <label className="cg-setup-logo-title" htmlFor="cg-workshop-logo">
                  <ImagePlus size={20} aria-hidden="true"/>
                  <span>Workshop logo (optional) {state.logoAvailable ? '· Uploaded' : ''}</span>
                </label>
                <p className="cg-setup-logo-hint">PNG, JPG or WEBP image</p>
                <input id="cg-workshop-logo" type="file" accept="image/png,image/jpeg,image/webp"
                  onChange={e => {
                    const nextFile = e.target.files?.[0] || null;
                    if (nextFile && !['image/png', 'image/jpeg', 'image/webp'].includes(nextFile.type)) {
                      setError('Choose a PNG, JPG or WEBP logo image.');
                      setLogoFile(null);
                      e.target.value = '';
                      return;
                    }
                    setLogoFile(nextFile);
                    setError('');
                  }}/>
                {logoFile && <small className="cg-setup-logo-selected">Selected: {logoFile.name}</small>}
              </div>
              {(logoPreviewUrl || savedLogoUrl) && (
                <div className="cg-setup-logo-preview" role="status">
                  <img src={logoPreviewUrl || savedLogoUrl}
                    alt={logoPreviewUrl ? 'Selected workshop logo preview' : 'Saved workshop logo preview'}/>
                  <span>{logoPreviewUrl ? 'New logo preview' : 'Saved logo'}</span>
                </div>
              )}
            </div>}
            {current.key === 'bank' && (
              <section className="cg-setup-bank" aria-label="Bank account setup">
                {drafts.bank?.configured ? (
                  <div className="cg-setup-bank-saved" role="status">
                    <Check size={20} aria-hidden="true"/>
                    <div>
                      <strong>{drafts.bank.name}</strong>
                      <p>{drafts.bank.bankName} · {drafts.bank.accountNumberMasked || 'Account number not provided'}</p>
                      <p>Opening balance: ₹{drafts.bank.openingBalance}</p>
                      <small>Saved in Finance Accounts. Manage later changes there to preserve your accounting history.</small>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="cg-setup-bank-intro">
                      Add your workshop bank account and its starting balance.
                      This is for internal accounting, not a bank connection. You may skip and add it later.
                    </p>
                    <div className="cg-setup-bank-modes" role="group" aria-label="Bank setup choice">
                      <label>
                        <input type="radio" name="bankMode" value="new"
                          checked={(drafts.bank?.mode || 'new') === 'new'}
                          onChange={() => update('mode', 'new')}/>
                        Add bank account
                      </label>
                      {(drafts.bank?.availableAccounts?.length > 0) && (
                        <label>
                          <input type="radio" name="bankMode" value="existing"
                            checked={drafts.bank?.mode === 'existing'}
                            onChange={() => update('mode', 'existing')}/>
                          Use existing bank
                        </label>
                      )}
                      <label>
                        <input type="radio" name="bankMode" value="skip"
                          checked={drafts.bank?.mode === 'skip'}
                          onChange={() => update('mode', 'skip')}/>
                        Skip for now
                      </label>
                    </div>
                    {(drafts.bank?.mode || 'new') === 'new' && (
                      <div className="cg-setup-fields cg-setup-bank-fields">
                        {current.fields.map(([key, label, type, required]) => (
                          <label key={key}>
                            <span className="cg-setup-label">{label}{required ? ' *' : ''}</span>
                            <input name={key} type={type}
                              required={Boolean(required)}
                              min={key === 'openingBalance' ? '0' : undefined}
                              step={key === 'openingBalance' ? '0.01' : undefined}
                              autoComplete={key === 'accountNumber' ? 'off' : undefined}
                              value={drafts.bank?.[key] ?? (key === 'openingBalance' ? '0.00' : '')}
                              onChange={event => update(key, event.target.value)}/>
                          </label>
                        ))}
                        <p className="cg-setup-bank-note cg-setup-wide">
                          The opening balance creates a real finance account and balanced opening journal once.
                          Please check it before saving; subsequent balance changes are made in Finance Accounts.
                        </p>
                      </div>
                    )}
                    {drafts.bank?.mode === 'existing' && (
                      <label className="cg-setup-bank-existing">
                        <span className="cg-setup-label">Existing workshop bank *</span>
                        <select required name="selectedBankAccount"
                          value={drafts.bank?.selectedAccountId || ''}
                          onChange={event => update('selectedAccountId', event.target.value)}>
                          <option value="">Select a bank</option>
                          {(drafts.bank?.availableAccounts || []).map(account => (
                            <option key={account.id} value={account.id}>
                              {account.name} — {account.bankName} {account.accountNumberMasked}
                            </option>
                          ))}
                        </select>
                        <small>The existing bank balance and transactions will not change.</small>
                      </label>
                    )}
                    {drafts.bank?.mode === 'skip' && (
                      <p className="cg-setup-bank-note">
                        No bank account will be created. You can add cash, bank and UPI accounts
                        later in Finance → Accounts.
                      </p>
                    )}
                  </>
                )}
              </section>
            )}
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
