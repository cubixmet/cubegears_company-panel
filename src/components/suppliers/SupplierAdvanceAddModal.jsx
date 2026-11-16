import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowDownRight, RefreshCw } from 'lucide-react';
import { ResponsiveModalSheet } from '../common/ResponsiveModalSheet';
import { supplierFinanceService } from '../../services/supplierFinance.service';
import { accountChannel, defaultFinanceAccountId } from '../../utils/financeCashBank';
import { supplierFinanceSetupRoute } from '../../utils/supplierFinanceReturnRoute';
import { supplierAdvancePayload, validateSupplierAdvance } from '../../utils/supplierAdvancePayment';
import '../../styles/supplier-advance-add.css';

const today = () => {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
};
const newRequestKey = () => globalThis.crypto?.randomUUID?.()
  || ('supplier-advance-' + Date.now() + '-' + Math.random().toString(36).slice(2));
const currency = number => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR',
}).format(Number(number || 0));
const errorText = error => {
  const data = error?.response?.data || error?.data;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const first = Object.values(data).find(value => typeof value === 'string' || Array.isArray(value));
    if (Array.isArray(first)) return String(first[0] || 'Unable to record supplier advance.');
    if (first) return first;
  }
  return error?.message || 'Unable to record supplier advance.';
};

export default function SupplierAdvanceAddModal({ supplier, onClose, onSaved }) {
  const location = useLocation();
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('');
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const requestKey = useRef(newRequestKey());

  const loadAccounts = async () => {
    setAccountsLoading(true);
    setAccountsError('');
    try {
      const rows = await supplierFinanceService.getAccounts();
      setAccounts(rows.filter(account => account.isActive !== false && accountChannel(account.kind)));
    } catch (cause) {
      setAccounts([]);
      setAccountsError(errorText(cause));
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    supplierFinanceService.getAccounts().then(rows => {
      if (active) setAccounts(rows.filter(account =>
        account.isActive !== false && accountChannel(account.kind)));
    }).catch(cause => {
      if (active) setAccountsError(errorText(cause));
    }).finally(() => {
      if (active) setAccountsLoading(false);
    });
    return () => { active = false; };
  }, []);

  const selectedId = defaultFinanceAccountId(accounts, channel);
  const selectedAccount = accounts.find(account => String(account.id) === selectedId);
  const sourceRoute = supplierFinanceSetupRoute(location, channel || 'Bank', '#supplier-ledger');

  const submitAdvance = async event => {
    event.preventDefault();
    if (saving) return;
    setError('');
    const { error: validationError } = validateSupplierAdvance({
      amount, channel, accounts, accountsReady: !accountsLoading && !accountsError,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!paidOn) {
      setError('Select the date the advance was paid.');
      return;
    }
    if (reference.trim().length > 120) {
      setError('Payment reference cannot exceed 120 characters.');
      return;
    }
    setSaving(true);
    try {
      await supplierFinanceService.recordPayment(supplierAdvancePayload({
        supplierId: supplier.id, amount, channel, date: paidOn,
        reference, requestKey: requestKey.current,
      }));
      // The supplier advance is posted: a follow-up read failure must not
      // prompt a second write. The parent refreshes the ledger and metrics.
      requestKey.current = newRequestKey();
      onClose();
      Promise.resolve().then(onSaved).catch(() => {});
    } catch (cause) {
      const status = Number(cause?.status || cause?.response?.status || 0);
      setError(!status || status >= 500
        ? 'Payment status is uncertain. Check the supplier ledger before retrying; do not send the advance twice.'
        : errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  return <ResponsiveModalSheet isOpen={true}
    onClose={() => { if (!saving) onClose(); }}
    title="Add Supplier Advance" maxWidth="520px">
    <form className="cg-supplier-advance-form" onSubmit={submitAdvance}>
      <div className="cg-supplier-advance-context">
        <strong>{supplier?.name || 'Supplier'}</strong>
        <p>Pay money in advance to this supplier. The amount increases Advance Available and is deducted from the workshop Cash or Bank balance.</p>
      </div>
      <label>Advance Amount (₹) *
        <input type="number" name="advanceAmount" value={amount} autoFocus
          min="0.01" step="0.01" inputMode="decimal" required
          placeholder="0.00" disabled={saving} onChange={e => { setAmount(e.target.value); setError(''); }}/>
      </label>
      <label>Payment Method *
        <select value={channel} required disabled={saving}
          onChange={e => { setChannel(e.target.value); setError(''); }}>
          <option value="">Select payment method</option>
          <option value="Cash">Cash in Hand</option>
          <option value="Bank">Bank / UPI (PhonePe, GPay, transfer)</option>
        </select>
      </label>
      {accountsLoading && <p className="cg-supplier-advance-hint" role="status">Loading Finance accounts…</p>}
      {accountsError && <div role="alert" className="cg-supplier-advance-warning">
        <p>Unable to load Finance accounts: {accountsError}</p>
        <button type="button" disabled={saving} onClick={loadAccounts}>Retry</button>
      </div>}
      {channel && !accountsLoading && !accountsError && (selectedAccount
        ? <div className="cg-supplier-advance-source" role="status">
          <span><ArrowDownRight size={16} aria-hidden="true"/> Will deduct from Finance</span>
          <strong>{selectedAccount.name}</strong>
          <small>{selectedAccount.recordedBalance == null
            ? 'Available balance will be verified by Finance on submit.'
            : 'Available: ' + currency(selectedAccount.recordedBalance)}</small>
        </div>
        : <div className="cg-supplier-advance-warning" role="alert">
          <p>No unambiguous active {channel === 'Cash' ? 'Cash' : 'Bank / UPI'} account is selected.
            {accounts.some(account => accountChannel(account.kind) === channel)
              ? ' Set a Default Payment Account in Finance.'
              : ' Create an account in Finance before paying.'}</p>
          <div className="cg-supplier-advance-source-actions">
            <Link to={sourceRoute}>Open Finance Accounts</Link>
            <button type="button" onClick={loadAccounts}><RefreshCw size={14} aria-hidden="true"/> Refresh</button>
          </div>
        </div>)}
      <div className="cg-supplier-advance-fields-two">
        <label>Paid On *
          <input type="date" value={paidOn} required disabled={saving}
            onChange={e => setPaidOn(e.target.value)}/>
        </label>
        <label>Reference (optional)
          <input type="text" value={reference} maxLength={120} disabled={saving}
            placeholder="Receipt / UTR / note" onChange={e => setReference(e.target.value)}/>
        </label>
      </div>
      <p className="cg-supplier-advance-hint">
        This is an advance payment, not a Finance deposit. Existing purchase bills stay due
        until this advance is allocated to them. No stock or additional expense is created.
      </p>
      {error && <p className="cg-supplier-advance-warning" role="alert">{error}</p>}
      <div className="cg-supplier-advance-actions">
        <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="is-primary" disabled={saving || accountsLoading}>
          {saving ? 'Recording…' : 'Confirm Advance Payment'}
        </button>
      </div>
    </form>
  </ResponsiveModalSheet>;
}
