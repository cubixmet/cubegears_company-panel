import { recordLabel } from '../../utils/recordReferences.js';
import { appConfirm } from '../../components/common/appDialogs';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, CreditCard, FilePenLine, ReceiptText, Upload, Users } from 'lucide-react';
import { saasAccountService } from '../../services/saasAccount.service';
import { settingsService } from '../../services/settings.service';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { storageHistoryService } from '../../services/storageHistory.service';
import { AccountHeader, AccountOverview } from '../../components/account';
import { formatStorageBytes, storageBytes, BYTES_PER_GB } from '../../utils/storageUnits';
import '../../styles/account-billing.css';
import '../../styles/account-dashboard.css';
import '../../styles/account-overview-refined.css';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
function BillingView({ billing, storage, onOpenTemplates }) {
  const navigate = useNavigate();
  const estimate = useMemo(() => billing ? saasAccountService.calculateMonthlyEstimate(billing) : null, [billing]);
  const plan = billing?.plan;
  const nextRenewal = plan?.nextBillingDate ? date.format(new Date(plan.nextBillingDate)) : '—';
  const actualUsers = billing?.usage?.seatsUsed;
  const seats = Number(plan?.includedSeats || 0);
  return (
    <div className="saas-grid">
      <section className="saas-card saas-wide saas-template-entry">
        <div className="saas-card-head">
          <div><span className="saas-kicker">DOCUMENTS</span><h2>Invoice & Estimate Templates</h2></div>
          <FilePenLine size={22}/>
        </div>
        <p className="saas-muted">Configure invoice and estimate styles and company document details.</p>
        <button type="button" className="saas-button" onClick={onOpenTemplates}>
          <FilePenLine size={17}/> Open Template Designer
        </button>
      </section>
      <section className="saas-card saas-wide">
        <div className="saas-card-head">
          <div><span className="saas-kicker">RAZORPAY SUBSCRIPTION</span><h2>Manage your plan and payment history</h2></div>
          <CreditCard size={22}/>
        </div>
        <p className="saas-muted">Select a plan, complete a secure one-time Razorpay payment, renew access, or review previous payments.</p>
        <button type="button" className="saas-button" onClick={() => navigate('/subscribe')}>
          Open subscription &amp; payments <ChevronRight size={17}/>
        </button>
      </section>
      <section className="saas-card saas-plan-card">
        <div className="saas-card-head">
          <div><span className="saas-kicker">SUBSCRIPTION</span>
            <h2>{plan?.name || 'Subscription unavailable'}</h2></div>
          <span className="saas-status">{plan?.status || 'Unavailable'}</span>
        </div>
        <div className="saas-price">
          {plan?.basePrice == null ? '—' : money.format(plan.basePrice)}
          <span>{plan?.billingCycle ? '/' + plan.billingCycle : 'No active recurring charge'}</span>
        </div>
        <div className="saas-details-grid">
          <div><span>Included users</span><strong>{plan?.includedSeats ?? '—'}</strong></div>
          <div><span>Billing renewal</span><strong>{nextRenewal}</strong></div>
          <div><span>Active accounts</span><strong>{actualUsers ?? '—'}</strong></div>
          <div><span>Current media</span><strong>{storage?.usedGb == null ? '—' : storage.usedGb + ' GB'}</strong></div>
        </div>
        <button type="button" className="saas-button" onClick={() => navigate('/account/plans')}>Compare / Change Plan <ChevronRight size={15}/></button>
        {billing?.billingNote && <p className="saas-muted saas-billing-note">{billing.billingNote}</p>}
      </section>
      <section className="saas-card">
        <div className="saas-card-head"><div>
          <span className="saas-kicker">PLAN ESTIMATE</span><h2>Estimated monthly amount</h2>
        </div><ReceiptText size={22}/></div>
        {estimate ? (
          <div className="saas-breakdown">
            <div><span>Plan base</span><strong>{money.format(estimate.base)}</strong></div>
            <div><span>Seats above plan ({estimate.extraSeats})</span>
              <strong>{plan?.extraSeatRate == null ? 'Not configured' : money.format(estimate.seatCharge)}</strong></div>
            <div><span>Estimated GST (18%)</span><strong>{money.format(estimate.tax)}</strong></div>
            <div className="total"><span>Indicative subtotal</span><strong>{money.format(estimate.total)}</strong></div>
          </div>
        ) : <p className="saas-muted">
          No verified subscription rate is configured. Plan charges cannot be estimated.
        </p>}
        <p className="saas-muted">Estimates are informational only; this is not an issued subscription invoice.</p>
      </section>
      <section className="saas-card">
        <div className="saas-card-head"><div><span className="saas-kicker">USER ACCESS</span>
          <h2>Active login accounts</h2></div><Users size={22}/></div>
        <div className="saas-account-readonly-users">
          <strong>{actualUsers ?? '—'}</strong>
          <span>Actual active users from your company</span>
        </div>
        {seats > 0 && actualUsers != null && (
          <div className="saas-meter"><div style={{
            width: Math.min(100, Math.max(0, Number(actualUsers) / seats * 100)) + '%',
          }}/></div>
        )}
        <p className="saas-muted">
          User count updates automatically when staff accounts are activated/deactivated.
          It cannot be edited manually.
        </p>
      </section>
      <section className="saas-card saas-wide">
        <div className="saas-card-head"><div><span className="saas-kicker">BILL HISTORY</span>
          <h2>Subscription invoices</h2></div><CalendarDays size={22}/></div>
        {billing?.invoices?.length ? (
          <div className="saas-table-wrap"><table className="saas-table">
            <thead><tr><th>Invoice</th><th>Period</th><th>Amount</th><th>Status</th><th>Paid</th></tr></thead>
            <tbody>{billing.invoices.map((item) => <tr key={item.id}>
              <td>{recordLabel(item.number || item.id)}</td><td>{item.period || '—'}</td><td>{money.format(item.amount)}</td>
              <td>{item.status || '—'}</td>
              <td>{item.paidAt ? date.format(new Date(item.paidAt)) : '—'}</td>
            </tr>)}</tbody>
          </table></div>
        ) : <p className="saas-muted">No verified subscription invoices available.</p>}
      </section>
    </div>
  );
}

function StorageView({ storage, setStorage }) {
  const access = useFeatureAccess();
  const canManageStorage = access.can('storage.manage');
  const canToggleStorage = access.isCompanyOwner || canManageStorage;
  const [storageError, setStorageError] = useState('');
  const [storageBusy, setStorageBusy] = useState(false);
  const [unit, setUnit] = useState('auto');
  const [category, setCategory] = useState('Job Card');
  const usedBytes = storageBytes(storage);
  const storageEnabled = storage.settings?.enabled !== false;

  const upload = async (event) => {
    if (!canManageStorage) return setStorageError('Storage modification requires storage.manage permission.');
    if (!storageEnabled) return setStorageError('Storage uploads are disabled. Enable storage first.');
    const files = Array.from(event.target.files || []);
    const valid = files.filter((file) =>
      storage.settings.allowedTypes.includes(file.type) &&
      file.size <= storage.settings.maxFileMb * 1024 * 1024);
    event.target.value = '';
    if (!valid.length) return setStorageError('Select JPG, PNG or WebP images within the allowed file size.');
    setStorageBusy(true); setStorageError('');
    try {
      const next = await saasAccountService.uploadMediaFiles(valid, category);
      setStorage(next);
      await storageHistoryService.recordTodayStorageSnapshot(next);
    } catch (error) {
      setStorageError(error?.message || 'Upload failed. Please retry.');
    } finally { setStorageBusy(false); }
  };

  const setUploadsEnabled = async (enabled) => {
    if (!canToggleStorage || storageBusy) return;
    if (!enabled && !await appConfirm('Disable new storage uploads for this workshop?')) return;
    setStorageBusy(true);
    setStorageError('');
    try {
      setStorage(await saasAccountService.updateStorageSettings({ enabled }));
    } catch (error) {
      setStorageError(error?.message || 'Unable to save storage settings.');
    } finally {
      setStorageBusy(false);
    }
  };

  return (
    <div className="saas-grid">
      <section className="saas-card saas-wide storage-control-card">
        <div className="storage-control-header">
          <h2>Storage &amp; file usage</h2>
          <div className="storage-status-control">
            <span className={storageEnabled ? 'storage-status is-on' : 'storage-status is-off'}>
              {storageEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <label className="storage-switch-label">
              <span>Allow new uploads</span>
              <input type="checkbox" role="switch" aria-label="Enable workshop storage uploads"
                aria-checked={storageEnabled} checked={storageEnabled}
                disabled={storageBusy || !canToggleStorage}
                onChange={(event) => setUploadsEnabled(event.target.checked)} />
            </label>
          </div>
        </div>
        <div className="storage-unit-toolbar">
          <span>Display usage as</span>
          <div className="storage-unit-options" role="group" aria-label="Storage unit">
            {['auto', 'KB', 'MB', 'GB'].map((value) => (
              <button type="button" key={value} className={unit === value ? 'active' : ''}
                aria-pressed={unit === value} onClick={() => setUnit(value)}>
                {value === 'auto' ? 'Auto' : value}
              </button>
            ))}
          </div>
        </div>
        <div className="storage-overview-grid">
          <div className="storage-primary-usage">
            <span>Currently stored</span>
            <strong>{formatStorageBytes(usedBytes, unit)}</strong>
            <small>{usedBytes.toLocaleString('en-IN')} bytes</small>
          </div>
          <div><span>Files stored</span><strong>{storage.fileCount ?? storage.files?.length ?? 0}</strong></div>
          <div><span>Storage allowance</span><strong>{storage.quotaBytes != null ? formatStorageBytes(storage.quotaBytes, unit) : storage.quotaGb != null ? formatStorageBytes(Number(storage.quotaGb) * BYTES_PER_GB, unit) : 'Not capped'}</strong></div>
        </div>
        {canManageStorage && <div className="saas-storage-actions">
          <select aria-label="Upload category" value={category} onChange={(e) => setCategory(e.target.value)}><option>Job Card</option><option>Inspection</option><option>Invoice</option><option>Delivery</option><option>General</option></select>
          <label className={`saas-button ${!storageEnabled ? 'is-disabled' : ''}`}><Upload size={18} />
            {storageBusy ? 'Working…' : storageEnabled ? 'Upload photos' : 'Uploads disabled'}
            <input hidden multiple disabled={storageBusy || !storageEnabled} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} />
          </label>
        </div>}
        {storageError && <p className="saas-error" role="alert">{storageError}</p>}
      </section>
    </div>
  );
}

export function SaaSAccount({ section = 'billing' }) {
  const navigate = useNavigate();
  const [billing, setBilling] = useState(null);
  const [storage, setStorage] = useState(null);
  const [company, setCompany] = useState(null);
  const [companyError, setCompanyError] = useState('');
  const [sourceErrors, setSourceErrors] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [bill, media, companyResult] = await Promise.allSettled([
      section === 'billing' ? saasAccountService.getSubscriptionBilling() : Promise.resolve(null),
      saasAccountService.getStorageAccount(),
      section === 'storage' ? Promise.resolve(null) : settingsService.getSettings('company'),
    ]);
    const errors = {};
    if (bill.status === 'fulfilled') setBilling(bill.value);
    else { errors.billing = bill.reason?.message || 'Unable to load billing.'; setBilling(null); }
    if (media.status === 'fulfilled') {
      setStorage(media.value);
      storageHistoryService.recordTodayStorageSnapshot(media.value).catch(() => {});
    } else { errors.storage = media.reason?.message || 'Unable to load media storage.'; setStorage(null); }
    if (companyResult.status === 'fulfilled') {
      setCompany(companyResult.value); setCompanyError('');
    } else {
      setCompany(null);
      setCompanyError(companyResult.reason?.message || 'Company details unavailable.');
    }
    setSourceErrors(errors);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveCompany = async (nextCompany) => {
    const updated = await settingsService.updateSettings('company', nextCompany);
    setCompany((current) => ({ ...current, ...nextCompany, ...updated }));
    return updated;
  };

  return (
    <div className="saas-page account-billing-page">
      <AccountHeader
        title={section === 'overview' ? 'Account Overview'
          : section === 'storage' ? 'Media Storage' : 'Billing & Plan'}
        subtitle={section === 'overview'
          ? 'Your company account, users, billing, settings and security in one place.'
          : section === 'storage'
            ? 'Check storage usage and manage new photo uploads.'
            : 'Account information and usage.'}
        active={section}
        onNavigate={navigate}
      />
      {loading && <div className="saas-loading" role="status">Loading account information…</div>}
      {Object.keys(sourceErrors).length > 0 && (
        <div className="saas-error" role="alert">
          Some account data could not load: {Object.keys(sourceErrors).join(', ')}.
          <button type="button" className="saas-retry" onClick={load}>Retry</button>
        </div>
      )}
      {section === 'overview' ? (
        <AccountOverview billing={billing} storage={storage}
          company={company} companyError={companyError}
          onSaveCompany={saveCompany} onReload={load} loading={loading}
          onNavigate={navigate}/>
      ) : section === 'storage' ? (
        storage ? <StorageView storage={storage} setStorage={setStorage}/>
          : !loading && <div className="saas-error">Storage information unavailable. Retry loading your account.</div>
      ) : (
        <BillingView billing={billing} storage={storage}
          onOpenTemplates={() => navigate('/account/templates')}
          onOpenPlans={() => navigate('/account/plans')}/>
      )}
    </div>
  );
}
