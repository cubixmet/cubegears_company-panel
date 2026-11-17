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
      <h2>Stock · GST & Finance</h2>
    </header>
    <div className="cg-stock-finance-grid">
      {canViewValuation && <article>
        <Warehouse size={18} aria-hidden="true"/>
        <span>Inventory Value</span>
        <strong>{loading || stockValue == null ? 'Unavailable' : INR.format(stockValue)}</strong>
      </article>}
      {showSupplierFinance && <>
        <article>
          <CreditCard size={18} aria-hidden="true"/>
          <span>Supplier Credit Outstanding</span>
          <strong>{available ? INR.format(credits.outstanding) : 'Unavailable'}</strong>
          <small>{available ? credits.suppliersWithDue + ' suppliers with unpaid bills' : 'Awaiting Finance ledger'}</small>
        </article>
        <article>
          <AlertTriangle size={18} aria-hidden="true"/>
          <span>Overdue Supplier Payments</span>
          <strong>{available ? INR.format(credits.overdue) : 'Unavailable'}</strong>
        </article>
        <article>
          <Landmark size={18} aria-hidden="true"/>
          <span>Unused Advances & Debit Credits</span>
          <strong>{available ? INR.format(credits.availableCredits) : 'Unavailable'}</strong>
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
  </section>;
}
