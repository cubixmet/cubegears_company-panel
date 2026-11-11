import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FileText, PackagePlus, RefreshCw, Wallet } from 'lucide-react';
import { supplierFinanceService } from '../../services/supplierFinance.service';
import { USE_MOCK_API } from '../../api/apiConfig';
import '../../styles/finance-supplier-purchases.css';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
});
const money = value => {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  return Number.isFinite(amount) ? currency.format(amount) : '—';
};

/**
 * Read-only finance cross-reference to the canonical supplier bill ledger.
 * Only the supplier purchase workflow may post stock and debit Cash/Bank/UPI.
 * The API returns the latest 100 bills, so do NOT label this a total report.
 */
export default function FinanceSupplierPurchases({
  canPurchase = false, canPaySupplier = false, canReviewGST = false, refreshVersion = 0,
}) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    if (USE_MOCK_API) {
      setBills([]);
      setLoading(false);
      setError('Supplier purchase finance records require the live Django backend.');
      return () => { active = false; };
    }
    supplierFinanceService.getBills()
      .then(rows => {
        if (active) setBills(Array.isArray(rows) ? rows : []);
      })
      .catch(cause => {
        if (active) {
          setBills([]);
          setError(cause?.message || 'Unable to load supplier purchase bills.');
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshVersion, retry]);

  const recentPosted = bills
    .filter(bill => bill.postingStatus === 'Posted')
    .slice(0, 5);

  return <section className="finance-supplier-purchases" aria-label="Supplier purchase GST and credit">
    <div className="finance-supplier-purchases-head">
      <div>
        <h2>Supplier Purchases · GST &amp; Credit</h2>
        <p>Recent posted supplier bills. GST, payments and dues come from the original purchase ledger.</p>
      </div>
      <button type="button" className="finance-supplier-purchases-reload" disabled={loading}
        onClick={() => setRetry(value => value + 1)} aria-label="Refresh supplier purchase bills">
        <RefreshCw size={16} aria-hidden="true" /> Refresh
      </button>
    </div>
    <div className="finance-supplier-purchases-actions">
      {canPurchase && <Link className="finance-supplier-action primary" to="/suppliers/purchases">
        <PackagePlus size={17} aria-hidden="true" /> Receive Stock / Purchase GST
      </Link>}
      {canPaySupplier && <Link className="finance-supplier-action" to="/suppliers">
        <Wallet size={17} aria-hidden="true" /> Pay Supplier Credit
      </Link>}
      <Link className="finance-supplier-action" to="/suppliers/purchases">
        <FileText size={17} aria-hidden="true" /> All Supplier Bills
      </Link>
      {canReviewGST && <Link className="finance-supplier-action" to="/gstr?tab=gstr2b">
        <FileText size={17} aria-hidden="true" /> GSTR-2B Review
      </Link>}
    </div>
    <p className="finance-supplier-purchases-info">
      Select a supplier to receive stock and enter purchase GST. Choose Cash in Hand,
      Bank / UPI, split payment or full credit there. Posting creates one supplier bill,
      its stock movements and the selected financial entries atomically.
      Paying an existing bill changes its outstanding amount, not its original purchase GST.
      Recorded purchase GST is not automatically eligible ITC.
    </p>
    {loading && <p className="finance-supplier-purchases-state" role="status">Loading posted supplier bills…</p>}
    {error && <div className="finance-supplier-purchases-error" role="alert">
      {error}
      <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button>
    </div>}
    {!loading && !error && (recentPosted.length ? (
      <div className="finance-supplier-purchases-list">
        {recentPosted.map(bill =>
          <article className="finance-supplier-purchase" key={bill.id}>
            <div className="finance-supplier-purchase-title">
              <div>
                <strong>{bill.invoiceNumber || 'Supplier Bill'}</strong>
                <span>{bill.supplierName || 'Supplier'} · {bill.invoiceDate || 'Date unavailable'}</span>
              </div>
              <Link to={'/suppliers/' + encodeURIComponent(bill.supplierId)}
                aria-label={'Open supplier bill ' + (bill.invoiceNumber || '')}>
                View Supplier <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <dl className="finance-supplier-purchase-values">
              <div><dt>Bill Total</dt><dd>{money(bill.total)}</dd></div>
              <div><dt>Purchase GST</dt><dd>{money(bill.tax)}</dd></div>
              <div><dt>Paid / Allocated</dt><dd>{money(bill.paid)}</dd></div>
              <div><dt>Credit Applied</dt><dd>{money(bill.creditsApplied)}</dd></div>
              <div><dt>Remaining Credit</dt><dd>{money(bill.outstanding)}</dd></div>
            </dl>
          </article>
        )}
      </div>
    ) : <p className="finance-supplier-purchases-state">
      No posted supplier purchases in the recent bill list. Start from Supplier Purchases to receive stock.
    </p>)}
    <small className="finance-supplier-purchases-foot">
      Showing up to five recent posted bills, not a complete GST return or month-end statement.
      Supplier due values are current and may include later settlements and returns.
    </small>
  </section>;
}
