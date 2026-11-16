import { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { jobService } from '../../services/job.service';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import '../../styles/job-cost-margin.css';

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(Number(value) || 0);

export function JobTotalCostPanel({
  jobId, refreshVersion = 0, refreshOnTab = '', customerServiceCharges = 0,
  billedTotal = null, netSellingValue = null, salesSource = 'none',
  receivedTotal = null, outstandingTotal = null, paymentVisible = false,
  postedInvoiceCount = 0,
}) {
  const { user } = useAuth();
  const permitted = ['jobs.view', 'payroll.view', 'expenses.view', 'stock.view']
    .every((code) => hasPermission(user, code));
  const [costState, setCostState] = useState({ jobId: null, data: null });
  // Never show the previous Job Card's financial figures during navigation.
  const summary = costState.jobId === jobId ? costState.data : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasBill = billedTotal !== null && billedTotal !== undefined && Number.isFinite(Number(billedTotal));
  const showBill = refreshOnTab !== 'work' && hasBill;
  const hasNetSales = netSellingValue !== null && netSellingValue !== undefined
    && Number.isFinite(Number(netSellingValue));
  const showCollections = refreshOnTab !== 'work' && paymentVisible && postedInvoiceCount > 0 &&
    receivedTotal !== null && outstandingTotal !== null &&
    Number.isFinite(Number(receivedTotal)) && Number.isFinite(Number(outstandingTotal));
  const incompleteCosts = Boolean(summary?.unallocatedDailyWages || summary?.unapprovedMechanicWork
    || summary?.partsAtCurrentCost);
  // Show only the difference between known pre-tax selling and recorded direct
  // costs. It is never a final profit (overheads/daily wages may be missing).
  const recordedCost = summary ? Number(summary.totalCost) : NaN;
  const grossMargin = hasNetSales && Number.isFinite(recordedCost)
    ? Number(netSellingValue) - recordedCost : null;

  useEffect(() => {
    if (!jobId || !permitted) {
      setCostState({ jobId: null, data: null });
      setError('');
      setLoading(false);
      return undefined;
    }

    let active = true;
    let inFlight = false;
    let lastRequestAt = 0;

    const loadCosts = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      lastRequestAt = Date.now();
      setLoading(true);
      setError('');
      try {
        const data = await jobService.getJobCostSummary(jobId);
        if (active) setCostState({ jobId, data });
      } catch (err) {
        if (active) {
          setError(err?.response?.data?.detail || err?.message || 'Unable to update job costs.');
          // Keep the latest successful figures visible during temporary outages.
        }
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };

    // Load immediately on Job change, entering the Work tab, or after
    // Mechanic / Outside Staff / Parts mutations update refreshVersion.
    void loadCosts();

    if (refreshOnTab !== 'work') {
      return () => { active = false; };
    }

    // Sync changes made by another worker/browser while this Work page
    // is visible. No network polling when the document is in the background.
    const syncWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRequestAt < 3000) return;
      void loadCosts();
    };
    const intervalId = window.setInterval(syncWhenVisible, 30000);
    window.addEventListener('focus', syncWhenVisible);
    document.addEventListener('visibilitychange', syncWhenVisible);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncWhenVisible);
      document.removeEventListener('visibilitychange', syncWhenVisible);
    };
  }, [jobId, refreshVersion, refreshOnTab, permitted]);

  return (
    <section className="job-total-cost-panel is-global" aria-label="Job Card total cost">
      <header className="job-total-cost-heading">
        <div>
          <h3><Calculator size={18} aria-hidden="true" /> Job Cost, Selling &amp; Profit</h3>
          <p>Workshop-only cost, customer bill and indicative margin. These figures never appear on the customer invoice.</p>
        </div>
      </header>

      {!permitted ? (
        <p className="job-total-cost-notice">
          Cost details require Jobs View, Payroll View, Expenses View and Stock View permissions.
        </p>
      ) : error && !summary ? (
        <p role="alert" className="job-total-cost-notice">{error}</p>
      ) : (
        <>
          <details className="cg-job-cost-breakdown">
            <summary>Show direct cost breakdown (mechanic, outside labour and parts)</summary>
            <div className="job-total-cost-grid" aria-busy={loading}>
            {[
              { label: 'Mechanic Cost', value: summary?.mechanicCost, desc: 'Approved worker charges' },
              { label: 'Outside Staff Cost', value: summary?.outsideStaffCost, desc: 'Agreed worker charges' },
              { label: 'Parts Cost', value: summary?.partsCost, desc: 'Issued stock + outside purchases' }
            ].map(({ label, value, desc, primary }) => (
              <div key={label} className={primary ? 'job-total-cost-card is-primary' : 'job-total-cost-card'}>
                <span>{label}</span>
                <strong>{summary ? money(value) : loading ? 'Loading…' : '—'}</strong>
                <small>{desc}</small>
              </div>
            ))}
            </div>
          </details>
          <div className={'job-total-cost-grid job-total-finance-grid' + (showBill ? ' has-bill' : '')} aria-label="Internal billing and margin">
            {showBill && <div className="job-total-cost-card">
              <span>{salesSource === 'final_invoice' ? postedInvoiceCount > 1 ? 'All Posted Invoice Bills' : 'Posted Invoice Bill'
                : salesSource === 'draft_invoice' ? 'Draft Invoice Total'
                  : salesSource === 'estimate' ? 'Estimated Bill' : 'Invoice Total'}</span>
              <strong>{money(billedTotal)}</strong>
              <small>Includes GST when applicable</small>
            </div>}
            <div className="job-total-cost-card">
              <span>Customer Selling (before GST)</span>
              <strong>{hasNetSales ? money(netSellingValue) : 'Not available'}</strong>
              <small>{salesSource === 'work' ? 'Provisional · recorded billable work and parts'
                : salesSource === 'estimate' ? 'From the saved estimate' : 'Tax-exclusive value'}</small>
            </div>
            <div className="job-total-cost-card is-primary">
              <span>Workshop Direct Cost</span>
              <strong>{summary ? money(summary.totalCost) : loading ? 'Loading…' : 'Unavailable'}</strong>
              <small>Mechanic + outside labour + parts purchase cost</small>
            </div>
            <div className="job-total-cost-card is-margin">
              <span>Indicative Gross Profit (before GST)</span>
              <strong>{grossMargin !== null ? money(grossMargin) : 'Not ready'}</strong>
              <small>{grossMargin === null
                ? 'A verified pre-tax selling figure and recorded costs are required'
                : incompleteCosts ? 'Indicative only: some wages or costs are missing'
                  : salesSource === 'final_invoice' ? 'Excludes overhead and unallocated wages'
                    : 'Provisional; bill not yet finalized'}</small>
            </div>
          </div>
          {showCollections && (
            <div className="job-total-cost-grid job-customer-payment-grid"
              aria-label="Customer invoice settlement">
              <div className="job-total-cost-card">
                <span>Customer Paid</span>
                <strong>{money(receivedTotal)}</strong>
              </div>
              <div className="job-total-cost-card is-due">
                <span>Customer Balance Due</span>
                <strong>{money(outstandingTotal)}</strong>
              </div>
            </div>
          )}
          {refreshOnTab === 'work' && (
            <div className="job-total-customer-service" aria-label="Recorded customer service charges">
              <div>
                <strong>Customer Service Charges</strong>
                <small>Saved billable services carry into the Job Card invoice draft.</small>
              </div>
              <strong>{money(customerServiceCharges)}</strong>
            </div>
          )}
          {!!summary && (
            <div className="job-total-cost-footnotes">
              {Number(summary.outsidePartsCost || 0) > 0 && (
                <p>Includes outside-shop parts: <strong>{money(summary.outsidePartsCost)}</strong> (already counted in Parts Cost).</p>
              )}
              {Number(summary.outsidePending || 0) > 0 && (
                <p>Outside Staff payment pending: <strong>{money(summary.outsidePending)}</strong> (already included in total).</p>
              )}
              {(summary.unallocatedDailyWages || summary.unapprovedMechanicWork) && (
                <p>Daily-wage mechanic cost may not be allocated to this Job Card; unapproved work is excluded. Total is not a full profit calculation.</p>
              )}
              {summary.partsAtCurrentCost && (
                <p>Some older stock issues have no saved cost rate; current stock purchase prices were used as estimates.</p>
              )}
              <p>{summary.note}</p>
              {error && <p role="alert">{error}</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
