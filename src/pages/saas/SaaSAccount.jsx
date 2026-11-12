import { appConfirm } from '../../components/common/appDialogs';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, CreditCard, FilePenLine, IndianRupee, ReceiptText, ShieldCheck, Trash2, Upload, Users } from 'lucide-react';
import { saasAccountService } from '../../services/saasAccount.service';
import { settingsService } from '../../services/settings.service';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { useAuth } from '../../hooks/useAuth';
import { USE_MOCK_API } from '../../api/apiConfig';
import { storageHistoryService } from '../../services/storageHistory.service';
import { CreditCycleCard } from '../../components/account/CreditCycleCard';
import { AccountHeader, AccountOverview } from '../../components/account';
import { formatStorageBytes, formatStorageDelta, storageBytes, BYTES_PER_GB, BYTES_PER_MB } from '../../utils/storageUnits';
import '../../styles/account-billing.css';
import '../../styles/account-dashboard.css';
import '../../styles/account-overview-refined.css';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTime = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const iso = (value) => new Date(value).toISOString().slice(0, 10);

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
              <td>{item.id}</td><td>{item.period || '—'}</td><td>{money.format(item.amount)}</td>
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
  const navigate = useNavigate();
  const { can } = useFeatureAccess();
  const canManageStorage = can('storage.manage');
  const canToggleStorage = access.isCompanyOwner || canManageStorage;
  const { user } = useAuth();
  const [storageError, setStorageError] = useState('');
  const [unit, setUnit] = useState('auto');
  const usedBytes = storageBytes(storage);
  const storageEnabled = storage.settings?.enabled !== false;
  const [historyError, setHistoryError] = useState('');
  const [storageBusy, setStorageBusy] = useState(false);
  const [selected, setSelected] = useState([]);
  const [category, setCategory] = useState('Job Card');
  const [history, setHistory] = useState([]);
  const [serverEvents, setServerEvents] = useState([]);
  const [eventCount, setEventCount] = useState(0);
  const [eventError, setEventError] = useState('');
  const [eventsLoading, setEventsLoading] = useState(!USE_MOCK_API);
  const [intervalLogs, setIntervalLogs] = useState([]);
  const [intervalCount, setIntervalCount] = useState(0);
  const [intervalError, setIntervalError] = useState('');
  const [intervalsLoading, setIntervalsLoading] = useState(!USE_MOCK_API);
  const [audit, setAudit] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cubixgear-storage-audit') || '[]'); } catch { return []; }
  });
  const [rangePreset, setRangePreset] = useState('7');
  const [to, setTo] = useState(iso(new Date()));
  const [from, setFrom] = useState(iso(new Date(Date.now() - 6 * 86400000)));

  const summary = useMemo(() => storageHistoryService.summarizeStorageHistory(history), [history]);

  const refreshHistory = async (nextFrom = from, nextTo = to) => {
    try {
      const rows = await storageHistoryService.getStorageHistory({ from: nextFrom, to: nextTo });
      setHistory(Array.isArray(rows) ? rows : []);
      setHistoryError('');
    } catch (error) {
      setHistoryError(error?.message || 'Could not load storage history.');
      setHistory([]);
    }
  };

  const refreshEvents = async (start = from, end = to, append = false) => {
    if (USE_MOCK_API) return;
    setEventsLoading(true);
    try {
      const payload = await storageHistoryService.getStorageEvents({ from: start, to: end, offset: append ? serverEvents.length : 0 });
      setServerEvents(old => append ? [...old, ...(payload?.results || [])] : (payload?.results || []));
      setEventCount(payload?.count || 0);
      setEventError('');
    } catch (error) {
      setServerEvents([]);
      setEventError(error?.message || 'Could not retrieve storage activity.');
    } finally {
      setEventsLoading(false);
    }
  };

  const refreshIntervals = async (start = from, end = to, append = false) => {
    if (USE_MOCK_API) return;
    setIntervalsLoading(true);
    try {
      const payload = await storageHistoryService.getStorageIntervalLogs({
        from: start, to: end, offset: append ? intervalLogs.length : 0,
      });
      setIntervalLogs(old => append ? [...old, ...(payload?.results || [])] : (payload?.results || []));
      setIntervalCount(Number(payload?.count || 0));
      setIntervalError('');
    } catch (error) {
      if (!append) setIntervalLogs([]);
      setIntervalError(error?.message || 'Could not load interval logs.');
    } finally {
      setIntervalsLoading(false);
    }
  };

  useEffect(() => {
    refreshHistory();
    refreshEvents();
    refreshIntervals();
  }, []);

  const log = (action, details) => {
    if (!USE_MOCK_API) return;
    const next = [{ id: Date.now(), at: new Date().toISOString(), action, details, user: user?.name || 'Local Account' }, ...audit].slice(0, 100);
    setAudit(next);
    localStorage.setItem('cubixgear-storage-audit', JSON.stringify(next));
  };

  const choosePreset = (value) => {
    setRangePreset(value);
    const end = new Date();
    let start;
    if (value === 'month') start = new Date(end.getFullYear(), end.getMonth(), 1);
    else start = new Date(end.getTime() - (Number(value) - 1) * 86400000);
    const nextFrom = iso(start);
    const nextTo = iso(end);
    setFrom(nextFrom);
    setTo(nextTo);
    refreshHistory(nextFrom, nextTo);
    refreshEvents(nextFrom, nextTo);
    refreshIntervals(nextFrom, nextTo);
  };

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
      await refreshHistory();
      await refreshEvents();
      log('UPLOAD', `${valid.length} photo(s) uploaded to ${category}`);
    } catch (error) {
      setStorageError(error?.message || 'Upload failed. Please retry.');
    } finally { setStorageBusy(false); }
  };

  const remove = async (ids) => {
    if (!canManageStorage) return setStorageError('Storage modification requires storage.manage permission.');
    if (!ids.length || !await appConfirm(`Delete ${ids.length} photo(s)? This cannot be undone.`)) return;
    setStorageBusy(true); setStorageError('');
    try {
      const next = await saasAccountService.deleteMediaFiles(ids);
      setStorage(next);
      await storageHistoryService.recordTodayStorageSnapshot(next);
      await refreshHistory();
      await refreshEvents();
      log('DELETE', `${ids.length} photo(s) deleted`);
      setSelected((old) => old.filter((id) => !ids.includes(id)));
    } catch (error) {
      setStorageError(error?.message || 'Unable to delete selected media.');
    } finally { setStorageBusy(false); }
  };

  const setting = async (key, value) => {
    if (!(key === 'enabled' && canToggleStorage) && !canManageStorage) return setStorageError('Storage settings require storage.manage permission.');
    setStorageBusy(true); setStorageError('');
    try {
      const next = await saasAccountService.updateStorageSettings({ [key]: value });
      setStorage(next);
      log('SETTINGS', `${key} changed to ${String(value)}`);
    } catch (error) {
      setStorageError(error?.message || 'Unable to save storage settings.');
    } finally { setStorageBusy(false); }
  };

  return (
    <div className="saas-grid">
      <section className="saas-card saas-wide storage-control-card">
        <div className="storage-control-header">
          <div>
            <span className="saas-kicker">LIVE WORKSHOP STORAGE</span>
            <h2>Storage & file usage</h2>
            <p>Storage is enabled by default for every workshop. Your files are measured in bytes.</p>
          </div>
          <div className="storage-status-control">
            <span className={storageEnabled ? 'storage-status is-on' : 'storage-status is-off'}>
              {storageEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <label className="storage-switch-label">
              <span>Allow new uploads</span>
              <input type="checkbox" role="switch" aria-label="Enable workshop storage uploads"
                aria-checked={storageEnabled} checked={storageEnabled}
                disabled={storageBusy || !canToggleStorage}
                onChange={async (event) => {
                  const next = event.target.checked;
                  if (!next && !await appConfirm('Disable new storage uploads for this workshop? Existing files and history remain accessible; billing for previously stored data is unchanged.')) return;
                  setting('enabled', next);
                }} />
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
          <div><span>Uploaded files</span><strong>{storage.fileCount ?? storage.files.length}</strong><small>Actual records in Django</small></div>
          <div><span>Storage allowance</span><strong>{storage.quotaBytes != null ? formatStorageBytes(storage.quotaBytes, unit) : storage.quotaGb != null ? formatStorageBytes(Number(storage.quotaGb) * BYTES_PER_GB, unit) : 'Not capped'}</strong><small>Plan allowance, if configured</small></div>
          <div><span>Storage billing</span><strong>{storage.billing ? (storage.billing.active ? 'Active' : 'Not active') : 'Not configured'}</strong><small>Billing is separate from storage availability</small></div>
        </div>
        <p className="storage-unit-note">1 KB = 1,024 bytes · 1 MB = 1,024 KB · 1 GB = 1,024 MB. Small uploads are not rounded down to 0 GB.</p>
        {canManageStorage && <div className="saas-storage-actions">
          <select aria-label="Upload category" value={category} onChange={(e) => setCategory(e.target.value)}><option>Job Card</option><option>Inspection</option><option>Invoice</option><option>Delivery</option><option>General</option></select>
          <label className={`saas-button ${!storageEnabled ? 'is-disabled' : ''}`}><Upload size={18} />
            {storageBusy ? 'Working…' : storageEnabled ? 'Upload photos' : 'Uploads disabled'}
            <input hidden multiple disabled={storageBusy || !storageEnabled} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} />
          </label>
          <button type="button" className="saas-button danger saas-storage-delete"
            disabled={!selected.length || storageBusy} onClick={() => remove(selected)}
            title={!selected.length ? 'Select one or more files to delete' : `Delete ${selected.length} selected file(s)`}>
            <Trash2 size={17} strokeWidth={2} aria-hidden="true" />
            <span>Delete selected</span>
          </button>
        </div>}
        {!storageEnabled && <p className="storage-paused-note">Uploads are paused. Existing files, download access and usage history are preserved.</p>}
        {storageError && <p className="saas-error" role="alert">{storageError}</p>}
      </section>
      <CreditCycleCard />

      {storage.billing && <section className="saas-card saas-wide"><h2>Storage Billing: {storage.billing.active ? 'Active' : 'Not active'}</h2>
        <p>{storage.billing.creditsPerGb} credits / GB / {storage.billing.period} · {storage.billing.includedGb} GB free</p>
        <details className="saas-storage-help"><summary>Billing details</summary>
          <p>Meter interval: {storage.billing.meterIntervalHours ?? (Number(storage.billing.meterIntervalSeconds || 0) / 3600)} hours. Monitoring has a separate schedule.</p>
          <p>Deleting files stops future usage. Previously recorded charges remain payable; see Account → Logs for monthly balances and due dates.</p>
        </details>
      </section>}
      <section className="saas-card saas-wide storage-history-card">
        <div className="saas-card-head"><div><span className="saas-kicker">USAGE INTERVAL</span><h2>Storage usage history</h2></div><IndianRupee size={22} /></div>
        <div className="storage-range-toolbar">
          <div className="storage-range-presets">
            <button className={rangePreset === '7' ? 'active' : ''} onClick={() => choosePreset('7')}>Last 7 days</button>
            <button className={rangePreset === '30' ? 'active' : ''} onClick={() => choosePreset('30')}>Last 30 days</button>
            <button className={rangePreset === 'month' ? 'active' : ''} onClick={() => choosePreset('month')}>This month</button>
          </div>
          <div className="storage-custom-range">
            <label><span>From</span><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setRangePreset('custom'); }} /></label>
            <label><span>To</span><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setRangePreset('custom'); }} /></label>
            <button onClick={() => { refreshHistory(); refreshEvents(); refreshIntervals(); }}>Apply</button>
          </div>
        </div>

        <div className="storage-interval-summary">
          <div><span>Days</span><strong>{summary.days}</strong></div>
          <div><span>Average storage</span><strong>{formatStorageBytes(summary.averageBytes, unit)}</strong></div>
          <div><span>Peak storage</span><strong>{formatStorageBytes(summary.peakBytes, unit)}</strong></div>
          <div><span>Snapshots</span><strong>{history.length}</strong></div>
        </div>

        {historyError && <p className="saas-error" role="alert">{historyError}</p>}
        {!history.length && !historyError && <p className="saas-muted">
          No recorded storage snapshots in this range yet.
        </p>}
        <div className="storage-history-list">
          {history.map((row) => (
            <button key={row.date} className="storage-history-row" onClick={() => navigate(`/account/storage/history/${row.date}`)}>
              <div><strong>{date.format(new Date(`${row.date}T00:00:00`))}</strong><span>{row.fileCount} files</span></div>
              <div><span>Stored</span><strong>{formatStorageBytes(storageBytes(row), unit)}</strong></div>
              <div><span>Files</span><strong>{row.fileCount}</strong></div>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      </section>

      <section className="saas-card saas-wide storage-interval-card">
        <div className="saas-card-head">
          <div><h2>Storage interval logs</h2></div>
          <span>{intervalLogs.length} of {intervalCount} recorded readings</span>
        </div>
        <details className="saas-storage-help"><summary>About readings</summary><p>Only saved monitoring and billing readings are shown. Monitoring does not debit credits.</p></details>
        {intervalError && <p className="saas-error" role="alert">{intervalError}</p>}
        {intervalsLoading && <p className="saas-loading" role="status">Loading recorded intervals…</p>}
        <div className="saas-table-wrap">
          <table className="saas-table">
            <thead><tr><th scope="col">Recorded at</th><th scope="col">Source</th><th scope="col">Storage</th><th scope="col">Files</th><th scope="col">Interval / covered</th><th scope="col">Accrued credits</th></tr></thead>
            <tbody>
              {intervalLogs.map(row => (
                <tr key={row.id}>
                  <td>{new Date(row.sampledAt).toLocaleString('en-IN')}</td>
                  <td>{row.source === 'monitoring' ? 'Monitoring' : row.source === 'monthly_meter' ? 'Monthly meter' : 'Legacy meter'}</td>
                  <td>{formatStorageBytes(storageBytes(row), unit)}</td>
                  <td>{row.fileCount ?? '—'}</td>
                  <td>{row.intervalSeconds != null ? `${Number(row.intervalSeconds / 3600).toFixed(2)} h interval` : row.coveredSeconds != null ? `${Number(row.coveredSeconds / 3600).toFixed(2)} h covered` : '—'}</td>
                  <td>{row.accruedCredits == null ? 'Not billed' : `${row.accruedCredits} credits`}</td>
                </tr>
              ))}
              {!intervalsLoading && !intervalError && !intervalLogs.length && (
                <tr><td colSpan={6}>No usage records yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {intervalLogs.length < intervalCount && (
          <button type="button" className="saas-button" disabled={intervalsLoading} onClick={() => refreshIntervals(from, to, true)}>
            Load more intervals
          </button>
        )}
      </section>

      <details className="saas-card saas-storage-advanced">
        <summary><ShieldCheck size={18} aria-hidden="true"/> Advanced storage settings</summary>
        {!canManageStorage && <p className="saas-muted">Usage and audit logs are included with your SaaS Account. Editing upload policies requires storage management access.</p>}
        {[
          ['autoCompress', 'Compress uploads'],
          ['keepOriginals', 'Keep original files'],
          ['allowStaffUpload', 'Staff can upload'],
          ['allowStaffDelete', 'Staff can delete']
        ].map(([key, label]) => <label className="saas-toggle" key={key}><span>{label}</span><input type="checkbox" checked={Boolean(storage.settings[key])} disabled={storageBusy || !canManageStorage} onChange={(e) => setting(key, e.target.checked)} /></label>)}
        <label className="saas-field"><span>Auto-delete after days (0 = never)</span><input type="number" min="0" disabled={!canManageStorage} value={storage.settings.retentionDays} onChange={(e) => setting('retentionDays', Number(e.target.value))} /></label>
      </details>

      <section className="saas-card saas-wide">
        <div className="saas-card-head"><div><h2>Uploaded Files</h2></div><span>{storage.files.length} files</span></div>
        <div className="saas-media-list">{storage.files.map((file) => <article className="saas-media-row" key={file.id}>{canManageStorage && <input type="checkbox" checked={selected.includes(file.id)} onChange={(e) => setSelected((old) => e.target.checked ? [...old, file.id] : old.filter((id) => id !== file.id))} /> }<div className="saas-file-icon">IMG</div><div className="saas-file-main"><strong>{file.name}</strong><span>{file.category} · {formatStorageBytes(file.sizeBytes ?? Math.round(Number(file.sizeMb || 0) * BYTES_PER_MB), unit)} · {file.uploadedBy}</span></div><span className="saas-file-date">{date.format(new Date(file.uploadedAt))}</span>{canManageStorage && <button className="saas-icon-button" aria-label={`Delete ${file.name}`} onClick={() => remove([file.id])}><Trash2 size={17} /></button>}</article>)}</div>
      </section>

      <section className="saas-card saas-wide">
        <div className="saas-card-head"><div><span className="saas-kicker">{USE_MOCK_API ? 'LOCAL ACTIVITY' : 'SERVER AUDIT LOG'}</span><h2>{USE_MOCK_API ? 'Storage actions on this browser' : 'Recorded storage activity'}</h2></div><button className="saas-button" onClick={() => navigate('/account/storage/history')}>View full history <ChevronRight size={16} /></button></div>
        {USE_MOCK_API && <p className="saas-muted">Demo activity is stored in this browser.</p>}
        {USE_MOCK_API ? (
          audit.length ? <div className="saas-table-wrap"><table className="saas-table"><thead><tr><th>Date & time</th><th>Action</th><th>Details</th><th>User</th></tr></thead><tbody>{audit.map((item) => <tr key={item.id}><td>{dateTime.format(new Date(item.at))}</td><td>{item.action}</td><td>{item.details}</td><td>{item.user}</td></tr>)}</tbody></table></div> : <p className="saas-muted">No local storage activity recorded yet.</p>
        ) : eventsLoading ? (
          <p className="saas-loading">Loading server storage activity…</p>
        ) : eventError ? (
          <p className="saas-error" role="alert">{eventError}</p>
        ) : serverEvents.length ? (
          <div className="saas-table-wrap"><table className="saas-table"><thead><tr><th>Date & time</th><th>Action</th><th>File</th><th>Storage change</th><th>Performed by</th></tr></thead><tbody>{serverEvents.map((event) => (
            <tr key={event.id}>
              <td>{dateTime.format(new Date(event.occurredAt))}</td>
              <td>{event.eventType}</td>
              <td>{event.filename}</td>
              <td>{formatStorageDelta(event.deltaBytes)}</td>
              <td>{event.actor || 'System'}</td>
            </tr>
          ))}</tbody></table></div>
        ) : <p className="saas-muted">No server-recorded events for this period.</p>}
        {serverEvents.length < eventCount && <button className="saas-button" disabled={eventsLoading} onClick={() => refreshEvents(from, to, true)}>Load more storage events ({serverEvents.length} / {eventCount})</button>}
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
            ? 'Manage uploaded media and review server-recorded file activity.'
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
