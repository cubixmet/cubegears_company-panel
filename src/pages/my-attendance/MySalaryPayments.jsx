import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { getMySalaryPayments } from '../../services/attendance.service';

// Only the authenticated employee's confirmed payments are returned by
// Django. No staff ID, salary configuration, or payroll write APIs are used.
const money = (amount) => {
  const number = Number(amount);
  return Number.isFinite(number)
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(number)
    : '—';
};

export function MySalaryPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await getMySalaryPayments();
      setPayments(Array.isArray(rows) ? rows : []);
    } catch (cause) {
      setError(cause?.message || 'Unable to load your salary payments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The API returns only the latest 50 payments; don't label this as
  // lifetime earnings or the complete outstanding salary balance.
  const recentTotal = useMemo(
    () => payments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [payments],
  );
  const latestPayment = payments[0] || null;

  return (
    <section className="my-salary-panel my-salary-summary-card" aria-label="My Salary">
      <div className="my-salary-card-heading">
        <div className="my-salary-card-title">
          <span className="my-salary-card-icon" aria-hidden="true"><Wallet size={20} /></span>
          <div>
            <h2>My Salary</h2>
            <p>Read-only salary and daily-wage payments</p>
          </div>
        </div>
        <button type="button" className="my-salary-refetch" onClick={load} disabled={loading}
          aria-label="Refresh salary payments"><RefreshCw size={16} aria-hidden="true" /> Refresh</button>
      </div>

      {loading && <p className="my-salary-card-status" role="status">Loading your salary details…</p>}
      {!loading && error && (
        <div className="my-salary-message" role="alert">
          <p>{error}</p>
          <button type="button" className="my-salary-refetch" onClick={load}>Retry</button>
        </div>
      )}
      {!loading && !error && payments.length === 0 && (
        <p className="my-salary-card-status">No salary payments have been recorded yet.</p>
      )}
      {!loading && !error && payments.length > 0 && (
        <>
          <div className="my-salary-card-stats">
            <div>
              <span>Recent payments received</span>
              <strong>{money(recentTotal)}</strong>
              <small>{payments.length} recorded payment{payments.length !== 1 ? 's' : ''} (up to latest 50)</small>
            </div>
            <div>
              <span>Latest payment</span>
              <strong>{money(latestPayment.amount)}</strong>
              <small>{latestPayment.date} · {latestPayment.type}</small>
            </div>
          </div>
          <button type="button" className="my-salary-expand" aria-expanded={expanded}
            aria-controls="my-salary-history" onClick={() => setExpanded(value => !value)}>
            {expanded ? 'Hide payment history' : 'View payment history'}
            {expanded ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
          </button>
          {expanded && (
            <div id="my-salary-history" className="my-salary-records">
              {payments.map((payment) => (
                <article className="my-salary-record" key={`${payment.type}-${payment.id}`}>
                  <strong className="my-salary-amount">{money(payment.amount)}</strong>
                  <span>{payment.type}{payment.period ? ` · ${payment.period}` : ''}</span>
                  <small>{payment.date} · {payment.method || 'Payment recorded'}</small>
                  {payment.reference && <small>Reference: {payment.reference}</small>}
                  <small>Status: {payment.status}</small>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
