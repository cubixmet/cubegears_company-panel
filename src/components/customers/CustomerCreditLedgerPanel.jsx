import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Wallet } from 'lucide-react';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { customerCreditService } from '../../services/customerCredit.service';
import { financeService } from '../../services/finance.service';
import { appConfirm, appPrompt } from '../common/appDialogs';
import '../../styles/customer-credit-ledger.css';

const currency = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(value || 0));
const uniqueKey = () => globalThis.crypto?.randomUUID?.() ||
  `customer-credit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const amountValid = (value, max) =>
  /^\d+(?:\.\d{1,2})?$/.test(String(value).trim()) &&
  Number(value) > 0 && Number(value) <= Number(max);
const emptyForm = () => ({ advanceId: '', invoiceId: '', amount: '', requestKey: uniqueKey() });
const emptyRefund = () => ({
  advanceId: '', accountId: '', amount: '', method: 'Cash',
  reference: '', reason: '', requestKey: uniqueKey(),
});

export function CustomerCreditLedgerPanel({ customerId, onChanged }) {
  const navigate = useNavigate();
  const { can } = useFeatureAccess();
  const canView = can('payments.view') && can('invoices.view');
  const canApply = can('payments.create');
  const canReverse = can('payments.reverse');
  const [ledger, setLedger] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [apply, setApply] = useState(emptyForm);
  const [refund, setRefund] = useState(emptyRefund);
  const lastCustomer = useRef('');

  const load = useCallback(async () => {
    if (!canView || !customerId) return;
    setLoading(true);
    setError('');
    try {
      const [next, accountRows] = await Promise.all([
        customerCreditService.getLedger(customerId),
        canReverse ? financeService.listAccounts().catch(() => []) : Promise.resolve([]),
      ]);
      setLedger(next);
      setAccounts(Array.isArray(accountRows) ? accountRows.filter((row) => row.isActive) : []);
    } catch (cause) {
      setError(cause?.message || 'Unable to load customer credit ledger.');
    } finally {
      setLoading(false);
    }
  }, [customerId, canView, canReverse]);

  useEffect(() => {
    if (lastCustomer.current !== customerId) {
      lastCustomer.current = customerId;
      setLedger(null);
      setApply(emptyForm());
      setRefund(emptyRefund());
    }
    load();
  }, [customerId, load]);

  if (!canView) return null;
  const advances = (ledger?.advances || []).filter((item) => Number(item.available) > 0);
  const invoices = (ledger?.entries || []).filter((item) =>
    item.type === 'invoice' && Number(item.balance) > 0
  );
  const selectedAdvance = advances.find((item) => item.id === apply.advanceId);
  const selectedInvoice = invoices.find((item) => item.invoiceId === apply.invoiceId);
  const selectedRefundAdvance = advances.find((item) => item.id === refund.advanceId);

  const applyCredit = async (event) => {
    event.preventDefault();
    if (!canApply || saving) return;
    const max = Math.min(Number(selectedAdvance?.available || 0), Number(selectedInvoice?.balance || 0));
    if (!apply.advanceId || !apply.invoiceId || !amountValid(apply.amount, max)) {
      setError('Select an advance and an unpaid invoice, then enter a valid amount no greater than both balances.');
      return;
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      await customerCreditService.applyAdvance(
        apply.advanceId, apply.invoiceId, apply.amount, apply.requestKey,
      );
      setApply(emptyForm());
      setSuccess('Credit applied to the invoice without another bank transaction.');
      await load();
      onChanged?.();
    } catch (cause) {
      setError(cause?.message || 'Unable to apply the customer advance.');
    } finally {
      setSaving(false);
    }
  };

  const refundCredit = async (event) => {
    event.preventDefault();
    if (!canReverse || saving) return;
    if (!refund.advanceId || !refund.accountId ||
      !amountValid(refund.amount, selectedRefundAdvance?.available)) {
      setError('Select an advance, a cash/bank account and a refund amount within the available credit.');
      return;
    }
    if (refund.reason.trim().length < 5) {
      setError('Enter a refund reason of at least five characters.');
      return;
    }
    if (!await appConfirm('Refund this unused customer advance from the selected cash/bank account?', {
      title: 'Customer advance refund', confirmLabel: 'Record Refund', tone: 'danger',
    })) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await customerCreditService.refundAdvance(refund.advanceId, refund);
      setRefund(emptyRefund());
      setSuccess('Refund recorded once in the cash/bank ledger and customer credit ledger.');
      await load();
      onChanged?.();
    } catch (cause) {
      setError(cause?.message || 'Unable to refund the customer advance.');
    } finally {
      setSaving(false);
    }
  };

  const reverseApplication = async (item) => {
    if (!canReverse || saving) return;
    const reason = await appPrompt('Reason to reverse this credit allocation:');
    if (!reason || reason.trim().length < 5) {
      if (reason != null) setError('Enter at least five characters for the reversal reason.');
      return;
    }
    if (!await appConfirm('Reverse this credit allocation? The invoice will become payable again.', {
      title: 'Reverse advance application', confirmLabel: 'Reverse Allocation', tone: 'danger',
    })) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await customerCreditService.reverseApplication(item.advanceId, item.id, reason.trim());
      setSuccess('Credit application reversed. No cash or bank movement was posted.');
      await load();
      onChanged?.();
    } catch (cause) {
      setError(cause?.message || 'Unable to reverse the credit allocation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="customer-credit-ledger" aria-label="Customer advance and credit ledger">
      <div className="customer-credit-head">
        <div><h3><Wallet size={17} aria-hidden="true"/> Customer Credit Ledger</h3>
          <p>Live invoice balances, advance receipts, applications and refunds.</p>
        </div>
        <button type="button" onClick={load} disabled={loading || saving} aria-label="Refresh customer credit ledger">
          <RefreshCw size={16} aria-hidden="true"/> Refresh
        </button>
      </div>
      {error && <p className="customer-credit-error" role="alert">{error}</p>}
      {success && <p className="customer-credit-success" role="status">{success}</p>}
      {loading && !ledger ? <p role="status">Loading customer credit ledger…</p> : ledger && (
        <>
          <div className="customer-credit-stats">
            <div><span>Invoice Due</span><strong>{currency(ledger.invoiceOutstanding)}</strong></div>
            <div><span>Available Advance</span><strong>{currency(ledger.advanceAvailable)}</strong></div>
            <div><span>Advance Applied</span><strong>{currency(ledger.advanceApplied)}</strong></div>
            <div><span>Advance Refunded</span><strong>{currency(ledger.advanceRefunded)}</strong></div>
          </div>
          <p className="customer-credit-note">
            An advance is not a second sale or an extra bank receipt when applied to an invoice.
            Amounts remain in customer credit until applied or refunded.
          </p>
          <div className="customer-credit-actions">
            <button type="button" onClick={() => navigate(`/payments/new?customerId=${encodeURIComponent(customerId)}`)}>
              <ArrowDownLeft size={16}/> Receive Advance
            </button>
            <button type="button" onClick={() => navigate('/payments')}>View All Payments</button>
          </div>
          {canApply && advances.length > 0 && invoices.length > 0 && (
            <form className="customer-credit-form" onSubmit={applyCredit}>
              <h4>Apply advance to an invoice</h4>
              <div className="customer-credit-form-grid">
                <label>Available advance
                  <select required value={apply.advanceId} disabled={saving}
                    onChange={(event) => setApply((x) => ({ ...x, advanceId: event.target.value }))}>
                    <option value="">Choose receipt</option>
                    {advances.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.date} · {item.method} · {currency(item.available)} left
                      </option>
                    ))}
                  </select>
                </label>
                <label>Invoice to settle
                  <select required value={apply.invoiceId} disabled={saving}
                    onChange={(event) => setApply((x) => ({ ...x, invoiceId: event.target.value }))}>
                    <option value="">Choose invoice</option>
                    {invoices.map((item) => (
                      <option key={item.id} value={item.invoiceId}>{item.reference} · Due {currency(item.balance)}</option>
                    ))}
                  </select>
                </label>
                <label>Credit amount (₹)
                  <input required type="number" min="0.01" step="0.01" inputMode="decimal"
                    max={Math.min(Number(selectedAdvance?.available || 0), Number(selectedInvoice?.balance || 0)) || undefined}
                    value={apply.amount} disabled={saving}
                    onChange={(event) => setApply((x) => ({ ...x, amount: event.target.value }))}/>
                </label>
              </div>
              <button type="submit" disabled={saving || !selectedAdvance || !selectedInvoice}>
                {saving ? 'Applying…' : 'Apply Credit to Invoice'}
              </button>
            </form>
          )}
          {canReverse && advances.length > 0 && (
            <form className="customer-credit-form" onSubmit={refundCredit}>
              <h4>Refund unused customer advance</h4>
              <div className="customer-credit-form-grid">
                <label>Advance
                  <select required value={refund.advanceId} disabled={saving}
                    onChange={(event) => setRefund((x) => ({ ...x, advanceId: event.target.value }))}>
                    <option value="">Choose advance</option>
                    {advances.map((item) => <option key={item.id} value={item.id}>{item.date} · {currency(item.available)} remaining</option>)}
                  </select>
                </label>
                <label>Refund from account
                  <select required value={refund.accountId} disabled={saving}
                    onChange={(event) => setRefund((x) => ({ ...x, accountId: event.target.value }))}>
                    <option value="">Select active account</option>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.kind})</option>)}
                  </select>
                </label>
                <label>Refund amount (₹)
                  <input required type="number" min="0.01" step="0.01" inputMode="decimal"
                    max={Number(selectedRefundAdvance?.available || 0) || undefined}
                    value={refund.amount} disabled={saving}
                    onChange={(event) => setRefund((x) => ({ ...x, amount: event.target.value }))}/>
                </label>
                <label>Method
                  <select value={refund.method} disabled={saving}
                    onChange={(event) => setRefund((x) => ({ ...x, method: event.target.value }))}>
                    {['Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque'].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>Reference
                  <input maxLength={120} value={refund.reference} disabled={saving}
                    onChange={(event) => setRefund((x) => ({ ...x, reference: event.target.value }))}/>
                </label>
                <label>Refund reason
                  <input required minLength={5} maxLength={1000} value={refund.reason} disabled={saving}
                    onChange={(event) => setRefund((x) => ({ ...x, reason: event.target.value }))}/>
                </label>
              </div>
              <button type="submit" disabled={saving || !refund.accountId || !refund.advanceId}>
                {saving ? 'Refunding…' : 'Record Refund'}
              </button>
            </form>
          )}
          <div className="customer-credit-history">
            <h4>Credit and Invoice Timeline</h4>
            {!ledger.entries?.length ? <p>No finalized invoices or payments recorded.</p> : (
              <div className="customer-credit-table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Transaction</th><th>Reference</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>{ledger.entries.map((item) => (
                    <tr key={item.type + ':' + item.id}>
                      <td>{item.date}</td>
                      <td>{String(item.type).replaceAll('_', ' ')}</td>
                      <td>{item.reference}</td>
                      <td>{item.type === 'refund' || item.type === 'credit_refunded'
                        ? <span className="customer-credit-out"><ArrowUpRight size={13}/> {currency(item.amount)}</span>
                        : currency(item.amount)}</td>
                      <td>{item.status}</td>
                      <td>{canReverse && item.type === 'credit_applied' && item.status !== 'Reversed'
                        ? <button type="button" disabled={saving} onClick={() => reverseApplication(item)}>Reverse</button>
                        : item.invoiceId ? <button type="button" onClick={() => navigate(`/invoices/${item.invoiceId}`)}>Invoice</button> : '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
