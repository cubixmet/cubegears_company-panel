import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, FileText, ImagePlus, LayoutTemplate, ReceiptText, Save, Sparkles, Trash2 } from 'lucide-react';
import {
  templateDefaults as defaults, loadDocumentTemplateSettings,
  loadWorkshopTemplateDetails, WORKSHOP_TEMPLATE_FIELDS,
  saveDocumentTemplateSettings,
} from '../../services/documentTemplates.service';
import { validateDocumentTemplateSettings, templateApiFieldErrors, templateErrorSummary } from '../../utils/documentTemplateValidation';
import { AccountHeader } from '../../components/account';
import { settingsService } from '../../services/settings.service';
import { optimizeDocumentLogo } from '../../utils/optimizeDocumentLogo';
import '../../styles/document-templates.css';
import '../../styles/account-dashboard.css';

const templates = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean business layout with strong hierarchy and compact tax summary.'
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional invoice structure with simple borders and accounting-first layout.'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Lightweight document with reduced decoration and maximum readability.'
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Your own document layout settings, labels and optional sections.'
  }
];

const accents = [
  { id: 'teal', label: 'Teal' },
  { id: 'blue', label: 'Blue' },
  { id: 'graphite', label: 'Graphite' }
];

function focusFirstTemplateError() {
  window.requestAnimationFrame(() => {
    const field = document.querySelector('.document-templates-page [aria-invalid="true"]');
    if (!field) return;
    field.focus({ preventScroll: true });
    field.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  });
}

function Preview({ kind, settings, workshopLogoUrl = '' }) {
  const selected = kind === 'invoice' ? settings.invoiceTemplate : settings.estimateTemplate;

  return (
    <div className={`template-preview template-${selected} accent-${settings.accent} ${settings.compactTable ? 'is-compact' : ''}`}>
      <div className="template-preview-top">
        <span>{settings.showOriginal ? 'ORIGINAL' : ''}</span>
        <span>{kind === 'invoice' ? 'FINALIZED' : 'ISSUED'}</span>
      </div>

      <div className="template-preview-head">
        <div className="template-preview-brand">
          {settings.showBusinessLogo && (settings.businessLogo || workshopLogoUrl)
            ? <img className="template-preview-logo" src={settings.businessLogo || workshopLogoUrl} alt="Business logo"/>
            : settings.showSellerMark && <div className="template-preview-mark">{(settings.businessName || 'CG').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()}</div>}
          <div>
            <strong>{settings.businessName || 'Business Name'}</strong>
            {settings.businessLegalName && <span>{settings.businessLegalName}</span>}
            <span>{[settings.businessAddress, settings.businessPhone, settings.businessEmail].filter(Boolean).join(' · ') || 'Business address · Phone · Email'}</span>
            {settings.showGstin && <span>GSTIN: {settings.businessGstin || 'Not registered'}</span>}
            {settings.showPan && settings.businessPan && <span>PAN: {settings.businessPan}</span>}
            {settings.showWebsite && settings.businessWebsite && <span>Website: {settings.businessWebsite}</span>}
          </div>
        </div>
        <div className="template-preview-meta">
          <span>{kind === 'invoice' ? 'Tax Invoice' : 'Estimate'}</span>
          <strong>{kind === 'invoice' ? 'INV-2026-0042' : 'EST-2026-0018'}</strong>
          <small>02-10-2026</small>
        </div>
      </div>

      <div className="template-preview-title">{selected === 'custom' ? (settings.customHeader || (kind === 'invoice' ? 'Tax Invoice' : 'Estimate / Quotation')) : (kind === 'invoice' ? 'Tax Invoice' : 'Estimate / Quotation')}</div>

      <div className="template-preview-info">
        <div><b>Bill To</b><strong>Customer Name</strong><span>Customer address</span></div>
        {settings.customShowTransport !== false && <div><b>Transport</b><span>Vehicle: KL08AB1234</span></div>}
        <div><b>Document</b><span>Place of Supply: 32-Kerala</span></div>
      </div>

      <div className="template-preview-table">
        <div className="head"><span>#</span><span>Item</span><span>Qty</span><span>GST</span><span>Amount</span></div>
        <div className="row"><span>1</span><span>Service / Part</span><span>1</span><span>18%</span><span>₹1,180.00</span></div>
        <div className="row"><span>2</span><span>Workshop Item</span><span>2</span><span>5%</span><span>₹2,100.00</span></div>
      </div>

      <div className="template-preview-bottom">
        <div>
          <b>Amount in Words</b>
          <span>Three Thousand Two Hundred Eighty Rupees only</span>
          {settings.showTerms && settings.termsText && <small><b>Terms:</b> {settings.termsText}</small>}
          {settings.showBankDetails && (settings.bankName || settings.bankAccountNumber || settings.bankUpi) && (
            <small><b>Bank:</b> {[settings.bankName, settings.bankAccountNumber, settings.bankIfsc, settings.bankUpi].filter(Boolean).join(' · ')}</small>
          )}
          {selected === 'custom' && settings.customFooter && <small>{settings.customFooter}</small>}
        </div>
        <div className="template-preview-total">
          <span>Total</span>
          <strong>₹3,280.00</strong>
          {settings.showSignature && <small>{settings.authorizedSignatory || 'Authorised Signatory'}</small>}
        </div>
      </div>
    </div>
  );
}

export function DocumentTemplates() {
  const navigate = useNavigate();
  const logoInputRef = useRef(null);
  const [settings, setSettings] = useState(defaults);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsReady, setSettingsReady] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [preparingLogo, setPreparingLogo] = useState(false);
  const [workshopLogoUrl, setWorkshopLogoUrl] = useState('');
  const [workshopLogoState, setWorkshopLogoState] = useState('loading');
  const [settingsError, setSettingsError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const [syncingProfile, setSyncingProfile] = useState(false);
  const [profileSynced, setProfileSynced] = useState(false);
  const [previewKind, setPreviewKind] = useState('invoice');
  const [mobilePane, setMobilePane] = useState('edit');

  useEffect(() => {
    let active = true;
    let blobUrl = '';
    settingsService.getCompanyLogo()
      .then((logo) => {
        if (!active) return;
        if (logo instanceof Blob && logo.type.startsWith('image/') && logo.size > 0) {
          blobUrl = URL.createObjectURL(logo);
          setWorkshopLogoUrl(blobUrl);
          setWorkshopLogoState('available');
        } else {
          setWorkshopLogoState('missing');
        }
      })
      .catch((error) => {
        if (active) setWorkshopLogoState(error?.status === 404 ? 'missing' : 'error');
      });
    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);

  const invoiceTemplate = useMemo(
    () => templates.find((item) => item.id === settings.invoiceTemplate) || templates[0],
    [settings.invoiceTemplate]
  );
  const estimateTemplate = useMemo(
    () => templates.find((item) => item.id === settings.estimateTemplate) || templates[0],
    [settings.estimateTemplate]
  );

  useEffect(() => {
    setSaved(false);
  }, [settings]);

  useEffect(() => {
    let alive = true;
    loadDocumentTemplateSettings().then((savedSettings) => {
      if (!alive) return;
      // The backend merges live company, logo and selected bank details into
      // template defaults before the first preview. No stale local cache.
      setSettings(savedSettings);
      setSettingsReady(true);
      setSettingsError('');
    }).catch((error) => {
      if (alive) setSettingsError(error?.message || 'Unable to load company template settings.');
    }).finally(() => { if (alive) setSettingsLoading(false); });
    return () => { alive = false; };
  }, []);

  const update = (key, value) => {
    setSaved(false);
    setFieldErrors((old) => {
      if (!old[key]) return old;
      const next = { ...old };
      delete next[key];
      return next;
    });
    setSettings((old) => ({ ...old, [key]: value }));
  };

  const syncWorkshopProfile = async () => {
    if (!settingsReady || syncingProfile || savingSettings || preparingLogo) return;
    setSyncingProfile(true);
    setProfileSynced(false);
    setSettingsError('');
    try {
      const latest = await loadWorkshopTemplateDetails();
      const values = Object.fromEntries(
        WORKSHOP_TEMPLATE_FIELDS.map((key) => [key, latest[key] || ''])
      );
      setSettings((old) => ({
        ...old,
        ...values,
        showBusinessLogo: Boolean(values.businessLogo) || old.showBusinessLogo,
      }));
      setFieldErrors((old) => Object.fromEntries(
        Object.entries(old).filter(([key]) => !WORKSHOP_TEMPLATE_FIELDS.includes(key))
      ));
      setProfileSynced(true);
    } catch (cause) {
      setSettingsError(cause?.message || 'Unable to refresh workshop details.');
    } finally {
      setSyncingProfile(false);
    }
  };

  const save = async () => {
    if (savingSettings || settingsLoading || preparingLogo || syncingProfile || !settingsReady) return;
    setSaved(false);
    const problems = validateDocumentTemplateSettings(settings);
    setFieldErrors(problems);
    if (Object.keys(problems).length) {
      setSettingsError(templateErrorSummary(problems));
      focusFirstTemplateError();
      return;
    }
    setSavingSettings(true);
    setSettingsError('');
    try {
      await saveDocumentTemplateSettings(settings);
      setSaved(true);
      setFieldErrors({});
    } catch (error) {
      const problems = templateApiFieldErrors(error);
      setFieldErrors(problems);
      setSettingsError(Object.keys(problems).length
        ? templateErrorSummary(problems)
        : error?.message || 'Unable to save company invoice templates.');
      if (Object.keys(problems).length) focusFirstTemplateError();
    } finally {
      setSavingSettings(false);
    }
  };

  const uploadLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPreparingLogo(true);
    setSettingsError('');
    setFieldErrors((old) => {
      const next = { ...old };
      delete next.businessLogo;
      return next;
    });
    try {
      const value = await optimizeDocumentLogo(file);
      // This logo is shared with the workshop, not only the template editor.
      await settingsService.uploadCompanyLogo(file);
      setSettings((old) => ({ ...old, businessLogo: value, showBusinessLogo: true }));
      setWorkshopLogoState('available');
    } catch (error) {
      const message = error?.message || 'Unable to prepare this image.';
      setFieldErrors((old) => ({ ...old, businessLogo: message }));
      setSettingsError(message);
      focusFirstTemplateError();
    } finally {
      setPreparingLogo(false);
    }
  };

  return (
    <div className="document-templates-page">
      <AccountHeader
        title="PDF Templates"
        active="templates"
        onNavigate={navigate}
        actions={
          <button className="template-save-button" type="button" disabled={!settingsReady || settingsLoading || savingSettings || preparingLogo || syncingProfile} onClick={save}>
            {saved ? <Check size={15}/> : <Save size={15}/>}
            {savingSettings ? 'Saving…' : saved ? 'Saved' : 'Save Templates'}
          </button>
        }
      />

      {settingsError && <p className="template-server-error" role="alert">{settingsError}</p>}
      {settingsLoading && <p className="template-server-loading" role="status">Loading saved company invoice templates…</p>}
      <div className="template-workshop-sync">
        <div>
          <strong>Workshop details connected</strong>
          <p>Brand name, legal details, GSTIN, contact, uploaded logo and the selected bank are loaded from the backend. Existing template overrides are preserved.</p>
        </div>
        <button type="button" onClick={syncWorkshopProfile}
          disabled={!settingsReady || settingsLoading || savingSettings || syncingProfile || preparingLogo}>
          {syncingProfile ? 'Refreshing…' : 'Use latest workshop details'}
        </button>
        {profileSynced && <small role="status">Workshop details refreshed in this preview. Click Save Templates to keep these values.</small>}
      </div>
      <details className="template-server-note"><summary>Document information</summary><p>Templates are company-scoped. Finalized documents retain their saved appearance. The live workshop profile provides defaults, and saved template overrides are retained unless refreshed.</p></details>
      <div className="template-mobile-mode" role="tablist" aria-label="Template editing mode">
        <button role="tab" type="button" aria-selected={mobilePane === 'edit'} onClick={() => setMobilePane('edit')}>Edit</button>
        <button role="tab" type="button" aria-selected={mobilePane === 'preview'} onClick={() => setMobilePane('preview')}>Preview</button>
      </div>
      <div className="template-editor-preview-layout">
        <div className={`template-editor-column ${mobilePane === 'preview' ? 'is-mobile-hidden' : ''}`}>
      <details className="template-settings-card business-branding-card" open>
        <summary className="template-settings-title"><Building2 size={18}/><strong>Branding</strong></summary>

        <div className="business-branding-layout">
          <div className="business-logo-panel">
            <div className="business-logo-preview">
              {settings.showBusinessLogo && (settings.businessLogo || workshopLogoUrl)
                ? <img src={settings.businessLogo || workshopLogoUrl} alt="Workshop logo"/>
                : <span>{(settings.businessName || 'CG').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()}</span>}
            </div>
            <div className="business-logo-actions">
              <button type="button" className="template-upload-button" aria-controls="business-logo-input" aria-invalid={Boolean(fieldErrors.businessLogo)} aria-describedby={fieldErrors.businessLogo ? 'business-logo-error' : 'business-logo-help'} disabled={preparingLogo} onClick={() => logoInputRef.current?.click()}><ImagePlus size={15}/>{preparingLogo ? 'Preparing logo…' : 'Upload Logo'}</button>
              <input ref={logoInputRef} id="business-logo-input" className="template-logo-input" type="file" accept="image/*" aria-label="Choose business logo image" disabled={preparingLogo} onChange={uploadLogo}/>
              {settings.showBusinessLogo && (settings.businessLogo || workshopLogoUrl) &&
                <button type="button" className="template-remove-logo"
                  onClick={() => update('showBusinessLogo', false)}>
                  <Trash2 size={14}/>Hide on documents
                </button>}
              {!settings.showBusinessLogo && (settings.businessLogo || workshopLogoUrl) &&
                <button type="button" className="template-upload-button"
                  onClick={() => update('showBusinessLogo', true)}>
                  Show logo
                </button>}
            </div>
            <small id="business-logo-help" className="template-logo-help">
              {workshopLogoState === 'loading' && 'Checking your saved workshop logo…'}
              {workshopLogoState === 'missing' && 'No saved workshop logo found. Upload it here or save it from onboarding.'}
              {workshopLogoState === 'error' && 'Could not fetch the saved workshop logo. Check your backend connection.'}
              {workshopLogoState === 'available' && 'Workshop logo is available. Upload a replacement if needed.'}
              {' '}Choose an image under 10 MB; it will be resized and compressed before saving.
            </small>
            {fieldErrors.businessLogo && <small id="business-logo-error" className="template-input-error" role="alert">{fieldErrors.businessLogo}</small>}
          </div>

          <div className="business-fields-grid">
            <label>Business / Brand Name<input value={settings.businessName || ''} onChange={(e) => update('businessName', e.target.value)} placeholder="Business / brand name" aria-invalid={Boolean(fieldErrors.businessName)}/>{fieldErrors.businessName && <small className="template-input-error" role="alert">{fieldErrors.businessName}</small>}</label>
            <label>Legal Business Name<input value={settings.businessLegalName || ''} onChange={(e) => update('businessLegalName', e.target.value)} placeholder="Registered legal name" aria-invalid={Boolean(fieldErrors.businessLegalName)}/>{fieldErrors.businessLegalName && <small className="template-input-error" role="alert">{fieldErrors.businessLegalName}</small>}</label>
            <div className="template-identity-field">
              <label className="template-identity-toggle">
                <span>Show GSTIN</span>
                <input type="checkbox" checked={settings.showGstin !== false}
                  onChange={(event) => update('showGstin', event.target.checked)}
                  aria-label="Show GSTIN on documents"/>
              </label>
              <label>GSTIN<input disabled={settings.showGstin === false}
                value={settings.businessGstin || ''}
                onChange={(e) => update('businessGstin', e.target.value.toUpperCase())}
                placeholder="32XXXXXXXXXXXXX" aria-invalid={Boolean(fieldErrors.businessGstin)}/></label>
              {fieldErrors.businessGstin && <small className="template-input-error" role="alert">{fieldErrors.businessGstin}</small>}
            </div>
            <div className="template-identity-field">
              <label className="template-identity-toggle">
                <span>Show PAN</span>
                <input type="checkbox" checked={settings.showPan !== false}
                  onChange={(event) => update('showPan', event.target.checked)}
                  aria-label="Show PAN on documents"/>
              </label>
              <label>PAN<input disabled={settings.showPan === false}
                value={settings.businessPan || ''}
                onChange={(e) => update('businessPan', e.target.value.toUpperCase())}
                placeholder="ABCDE1234F" aria-invalid={Boolean(fieldErrors.businessPan)}/></label>
              {fieldErrors.businessPan && <small className="template-input-error" role="alert">{fieldErrors.businessPan}</small>}
            </div>
            <label>Phone<input value={settings.businessPhone || ''} onChange={(e) => update('businessPhone', e.target.value)} placeholder="+91 98765 43210" aria-invalid={Boolean(fieldErrors.businessPhone)}/>{fieldErrors.businessPhone && <small className="template-input-error" role="alert">{fieldErrors.businessPhone}</small>}</label>
            <label>Email<input type="email" value={settings.businessEmail || ''} onChange={(e) => update('businessEmail', e.target.value)} placeholder="accounts@company.com" aria-invalid={Boolean(fieldErrors.businessEmail)}/>{fieldErrors.businessEmail && <small className="template-input-error" role="alert">{fieldErrors.businessEmail}</small>}</label>
            <label>State<input value={settings.businessState || ''} onChange={(e) => update('businessState', e.target.value)} placeholder="State" aria-invalid={Boolean(fieldErrors.businessState)}/>{fieldErrors.businessState && <small className="template-input-error" role="alert">{fieldErrors.businessState}</small>}</label>
            <label>State Code<input value={settings.businessStateCode || ''} onChange={(e) => update('businessStateCode', e.target.value)} placeholder="State code" aria-invalid={Boolean(fieldErrors.businessStateCode)}/>{fieldErrors.businessStateCode && <small className="template-input-error" role="alert">{fieldErrors.businessStateCode}</small>}</label>
            <div className="template-identity-field">
              <label className="template-identity-toggle">
                <span>Show Website</span>
                <input type="checkbox" checked={settings.showWebsite !== false}
                  onChange={(event) => update('showWebsite', event.target.checked)}
                  aria-label="Show website on documents"/>
              </label>
              <label>Website (optional)<input disabled={settings.showWebsite === false}
                value={settings.businessWebsite || ''}
                onChange={(e) => update('businessWebsite', e.target.value)}
                placeholder="https://yourworkshop.com"
                aria-invalid={Boolean(fieldErrors.businessWebsite)}/></label>
              {fieldErrors.businessWebsite && <small className="template-input-error" role="alert">{fieldErrors.businessWebsite}</small>}
            </div>
            <label className="business-field-wide">Registered Address<textarea value={settings.businessAddress || ''} onChange={(e) => update('businessAddress', e.target.value)} placeholder="Full registered business address" aria-invalid={Boolean(fieldErrors.businessAddress)}/>{fieldErrors.businessAddress && <small className="template-input-error" role="alert">{fieldErrors.businessAddress}</small>}</label>
          </div>
        </div>
        <p className="template-tax-identity-notice">
          GSTIN and PAN settings control optional document branding; GSTIN remains
          included where required on official GST tax invoices. Turning a field off
          does not change workshop GST registration.
        </p>

        <details className="business-subsection" open={false}>
          <summary className="business-subsection-head"><strong>Payment Details</strong></summary>
          <div className="business-fields-grid">
            <label>Bank Name<input value={settings.bankName || ''} onChange={(e) => update('bankName', e.target.value)} placeholder="Bank name" aria-invalid={Boolean(fieldErrors.bankName)}/>{fieldErrors.bankName && <small className="template-input-error" role="alert">{fieldErrors.bankName}</small>}</label>
            <label>Account Name<input value={settings.bankAccountName || ''} onChange={(e) => update('bankAccountName', e.target.value)} placeholder="Account holder" aria-invalid={Boolean(fieldErrors.bankAccountName)}/>{fieldErrors.bankAccountName && <small className="template-input-error" role="alert">{fieldErrors.bankAccountName}</small>}</label>
            <label>Account Number<input value={settings.bankAccountNumber || ''} onChange={(e) => update('bankAccountNumber', e.target.value)} placeholder="Account number" aria-invalid={Boolean(fieldErrors.bankAccountNumber)}/>{fieldErrors.bankAccountNumber && <small className="template-input-error" role="alert">{fieldErrors.bankAccountNumber}</small>}</label>
            <label>IFSC<input value={settings.bankIfsc || ''} onChange={(e) => update('bankIfsc', e.target.value.toUpperCase())} placeholder="IFSC code" aria-invalid={Boolean(fieldErrors.bankIfsc)}/>{fieldErrors.bankIfsc && <small className="template-input-error" role="alert">{fieldErrors.bankIfsc}</small>}</label>
            <label>UPI ID<input value={settings.bankUpi || ''} onChange={(e) => update('bankUpi', e.target.value)} placeholder="business@upi" aria-invalid={Boolean(fieldErrors.bankUpi)}/>{fieldErrors.bankUpi && <small className="template-input-error" role="alert">{fieldErrors.bankUpi}</small>}</label>
            <label>Authorised Signatory<input value={settings.authorizedSignatory || ''} onChange={(e) => update('authorizedSignatory', e.target.value)} placeholder="Name / designation" aria-invalid={Boolean(fieldErrors.authorizedSignatory)}/>{fieldErrors.authorizedSignatory && <small className="template-input-error" role="alert">{fieldErrors.authorizedSignatory}</small>}</label>
            <label className="business-field-wide">Terms & Conditions<textarea value={settings.termsText || ''} onChange={(e) => update('termsText', e.target.value)} placeholder="Payment / warranty / jurisdiction terms" aria-invalid={Boolean(fieldErrors.termsText)}/>{fieldErrors.termsText && <small className="template-input-error" role="alert">{fieldErrors.termsText}</small>}</label>
          </div>
        </details>

        <div className="template-toggle-row">
          <label><input type="checkbox" checked={settings.showBusinessLogo !== false} onChange={(e) => update('showBusinessLogo', e.target.checked)}/><span>Show business logo</span></label>
          <label><input type="checkbox" checked={settings.showBankDetails !== false} onChange={(e) => update('showBankDetails', e.target.checked)}/><span>Show bank details</span></label>
          <label><input type="checkbox" checked={settings.showTerms !== false} onChange={(e) => update('showTerms', e.target.checked)}/><span>Show terms</span></label>
          <label><input type="checkbox" checked={settings.showSignature !== false} onChange={(e) => update('showSignature', e.target.checked)}/><span>Show signature area</span></label>
        </div>
      </details>

      <details className="template-settings-card" open>
        <summary className="template-settings-title"><Sparkles size={18}/><strong>Layout &amp; Colors</strong></summary>

        <div className="template-control-grid">
          <label>
            <span><ReceiptText size={15}/>Invoice Template</span>
            <select value={settings.invoiceTemplate} aria-invalid={Boolean(fieldErrors.invoiceTemplate)} onChange={(e) => update('invoiceTemplate', e.target.value)}>
              {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {fieldErrors.invoiceTemplate && <small className="template-input-error" role="alert">{fieldErrors.invoiceTemplate}</small>}
          </label>

          <label>
            <span><FileText size={15}/>Estimate Template</span>
            <select value={settings.estimateTemplate} aria-invalid={Boolean(fieldErrors.estimateTemplate)} onChange={(e) => update('estimateTemplate', e.target.value)}>
              {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {fieldErrors.estimateTemplate && <small className="template-input-error" role="alert">{fieldErrors.estimateTemplate}</small>}
          </label>

          <label>
            <span><LayoutTemplate size={15}/>Accent</span>
            <select value={settings.accent} aria-invalid={Boolean(fieldErrors.accent)} onChange={(e) => update('accent', e.target.value)}>
              {accents.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            {fieldErrors.accent && <small className="template-input-error" role="alert">{fieldErrors.accent}</small>}
          </label>
        </div>

        <div className="template-toggle-row">
          <label><input type="checkbox" checked={settings.showOriginal} onChange={(e) => update('showOriginal', e.target.checked)}/><span>Show ORIGINAL label</span></label>
          <label><input type="checkbox" checked={settings.showSellerMark} onChange={(e) => update('showSellerMark', e.target.checked)}/><span>Show seller initials mark</span></label>
          <label><input type="checkbox" checked={settings.compactTable} onChange={(e) => update('compactTable', e.target.checked)}/><span>Compact item table</span></label>
        </div>

        {(settings.invoiceTemplate === 'custom' || settings.estimateTemplate === 'custom') && (
          <div className="custom-template-maker">
            <div className="custom-template-maker-head">
              <div>
                <span>CUSTOM TEMPLATE MAKER</span>
                <h3>Build your own PDF template</h3>
              </div>
            </div>

            <div className="custom-template-grid">
              <label>Template Name
                <input value={settings.customName || ''} onChange={(e) => update('customName', e.target.value)} placeholder="Template name" aria-invalid={Boolean(fieldErrors.customName)}/>
              {fieldErrors.customName && <small className="template-input-error" role="alert">{fieldErrors.customName}</small>}</label>
              <label>Document Heading
                <input value={settings.customHeader || ''} onChange={(e) => update('customHeader', e.target.value)} placeholder="Document heading" aria-invalid={Boolean(fieldErrors.customHeader)}/>
              {fieldErrors.customHeader && <small className="template-input-error" role="alert">{fieldErrors.customHeader}</small>}</label>
              <label className="custom-template-wide">Footer Note
                <textarea value={settings.customFooter || ''} onChange={(e) => update('customFooter', e.target.value)} placeholder="Footer note" aria-invalid={Boolean(fieldErrors.customFooter)}/>
              {fieldErrors.customFooter && <small className="template-input-error" role="alert">{fieldErrors.customFooter}</small>}</label>
            </div>

            <div className="template-toggle-row">
              <label><input type="checkbox" checked={settings.customShowTransport !== false} onChange={(e) => update('customShowTransport', e.target.checked)}/><span>Show transport section</span></label>
              <label><input type="checkbox" checked={settings.customShowTaxTable !== false} onChange={(e) => update('customShowTaxTable', e.target.checked)}/><span>Show tax summary</span></label>
            </div>
          </div>
        )}
      </details>
        </div>

      <div className={`template-preview-grid ${mobilePane === 'edit' ? 'is-mobile-hidden' : ''}`}>
        <div className="template-document-toggle" role="tablist" aria-label="Document preview">
          <button role="tab" type="button" aria-selected={previewKind === 'invoice'} onClick={() => setPreviewKind('invoice')}>Invoice</button>
          <button role="tab" type="button" aria-selected={previewKind === 'estimate'} onClick={() => setPreviewKind('estimate')}>Estimate</button>
        </div>
        {previewKind === 'invoice' && <section className="template-preview-card">
          <div className="template-preview-card-head">
            <div><span>INVOICE</span><h2>{invoiceTemplate.name}</h2></div>
            <ReceiptText size={20}/>
          </div>
          <Preview kind="invoice" settings={settings} workshopLogoUrl={workshopLogoUrl}/>
        </section>}

        {previewKind === 'estimate' && <section className="template-preview-card">
          <div className="template-preview-card-head">
            <div><span>ESTIMATE</span><h2>{estimateTemplate.name}</h2></div>
            <FileText size={20}/>
          </div>
          <Preview kind="estimate" settings={settings} workshopLogoUrl={workshopLogoUrl}/>
        </section>}
      </div>
      </div>
    </div>
  );
}

export default DocumentTemplates;
