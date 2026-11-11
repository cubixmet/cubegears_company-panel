import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/apiClient';
import { BranchRegistrationEditor } from './BranchRegistrationEditor';
import {
  OWNER_COMPANY_FIELDS, validateOwnerCompanyDraft, extractOwnerCompanyApiErrors,
} from './ownerCompanyValidation';
import '../../styles/owner-company-profile.css';

export function OwnerCompanyProfile() {
  const [values, setValues] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    let active = true;
    apiClient.get('/company/me')
      .then((data) => { if (active) setValues(data); })
      .catch((err) => { if (active) setLoadingError(err.message || 'Unable to load shop details.'); });
    return () => { active = false; };
  }, []);

  const focusFirstError = (errors) => {
    const field = OWNER_COMPANY_FIELDS.find(([key]) => errors[key])?.[0];
    if (!field) return;
    const input = formRef.current?.elements.namedItem(field);
    if (input && typeof input.focus === 'function') {
      input.focus({ preventScroll: true });
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const changeValue = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError('');
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      if (key === 'gstin') delete next.state;
      if (key === 'state') delete next.gstin;
      if (key === 'country') delete next.pincode;
      return next;
    });
  };

  const blurField = (key) => {
    const { errors } = validateOwnerCompanyDraft(values);
    setFieldErrors((current) => {
      const next = { ...current };
      if (errors[key]) next[key] = errors[key];
      else delete next[key];
      if (key === 'gstin' && errors.state) next.state = errors.state;
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving || !values) return;
    setError('');
    setSaved(false);
    const { draft, errors } = validateOwnerCompanyDraft(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      focusFirstError(errors);
      return;
    }
    setSaving(true);
    try {
      const data = await apiClient.patch('/company/me', draft);
      setValues(data);
      setFieldErrors({});
      setSaved(true);
    } catch (err) {
      const parsed = extractOwnerCompanyApiErrors(err);
      setFieldErrors(parsed.fieldErrors);
      setError(parsed.message);
      focusFirstError(parsed.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="owner-company-page">
      <header>
        <h1>Shop Details</h1>
        <p>Manage your company registration and contact details.</p>
        <Link to="/onboarding" className="owner-company-setup-link">
          Open workshop setup wizard
        </Link>
      </header>
      {loadingError && <p className="owner-company-notice is-error" role="alert">{loadingError}</p>}
      {!values && !loadingError && <p role="status">Loading shop details…</p>}
      {values && (
        <form ref={formRef} onSubmit={submit} noValidate>
          {error && <p className="owner-company-notice is-error" role="alert">{error}</p>}
          {saved && <p className="owner-company-notice is-success" role="status">Shop details saved.</p>}
          <div className="owner-company-fields">
            {OWNER_COMPANY_FIELDS.map(([key, label, maxLength]) => (
              <label className={key === 'address' ? 'is-wide' : ''} key={key}>
                <span>{label}{key === 'name' ? ' *' : ''}</span>
                {key === 'address' ? (
                  <textarea name={key} rows={3} maxLength={maxLength}
                    value={values[key] ?? ''} aria-invalid={Boolean(fieldErrors[key])}
                    aria-describedby={fieldErrors[key] ? 'owner-company-' + key + '-error' : undefined}
                    onChange={(event) => changeValue(key, event.target.value)}
                    onBlur={() => blurField(key)} />
                ) : (
                  <input name={key} value={values[key] ?? ''}
                    type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                    maxLength={maxLength} required={key === 'name'}
                    aria-invalid={Boolean(fieldErrors[key])}
                    aria-describedby={fieldErrors[key] ? 'owner-company-' + key + '-error' : undefined}
                    onChange={(event) => changeValue(key, event.target.value)}
                    onBlur={() => blurField(key)} />
                )}
                {fieldErrors[key] && (
                  <small id={'owner-company-' + key + '-error'} className="owner-company-field-error"
                    role="alert">{fieldErrors[key]}</small>
                )}
              </label>
            ))}
          </div>
          <div className="owner-company-actions">
            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save shop details'}</button>
          </div>
        </form>
      )}
      {values && <BranchRegistrationEditor companyState={values.state} gstin={values.gstin} />}
    </section>
  );
}
