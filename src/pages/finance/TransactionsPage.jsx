import { useCallback, useEffect, useState } from 'react';
import { Search, Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { financeService } from '../../services/finance.service';
import '../../styles/finance-ledger.css';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
});
const fmt = (v) => money.format(parseFloat(v || 0));

export function TransactionsPage() {
  const [data, setData] = useState({ results: [], count: 0, page: 1, totalPages: 1 });
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', account: '', from: '', to: '', type: '' });
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        page_size: 50,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      };
      const result = await financeService.getLedger(params);
      setData(result || { results: [], count: 0, page: 1, totalPages: 1 });
    } catch {
      setError('Unable to load transactions.');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    financeService.listAccounts()
      .then(a => setAccounts(Array.isArray(a) ? a : []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const clearFilters = () => {
    setFilters({ q: '', account: '', from: '', to: '', type: '' });
    setPage(1);
  };

  const handleExport = async (format) => {
    if (exporting) return;
    setExporting(true);
    setError('');
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      if (format === 'pdf') await financeService.exportLedgerPDF(params);
      else await financeService.exportLedgerCSV(params);
    } catch (err) {
      setError(err?.message || 'Unable to export the ledger.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="finance-page">
      <header className="finance-page-header">
        <div>
          <span className="finance-dash-kicker">FINANCE</span>
          <h1>All Money Movements</h1>
          <p>Find every posted account entry, check where money came from or went, and export the ledger.</p>
        </div>
        <div className="finance-form-actions">
          <button type="button" className="finance-secondary-btn" disabled={exporting}
            onClick={() => handleExport('csv')}>
            <Download size={16} /> Export CSV
          </button>
          <button type="button" className="finance-secondary-btn" disabled={exporting}
            onClick={() => handleExport('pdf')}>
            <Download size={16} /> Export PDF
          </button>
        </div>
      </header>

      {/* Filters */}
      <form className="finance-ledger-filters" onSubmit={applyFilters}>
        <div className="finance-filter-row">
          <div className="finance-search-wrap">
            <Search size={16} />
            <input
              placeholder="Search reference or transaction type…"
              aria-label="Search transactions"
              value={filters.q}
              onChange={e => setFilters({ ...filters, q: e.target.value })}
            />
          </div>
          <select aria-label="Filter by account" value={filters.account} onChange={e => setFilters({ ...filters, account: e.target.value })}>
            <option value="">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input
            type="date"
            aria-label="Start date"
            value={filters.from}
            placeholder="From"
            onChange={e => setFilters({ ...filters, from: e.target.value })}
          />
          <input
            type="date"
            aria-label="End date"
            value={filters.to}
            placeholder="To"
            onChange={e => setFilters({ ...filters, to: e.target.value })}
          />
          <button type="submit" className="finance-primary-btn">
            <Filter size={15} /> Filter
          </button>
          <button type="button" className="finance-secondary-btn" onClick={clearFilters}>Clear</button>
        </div>
      </form>

      {error && <div className="finance-error" role="alert">{error}</div>}

      <div className="finance-ledger-wrap">
        <table className="finance-ledger-table">
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
                  <td>{row.date}</td>
                  <td>
                    <span className={`finance-account-pill finance-kind-${(row.accountKind || '').toLowerCase()}`}>
                      {row.account}
                    </span>
                  </td>
                  <td><span className="finance-entry-type">{row.type.replace(/_/g, ' ')}</span></td>
                  <td className="finance-ref-cell">{row.reference || '—'}</td>
                  <td className="is-num is-credit">{parseFloat(row.credit) > 0 ? fmt(row.credit) : '—'}</td>
                  <td className="is-num is-debit">{parseFloat(row.debit) > 0 ? fmt(row.debit) : '—'}</td>
                  <td>{row.createdBy || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="finance-pagination">
          <span>{data.count} total entries</span>
          <div className="finance-page-controls">
            <button className="finance-page-btn" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span>Page {data.page} of {data.totalPages}</span>
            <button className="finance-page-btn" aria-label="Next page" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransactionsPage;

