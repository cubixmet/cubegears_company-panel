import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Building2, Wallet, TrendingUp, RefreshCw, Plus, SlidersHorizontal, Download } from 'lucide-react';
import { appConfirm } from '../common/appDialogs';
import { financeService } from '../../services/finance.service';
import '../../styles/payment-finance-overview.css';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const fmt = value => value === null || value === undefined ? '—' : money.format(Number(value) || 0);
const localDate = () => {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
};
const emptyAccount = () => ({
  name: '', kind: 'Bank', bankName: '', accountNumber: '',
  ifsc: '', openingBalance: '0', openingDate: localDate(),
});
const emptyAdjustment = () => ({ accountId: '', amount: '', direction: 'credit', reason: '' });

export default function PaymentFinanceOverview({
  summary, ledger = [], loading = false, error = '', period, onPeriodChange,
  canManage = false, onRefresh = () => {}, onExpense = () => {},
  onRecord = () => {},
  ledgerPage = 1, ledgerCount = 0, ledgerTotalPages = 1, ledgerAccount = '', ledgerQuery = '',
  onLedgerPageChange = () => {}, onLedgerAccountChange = () => {},
  onLedgerQueryChange = () => {},
}) {
  const [mode, setMode] = useState('');
  const [newAccount, setNewAccount] = useState(emptyAccount);
  const [adjustment, setAdjustment] = useState(emptyAdjustment);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const accounts = summary?.accounts || [];

  const open = next => {
    setMode(prev => prev === next ? '' : next);
    setActionError('');
    setSuccess('');
  };
  const saveAccount = async event => {
    event.preventDefault();
    if (busy || !canManage) return;
    setActionError('');
    setBusy(true);
    try {
      await financeService.createAccount(newAccount);
      setNewAccount(emptyAccount());
      setMode('');
      setSuccess('Bank/Cash account and opening balance saved. All further movements use the audited ledger.');
      onRefresh();
    } catch (cause) {
      setActionError(cause?.response?.data?.detail || cause?.message || 'Unable to create account.');
    } finally {
      setBusy(false);
    }
  };
  const saveAdjustment = async event => {
    event.preventDefault();
    if (busy || !canManage) return;
    setActionError('');
    if (!adjustment.reason.trim()) {
      setActionError('A reason is required for any balance adjustment.');
      return;
    }
    if (!await appConfirm(
      'Post this account correction? It will remain in the audit ledger.',
      { title: 'Confirm Balance Correction', confirmLabel: 'Post Adjustment' },
    )) return;
    setBusy(true);
    try {
      await financeService.adjustBalance(adjustment.accountId, {
        amount: adjustment.amount, direction: adjustment.direction,
        reason: adjustment.reason.trim(),
      });
      setAdjustment(emptyAdjustment());
      setMode('');
      setSuccess('Balance correction posted to the audit ledger. Opening balance was not overwritten.');
      onRefresh();
    } catch (cause) {
      setActionError(cause?.response?.data?.detail || cause?.message || 'Unable to adjust the balance.');
    } finally {
      setBusy(false);
    }
  };

  const downloadLedger = async format => {
    if (exporting) return;
    setActionError('');
    setExporting(true);
    const date = localDate();
    const filters = {
      ...(ledgerAccount ? { account: ledgerAccount } : {}),
      ...(ledgerQuery.trim() ? { q: ledgerQuery.trim() } : {}),
      ...(period === 'today' ? { from: date, to: date } :
        period === 'month' ? { from: date.slice(0, 8) + '01' } : {}),
    };
    try {
      if (format === 'csv') await financeService.exportLedgerCSV(filters);
      else await financeService.exportLedgerPDF(filters);
    } catch (cause) {
      setActionError(cause?.message || 'Unable to export transaction ledger.');
    } finally {
      setExporting(false);
    }
  };

  const cards = [
    { label: "Today's Money In", value: summary?.todayReceived, icon: ArrowDownLeft, description: 'Posted account credits, excluding transfers' },
    { label: "Today's Money Out", value: summary?.todayPaid, icon: ArrowUpRight, description: 'Posted account debits, excluding transfers' },
    { label: "Today's Expenses", value: summary?.todayExpensesRecorded, icon: ArrowUpRight, description: 'Costs recorded today, whether paid or unpaid' },
    { label: "Today's Supplier Payments", value: summary?.todaySupplierPaid, icon: Wallet, description: 'Parts suppliers paid today from real accounts' },
    { label: 'Bank Balance', value: summary?.bankBalance, icon: Building2, description: 'Internal bank account ledger' },
    { label: 'Cash / UPI / Wallet', value: summary?.cashBalance, icon: Wallet, description: 'Internal cash and digital balances' },
    { label: 'Net Sales Revenue', value: summary?.netSalesRevenue, icon: TrendingUp, description: 'Finalized invoices excluding GST' },
    { label: 'Recorded Expenses', value: summary?.recordedExpenses, icon: ArrowUpRight, description: 'Expense liabilities, paid or unpaid' },
    { label: 'Known Parts Cost', value: summary?.knownCostOfSales, icon: Wallet, description: 'Historical cost of invoiced products' },
    { label: 'Estimated Profit', value: summary?.estimatedProfit, icon: TrendingUp, description: 'Revenue − recorded expense − known parts cost' },
  ];

  return (
    <section className="cg-pay-finance" aria-label="Payments financial overview">
      <div className="cg-pay-finance-head">
        <div>
          <h2>Payments & Business Finance</h2>
          <p>Cash flow, bank balances, revenue, expenses and payment ledger on this page.</p>
        </div>
        <div className="cg-pay-finance-actions">
          <label>
            <span>Report period</span>
            <select value={period} onChange={event => onPeriodChange(event.target.value)}
              aria-label="Finance reporting period">
              <option value="today">Today</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          </label>
          <button type="button" disabled={loading} onClick={onRefresh}>
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      {error && <p className="cg-pay-finance-error" role="alert">{error}</p>}
      {loading && <p role="status">Loading actual finance totals…</p>}
      {summary && <>
        <div className="cg-pay-finance-cards">
          {cards.map(({ label, value, icon: Icon, description }) => (
            <article key={label}>
              <div className="cg-pay-finance-card-label"><span>{label}</span><Icon size={16} aria-hidden="true" /></div>
              <strong>{fmt(value)}</strong>
              <small>{description}</small>
            </article>
          ))}
        </div>
        <div className="cg-pay-finance-footnotes">
          <p>Reporting: <strong>{summary.periodLabel || 'All Time'}</strong> · As of {summary.asOfDate || 'current date'}.
            Today's Money In/Out always reflects today's posted account activity.</p>
          <p><strong>Profit is estimated, not certified:</strong> {summary.profitNote}</p>
          <p>Bank/Cash balances are internal bookkeeping amounts, not live bank statements.
            Customer receipts settle invoices; supplier credit is not a cash expense until paid.</p>
        </div>
        <div className="cg-pay-finance-subhead">
          <h3>Bank & Cash Accounts</h3>
          <div className="cg-pay-finance-buttons">
            <button type="button" onClick={onRecord}>Record Payment</button>
            <button type="button" onClick={onExpense}>Add Expense</button>
            {canManage && <button type="button" onClick={() => open('create')}><Plus size={15} /> Set Up Account</button>}
            {canManage && <button type="button" onClick={() => open('adjust')}><SlidersHorizontal size={15} /> Correct Balance</button>}
          </div>
        </div>
        <div className="cg-pay-finance-accounts">
          {accounts.map(account => (
            <article key={account.id}>
              <div><strong>{account.name}</strong><span>{account.kind}{account.bankName ? ' · ' + account.bankName : ''}{account.isActive === false ? ' · Inactive' : ''}</span></div>
              <strong>{fmt(account.currentBalance)}</strong>
              <small>Opening {fmt(account.openingBalance)} · {account.accountNumber || 'No bank number stored'}</small>
            </article>
          ))}
          {!accounts.length && <p>No bank or cash accounts set up. Create an account to start accurate money tracking.</p>}
        </div>
      </>}

      {canManage && mode === 'create' &&
        <form className="cg-pay-finance-form" onSubmit={saveAccount}>
          <h3>Create Bank / Cash Account</h3>
          <div className="cg-pay-finance-fields">
            <label>Account name *<input required maxLength={120} value={newAccount.name}
              onChange={e => setNewAccount(p => ({ ...p, name: e.target.value }))}/></label>
            <label>Account type *<select value={newAccount.kind} onChange={e => setNewAccount(p => ({ ...p, kind: e.target.value }))}>
              <option>Bank</option><option>Cash</option><option>UPI</option><option>Wallet</option><option>Other</option>
            </select></label>
            {newAccount.kind === 'Bank' && <>
              <label>Bank name<input maxLength={120} value={newAccount.bankName}
                onChange={e => setNewAccount(p => ({ ...p, bankName: e.target.value }))}/></label>
              <label>Account number (optional)<input maxLength={50} autoComplete="off" value={newAccount.accountNumber}
                onChange={e => setNewAccount(p => ({ ...p, accountNumber: e.target.value }))}/></label>
              <label>IFSC (optional)<input maxLength={20} value={newAccount.ifsc}
                onChange={e => setNewAccount(p => ({ ...p, ifsc: e.target.value }))}/></label>
            </>}
            <label>Opening balance (₹) *<input type="number" min="0" step="0.01" required value={newAccount.openingBalance}
              onChange={e => setNewAccount(p => ({ ...p, openingBalance: e.target.value }))}/></label>
            <label>Opening balance date *<input type="date" required value={newAccount.openingDate}
              onChange={e => setNewAccount(p => ({ ...p, openingDate: e.target.value }))}/></label>
          </div>
          <p>Opening balance is recorded once. Later payments and expenses automatically change the calculated balance.</p>
          <div className="cg-pay-finance-buttons"><button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create Account'}</button>
            <button type="button" onClick={() => open('')}>Cancel</button></div>
        </form>}

      {canManage && mode === 'adjust' &&
        <form className="cg-pay-finance-form" onSubmit={saveAdjustment}>
          <h3>Audited Account Balance Correction</h3>
          <div className="cg-pay-finance-fields">
            <label>Account *<select required value={adjustment.accountId}
              onChange={e => setAdjustment(p => ({ ...p, accountId: e.target.value }))}>
              <option value="">Select account</option>
              {accounts.filter(a => a.isActive).map(a => <option key={a.id} value={a.id}>{a.name} — {fmt(a.currentBalance)}</option>)}
            </select></label>
            <label>Correction direction *<select value={adjustment.direction}
              onChange={e => setAdjustment(p => ({ ...p, direction: e.target.value }))}>
              <option value="credit">Increase balance (Credit)</option>
              <option value="debit">Reduce balance (Debit)</option>
            </select></label>
            <label>Correction amount (₹) *<input type="number" min="0.01" step="0.01" required value={adjustment.amount}
              onChange={e => setAdjustment(p => ({ ...p, amount: e.target.value }))}/></label>
            <label>Mandatory audit reason *<input required maxLength={120} value={adjustment.reason}
              onChange={e => setAdjustment(p => ({ ...p, reason: e.target.value }))} placeholder="Bank reconciliation difference"/></label>
          </div>
          <p>Use this for reconciliation corrections only, not to record a purchase or receipt. Never overwrite balances directly.</p>
          <div className="cg-pay-finance-buttons"><button type="submit" disabled={busy || !adjustment.accountId}>
            {busy ? 'Posting…' : 'Post Audited Adjustment'}</button>
            <button type="button" onClick={() => open('')}>Cancel</button></div>
        </form>}

      {actionError && <p className="cg-pay-finance-error" role="alert">{actionError}</p>}
      {success && <p className="cg-pay-finance-success" role="status">{success}</p>}

      <div className="cg-pay-finance-subhead">
        <h3>Account Debit / Credit Log</h3>
        <small>Search and review real account movements. Transfers appear in history but never count as income or expenses.</small>
      </div>
      <div className="cg-pay-finance-ledger-controls" aria-label="Transaction log filters and exports">
        <label>Account
          <select aria-label="Filter payment ledger by account" value={ledgerAccount}
            onChange={event => onLedgerAccountChange(event.target.value)}>
            <option value="">All Accounts</option>
            {accounts.map(acc => <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.kind})
            </option>)}
          </select>
        </label>
        <label>Reference Search
          <input type="search" aria-label="Search payment ledger reference"
            value={ledgerQuery} onChange={event => onLedgerQueryChange(event.target.value)}
            placeholder="Voucher, invoice or reference" />
        </label>
        <div className="cg-pay-finance-buttons">
          <button type="button" disabled={exporting} onClick={() => downloadLedger('csv')}>
            <Download size={15} aria-hidden="true" /> CSV
          </button>
          <button type="button" disabled={exporting} onClick={() => downloadLedger('pdf')}>
            <Download size={15} aria-hidden="true" /> PDF
          </button>
        </div>
      </div>
      <div className="cg-pay-finance-log" role="region" aria-label="Recent account transactions" tabIndex={0}>
        <table>
          <thead><tr><th>Posted</th><th>Account</th><th>Type / Reference</th><th>Credit</th><th>Debit</th></tr></thead>
          <tbody>
            {ledger.map(entry => (
              <tr key={entry.id}>
                <td>{entry.date || String(entry.createdAt || '').slice(0,10)}</td>
                <td>{entry.account}</td>
                <td>{String(entry.type || '').replaceAll('_', ' ')}
                  {entry.reference && <small>{entry.reference}</small>}</td>
                <td className="is-credit">{Number(entry.credit) ? fmt(entry.credit) : '—'}</td>
                <td className="is-debit">{Number(entry.debit) ? fmt(entry.debit) : '—'}</td>
              </tr>
            ))}
            {!ledger.length && <tr><td colSpan={5}>No posted account transactions available.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="cg-pay-finance-ledger-pagination">
        <span>{ledgerCount} posted transaction{ledgerCount === 1 ? '' : 's'} · Page {ledgerPage} / {ledgerTotalPages}</span>
        <div className="cg-pay-finance-buttons">
          <button type="button" disabled={ledgerPage <= 1 || loading}
            onClick={() => onLedgerPageChange(Math.max(1, ledgerPage - 1))}>Previous</button>
          <button type="button" disabled={ledgerPage >= ledgerTotalPages || loading}
            onClick={() => onLedgerPageChange(ledgerPage + 1)}>Next</button>
        </div>
      </div>
    </section>
  );
}
