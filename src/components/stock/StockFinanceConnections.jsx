import { Link } from 'react-router-dom';
import { Landmark, ReceiptText, ClipboardCheck, CreditCard, AlertTriangle, Warehouse } from 'lucide-react';
import { stockGstReview, stockSupplierFinanceTotals } from '../../utils/stockFinanceOverview';
import '../../styles/stock-finance-connections.css';

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
});

export default function StockFinanceConnections({
  items = [], showGST = false, showSupplierFinance = false,
  supplierBalances = null, financeLoading = false, financeError = '',
  stockValue = null, canViewValuation = false, loading = false,
}) {
  const gst = stockGstReview(items);
  const credits = supplierBalances === null ? null : stockSupplierFinanceTotals(supplierBalances);
  const available = !loading && !financeLoading && credits !== null && !financeError;
  if (!showGST && !showSupplierFinance && !canViewValuation) return null;

  return <section className="cg-stock-finance" aria-label="Inventory GST and Finance connections">
    <header className="cg-stock-finance-head">
      <div>
        <h2>Stock · GST & Finance</h2>
        <p>Review product tax data and open the linked supplier purchase and accounting records.</p>
      </div>
      <span>Read-only overview · No automatic posting</span>
    </header>
    <div className="cg-stock-finance-grid">
      {canViewValuation && <article>
        <Warehouse size={18} aria-hidden="true"/>
        <span>Inventory Value</span>
        <strong>{loading || stockValue == null ? 'Unavailable' : INR.format(stockValue)}</strong>
        <small>Cost-basis stock valuation, not supplier payments or profit</small>
      </article>}
      {showSupplierFinance && <>
        <article>
          <CreditCard size={18} aria-hidden="true"/>
          <span>Supplier Credit Outstanding</span>
          <strong>{available ? INR.format(credits.outstanding) : 'Unavailable'}</strong>
          <small>{available ? credits.suppliersWithDue + ' suppliers with unpaid posted bills' : 'Awaiting Finance ledger'}</small>
        </article>
        <article>
          <AlertTriangle size={18} aria-hidden="true"/>
          <span>Overdue Supplier Payments</span>
          <strong>{available ? INR.format(credits.overdue) : 'Unavailable'}</strong>
          <small>Overdue portion of outstanding purchase bills</small>
        </article>
        <article>
          <Landmark size={18} aria-hidden="true"/>
          <span>Unused Advances & Debit Credits</span>
          <strong>{available ? INR.format(credits.availableCredits) : 'Unavailable'}</strong>
          <small>Available credit is not a cash refund or settled bill yet</small>
        </article>
      </>}
      {showGST && <article>
        <ClipboardCheck size={18} aria-hidden="true"/>
        <span>Catalog GST Review</span>
        <strong>{loading ? '—' : gst.needsReview + ' parts'}</strong>
        <small>{loading ? 'Loading stock...' : gst.missingHsn + ' taxable parts missing HSN/SAC · ' +
          gst.missingZeroClassification + ' zero-rate parts missing classification'}</small>
      </article>}
    </div>
    {showSupplierFinance && financeError &&
      <p className="cg-stock-finance-error" role="alert">
        Supplier balances could not be loaded: {financeError}
      </p>}
    <div className="cg-stock-finance-links">
      {showSupplierFinance && <Link to="/suppliers">
        <CreditCard size={16} aria-hidden="true"/> Supplier Credit & Transactions
      </Link>}
      {showSupplierFinance && <Link to="/finance/accounts">
        <Landmark size={16} aria-hidden="true"/> Cash / Bank Accounts
      </Link>}
      {showSupplierFinance && <Link to="/finance/transactions">
        <ReceiptText size={16} aria-hidden="true"/> Finance Transactions
      </Link>}
      {showGST && <Link to="/gstr?tab=gstr2b">
        <ClipboardCheck size={16} aria-hidden="true"/> GSTR-2B & Purchase ITC
      </Link>}
    </div>
    {showGST && <p className="cg-stock-finance-note">
      A stock item's GST rate and HSN/SAC are reference fields only. Eligible input tax credit
      depends on posted supplier invoice GST heads and verified GSTR-2B records.
      Stock receipts, returns, job usage and supplier payments must use their existing
      linked workflows — they are not created by opening this overview.
    </p>}
  </section>;
}
