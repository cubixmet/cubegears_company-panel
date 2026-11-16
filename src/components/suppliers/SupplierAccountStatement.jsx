import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Download, Search, RefreshCw, Plus } from 'lucide-react';
import '../../styles/supplier-account-statement.css';

const currency = value => value == null || value === '' || !Number.isFinite(Number(value))
  ? 'Unavailable'
  : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value));
const amount = value => Number(value) || 0;
const dateLabel = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10)
    : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const csvCell = value => {
  const string = String(value ?? '');
  const safe = /^[=+@\-\t\r]/.test(string.trimStart()) ? "'" + string : string;
  return '"' + safe.replaceAll('"', '""') + '"';
};
const FILTERS = [
  ['all', 'All Transactions'],
  ['bill', 'Purchases'],
  ['payment', 'Payments'],
  ['advance', 'Advances'],
  ['credit', 'Credits & Returns'],
  ['refund', 'Refunds'],
];
const categoryOf = entry => {
  const type = String(entry?.type || '');
  if (type === 'Supplier Bill') return 'bill';
  if (type === 'Supplier Advance' || type === 'Advance Application') return 'advance';
  if (type === 'Supplier Refund') return 'refund';
  if (type === 'Supplier Payment') return 'payment';
  return 'credit';
};

export default function SupplierAccountStatement({
  supplier, ledger, loading = false, error = '', onRefresh, onAddAdvance,
}) {
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const events = useMemo(
    () => Array.isArray(ledger?.entries) ? ledger.entries : [],
    [ledger],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(entry => {
      const key = String(entry.date || '').slice(0, 10);
      return (type === 'all' || categoryOf(entry) === type)
        && (!from || key >= from) && (!to || key <= to)
        && (!q || [
          entry.type, entry.reference, entry.paymentReference,
          entry.accountName, entry.method, entry.paidOn,
        ].some(value => String(value || '').toLowerCase().includes(q)));
    });
  }, [events, type, query, from, to]);

  const exportCsv = () => {
    if (!filtered.length) return;
    const columns = [
      ['date', 'Date'], ['type', 'Transaction'], ['reference', 'Reference'],
      ['accountName', 'Cash / Bank Account'], ['method', 'Method'],
      ['payableIncrease', 'Credit Purchase / Due Increase'],
      ['payableDecrease', 'Due Reduction'],
      ['cashOut', 'Cash / Bank Paid'], ['cashIn', 'Cash / Bank Received'],
      ['runningPayable', 'Running Supplier Due'],
    ];
    const records = [
      ['CubixGear Supplier Account Statement — internal workshop ledger'],
      ['Supplier', supplier?.name || ''],
      ['Outstanding', ledger?.outstanding ?? 'Unavailable'],
      ['Available Advance', ledger?.availableAdvance ?? 'Unavailable'],
      ['Debit Note Credit', ledger?.availableDebitCredit ?? 'Unavailable'],
      ['Note', 'A cash advance does not reduce outstanding until it is allocated to a bill.'],
      [],
      columns.map(([, label]) => label),
      ...filtered.map(event => columns.map(([key]) => event[key] ?? '')),
    ];
    const content = '\uFEFF' + records.map(record => record.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cubixgear-supplier-statement-' + (supplier?.id || 'supplier') + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return <section className="cg-supplier-statement" id="supplier-transactions"
    aria-label="Supplier credit and transaction history">
    <header className="cg-supplier-statement-head">
      <div><h3>Credit & Transaction Ledger</h3>
        <p>Posted purchases, paid settlements, advances, returns and refunds from Finance.</p>
      </div>
      <div className="cg-supplier-statement-actions">
        <button type="button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={15} aria-hidden="true" /> Refresh
        </button>
        <button type="button" onClick={exportCsv} disabled={loading || !filtered.length}>
          <Download size={15} aria-hidden="true" /> Export CSV
        </button>
      </div>
    </header>
    {ledger && <div className="cg-supplier-statement-metrics">
      <div><span>Supplier Credit Outstanding</span><strong>{currency(ledger.outstanding)}</strong></div>
      <div className="cg-supplier-advance-metric">
        <span>Advance Available</span>
        <strong>{currency(ledger.availableAdvance)}</strong>
        {onAddAdvance && <button type="button" onClick={onAddAdvance}
          className="cg-supplier-advance-metric-action">
          <Plus size={15} aria-hidden="true"/> Add Money
        </button>}
      </div>
      <div><span>Debit Credit Available</span><strong>{currency(ledger.availableDebitCredit)}</strong></div>
      <div><span>Net Exposure After Credits</span><strong>{currency(ledger.netExposureAfterAvailableCredits)}</strong></div>
    </div>}
    <p className="cg-supplier-statement-note">
      A supplier bill increases outstanding. A payment or applied credit reduces it.
      Advance payments debit the selected Cash/Bank account once; applying an advance later never withdraws money again.
    </p>
    <div className="cg-supplier-statement-filters">
      <label className="cg-supplier-statement-search"><Search size={16} aria-hidden="true"/>
        <input aria-label="Search supplier transactions" placeholder="Reference, bank, amount type"
          value={query} onChange={event => setQuery(event.target.value)}/>
      </label>
      <label>Transaction Type
        <select aria-label="Supplier transaction type" value={type}
          onChange={event => setType(event.target.value)}>
          {FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>From
        <input aria-label="Supplier transactions from" type="date" value={from}
          max={to || undefined} onChange={event => setFrom(event.target.value)}/>
      </label>
      <label>To
        <input aria-label="Supplier transactions to" type="date" value={to}
          min={from || undefined} onChange={event => setTo(event.target.value)}/>
      </label>
    </div>
    {error && <p role="alert" className="cg-supplier-statement-error">{error}</p>}
    {loading && <p role="status" className="cg-supplier-statement-empty">Loading supplier ledger…</p>}
    {!loading && !error && !filtered.length &&
      <p className="cg-supplier-statement-empty">
        {events.length ? 'No transactions match these filters.' : 'No posted supplier transactions yet.'}
      </p>}
    {!loading && !error && filtered.length > 0 && <>
      <div className="cg-supplier-statement-count">{filtered.length} of {events.length} ledger transactions</div>
      <div className="cg-supplier-statement-scroll">
        <table>
          <thead><tr>
            <th>Date</th><th>Transaction</th><th>Reference / Account</th>
            <th className="is-amount">Due Increase</th>
            <th className="is-amount">Due Reduction</th>
            <th className="is-amount">Cash/Bank Out</th>
            <th className="is-amount">Cash/Bank In</th>
            <th className="is-amount">Running Due</th>
          </tr></thead>
          <tbody>{filtered.map((entry, index) =>
            <tr key={entry.type + ':' + entry.sourceId + ':' + index}>
              <td>{dateLabel(entry.date)}</td>
              <td><strong>{entry.type}</strong>
                {entry.method && <small>{entry.method}</small>}
              </td>
              <td><strong>{entry.reference || '—'}</strong>
                <small>{entry.accountName || entry.paymentReference || '—'}</small>
              </td>
              <td className="is-amount">{amount(entry.payableIncrease) ? currency(entry.payableIncrease) : '—'}</td>
              <td className="is-amount">{amount(entry.payableDecrease) ? currency(entry.payableDecrease) : '—'}</td>
              <td className="is-amount">{amount(entry.cashOut) ? currency(entry.cashOut) : '—'}</td>
              <td className="is-amount">{amount(entry.cashIn) ? currency(entry.cashIn) : '—'}</td>
              <td className="is-amount"><strong>{currency(entry.runningPayable)}</strong></td>
            </tr>
          )}</tbody>
        </table>
      </div>
      <div className="cg-supplier-statement-mobile">
        {filtered.map((entry, index) => <article key={'m:' + entry.type + ':' + entry.sourceId + ':' + index}>
          <header>
            <strong>{entry.type}</strong>
            <time>{dateLabel(entry.date)}</time>
          </header>
          <p>{entry.reference || '—'} {entry.accountName && <span>· {entry.accountName}</span>}</p>
          <div className="cg-supplier-statement-mobile-grid">
            {amount(entry.payableIncrease) > 0 && <div><span>Credit Purchase</span><strong><ArrowUpRight size={13}/>{currency(entry.payableIncrease)}</strong></div>}
            {amount(entry.payableDecrease) > 0 && <div><span>Due Reduced</span><strong><ArrowDownLeft size={13}/>{currency(entry.payableDecrease)}</strong></div>}
            {amount(entry.cashOut) > 0 && <div><span>Money Paid</span><strong>{currency(entry.cashOut)}</strong></div>}
            {amount(entry.cashIn) > 0 && <div><span>Money Received</span><strong>{currency(entry.cashIn)}</strong></div>}
            <div><span>Running Credit Due</span><strong>{currency(entry.runningPayable)}</strong></div>
          </div>
        </article>)}
      </div>
    </>}
  </section>;
}
