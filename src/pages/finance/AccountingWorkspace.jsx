import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Building2, RefreshCw } from 'lucide-react';
import { financeService } from '../../services/finance.service';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import '../../styles/finance-accounting.css';

const TABS = [
  ['chart', 'Accounts'], ['journals', 'Journals'], ['trial-balance', 'Trial Balance'],
  ['profit-loss', 'Profit & Loss'], ['balance-sheet', 'Balance Sheet'],
  ['banks', 'Bank Reconciliation'],
];
const money = (v) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(v) || 0);
const key = () => globalThis.crypto?.randomUUID?.() ||
  'gl-' + Date.now() + '-' + Math.random().toString(36).slice(2);
const errorText = e => {
  const data = e?.response?.data || e?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (typeof data?.message === 'string') return data.message;
  if (data && typeof data === 'object') {
    const first = Object.values(data).find(Boolean);
    return Array.isArray(first) ? String(first[0]) : String(first);
  }
  return e?.message || 'Accounting API could not complete the request.';
};
const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0');
};
const emptyRow = () => ({ code: '', debit: '', credit: '' });
const validMoney = x => /^\d+(?:\.\d{1,2})?$/.test(String(x)) && Number(x) > 0;

function CoverageWarning({ value }) {
  if (!value || value.isComplete) return null;
  return <p className="gl-coverage" role="alert"><AlertTriangle size={16}/>
    {value.warning || 'Some historical transactions are not classified.'}
    <span> Missing source transactions: {value.missingSourceCount}.
      Unclassified lines: {value.unclassifiedLineCount}.</span>
  </p>;
}
function Table({ columns, rows, empty = 'No records available.' }) {
  return <div className="gl-table-wrap"><table><thead><tr>
    {columns.map(x => <th key={x}>{x}</th>)}
    </tr></thead><tbody>
    {rows.length ? rows.map((row, i) => <tr key={row.id || row.code || i}>
      {row.cells.map((cell, j) => <td key={j}>{cell}</td>)}
    </tr>) : <tr><td colSpan={columns.length}>{empty}</td></tr>}
    </tbody></table></div>;
}
export default function AccountingWorkspace() {
  const access = useFeatureAccess();
  const [tab, setTab] = useState('chart');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issue, setIssue] = useState('');
  const [notice, setNotice] = useState('');
  const [chart, setChart] = useState([]);
  const [journals, setJournals] = useState({ journals: [], coverage: null });
  const [reports, setReports] = useState({});
  const [bankAccounts, setBankAccounts] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState([]);
  const [dateRange, setDateRange] = useState({ from: '', to: today() });
  const [memo, setMemo] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState([emptyRow(), emptyRow()]);
  const [journalKey, setJournalKey] = useState(key());
  const [bank, setBank] = useState({
    accountId: '', statementDate: today(), statementBalance: '',
    reference: '', requestKey: key(),
  });
  const canRead = access.can('payments.view');
  const canWrite = access.can('payments.edit');

  const reload = useCallback(async () => {
    if (!canRead) return;
    setLoading(true); setIssue('');
    try {
      const [accounts, savedJournals, trial, profit, balance, moneyAccounts, savedBank] =
        await Promise.all([
          financeService.getChart(), financeService.getJournals(),
          financeService.getStatement('trial-balance', { to: dateRange.to }),
          financeService.getStatement('profit-loss', dateRange),
          financeService.getStatement('balance-sheet', { to: dateRange.to }),
          financeService.listAccounts(), financeService.getReconciliations(),
        ]);
      setChart(accounts);
      setJournals(savedJournals);
      setReports({ 'trial-balance': trial, 'profit-loss': profit, 'balance-sheet': balance });
      setBankAccounts((Array.isArray(moneyAccounts) ? moneyAccounts : moneyAccounts?.results || [])
        .filter(x => ['Bank', 'UPI'].includes(x.kind) && x.isActive !== false));
      setReconciliations(savedBank);
    } catch (error) { setIssue(errorText(error)); }
    finally { setLoading(false); }
  }, [canRead, dateRange.from, dateRange.to]);

  useEffect(() => { reload(); }, [reload]);
  const nonCash = useMemo(() => chart.filter(x => !x.financialAccountId &&
    x.code !== '9999' && x.isActive), [chart]);
  const lineTotal = lines.reduce((sum, row) => ({
    debit: sum.debit + (Number(row.debit) || 0),
    credit: sum.credit + (Number(row.credit) || 0),
  }), { debit: 0, credit: 0 });

  const postJournal = async event => {
    event.preventDefault();
    if (saving || !canWrite) return;
    if (memo.trim().length < 8 || lines.some(x =>
      !x.code || (!!x.debit === !!x.credit) ||
      !validMoney(x.debit || x.credit)) ||
      Math.abs(lineTotal.debit - lineTotal.credit) > 0.001 || lineTotal.debit <= 0) {
      setIssue('Enter a descriptive memo and balanced debit/credit journal lines.');
      return;
    }
    setSaving(true); setIssue(''); setNotice('');
    try {
      await financeService.postJournal({
        memo: memo.trim(), reference: reference.trim(), requestKey: journalKey,
        lines: lines.map(x => ({ code: x.code, debit: x.debit || '0', credit: x.credit || '0' })),
      });
      setMemo(''); setReference(''); setLines([emptyRow(), emptyRow()]);
      setJournalKey(key());
      await reload();
      setNotice('Balanced manual journal posted; cash and bank ledger remain unchanged.');
    } catch (err) { setIssue(errorText(err)); } finally { setSaving(false); }
  };

  const loadCandidates = async () => {
    if (!bank.accountId) { setCandidates([]); return; }
    setLoading(true); setIssue(''); setSelected([]);
    try {
      const data = await financeService.getReconciliationCandidates({
        accountId: bank.accountId, statementDate: bank.statementDate,
      });
      setCandidates(data);
    } catch (err) { setIssue(errorText(err)); } finally { setLoading(false); }
  };
  const reconcile = async event => {
    event.preventDefault();
    if (!canWrite || saving) return;
    if (!bank.accountId || !/^\d+(?:\.\d{1,2})?$/.test(bank.statementBalance) ||
      !selected.length) {
      setIssue('Select a bank, its statement balance and cleared ledger entries.');
      return;
    }
    setSaving(true); setIssue(''); setNotice('');
    try {
      const result = await financeService.reconcileBank({
        ...bank, entryIds: selected,
      });
      setBank(prev => ({ ...prev, statementBalance: '', reference: '', requestKey: key() }));
      setSelected([]); setCandidates([]);
      await reload();
      setNotice('Bank statement matched. Uncleared book difference: ' + money(result.unclearedDifference));
    } catch (err) { setIssue(errorText(err)); } finally { setSaving(false); }
  };
  if (!canRead) return <p role="alert">Accounting reports require finance view permission.</p>;
  const statement = reports[tab] || {};
  return <main className="gl-workspace" aria-label="Workshop double-entry accounting">
    <header className="gl-heading">
      <div><h1><BookOpen size={23}/> Accounting &amp; Reconciliation</h1>
        <p>Audited debit/credit records from existing workshop finance. Historic coverage is reported separately.</p>
      </div>
      <button type="button" onClick={reload} disabled={loading || saving}>
        <RefreshCw size={16}/> Refresh
      </button>
    </header>
    {issue && <p className="gl-error" role="alert">{issue}</p>}
    {notice && <p className="gl-success" role="status">{notice}</p>}
    {loading && <p role="status">Loading accounting records…</p>}
    <CoverageWarning value={journals.coverage || statement.coverage}/>
    <nav className="gl-tabs" aria-label="Accounting sections">
      {TABS.map(([name, title]) =>
        <button key={name} type="button" className={tab === name ? 'active' : ''}
          aria-current={tab === name ? 'page' : undefined}
          onClick={() => setTab(name)}>{title}</button>,
      )}
    </nav>
    {tab === 'chart' && <section className="gl-panel">
      <h2>Chart of Accounts</h2>
      <p>Read-only chart; mapped cash/bank accounts remain controlled by recorded transactions.</p>
      <Table columns={['Code', 'Account', 'Type', 'Status']}
        rows={chart.map(r => ({
          code: r.code,
          cells: [r.code, r.name, r.type, r.isActive ? 'Active' : 'Inactive'],
        }))}/>
    </section>}
    {tab === 'journals' && <section className="gl-panel">
      <h2>General Journal</h2>
      <p>Automatic journals are immutable. Manual journal entries affect non-cash accounts only.</p>
      {canWrite && <form className="gl-form" onSubmit={postJournal}>
        <label>Journal memo<input value={memo} minLength={8} required disabled={saving}
          onChange={e => setMemo(e.target.value)} placeholder="Reason for the journal"/></label>
        <label>Reference<input value={reference} disabled={saving}
          onChange={e => setReference(e.target.value)} placeholder="Supporting record / reference"/></label>
        {lines.map((row, index) => <div className="gl-journal-line" key={index}>
          <label>Account<select required value={row.code} disabled={saving}
            onChange={e => setLines(v => v.map((r, i) => i === index ? { ...r, code: e.target.value } : r))}>
            <option value="">Select account</option>
            {nonCash.map(a => <option key={a.id} value={a.code}>{a.code} · {a.name}</option>)}
          </select></label>
          <label>Debit<input inputMode="decimal" disabled={saving} value={row.debit}
            onChange={e => setLines(v => v.map((r, i) => i === index ?
              { ...r, debit: e.target.value, credit: '' } : r))}/></label>
          <label>Credit<input inputMode="decimal" disabled={saving} value={row.credit}
            onChange={e => setLines(v => v.map((r, i) => i === index ?
              { ...r, credit: e.target.value, debit: '' } : r))}/></label>
        </div>)}
        <p className="gl-totals">Debits: {money(lineTotal.debit)} · Credits: {money(lineTotal.credit)}</p>
        <div className="gl-actions">
          <button type="button" disabled={saving || lines.length >= 20}
            onClick={() => setLines(v => [...v, emptyRow()])}>Add line</button>
          <button type="submit" disabled={saving || lineTotal.debit !== lineTotal.credit}>
            {saving ? 'Posting…' : 'Post Balanced Journal'}
          </button>
        </div>
      </form>}
      <Table columns={['Date', 'Source', 'Memo', 'Debit / Credit']}
        rows={(journals.journals || []).map(r => ({
          id: r.id,
          cells: [r.postedAt.slice(0, 10), r.kind, r.memo,
            (r.lines || []).map((line, i) => <span key={i} className="gl-journal-detail">
              {line.code}: Dr {money(line.debit)} / Cr {money(line.credit)}
            </span>)],
        }))}/>
    </section>}
    {['trial-balance', 'profit-loss', 'balance-sheet'].includes(tab) && <section className="gl-panel">
      <div className="gl-heading">
        <h2>{TABS.find(([name]) => name === tab)?.[1]}</h2>
        <div className="gl-dates">
          {tab === 'profit-loss' && <label>From<input type="date" value={dateRange.from}
            onChange={e => setDateRange(x => ({ ...x, from: e.target.value }))}/></label>}
          <label>To<input type="date" value={dateRange.to}
            onChange={e => setDateRange(x => ({ ...x, to: e.target.value }))}/></label>
        </div>
      </div>
      {tab === 'trial-balance' && <>
        <div className="gl-totals">Total Debit {money(statement.totalDebit)} · Total Credit {money(statement.totalCredit)}</div>
        <Table columns={['Code', 'Account', 'Debit balance', 'Credit balance']}
          rows={(statement.accounts || []).map(row => ({
            code: row.code, cells: [row.code, row.name,
              money(row.debitBalance), money(row.creditBalance)],
          }))}/>
      </>}
      {tab === 'profit-loss' && <>
        <div className="gl-metrics"><div>Income<strong>{money(statement.income)}</strong></div>
          <div>Expenses<strong>{money(statement.expenses)}</strong></div>
          <div>Net profit<strong>{money(statement.netProfit)}</strong></div></div>
        <Table columns={['Account', 'Type', 'Amount']} rows={[
          ...(statement.incomeAccounts || []).map(r => ({
            code: r.code, cells: [r.name, 'Income', money(r.amount)],
          })),
          ...(statement.expenseAccounts || []).map(r => ({
            code: r.code, cells: [r.name, 'Expense', money(r.amount)],
          })),
        ]}/>
      </>}
      {tab === 'balance-sheet' && <>
        <div className="gl-metrics"><div>Assets<strong>{money(statement.assets)}</strong></div>
          <div>Liabilities<strong>{money(statement.liabilities)}</strong></div>
          <div>Equity + earnings<strong>{money(Number(statement.equity || 0) + Number(statement.currentEarnings || 0))}</strong></div></div>
        <p>Balance difference: {money(statement.difference)} · {statement.isBalanced ? 'Balanced' : 'Requires audit'}</p>
        <Table columns={['Code', 'Account', 'Type', 'Balance']}
          rows={(statement.accounts || []).map(r => ({
            code: r.code, cells: [r.code, r.name, r.type, money(r.balance)],
          }))}/>
      </>}
    </section>}
    {tab === 'banks' && <section className="gl-panel">
      <h2><Building2 size={19}/> Bank Statement Reconciliation</h2>
      <p>Mark existing account movements cleared only when they match a real bank statement.
        This never changes recorded bank balances.</p>
      {canWrite && <form className="gl-form" onSubmit={reconcile}>
        <div className="gl-bank-grid">
          <label>Bank / UPI account<select value={bank.accountId} required disabled={saving}
            onChange={e => setBank(v => ({ ...v, accountId: e.target.value }))}>
            <option value="">Select bank account</option>
            {bankAccounts.map(account => <option key={account.id} value={account.id}>
              {account.name} · {account.kind}</option>)}
          </select></label>
          <label>Statement date<input required type="date" disabled={saving}
            value={bank.statementDate}
            onChange={e => setBank(v => ({ ...v, statementDate: e.target.value }))}/></label>
          <label>Statement balance<input required inputMode="decimal" disabled={saving}
            value={bank.statementBalance}
            onChange={e => setBank(v => ({ ...v, statementBalance: e.target.value }))}/></label>
          <label>Bank reference<input value={bank.reference} disabled={saving}
            onChange={e => setBank(v => ({ ...v, reference: e.target.value }))}/></label>
        </div>
        <button type="button" disabled={!bank.accountId || saving} onClick={loadCandidates}>
          Load uncleared ledger entries
        </button>
        {candidates.length > 0 && <div className="gl-table-wrap">
          <table><thead><tr><th>Cleared</th><th>Date</th><th>Reference</th><th>Amount</th></tr></thead>
          <tbody>{candidates.map(row => <tr key={row.id}>
            <td><input type="checkbox" aria-label={'Clear ledger entry ' + row.id}
              checked={selected.includes(row.id)}
              onChange={e => setSelected(v => e.target.checked
                ? [...v, row.id] : v.filter(id => id !== row.id))}/></td>
            <td>{row.date}</td><td>{row.reference || row.type}</td><td>{money(row.amount)}</td>
          </tr>)}</tbody></table>
        </div>}
        <button type="submit" disabled={saving || !selected.length}>
          {saving ? 'Reconciling…' : 'Reconcile Selected Entries'}
        </button>
      </form>}
      <h3>Saved Reconciliation History</h3>
      <Table columns={['Statement', 'Account', 'Bank statement', 'Book', 'Uncleared difference']}
        rows={reconciliations.map(r => ({
          id: r.id, cells: [
            r.statementDate, r.accountName, money(r.statementBalance),
            money(r.bookBalance), money(r.difference),
          ],
        }))}/>
    </section>}
  </main>;
}
