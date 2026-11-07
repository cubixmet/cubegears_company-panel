import { appConfirm, appPrompt } from '../../components/common/appDialogs';
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarCheck2, CheckCircle2, ClipboardList, History, Pencil, Plus, Wallet, WalletCards } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ResponsiveModalSheet } from '../../components/common/ResponsiveModalSheet';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { dailyWageService } from '../../services/dailyWage.service';
import { financeService } from '../../services/finance.service';
import { DailyWageNav, rupees, todayISO } from './DailyWagePage';
import './daily-wage.css';

const key = () => crypto.randomUUID();
const empty = (kind, current = {}) => ({
  date: todayISO(), rate: current.currentRate || '',
  effectiveFrom: todayISO(), reason: '',
  status: 'Full Day', category: 'OT', amount: '',
  method: 'Cash', reference: '', paymentDate: todayISO(), account: '',
  requestKey: key(),
  ...(kind === 'pay' ? { amount: String(Math.max(0, Number(current.currentBalance || 0))) } : {}),
});

const panels = [
  ['history', 'Daily History', ClipboardList],
  ['extras', 'Extra Earnings', Plus],
  ['payments', 'Payment History', WalletCards],
  ['audit', 'Audit History', History],
];

export const DailyWageAccountPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useFeatureAccess();
  const canView = can('payroll.view');
  const actionAccess = {
    rate: can('payroll.rates.manage'),
    attendance: can('payroll.wages.finalize'),
    extra: can('payroll.extras.manage'),
    adjustment: can('payroll.adjustments.manage'),
    pay: can('payroll.payments.record'),
  };
  const canReviewExtra = can('payroll.extras.approve');
  const canReversePayment = can('payroll.payments.reverse');
  const canViewPayments = can('payroll.payments.view');
  const [account, setAccount] = useState(null);
  const [financialAccounts, setFinancialAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState('');
  const [form, setForm] = useState({});
  const [section, setSection] = useState('history');
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    if (!actionAccess.pay) return;
    financeService.listAccounts()
      .then((rows) => setFinancialAccounts(Array.isArray(rows) ? rows : []))
      .catch(() => setFinancialAccounts([]));
  }, [actionAccess.pay]);

  useEffect(() => {
    if (!canView || !id) { setLoading(false); return; }
    let mounted = true;
    setLoading(true);
    setError('');
    dailyWageService.account(id).then((result) => {
      if (mounted) setAccount(result);
    }).catch((err) => {
      if (mounted) setError(err.message || 'Unable to load wage account.');
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [canView, id, reload]);

  const open = (kind) => {
    setError('');
    setNotice('');
    setForm(empty(kind, account || {}));
    setModal(kind);
  };
  const set = (name, value) => setForm((old) => ({ ...old, [name]: value }));
  const close = () => { if (!saving) setModal(''); };

  const submit = async (event) => {
    event.preventDefault();
    if (!actionAccess[modal] || saving || !modal) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const actions = {
        rate: () => dailyWageService.addRate(id, {
          rate: form.rate, effectiveFrom: form.effectiveFrom, reason: form.reason,
        }),
        attendance: () => dailyWageService.finalizeAttendance(id, {
          date: form.date, status: form.status, reason: form.reason,
        }),
        extra: () => dailyWageService.addExtra(id, {
          date: form.date, category: form.category,
          amount: form.amount, reason: form.reason, requestKey: form.requestKey,
        }),
        adjustment: () => dailyWageService.adjustment(id, {
          date: form.date, amount: form.amount, reason: form.reason, requestKey: form.requestKey,
        }),
        pay: () => dailyWageService.pay(id, {
          amount: form.amount, method: form.method, reference: form.reference,
          paymentDate: form.paymentDate, requestKey: form.requestKey,
          account: form.account || null,
        }),
      };
      await actions[modal]();
      setModal('');
      setNotice(modal === 'extra'
        ? 'Extra earning saved as Pending. Approve it to credit the employee account.'
        : modal === 'pay' ? 'Payment recorded. The outstanding balance has been recalculated.'
          : 'Daily Wage account updated.');
      setReload((v) => v + 1);
    } catch (err) {
      setError(err.message || 'Unable to save wage record.');
    } finally {
      setSaving(false);
    }
  };

  const review = async (row, status) => {
    if (!canReviewExtra || saving) return;
    setSaving(true);
    setError('');
    try {
      await dailyWageService.reviewExtra(row.id, status);
      setNotice(`Extra earning ${status.toLowerCase()}.`);
      setReload((v) => v + 1);
    } catch (err) {
      setError(err.message || 'Cannot review this earning.');
    } finally { setSaving(false); }
  };

  const reverse = async (row) => {
    if (!canReversePayment || saving) return;
    const reason = await appPrompt('Reason for reversing this payment:');
    if (!reason?.trim()) return;
    if (!await appConfirm('Reverse this payment? Its amount will become payable again.')) return;
    setSaving(true);
    setError('');
    try {
      await dailyWageService.reverse(row.id, reason.trim());
      setNotice('Payment reversed with audit record.');
      setReload((v) => v + 1);
    } catch (err) {
      setError(err.message || 'Cannot reverse payment.');
    } finally { setSaving(false); }
  };

  const selectedRows = useMemo(() => {
    const rows = section === 'history' ? account?.history
      : section === 'extras' ? account?.extras : section === 'payments' ? account?.payments : account?.audit;
    if (filter === 'All') return rows || [];
    if (section === 'extras') return (rows || []).filter((x) => x.status === filter);
    if (section === 'payments') return (rows || []).filter((x) => (x.reversed ? 'Reversed' : 'Paid') === filter);
    return rows || [];
  }, [account, section, filter]);

  if (!canView) return <main className="dw-page"><p role="alert">Payroll View permission required.</p></main>;
  if (loading) return <main className="dw-page"><div className="dw-empty">Loading employee wages…</div></main>;

  return (
    <main className="dw-page dashboard-page">
      <header className="dw-header dashboard-heading">
        <div className="dashboard-heading-copy">
          <button type="button" className="dw-text-link dw-back" onClick={() => navigate('/payroll/daily-wages')}><ArrowLeft size={16}/> Daily Wages</button>
          <h1>{account?.employee?.name || 'Daily Wage Account'}</h1>
          <p>{account?.employee?.employeeCode || ''} · {account?.employee?.designation || 'Workshop Staff'} · Daily Wage Ledger</p>
        </div>
        <div className="dw-actions">
          {actionAccess.rate && <button type="button" className="dw-button" onClick={() => open('rate')}><Pencil size={16}/> Edit Wage Rate</button>}
          {actionAccess.attendance && <button type="button" className="dw-button" onClick={() => open('attendance')}><CalendarCheck2 size={16}/> Finalize Attendance</button>}
          {actionAccess.pay && <button type="button" className="dw-button is-primary" onClick={() => open('pay')} disabled={Number(account?.currentBalance || 0) <= 0}><Wallet size={16}/> Pay Wage</button>}
        </div>
      </header>
      <DailyWageNav/>
      {error && <div className="dw-alert" role="alert">{error} <button type="button" onClick={() => setReload((v) => v + 1)}>Retry</button></div>}
      {location.state?.wageSetupError && <div className="dw-alert" role="alert">{location.state.wageSetupError} Set a Daily Wage Rate to finish the setup.</div>}
      {notice && <div className="dw-notice" role="status"><CheckCircle2 size={16}/>{notice}</div>}
      {!account ? <div className="dw-empty">Wage account unavailable.</div> : <>
        <section className="dw-metrics">
          <article className="dw-metric"><span>Daily Wage Rate</span><strong>{account.currentRate ? rupees(account.currentRate) : 'Not Set'}</strong><small>Effective on today's date</small></article>
          <article className="dw-metric"><span>Today's Attendance</span><strong>{account.today.finalized ? account.today.attendance : 'Pending'}</strong><small>{account.today.date}</small></article>
          <article className="dw-metric"><span>Today's Wage</span><strong>{rupees(account.today.totalWage)}</strong><small>Base {rupees(account.today.baseWage)} + Extra {rupees(account.today.extraEarnings)}</small></article>
          <article className="dw-metric"><span>Lifetime Earned</span><strong>{rupees(account.totalEarned)}</strong><small>Historical earnings retained</small></article>
          <article className="dw-metric"><span>Lifetime Paid</span><strong>{rupees(account.totalPaid)}</strong><small>All non-reversed payments</small></article>
          <article className="dw-metric dw-metric-payable"><span>Unpaid Balance</span><strong>{rupees(account.currentBalance)}</strong><small>{Number(account.currentBalance) <= 0 ? 'Account settled' : 'Available for full or partial payment'}</small></article>
        </section>
        <section className="dw-card dw-account-summary">
          <div><h2>Daily Rate History</h2><p>Historical entries retain their applied daily wage rate.</p></div>
          <div className="dw-rate-chips">
            {account.rates?.length ? account.rates.map((x) => (
              <span key={x.id}>{x.effectiveFrom} · <strong>{rupees(x.rate)}/day</strong></span>
            )) : <span>No daily wage rate set. Configure one to start posting attendance wages.</span>}
          </div>
          <div className="dw-actions">
            {actionAccess.extra && <button type="button" className="dw-button is-primary" onClick={() => open('extra')}><Plus size={15}/> Add Extra Earning</button>}
            {actionAccess.adjustment && <button type="button" className="dw-button" onClick={() => open('adjustment')}><Pencil size={15}/> Adjustment</button>}
            <Link to="/payroll/daily-wages/history" className="dw-button"><History size={15}/> All Daily History</Link>
          </div>
        </section>
        <section className="dw-card">
          <div className="dw-card-head">
            <div><h2>Wage Ledger & Activity</h2><p>Posted attendance, approved earnings and permanent payment history.</p></div>
          </div>
          <nav className="dw-subtabs" aria-label="Wage account records">
            {panels.filter(([id]) => id !== 'payments' || canViewPayments).map(([id, label, Icon]) => (
              <button type="button" key={id} className={section === id ? 'is-active' : ''} onClick={() => { setSection(id); setFilter('All'); }}>
                <Icon size={15}/>{label}
              </button>
            ))}
          </nav>
          {(section === 'extras' || section === 'payments') && (
            <div className="dw-toolbar">
              <select aria-label="Filter by status" value={filter} onChange={(event) => setFilter(event.target.value)}>
                {(section === 'extras' ? ['All','Pending','Approved','Rejected'] : ['All','Paid','Reversed']).map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          )}
          {!selectedRows.length ? <div className="dw-empty">No records to display.</div> : (
            <div className="dw-table-scroll">
              <table className="dw-table">
                <thead><tr>{(section === 'history'
                  ? ['Date','Attendance','Applied Rate','Base Wage','Extras','Adjustments','Total','Payment']
                  : section === 'extras' ? ['Date','Category','Reason','Amount','Status','Action']
                    : section === 'payments' ? ['Date','Amount','Method','Reference','Status','Action']
                      : ['Date','Action','Reason','Original','Updated','Actor']
                ).map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {section === 'history' && selectedRows.map((row) => <tr key={row.id}>
                    <td data-label="Date">{row.date}</td><td data-label="Attendance">{row.attendance}</td>
                    <td data-label="Applied Rate">{rupees(row.dailyRate)}</td><td data-label="Base Wage">{rupees(row.baseWage)}</td>
                    <td data-label="Extras">{rupees(row.extras)}</td><td data-label="Adjustments">{rupees(row.adjustments)}</td>
                    <td data-label="Total"><strong>{rupees(row.total)}</strong></td><td data-label="Payment"><span className={row.paymentStatus === 'Paid' ? 'dw-ok' : 'dw-pending'}>{row.paymentStatus || 'Unpaid'}</span></td>
                  </tr>)}
                  {section === 'extras' && selectedRows.map((row) => <tr key={row.id}>
                    <td data-label="Date">{row.date}</td><td data-label="Category">{row.category}</td>
                    <td data-label="Reason">{row.reason}</td><td data-label="Amount"><strong>{rupees(row.amount)}</strong></td>
                    <td data-label="Status"><span className={row.status === 'Approved' ? 'dw-ok' : 'dw-pending'}>{row.status}</span></td>
                    <td data-label="Action">{row.status === 'Pending' && canReviewExtra ? <div className="dw-actions">
                      <button type="button" className="dw-button is-primary" disabled={saving} onClick={() => review(row, 'Approved')}>Approve</button>
                      <button type="button" className="dw-button" disabled={saving} onClick={() => review(row, 'Rejected')}>Reject</button>
                    </div> : '—'}</td>
                  </tr>)}
                  {section === 'payments' && selectedRows.map((row) => <tr key={row.id}>
                    <td data-label="Date">{row.date}</td><td data-label="Amount"><strong>{rupees(row.amount)}</strong></td>
                    <td data-label="Method">{row.method}</td><td data-label="Reference">{row.reference || '—'}</td>
                    <td data-label="Status"><span className={row.reversed ? 'dw-pending' : 'dw-ok'}>{row.reversed ? 'Reversed' : 'Paid'}</span></td>
                    <td data-label="Action">{!row.reversed && canReversePayment ? <button type="button" className="dw-button" disabled={saving} onClick={() => reverse(row)}>Reverse</button> : '—'}</td>
                  </tr>)}
                  {section === 'audit' && selectedRows.map((row) => <tr key={row.id}>
                    <td data-label="Date">{row.date || row.createdAt?.slice(0, 10)}</td>
                    <td data-label="Action">{row.action}</td><td data-label="Reason">{row.reason}</td>
                    <td data-label="Original"><code>{JSON.stringify(row.original)}</code></td>
                    <td data-label="Updated"><code>{JSON.stringify(row.updated)}</code></td>
                    <td data-label="Actor">{row.actor || 'System'}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </>}
      <ResponsiveModalSheet isOpen={Boolean(modal)} title={
        { rate: 'Set Daily Wage Rate', attendance: 'Finalize Attendance & Post Wage',
          extra: 'Add Extra Earning', adjustment: 'Approved Wage Adjustment', pay: 'Pay Outstanding Wage' }[modal]
      } onClose={close} maxWidth="520px">
        <form className="dw-modal-form" onSubmit={submit}>
          {modal === 'rate' && <>
            <label>Daily Wage Rate (₹)<input name="rate" type="number" min="0.01" step="0.01" value={form.rate || ''} onChange={(e) => set('rate', e.target.value)} required/></label>
            <label>Effective From<input type="date" value={form.effectiveFrom || ''} onChange={(e) => set('effectiveFrom', e.target.value)} required/></label>
          </>}
          {modal === 'attendance' && <>
            <label>Work Date<input type="date" max={todayISO()} value={form.date || ''} onChange={(e) => set('date', e.target.value)} required/></label>
            <label>Attendance Status<select value={form.status || 'Full Day'} onChange={(e) => set('status', e.target.value)}>
              {[
                ['Full Day', 'Full Day Worked — 100%'],
                ['Half Day', 'Half Day Worked — 50%'],
                ['Leave', 'Leave (No Paid Leave) — ₹0'],
                ['Absent', 'Absent — ₹0'],
                ['Weekly Off', 'Weekly Off (Not Worked) — ₹0'],
                ['Holiday', 'Holiday (Not Worked) — ₹0'],
              ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <p className="dw-modal-help">Only worked days earn base wages: Full Day 100%, Half Day 50%. Every Leave type (including Paid Leave), Absent, Weekly Off not worked and Holiday not worked earn ₹0. Approved OT/OD/Extras are separate. Corrections remain audited.</p>
          </>}
          {modal === 'extra' && <>
            <label>Work Date<input type="date" max={todayISO()} value={form.date || ''} onChange={(e) => set('date', e.target.value)} required/></label>
            <label>Earning Type<select value={form.category || 'OT'} onChange={(e) => set('category', e.target.value)}>
              {[['OT','Overtime'],['OD','Extra Duty'],['BONUS','Special Work Bonus'],['JOB','Additional Job Payment'],['MANUAL','Manual Extra Earning'],['CUSTOM','Custom']].map(([id,label]) => <option key={id} value={id}>{label}</option>)}
            </select></label>
            <label>Amount (₹)<input type="number" min="0.01" step="0.01" required value={form.amount || ''} onChange={(e) => set('amount', e.target.value)}/></label>
            <p className="dw-modal-help">Extra earning requires approval before it increases the payable balance.</p>
          </>}
          {modal === 'adjustment' && <>
            <label>Work Date<input type="date" value={form.date || ''} max={todayISO()} onChange={(e) => set('date', e.target.value)} required/></label>
            <label>Adjustment Amount (₹)<input type="number" required step="0.01" value={form.amount || ''} onChange={(e) => set('amount', e.target.value)} placeholder="Positive or negative"/></label>
          </>}
          {modal === 'pay' && <>
            <div className="dw-payment-due">Amount Due <strong>{rupees(account?.currentBalance)}</strong></div>
            <label>Pay Amount (₹)<input name="amount" type="number" required min="0.01" max={account?.currentBalance} step="0.01" value={form.amount || ''} onChange={(e) => set('amount', e.target.value)}/></label>
            <label>Payment Date<input type="date" max={todayISO()} required value={form.paymentDate || ''} onChange={(e) => set('paymentDate', e.target.value)}/></label>
            <label>Pay From Bank / Cash Account
              <select value={form.account || ''} required={financialAccounts.length > 0}
                onChange={(e) => set('account', e.target.value)}>
                <option value="">Select account {financialAccounts.length ? '*' : '(not configured)'}</option>
                {financialAccounts.filter((item) => item.isActive).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.kind}) — {rupees(item.currentBalance)}
                  </option>
                ))}
              </select>
            </label>
            <label>Payment Method<select value={form.method || 'Cash'} onChange={(e) => set('method', e.target.value)}>
              {['Cash','UPI','Bank Transfer','Cheque','Other'].map((m) => <option key={m}>{m}</option>)}
            </select></label>
            <label>Reference (optional)<input maxLength={150} value={form.reference || ''} onChange={(e) => set('reference', e.target.value)} placeholder="Transaction or receipt number"/></label>
            <p className="dw-modal-help">Full payment sets the current balance to ₹0. Earnings and payment history remain unchanged.</p>
          </>}
          {modal !== 'pay' && (
            <label>Reason<input value={form.reason || ''} required onChange={(e) => set('reason', e.target.value)} placeholder="Reason and authorizing detail"/></label>
          )}
          {error && <p className="dw-alert" role="alert">{error}</p>}
          <div className="dw-modal-actions">
            <button type="button" className="dw-button" onClick={close}>Cancel</button>
            <button type="submit" className="dw-button is-primary" disabled={saving}>
              <CheckCircle2 size={16}/>{saving ? 'Saving…' : modal === 'pay' ? 'Confirm Payment' : 'Save'}
            </button>
          </div>
        </form>
      </ResponsiveModalSheet>
    </main>
  );
};
