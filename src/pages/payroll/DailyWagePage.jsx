import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Banknote, CalendarCheck2, CheckCircle2, Clock3, History, RefreshCcw, Search, Users, Wallet, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { dailyWageService } from '../../services/dailyWage.service';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import './daily-wage.css';
import './daily-wage-readable.css';
import './daily-wage-compact.css';

export const rupees = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(value || 0));

export const todayISO = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const sections = [
  ['overview', 'Daily Wages', '/payroll/daily-wages', Wallet],
  ['history', 'Daily History', '/payroll/daily-wages/history', History],
  ['overtime', 'Overtime Approval', '/payroll/daily-wages/overtime-approvals', Clock3],
  ['payments', 'Payments', '/payroll/payments', Banknote],
];

export function DailyWageNav({ selected = 'overview' }) {
  const { search } = useLocation();
  const { can } = useFeatureAccess();
  const navRef = useRef(null);
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector('[aria-current="page"]');
    if (!nav || !active) return;
    nav.scrollLeft = Math.max(0, active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2);
  }, [selected]);
  // Moving between the payroll views must retain the user's selected
  // month, year, branch and staff query parameters.
  return (
    <nav ref={navRef} className="dw-nav" aria-label="Payroll navigation">
      {sections.filter(([id]) => id === 'overtime' ? can('attendance.team.view') : id === 'payments' ? can('payroll.payments.view') : can('payroll.view')).map(([id, title, href, Icon]) => (
        <Link key={id} to={`${href}${search}`} aria-current={selected === id ? 'page' : undefined} className={selected === id ? 'is-active' : ''}>
          <Icon size={16} aria-hidden="true"/>{title}
        </Link>
      ))}
    </nav>
  );
}

const Metric = ({ label, value, Icon, meta }) => (
  <article className="dw-metric dashboard-stat-card">
    <div className="dw-metric-top">
      <span>{label}</span>
      <span className="dw-metric-icon"><Icon size={18} aria-hidden="true"/></span>
    </div>
    <strong>{value}</strong>
    {meta && <small>{meta}</small>}
  </article>
);

const Empty = ({ text }) => <div className="dw-empty">{text}</div>;

export const DailyWagePage = ({ mode = 'overview' }) => {
  const { can } = useFeatureAccess();
  const navigate = useNavigate();
  const canView = can(mode === 'payments' ? 'payroll.payments.view' : 'payroll.view');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState('All');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError('');
    const promise = mode === 'overview'
      ? dailyWageService.dashboard()
      : mode === 'history'
        ? dailyWageService.history({ ...(from ? { from } : {}), ...(to ? { to } : {}) })
        : dailyWageService.payments();
    promise.then((result) => { if (mounted) setData(result); })
      .catch((err) => { if (mounted) setError(err.message || 'Could not load Daily Wages.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [canView, mode, from, to, refreshToken]);

  const items = useMemo(() => {
    const rows = Array.isArray(data) ? data : Array.isArray(data?.employees) ? data.employees : [];
    const text = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesText = !text || [
        row.name, row.employeeName, row.employeeCode, row.designation,
        row.branchName, row.date, row.method, row.reference,
      ].some((value) => String(value || '').toLowerCase().includes(text));
      return matchesText && (branch === 'All' || String(row.branchId) === branch);
    });
  }, [data, query, branch]);

  const branches = useMemo(() =>
    [...new Map((Array.isArray(data) ? data : data?.employees || []).filter((e) => e.branchId)
      .map((e) => [e.branchId, e.branchName || 'Branch'])).entries()],
    [data],
  );
  const hasActiveFilters = Boolean(query.trim()) || branch !== 'All'
    || (mode === 'history' && Boolean(from || to));
  const resetFilters = () => {
    setQuery('');
    setBranch('All');
    if (mode === 'history') {
      setFrom('');
      setTo('');
    }
  };

  if (!canView) return <div className="dw-page"><Empty text="You need Payroll View permission to see wage accounts."/></div>;

  return (
    <main className={`dw-page dashboard-page${mode === 'overview' ? ' dw-daily-wages' : ' dw-ledger-page'}`}>
      <header className="dw-header dashboard-heading">
        <div className="dashboard-heading-copy">
          <h1>{mode === 'overview' ? 'Daily Wages' : mode === 'history' ? 'Daily Wage History' : 'Wage Payments'}</h1>
        </div>
        <button className="dw-button" type="button" disabled={loading} onClick={() => setRefreshToken((v) => v + 1)}>
          <RefreshCcw size={16} aria-hidden="true"/> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>
      <DailyWageNav selected={mode}/>
      {mode === 'overview' && <details className="dw-payroll-help"><summary>About daily wages</summary>
        <p>Daily wage earnings are attendance-based. Only finalized attendance contributes to daily totals; monthly salary and automatic commission are not included.</p>
      </details>}
      {mode === 'overview' && data && (
        <div className="dw-metrics">
          <Metric label="Workers" value={data.totalWorkers || 0} Icon={Users} meta="Company / branch employees"/>
          <Metric label="Today's Earned Wages" value={rupees(data.todayExpense)} Icon={CalendarCheck2} meta="Finalized attendance only"/>
          <Metric label="Outstanding Payable" value={rupees(data.outstanding)} Icon={Wallet} meta={`${data.workersUnpaid || 0} staff awaiting payment`}/>
          <Metric label="Total Wage Payments" value={rupees(data.totalPayments)} Icon={CheckCircle2} meta="Recorded settlements"/>
        </div>
      )}
      {mode === 'overview' && data && (
        <div className="dw-attendance-summary">
          <span><b>{data.todayAttendance?.full || 0}</b> Full Day</span>
          <span><b>{data.todayAttendance?.half || 0}</b> Half Day</span>
          <span><b>{data.todayAttendance?.pending || 0}</b> Pending Finalization</span>
        </div>
      )}
      {error && <p className="dw-alert" role="alert">{error} <button type="button" onClick={() => setRefreshToken((v) => v + 1)}>Retry</button></p>}
      <section className="dw-card" aria-labelledby="dw-records-heading">
        <div className="dw-card-head">
          <div>
            <h2 id="dw-records-heading">{mode === 'overview' ? 'Employee Wage Accounts' : mode === 'history' ? 'Posted Daily Earnings' : 'Wage Payment Transactions'}</h2>

          </div>
          <span role="status" aria-live="polite">{loading || error ? '—' : items.length} {mode === 'overview' ? 'staff' : 'records'}</span>
        </div>
        <div className="dw-toolbar" aria-label="Payroll record filters">
          <label className="dw-search"><Search size={17} aria-hidden="true"/>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff or records" aria-label="Search Daily Wages"/>
          </label>
          <select aria-label="Filter by branch" value={branch} onChange={(event) => setBranch(event.target.value)}>
            <option value="All">All Branches</option>
            {branches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          {hasActiveFilters && (
            <button type="button" className="dw-button dw-clear-filters" onClick={resetFilters}>
              <X size={15} aria-hidden="true" /> Clear Filters
            </button>
          )}
          {mode === 'history' && (
            <>
              <label>From <input type="date" aria-label="History from date" max={to || undefined} value={from} onChange={(event) => setFrom(event.target.value)}/></label>
              <label>To <input type="date" aria-label="History to date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)}/></label>
            </>
          )}
        </div>
        {loading ? <Empty text="Loading wage records…"/> : error ? <Empty text="Unable to display wage records."/> : !items.length ? (
          <div className="dw-empty">
            {hasActiveFilters ? 'No records match the selected filters.' : mode === 'overview'
              ? 'No wage accounts available.' : mode === 'history'
                ? 'No daily earnings recorded.' : 'No wage payment transactions.'}
            {hasActiveFilters && (
              <button type="button" className="dw-button dw-clear-filters" onClick={resetFilters}>
                <X size={15} aria-hidden="true" /> Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="dw-table-scroll">
            {mode === 'overview' ? (
              <table className="dw-table">
                <thead><tr><th>Employee</th><th>Daily Rate</th><th>Today's Attendance</th><th>Today's Wage</th><th>Extra</th><th>Unpaid Balance</th><th>Last Paid</th><th>Action</th></tr></thead>
                <tbody>{items.map((w) => (
                  <tr key={w.id}>
                    <td data-label="Employee"><strong>{w.name}</strong><small>{w.employeeCode} · {w.designation || 'Staff'}</small></td>
                    <td data-label="Daily Rate">{w.dailyRate ? rupees(w.dailyRate) : <span className="dw-pending">Set Rate</span>}</td>
                    <td data-label="Today's Attendance"><span className={w.today.finalized ? 'dw-ok' : 'dw-pending'}>{w.today.finalized ? w.today.attendance : 'Pending'}</span></td>
                    <td data-label="Today's Wage">{rupees(w.today.totalWage)}</td>
                    <td data-label="Extra">{rupees(w.today.extraEarnings)}</td>
                    <td data-label="Unpaid Balance"><strong>{rupees(w.currentBalance)}</strong></td>
                    <td data-label="Last Paid">{w.lastPaymentDate || '—'}</td>
                    <td data-label="Action"><button className="dw-button is-primary dw-account-action" onClick={() => navigate(`/staff/${w.id}/wages`)} type="button">Wage Account <ArrowUpRight size={16} aria-hidden="true" /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            ) : mode === 'history' ? (
              <table className="dw-table">
                <thead><tr><th>Work Date</th><th>Employee</th><th>Attendance</th><th>Applied Rate</th><th>Base Wage</th><th>Extras</th><th>Adjustments</th><th>Total</th><th>Payment</th></tr></thead>
                <tbody>{items.map((e) => <tr key={e.id}>
                  <td data-label="Date">{e.date}</td><td data-label="Employee"><button type="button" className="dw-text-link" onClick={() => navigate(`/staff/${e.employeeId}/wages`)}>{e.employeeName}</button></td>
                  <td data-label="Attendance">{e.attendance}</td><td data-label="Applied Rate">{rupees(e.dailyRate)}</td>
                  <td data-label="Base Wage">{rupees(e.baseWage)}</td><td data-label="Extras">{rupees(e.extras)}</td>
                  <td data-label="Adjustments">{rupees(e.adjustments)}</td><td data-label="Total"><strong>{rupees(e.total)}</strong></td>
                  <td data-label="Payment Status"><span className={e.paymentStatus === 'Paid' ? 'dw-ok' : 'dw-pending'}>{e.paymentStatus || 'Unpaid'}</span></td>
                </tr>)}</tbody>
              </table>
            ) : (
              <table className="dw-table">
                <thead><tr><th>Date</th><th>Employee</th><th>Amount</th><th>Method</th><th>Reference</th><th>Status</th><th>Account</th></tr></thead>
                <tbody>{items.map((p) => <tr key={p.id}>
                  <td data-label="Date">{p.date}</td><td data-label="Employee">{p.employeeName}</td><td data-label="Amount"><strong>{rupees(p.amount)}</strong></td>
                  <td data-label="Method">{p.method}</td><td data-label="Reference">{p.reference || '—'}</td>
                  <td data-label="Status"><span className={p.reversed ? 'dw-pending' : 'dw-ok'}>{p.reversed ? 'Reversed' : 'Paid'}</span></td>
                  <td data-label="Wage Account"><button type="button" className="dw-text-link" onClick={() => navigate(`/staff/${p.employeeId}/wages`)}>View Account</button></td>
                </tr>)}</tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </main>
  );
};
