import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, CheckCircle2, Download, FileSpreadsheet, FileText,
  RefreshCw, Search, ShieldCheck, UploadCloud, CalendarDays, AlertTriangle, ShoppingBag
} from 'lucide-react';
import apiClient from '../../api/apiClient';
import GSTPart15Workspace from './GSTPart15Workspace';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import './gstr.css';
import './gstr-ui-polish.css';
import './gstr-directory-refined.css';
import './gstr-purchase-finance-refined.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const TABS = [
  ['overview', 'Overview'], ['gstr1', 'GSTR-1'],
  ['gstr3b', 'GSTR-3B'], ['gstr2b', 'GSTR-2B Reconciliation'],
  ['hsn', 'HSN / SAC'], ['itc', 'ITC Review'],
  ['credits', 'GST Credit Notes'], ['ledger', 'Tax Ledger'],
  ['exports', 'Exports & Filing']
];
const todayPeriod = () => {
  const now = new Date();
  return String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2, '0');
};
const currency = (value) => value == null
  ? 'Requires review'
  : '₹' + Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const str = (value) => String(value ?? '');
const fmt = (value) => str(value).trim() || '—';
const fiscalStart = (period) => {
  const [year, month] = period.split('-').map(Number);
  return month >= 4 ? year : year - 1;
};
const isPeriod = (value) => /^20\d\d-(0[1-9]|1[0-2])$/.test(value);
const csvDownload = async (report, period) => {
  const blob = await apiClient.get('/gstr/exports', {
    params: { report, period }, responseType: 'blob'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cubixgear-' + report + '-' + period + '-PREPARATION.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

function DataTable({ rows, columns, search = '', pageSize = 20 }) {
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => (rows || []).filter((row) =>
    !search.trim() || Object.values(row).some((value) => str(value).toLowerCase().includes(search.toLowerCase().trim()))
  ), [rows, search]);
  const max = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, max);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  if (!filtered.length) return <div className="gstr-empty" role="status">No records match the selected month or search. Check the period or try another search.</div>;
  return <>
    <div className="gstr-table-scroll" role="region" aria-label="GST records table" tabIndex={0}>
      <table className="gstr-table" aria-label="GST records for selected return period">
        <thead><tr>{columns.map((column) => <th scope="col" key={column.key} className={column.money ? 'is-money' : ''}>{column.label}</th>)}</tr></thead>
        <tbody>{visible.map((row, i) =>
          <tr key={row.id || row.bookId || row.number + ':' + i}>
            {columns.map((column) =>
              <td key={column.key} className={column.money ? 'is-money' : ''}>
                {column.render ? column.render(row) : column.money ? currency(row[column.key]) : fmt(row[column.key])}
              </td>
            )}
          </tr>
        )}</tbody>
      </table>
    </div>
    <div className="gstr-mobile-rows">{visible.map((row, i) =>
      <article className="gstr-mobile-row" key={'mobile-' + (row.id || row.bookId || row.number + i)}>
        {columns.map((column) =>
          <div className="gstr-mobile-field" key={column.key}>
            <span>{column.label}</span>
            <strong>{column.render ? column.render(row) : column.money ? currency(row[column.key]) : fmt(row[column.key])}</strong>
          </div>
        )}
      </article>
    )}</div>
    {max > 1 && <div className="gstr-pagination">
      <span>{filtered.length} records · Page {current} of {max}</span>
      <div><button type="button" aria-label="Previous records page" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button>
        <button type="button" aria-label="Next records page" disabled={current === max} onClick={() => setPage(current + 1)}>Next</button></div>
    </div>}
  </>;
}

const invoiceColumns = [
  { key: 'number', label: 'Invoice', render: (r) => <Link to={'/invoices/' + r.id}>{fmt(r.number)}</Link> },
  { key: 'date', label: 'Date' }, { key: 'classification', label: 'Class' },
  { key: 'customer', label: 'Customer' }, { key: 'customerGSTIN', label: 'GSTIN' },
  { key: 'placeOfSupply', label: 'Place of Supply' },
  { key: 'taxable', label: 'Taxable Value', money: true },
  { key: 'cgst', label: 'CGST', money: true }, { key: 'sgst', label: 'SGST', money: true },
  { key: 'igst', label: 'IGST', money: true }, { key: 'total', label: 'Invoice Total', money: true },
];
const purchaseColumns = [
  { key: 'number', label: 'Supplier Invoice' }, { key: 'date', label: 'Date' },
  { key: 'supplier', label: 'Supplier' }, { key: 'supplierGSTIN', label: 'Supplier GSTIN' },
  { key: 'taxable', label: 'Taxable', money: true }, { key: 'tax', label: 'Purchase GST', money: true },
  { key: 'itcEligibility', label: 'ITC Eligibility' }
];
// This is a live supplier-ledger cross-reference, not an official GSTR-2B
// field and not a substitute for the independent ITC eligibility review.
const purchaseSettlementColumns = [
  { key: 'invoiceNumber', label: 'Supplier Bill', render: row =>
    <Link to={'/suppliers/' + encodeURIComponent(row.supplierId) + '#supplier-transactions'}>{fmt(row.invoiceNumber)}</Link> },
  { key: 'supplier', label: 'Supplier' },
  { key: 'invoiceDate', label: 'Invoice Date' },
  { key: 'purchaseGST', label: 'Purchase GST', money: true },
  { key: 'purchaseTotal', label: 'Bill Total', money: true },
  { key: 'allocatedCash', label: 'Cash Allocated', money: true },
  { key: 'allocatedBank', label: 'Bank / UPI Allocated', money: true },
  { key: 'paidAllocated', label: 'Total Paid / Allocated', money: true },
  { key: 'creditsApplied', label: 'Returns / Credits Applied', money: true },
  { key: 'remainingCredit', label: 'Current Supplier Due', money: true },
];

const expenseGSTColumns = [
  { key: 'date', label: 'Expense Date' },
  { key: 'description', label: 'Expense', render: (r) =>
    <Link to={'/finance/expenses/' + r.id}>{fmt(r.description)}</Link> },
  { key: 'vendor', label: 'Vendor' },
  { key: 'category', label: 'Category' },
  { key: 'amount', label: 'Expense Total', money: true },
  { key: 'tax', label: 'Recorded GST', money: true },
  { key: 'itcEligibility', label: 'ITC Status' },
];
const hsnColumns = [
  { key: 'classification', label: 'Category' }, { key: 'hsnSac', label: 'HSN / SAC' },
  { key: 'description', label: 'Description' }, { key: 'unit', label: 'Unit' },
  { key: 'rate', label: 'GST %' }, { key: 'quantity', label: 'Quantity' },
  { key: 'taxablePreview', label: 'Taxable Preview', money: true },
];
const reconcileColumns = [
  { key: 'number', label: 'Invoice' }, { key: 'supplierGSTIN', label: 'Supplier GSTIN' },
  { key: 'date', label: 'Date' }, { key: 'taxable', label: 'Taxable', money: true },
  { key: 'cgst', label: 'CGST', money: true }, { key: 'sgst', label: 'SGST', money: true },
  { key: 'igst', label: 'IGST', money: true },
  { key: 'status', label: 'Reconciliation', render: (r) =>
    <span className={'gstr-result ' + (r.status === 'Matched' ? 'ok' : 'needs-review')}>{r.status}</span> },
];

function Stat({ label, value, detail }) {
  return <article className="gstr-stat"><span>{label}</span><strong>{currency(value)}</strong>{detail && <small>{detail}</small>}</article>;
}

export default function GSTRDashboard() {
  const access = useFeatureAccess();
  const [params, setParams] = useSearchParams();
  const selected = params.get('period');
  const period = isPeriod(selected) ? selected : todayPeriod();
  const tab = TABS.some(([value]) => value === params.get('tab')) ? params.get('tab') : 'overview';
  const [data, setData] = useState(null);
  const [issue, setIssue] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState(
    () => params.get('tab') === 'gstr1' ? params.get('invoice') || '' : ''
  );
  const [upload, setUpload] = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [savedImports, setSavedImports] = useState([]);
  const [activeImportId, setActiveImportId] = useState('');
  const [loadingImports, setLoadingImports] = useState(false);
  const [importError, setImportError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const canSeePurchaseFinance = access.can('stock.view') && access.can('payments.view');
  const [purchaseSettlements, setPurchaseSettlements] = useState([]);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementError, setSettlementError] = useState('');

  const updateParams = (updates) => {
    const next = new URLSearchParams(params);
    Object.entries(updates).forEach(([key, value]) => next.set(key, value));
    setParams(next, { replace: true });
  };
  const changeTab = (value) => {
    const next = new URLSearchParams(params);
    next.set('tab', value);
    // Invoice-targeted GSTR-1 links must not keep filtering unrelated tabs.
    next.delete('invoice');
    setSearch('');
    setParams(next, { replace: true });
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    setIssue('');
    setData(null);
    setReconciliation(null);
    setActiveImportId('');
    setUpload(null);
    setSearch(
      params.get('tab') === 'gstr1' ? params.get('invoice') || '' : ''
    );
    apiClient.get('/gstr/overview', { params: { period } })
      .then((value) => { if (active) setData(value); })
      .catch((error) => { if (active) setIssue(error.message || 'Unable to load GST records. Check the server and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period, reload]);

  // This is READ-ONLY. Never call supplier posting endpoints from the GST UI:
  // a supplier bill's original GST is fixed even if it is paid in another month.
  useEffect(() => {
    if (tab !== 'gstr2b' || !canSeePurchaseFinance) {
      setPurchaseSettlements([]);
      setSettlementError('');
      setSettlementLoading(false);
      return undefined;
    }
    let active = true;
    setPurchaseSettlements([]);
    setSettlementError('');
    setSettlementLoading(true);
    apiClient.get('/gstr/purchase-settlements', { params: { period } })
      .then(value => {
        if (active) setPurchaseSettlements(Array.isArray(value?.rows) ? value.rows : []);
      })
      .catch(cause => {
        if (active) setSettlementError(cause?.message || 'Unable to load supplier settlement details.');
      })
      .finally(() => { if (active) setSettlementLoading(false); });
    return () => { active = false; };
  }, [tab, period, reload, canSeePurchaseFinance]);

  // Persisted GSTR-2B matching can be inspected again after a page refresh.
  // This is evidence only; GET never approves input tax or modifies stock.
  useEffect(() => {
    if (tab !== 'gstr2b') return undefined;
    let active = true;
    setLoadingImports(true);
    setImportError('');
    apiClient.get('/gstr/imports', { params: { period } })
      .then((rows) => { if (active) setSavedImports(Array.isArray(rows) ? rows : []); })
      .catch((error) => {
        if (active) { setSavedImports([]); setImportError(error.message || 'Unable to load saved 2B imports.'); }
      })
      .finally(() => { if (active) setLoadingImports(false); });
    return () => { active = false; };
  }, [tab, period, reload]);

  const openSavedImport = async (importId) => {
    setActiveImportId(importId);
    setReconciliation(null);
    if (!importId) return;
    setBusy(true);
    setIssue('');
    try {
      const result = await apiClient.get('/gstr/reconcile', {
        params: { period, importId },
      });
      setReconciliation(result);
      setNotice('Saved 2B matching evidence loaded. ITC still requires separate approval.');
    } catch (error) {
      setIssue(error.message || 'Unable to open the selected reconciliation.');
    } finally { setBusy(false); }
  };

  const financialYear = fiscalStart(period);
  const years = [financialYear - 2, financialYear - 1, financialYear, financialYear + 1, financialYear + 2];
  const month = Number(period.slice(5));
  const setMonth = (value) => {
    const target = Number(value);
    const targetYear = target >= 4 ? financialYear : financialYear + 1;
    updateParams({ period: targetYear + '-' + String(target).padStart(2, '0') });
  };
  const setFinancialYear = (value) => {
    const start = Number(value);
    updateParams({ period: (month >= 4 ? start : start + 1) + '-' + String(month).padStart(2, '0') });
  };
  const exportCsv = async (report) => {
    setBusy(true); setNotice('');
    try { await csvDownload(report, period); setNotice('Preparation CSV exported. Not a GST Portal filing file.'); }
    catch (error) { setIssue(error.message || 'Export failed.'); }
    finally { setBusy(false); }
  };
  const reconcile = async (event) => {
    event.preventDefault();
    if (!upload) return;
    if (!/\.json$/i.test(upload.name) || upload.size > 5 * 1024 * 1024) {
      setIssue('Choose a GST Portal JSON file up to 5 MB.');
      return;
    }
    setBusy(true); setIssue(''); setReconciliation(null);
    try {
      const form = new FormData();
      form.append('file', upload);
      const result = await apiClient.post('/gstr/reconcile', form, { params: { period, save: '1' } });
      setReconciliation(result);
      setActiveImportId(result.importId || '');
      const history = await apiClient.get('/gstr/imports', {
        params: { period },
      }).catch(() => null);
      if (Array.isArray(history)) setSavedImports(history);
      setNotice(result.importId
        ? 'Official GSTR-2B match evidence saved. Supplier invoices remain unchanged.'
        : 'GSTR-2B reconciled. No source records changed.');
    } catch (error) {
      setIssue(error.fieldErrors?.file || error.message || 'Unable to reconcile the selected file.');
    } finally { setBusy(false); }
  };

  const sums = data?.overview;
  const invoices = data?.gstr1?.rows || [];
  const purchases = data?.gstr2b?.purchases || [];
  const expenseTaxReview = data?.gstr2b?.expenseGSTReview || [];
  const validations = data?.issues || [];

  return <main className="gstr-page cg-gstr-refined">
    <header className="gstr-header">
      <div className="cg-gstr-heading">
        <div className="gstr-eyebrow"><ShieldCheck size={15} aria-hidden="true"/> GST Returns Management</div>
        <h1>GST Reports &amp; Returns</h1>
        <p>Review sales GST, supplier GST, tax credits and return preparation for your workshop.</p>
      </div>
      <div className="gstr-header-actions">
        {canSeePurchaseFinance && <Link to="/suppliers/purchases" className="gstr-source-link"><ShoppingBag size={16} /> Supplier Purchases</Link>}
        <button type="button" className="cg-gstr-refresh" onClick={() => setReload((n) => n + 1)} disabled={loading} aria-label="Refresh GST data"><RefreshCw size={17} aria-hidden="true"/> Refresh</button>
        {access.can('gstr.export') && <button type="button" className="cg-gstr-export" disabled={busy || loading} onClick={() => exportCsv('gstr1')} title="Download GSTR-1 preparation data, not a filed return"><Download size={17} aria-hidden="true"/> Sales CSV</button>}
      </div>
    </header>
    <section className="gstr-filter-panel" aria-label="GST return reporting period and registration">
      <label><CalendarDays size={15} aria-hidden="true"/> Financial Year
        <select value={financialYear} onChange={(event) => setFinancialYear(event.target.value)}>
          {years.map((year) => <option key={year} value={year}>{year}–{String(year + 1).slice(-2)}</option>)}
        </select>
      </label>
      <label>Return Month
        <select value={month} onChange={(event) => setMonth(event.target.value)}>
          {MONTHS.map((label, i) => <option value={i + 1} key={label}>{label}</option>)}
        </select>
      </label>
      <label>Workshop GSTIN
        <div className="gstr-readonly">{data?.company?.gstin || 'Not registered / unavailable'}</div>
      </label>
      <span className="gstr-status"><AlertTriangle size={16} aria-hidden="true"/> Preparation only · Portal unverified · Not submitted by CubixGear</span>
    </section>

    {issue && <div className="gstr-alert is-error" role="alert">
      <AlertCircle size={18} aria-hidden="true"/>
      <span>{issue}</span>
      <button type="button" onClick={() => setReload(n => n + 1)} disabled={loading} aria-label="Retry loading GST records">Retry</button>
      <button type="button" onClick={() => setIssue('')} aria-label="Dismiss error">×</button>
    </div>}
    {notice && <div className="gstr-alert is-success" role="status"><CheckCircle2 size={18} /> {notice}</div>}
    {loading && <div className="gstr-empty" role="status"><RefreshCw size={17} aria-hidden="true" className="gstr-spinning"/> Loading workshop GST records…</div>}
    {!loading && !data && !issue && <div className="gstr-empty">No GSTR information available.</div>}

    {data && <>
      <section className="gstr-stats" aria-label="GST figures">
        <Stat label="Taxable Sales" value={sums.taxable} detail={sums.invoiceCount + ' finalized customer invoices'} />
        <Stat label="Sales GST" value={sums.outputGST} detail="Tax recorded on finalized invoices" />
        <Stat label="Reviewed ITC" value={sums.eligibleITC} detail="Internally reviewed purchase tax credits only" />
        <Stat label="Estimated GST (not final)" value={sums.estimatedNetLiability} detail="Not confirmed payable GST; portal reconciliation needed" />
      </section>
      <nav className="gstr-tabs" aria-label="GSTR sections">
        {TABS.map(([value, label]) =>
          <button key={value} type="button" className={tab === value ? 'is-active' : ''}
            aria-pressed={tab === value}
            onClick={() => changeTab(value)}>{label}</button>
        )}
      </nav>

      {tab === 'overview' && <section className="gstr-panel">
        <div className="gstr-panel-heading"><h2>Monthly GST Overview</h2><span>{period}</span></div>
        <div className="gstr-breakdown">
          {[['Taxable Sales', sums.taxable], ['CGST', sums.cgst], ['SGST / UTGST', sums.sgst],
            ['IGST', sums.igst], ['Total Output GST', sums.outputGST],
            ['Recorded Purchase GST', sums.purchaseGST], ['Verified Purchase Tax Components', sums.verifiedPurchaseTax],
            ...(access.can('expenses.view') ? [['Expense GST Pending Verification', sums.unverifiedExpenseGST]] : [])]
            .map(([label, value]) => <div key={label}><span>{label}</span><strong>{currency(value)}</strong></div>)}
        </div>
        <p className="gstr-note">Purchase GST is not the same as eligible ITC. ITC reversals and sales credit notes are tracked separately. Cash liability and GST Portal utilization need independent verification.</p>
      </section>}

      {tab === 'gstr1' && <section className="gstr-panel">
        <div className="gstr-panel-heading"><h2>GSTR-1 · Outward Supplies</h2><span>{invoices.length} invoices</span></div>
        {params.get('invoice') && <p className="gstr-note" role="status">
          Opened from invoice {params.get('invoice')}. Matching records are shown below; finalized and validated tax invoices only.
        </p>}
        <div className="gstr-search cg-gstr-search">
          <Search size={18} aria-hidden="true"/>
          <input type="search" aria-label="Search outward invoices" placeholder="Search invoice, customer or GSTIN" value={search} onChange={(e) => setSearch(e.target.value)}/>
          {search && <button type="button" className="cg-gstr-search-reset"
            aria-label="Clear outward invoice search" onClick={() => setSearch('')}>Clear</button>}
        </div>
        <DataTable key={'sales-' + period} rows={invoices} columns={invoiceColumns} search={search} />
        <p className="gstr-note">Source: finalized GST invoices only. Sales credit notes are recorded separately under GST Credit Notes; amendments and document summary require independent review.</p>
      </section>}

      {tab === 'gstr3b' && <section className="gstr-panel">
        <div className="gstr-panel-heading"><h2>GSTR-3B · Preparation Summary</h2><span>Portal unverified</span></div>
        <div className="gstr-breakdown">
          {[['Outward Taxable Supplies', sums.taxable], ['Output IGST', sums.igst],
            ['Output CGST', sums.cgst], ['Output SGST / UTGST', sums.sgst],
            ['Internally Approved ITC', sums.eligibleITC], ['ITC Reversals', sums.reversedITC],
            ['Reverse Charge Liabilities', null], ['Estimated Net GST Liability', null]]
            .map(([label, value]) => <div key={label}><span>{label}</span><strong>{currency(value)}</strong></div>)}
        </div>
        <p className="gstr-note">Indicative tax gap before credit utilization: {currency(sums.indicativeGapBeforeUtilization)}. This is NOT payable net GST. GST Portal electronic ledgers, utilization rules and reverse charge require review.</p>
      </section>}

      {tab === 'gstr2b' && <section className="gstr-panel">
        <div className="gstr-panel-heading"><h2>GSTR-2B · Purchase ITC Reconciliation</h2><span>{purchases.length} posted supplier bills</span></div>
        <p className="gstr-note">Upload the official GST Portal GSTR-2B JSON. Matching B2B invoice evidence is now saved by upload fingerprint, but purchase bills remain unchanged. ITC must still be reviewed and approved separately.</p>
        <div className="cg-gstr-purchase-quick-links" aria-label="Purchase GST and finance source records">
          <div className="cg-gstr-purchase-heading">
            <span className="cg-gstr-purchase-kicker">PURCHASE GST &amp; FINANCE</span>
            <strong>Purchase records and payment references</strong>
            <small>Purchase GST, supplier payments and eligible input tax are separate records.</small>
          </div>
          <div className="cg-gstr-purchase-link-actions">
            {canSeePurchaseFinance && <Link to="/suppliers/purchases" className="cg-gstr-purchase-nav-link">
              <ShoppingBag size={16} aria-hidden="true"/> Supplier Purchases
            </Link>}
            {access.can('payments.view') && <Link to="/finance/transactions" className="cg-gstr-purchase-nav-link">
              <FileText size={16} aria-hidden="true"/> Finance Transactions
            </Link>}
            {access.can('expenses.view') && <Link to="/finance/expenses" className="cg-gstr-purchase-nav-link">
              <FileSpreadsheet size={16} aria-hidden="true"/> Finance Expenses
            </Link>}
          </div>
        </div>
        <div className="gstr-saved-imports">
          <label>Saved GSTR-2B reconciliation
            <select aria-label="Open saved GSTR-2B reconciliation" value={activeImportId}
              disabled={loadingImports || busy}
              onChange={(event) => openSavedImport(event.target.value)}>
              <option value="">Choose an earlier upload</option>
              {savedImports.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.importedAt?.slice(0, 10) || entry.period} · {entry.matchedCount} matched
                </option>
              ))}
            </select>
          </label>
          {loadingImports && <span role="status">Loading saved uploads…</span>}
          {importError && <p className="gstr-alert is-error" role="alert">{importError}</p>}
          {!loadingImports && !importError && !savedImports.length &&
            <p className="gstr-note">No saved 2B upload for this period. Upload a GST Portal JSON to start matching.</p>}
        </div>
        {access.can('gstr.reconcile') && <form className="gstr-upload" onSubmit={reconcile}>
          <label><UploadCloud size={18} /> Official GSTR-2B JSON
            <input type="file" accept=".json,application/json" onChange={(e) => setUpload(e.target.files?.[0] || null)} /></label>
          <button type="submit" disabled={busy || !upload || !data.company?.registered}>{busy ? 'Matching…' : 'Reconcile & Save Evidence'}</button>
        </form>}
        {reconciliation && <>
          <div className="gstr-reconcile-counts">
            {Object.entries(reconciliation.counts || {}).map(([key, value]) =>
              <div key={key}><strong>{value}</strong><span>{key}</span></div>)}
          </div>
          {(reconciliation.unsupportedSections || []).length > 0 && <div className="gstr-alert is-error">
            <AlertCircle size={18} /> Unsupported statement sections: {reconciliation.unsupportedSections.join(', ')}. Reconcile separately.
          </div>}
          <div className="gstr-search"><Search size={17} /><input aria-label="Search reconciliation" placeholder="Search reconciliation" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <DataTable key={'match-' + period + '-' + (reconciliation.importId || '')} rows={reconciliation.rows} columns={reconcileColumns} search={search} />
        </>}
        {!reconciliation && <><h3 className="gstr-subheading">Posted Purchase Bills</h3>
          <div className="gstr-search"><Search size={17} /><input aria-label="Search purchase bills" placeholder="Search supplier bills" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <DataTable key={'purchases-' + period} rows={purchases} columns={purchaseColumns} search={search} /></>}
        {canSeePurchaseFinance && <div className="gstr-purchase-settlements" aria-label="Supplier purchase payment allocation summary">
          <div className="gstr-panel-heading">
            <div className="cg-gstr-purchase-heading">
              <span className="cg-gstr-purchase-kicker">SUPPLIER PAYMENTS</span>
              <h3>Purchase Bill Payments &amp; Remaining Credit</h3>
            </div>
            <Link to="/suppliers/purchases" className="gstr-source-link">Open Supplier Purchases</Link>
          </div>
          <p className="gstr-note">
            These amounts come from posted supplier bill allocations. Cash in Hand, Bank and UPI
            are recorded in the Supplier Purchase workflow, not here. Remaining supplier credit
            is the CURRENT ledger balance, including any later payments, advances and purchase
            return credits; it is not the return-month closing balance. Payment does not change
            the purchase GST or automatically approve ITC.
          </p>
          {settlementLoading && <p className="gstr-note" role="status">Loading supplier Cash / Bank allocations…</p>}
          {settlementError && <div className="gstr-alert is-error" role="alert">
            <AlertCircle size={17} /> {settlementError}
            <button type="button" onClick={() => setReload(n => n + 1)}>Retry</button>
          </div>}
          {!settlementLoading && !settlementError &&
            <DataTable key={'settlements-' + period} rows={purchaseSettlements}
              columns={purchaseSettlementColumns} />}
        </div>}
        {access.can('expenses.view') && <div className="gstr-expense-gst-review">
          <div className="cg-gstr-expense-heading">
            <div className="cg-gstr-purchase-heading">
              <span className="cg-gstr-purchase-kicker">FINANCE EXPENSES</span>
              <h3 className="gstr-subheading">Operational Expense GST · Review Required</h3>
            </div>
            <Link to="/finance/expenses" className="cg-gstr-purchase-nav-link">
              Review Finance Expenses
            </Link>
          </div>
          <p className="gstr-note">Finance Expenses may record a tax amount without a verified supplier GSTIN or CGST/SGST/IGST invoice breakdown. These amounts appear for investigation only; they are excluded from eligible ITC and GSTR-3B.</p>
          <DataTable key={'expense-gst-' + period} rows={expenseTaxReview} columns={expenseGSTColumns} />
        </div>}
      </section>}

      {['itc', 'credits', 'ledger'].includes(tab) && (
        <GSTPart15Workspace tab={tab} period={period} report={data}
          onChanged={() => setReload(n => n + 1)} />
      )}
      {tab === 'hsn' && <section className="gstr-panel">
        <div className="gstr-panel-heading"><h2>HSN / SAC Summary</h2><span>Provisional values</span></div>
        <p className="gstr-note">B2B and B2C are separated. This preview is not official Table 12: existing InvoiceItem records do not store immutable line-level CGST/SGST/IGST snapshots.</p>
        <div className="gstr-search"><Search size={17} /><input aria-label="Search HSN summary" placeholder="Search HSN, description" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <DataTable key={'hsn-' + period} rows={data.hsn?.rows || []} columns={hsnColumns} search={search} />
      </section>}

      {tab === 'exports' && <section className="gstr-panel">
        <div className="gstr-panel-heading"><h2>Exports &amp; Filing Review</h2><span>Preparation only</span></div>
        <div className="gstr-export-actions">
          <div><FileSpreadsheet size={22} /><strong>GSTR-1 Preparation CSV</strong><span>Original recorded invoice tax totals.</span>
            <button type="button" disabled={busy || !access.can('gstr.export')} onClick={() => exportCsv('gstr1')}><Download size={16} /> Download CSV</button></div>
          <div><FileText size={22} /><strong>HSN / SAC Preview CSV</strong><span>Provisional line taxable amounts, not portal compatible.</span>
            <button type="button" disabled={busy || !access.can('gstr.export')} onClick={() => exportCsv('hsn')}><Download size={16} /> Download CSV</button></div>
          <div><FileSpreadsheet size={22} /><strong>GSTR-3B Reviewed Preparation</strong>
            <span>Output GST, approved ITC and reversals; not payable tax.</span>
            <button type="button" disabled={busy || !access.can('gstr.export')} onClick={() => exportCsv('gstr3b')}><Download size={16} /> Download CSV</button></div>
          <div><FileText size={22} /><strong>Sales GST Credit Notes</strong>
            <span>Original-invoice linked credit note tax heads.</span>
            <button type="button" disabled={busy || !access.can('gstr.export')} onClick={() => exportCsv('credits')}><Download size={16} /> Download CSV</button></div>
          <div><FileSpreadsheet size={22} /><strong>ITC Approval Audit</strong>
            <span>Claims reviewed against official GSTR-2B evidence.</span>
            <button type="button" disabled={busy || !access.can('gstr.export')} onClick={() => exportCsv('itc')}><Download size={16} /> Download CSV</button></div>
          <div><FileSpreadsheet size={22} /><strong>Supplier Purchase GST Review</strong>
            <span>Recorded purchase bills with tax-component verification. Not an official GSTR-2B file.</span>
            <button type="button" disabled={busy || !access.can('gstr.export')} onClick={() => exportCsv('purchases')}><Download size={16} /> Download CSV</button></div>
          {access.can('expenses.view') && <div><FileSpreadsheet size={22} /><strong>Operating Expense GST Exceptions</strong>
            <span>Expense GST requiring invoice verification; excluded from eligible ITC.</span>
            <button type="button" disabled={busy || !access.can('gstr.export')} onClick={() => exportCsv('expense-gst')}><Download size={16} /> Download CSV</button></div>}
        </div>
        <p className="gstr-note">These CSV files are preparation exports only, never GST Portal-compatible. PDF, XLSX and official portal filing are not connected.</p>
        <GSTPart15Workspace tab="exports" period={period} report={data}
          onChanged={() => setReload(n => n + 1)} />
      </section>}

      <section className="gstr-panel" aria-label="Review alerts">
        <div className="gstr-panel-heading"><h2>Checks Before Filing</h2>
          <span>{validations.length} source issues</span></div>
        {validations.length ? <div className="gstr-issues">
          {validations.slice(0, 100).map((entry, i) =>
            <div key={entry.type + ':' + entry.record + ':' + i}>
              <AlertCircle size={16} />
              <p><strong>{entry.number || entry.type.replaceAll('_', ' ')}</strong><span>{entry.message}</span></p>
              {entry.record && <Link to={entry.type.includes('purchase') ? '/suppliers/purchases' : '/invoices/' + entry.record}>Review source</Link>}
            </div>)}
          {validations.length > 100 && <p className="gstr-note">Showing the first 100 issues. Review all source data before filing.</p>}
        </div> : <div className="gstr-complete"><CheckCircle2 size={18} /> No detected source-field issues. Independent tax compliance review is still required.</div>}
        <ul className="gstr-warnings">{(data.warnings || []).map((warning) => <li key={warning}>{warning}</li>)}</ul>
      </section>
    </>}
  </main>;
}
