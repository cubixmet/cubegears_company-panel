import { recordLabel } from '../../utils/recordReferences.js';
import { useEffect, useState } from 'react';
import { Search, Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { financeService } from '../../services/finance.service';
import { formatPaymentDate } from '../../components/payments/payments.utils';
import '../../styles/finance-ledger.css';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
});
const fmt = (v) => money.format(parseFloat(v || 0));
const emptyFilters = { q: '', account: '', from: '', to: '' };

export function TransactionsPage() {
  const [data, setData] = useState({ results: [], count: 0, page: 1, totalPages: 1 });
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  const [exportError, setExportError] = useState('');
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLedgerError('');
    financeService.getLedger({ page, page_size: 50, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) })
      .then(result => {
        if (active) setData(result || { results: [], count: 0, page: 1, totalPages: 1 });
      })
      .catch(() => {
        if (active) setLedgerError('Unable to load transactions.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [page, filters]);

  useEffect(() => {
    financeService.listAccounts()
      .then(a => setAccounts(Array.isArray(a) ? a : []))
      .catch(() => {});
  }, []);

  const applyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    const q = draftFilters.q.trim();
    setFilters({ ...draftFilters, q });
  };

  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
  };

  const handleExport = async (format) => {
    if (exporting) return;
    setExporting(true);
    setExportError('');
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      if (format === 'pdf') await financeService.exportLedgerPDF(params);
      else await financeService.exportLedgerCSV(params);
    } catch (err) {
      setExportError(err?.message || 'Unable to export the ledger.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="finance-page">
      <header className="finance-page-header">
        <div>
          <h1>Transactions</h1>
          <p>Posted movements across cash, bank and UPI accounts.</p>
        </div>
        <div className="finance-form-actions">
          <button type="button" className="finance-secondary-btn" disabled={exporting || loading || Boolean(ledgerError)}
            onClick={() => handleExport('csv')}>
            <Download size={16} /> Export CSV
          </button>
          <button type="button" className="finance-secondary-btn" disabled={exporting || loading || Boolean(ledgerError)}
            onClick={() => handleExport('pdf')}>
            <Download size={16} /> Export PDF
          </button>
        </div>
      </header>

      {/* Filters */}
      <form className="finance-ledger-filters" onSubmit={applyFilters}>
        <div className="finance-filter-row">
          <label className="finance-ledger-search">Reference
            <span className="finance-search-wrap"><Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Invoice, receipt or reference"
              aria-label="Search transactions"
              value={draftFilters.q}
              onChange={e => setDraftFilters({ ...draftFilters, q: e.target.value })}
            />
            </span>
          </label>
          <label>Account<select aria-label="Filter by account" value={draftFilters.account} onChange={e => setDraftFilters({ ...draftFilters, account: e.target.value })}>
            <option value="">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></label>
          <label>From<input
            type="date"
            aria-label="Start date"
            value={draftFilters.from}
            onChange={e => setDraftFilters({ ...draftFilters, from: e.target.value })}
          /></label>
          <label>To<input
            type="date"
            aria-label="End date"
            value={draftFilters.to}
            onChange={e => setDraftFilters({ ...draftFilters, to: e.target.value })}
          /></label>
          <button type="submit" className="finance-primary-btn">
            <Filter size={15} /> Filter
          </button>
          <button type="button" className="finance-secondary-btn" onClick={clearFilters}>Clear</button>
        </div>
      </form>

      {exportError && <div className="finance-error" role="alert">{exportError}</div>}
      {ledgerError && <div className="finance-error" role="alert">{ledgerError}</div>}

      {!ledgerError && <div className="finance-ledger-wrap">
        <table className="finance-ledger-table finance-responsive-table" aria-label="Posted transactions" role="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Account</th>
              <th>Type</th>
              <th>Reference</th>
              <th className="is-num">Money In (Credit)</th>
              <th className="is-num">Money Out (Debit)</th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="finance-loading-cell">Loading transactions…</td></tr>
            ) : !data.results || data.results.length === 0 ? (
              <tr><td colSpan={7} className="finance-empty-cell">No transactions match these filters. Try changing the account, dates, or search.</td></tr>
            ) : (
              data.results.map(row => (
                <tr key={row.id}>
                  <td data-label="Date"><span>{formatPaymentDate(row.date)}</span></td>
                  <td data-label="Account">
                    <span className={`finance-account-pill finance-kind-${(row.accountKind || '').toLowerCase()}`}>
                      {row.account}
                    </span>
                  </td>
                  <td data-label="Type"><span className="finance-entry-type">{String(row.type || 'Transaction').replaceAll('_', ' ')}</span></td>
                  <td data-label="Reference" className="finance-ref-cell"><span>{recordLabel(row.reference || row.id)}</span></td>
                  <td data-label="Money In" className="is-num is-credit"><span>{parseFloat(row.credit) > 0 ? fmt(row.credit) : '—'}</span></td>
                  <td data-label="Money Out" className="is-num is-debit"><span>{parseFloat(row.debit) > 0 ? fmt(row.debit) : '—'}</span></td>
                  <td data-label="Created By"><span>{row.createdBy || '—'}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>}

      {/* Pagination */}
      {!loading && !ledgerError && (
        <div className="finance-pagination">
          <span>{data.count} posted {data.count === 1 ? 'entry' : 'entries'}</span>
          {data.totalPages > 1 && <div className="finance-page-controls">
            <button className="finance-page-btn" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span>Page {data.page} of {data.totalPages}</span>
            <button className="finance-page-btn" aria-label="Next page" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>}
        </div>
      )}
    </div>
  );
}

export default TransactionsPage;

