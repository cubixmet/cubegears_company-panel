import { useEffect, useState } from "react";
import { Building2, CheckCircle2, CreditCard, HardDrive, Mail, MapPin, Phone, ReceiptText, Save, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { creditWalletService } from '../../services/creditWallet.service';
import { formatStorageBytes, storageBytes } from '../../utils/storageUnits';
import { validateCompanyDraft, formatCompanyApiError } from './companyAccountValidation';

const display = (value) => value === null || value === undefined || value === '' ? '—' : String(value);
const fmtDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—'
    : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const EDIT_FIELDS = [
  ['name','Workshop / Company Name','text',true],
  ['phone','Company Phone','tel',false],
  ['email','Official Email','email',false],
  ['gstNo','GSTIN','text',false],
  ['address','Registered Address','textarea',false],
];

export function AccountOverview({
  storage, company, companyError,
  onSaveCompany, onReload, loading, onNavigate,
}) {
  const { user } = useAuth();
  const featureAccess = useFeatureAccess();
  const { can } = featureAccess;
  const activeModules = featureAccess.labelOnly ? featureAccess.activeLabelModules : featureAccess.modules;
  const [editing, setEditing] = useState(false);
  const [creditOverview, setCreditOverview] = useState(null);
  useEffect(() => {
    let alive = true;
    creditWalletService.overview().then(data => { if (alive) setCreditOverview(data); }).catch(() => { if (alive) setCreditOverview(null); });
    return () => { alive = false; };
  }, [loading]);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!editing) setDraft({
      name: company?.name || '', phone: company?.phone || '',
      email: company?.email || '', gstNo: company?.gstNo || '',
      address: company?.address || '',
    });
  }, [company, editing]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (saving || !company || !onSaveCompany) return;
    const validated = validateCompanyDraft(draft);
    setFieldErrors(validated.errors);
    if (Object.keys(validated.errors).length) return;
    setSaving(true); setSaveError(''); setSaveMessage('');
    try {
      await onSaveCompany(validated.draft);
      setEditing(false);
      setSaveMessage('Company details updated successfully.');
    } catch (err) {
      setSaveError(formatCompanyApiError(err));
    } finally { setSaving(false); }
  };

  const cards = [
    { label: 'Available Credits', value: display(creditOverview?.balance), icon: CreditCard },
    { label: 'Active Modules', value: featureAccess.unavailable || !Array.isArray(activeModules)
      ? '—' : new Set(activeModules.map(item => typeof item === 'string' ? item : item?.key || item?.id)).size, icon: Zap },
    { label: 'Storage Used', value: storage ? formatStorageBytes(storageBytes(storage)) : '—', icon: HardDrive },
  ];
  const actions = [
    { title: 'Buy Credits', href: '/account/credits/buy', icon: CreditCard, permission: 'billing.view' },
    { title: 'Feature Controls', href: '/account#module-pricing', icon: Zap, permission: 'billing.view' },
    { title: 'View Logs', href: '/account/credits/logs', icon: ReceiptText, permission: 'billing.view' },
    { title: 'Manage Storage', href: '/account/storage', icon: HardDrive, permission: 'billing.view' },
    { title: 'Security Settings', href: '/account/security', icon: ShieldCheck, permission: 'settings.view' },
  ];

  return (
    <div className="account-overview account-overview-refined">
      <section className="account-overview-welcome">
        <div className="account-overview-avatar" aria-hidden="true">
          {String(user?.name || 'U').trim().split(/\s+/).slice(0,2)
            .map((part) => part[0]?.toUpperCase()).join('')}
        </div>
        <div className="account-overview-welcome__details">
          <h2>{display(company?.name || user?.companyName || 'Your workshop')}</h2>
          <p>Signed in as <strong>{display(user?.name)}</strong> · {display(user?.email)}</p>
        </div>
        <button type="button" className="account-overview-refresh" onClick={onReload} disabled={loading}>
          <CheckCircle2 size={15}/> {loading ? 'Loading…' : 'Refresh Data'}
        </button>
      </section>

      <section className="account-overview-stats" aria-label="Account overview">
        {cards.map(({label,value,icon:Icon}) => (
          <article key={label}>
            <div><span>{label}</span><strong title={value}>{value}</strong></div>
            <i><Icon size={19} aria-hidden="true"/></i>
          </article>
        ))}
      </section>
      {saveMessage && <p className="account-overview-success" role="status">{saveMessage}</p>}
      <div className="account-overview-grid">
        <article className="account-overview-panel account-overview-company">
          <header>
            <div><h2><Building2 size={18} aria-hidden="true"/> Company Information</h2></div>
            {!editing && company && can('company.manage') && (
              <button type="button" className="account-overview-edit" onClick={() => {
                setSaveMessage('');setSaveError('');setFieldErrors({});setEditing(true);
              }}>Edit Details</button>
            )}
          </header>

          {companyError && !company && <p className="account-overview-warning" role="alert">
            Company information unavailable. {companyError}
          </p>}
          {editing ? (
            <form className="account-overview-company-form" onSubmit={onSubmit}>
              {EDIT_FIELDS.map(([key,label,type,required]) => (
                <label key={key} className={type==='textarea'?'is-wide':''}>
                  {label}
                  {type==='textarea'
                    ? <textarea rows={3} value={draft[key] || ''} maxLength={2000}
                        aria-invalid={Boolean(fieldErrors[key])}
                        onChange={(e) => { setDraft((prev)=>({...prev,[key]:e.target.value})); setFieldErrors((prev)=>({...prev,[key]:''})); }}/>
                    : <input type={type} value={draft[key] || ''} required={required}
                        maxLength={key==='gstNo'?15:key==='name'?180:key==='phone'?30:254}
                        aria-invalid={Boolean(fieldErrors[key])}
                        onChange={(e) => { setDraft((prev)=>({...prev,[key]:e.target.value})); setFieldErrors((prev)=>({...prev,[key]:''})); }}/>}
                  {fieldErrors[key] && <small className="account-overview-field-error" role="alert">{fieldErrors[key]}</small>}
                </label>
              ))}
              {saveError && <p className="account-overview-warning" role="alert">{saveError}</p>}
              <div className="account-overview-form-actions">
                <button type="button" disabled={saving} onClick={()=>{setEditing(false);setSaveError('');setFieldErrors({});}}>Cancel</button>
                <button type="submit" className="is-primary" disabled={saving}>
                  <Save size={15} aria-hidden="true"/>{saving?'Saving…':'Save Company'}
                </button>
              </div>
            </form>
          ) : (
            <div className="account-overview-rows">
              <div><span><Building2 size={14}/> Company</span><strong>{display(company?.name)}</strong></div>
              <div><span><Mail size={14}/> Email</span><strong>{display(company?.email)}</strong></div>
              <div><span><Phone size={14}/> Phone</span><strong>{display(company?.phone)}</strong></div>
              <div><span><MapPin size={14}/> Address</span><strong>{display(company?.address)}</strong></div>
              <div><span>GSTIN</span><strong>{display(company?.gstNo)}</strong></div>
            </div>
          )}
        </article>

      </div>
      <section className="account-overview-shortcuts">
        <header><h2>Quick Actions</h2></header>
        <div className="account-overview-shortcut-grid">
          {actions.filter(({permission}) => can(permission)).map(({title,href,icon:Icon}) => (
            <button type="button" key={href} onClick={()=>onNavigate(href)}>
              <i><Icon size={20}/></i>
              <strong>{title}</strong>
              
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
