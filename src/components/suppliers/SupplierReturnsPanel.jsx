import { recordLabel } from '../../utils/recordReferences.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowRightLeft, BookOpen, PackageMinus, RefreshCw, ReceiptText, Wallet, Clock3 } from 'lucide-react';
import { supplierFinanceService } from '../../services/supplierFinance.service';
import { USE_MOCK_API } from '../../api/apiConfig';
import '../../styles/supplier-returns.css';

const currency = value => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(value) || 0);
const amount = value => Number(value) || 0;
const rows = data => Array.isArray(data) ? data : data?.results || [];
const today = () => {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
};
const key = () => globalThis.crypto?.randomUUID?.() ||
  `supplier-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const isMoney = value => /^\d+(?:\.\d{1,2})?$/.test(String(value)) && amount(value) > 0;
const errText = cause => {
  const data = cause?.response?.data || cause?.data;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const first = Object.values(data).find(Boolean);
    if (typeof first === 'string') return first;
    if (Array.isArray(first) && first[0]) return String(first[0]);
  }
  return cause?.message || 'Supplier transaction could not be completed.';
};
const refundMethod = account => account?.kind === 'Cash' ? 'Cash' :
  account?.kind === 'UPI' ? 'UPI' : 'Bank Transfer';

export default function SupplierReturnsPanel({
  supplier, bills = [], payments = [], canReturn = false, canPay = false, onChanged,
}) {
  const [notes, setNotes] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [payables, setPayables] = useState(null);
  const [tab, setTab] = useState('returns');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [billId, setBillId] = useState('');
  const [quantities, setQuantities] = useState({});
  const [returnForm, setReturnForm] = useState({
    number: '', date: today(), reason: '', requestKey: key(),
  });
  const [application, setApplication] = useState({
    debitNoteId: '', billId: '', amount: '', requestKey: key(),
  });
  const [refundForm, setRefundForm] = useState({
    source: '', accountId: '', amount: '', reference: '',
    refundedOn: today(), requestKey: key(),
  });

  const refresh = useCallback(async () => {
    if (!supplier?.id || USE_MOCK_API) return;
    setLoading(true);
    try {
      const [debitNotes, supplierRefunds, moneyAccounts, aging] = await Promise.all([
        supplierFinanceService.getDebitNotes(supplier.id),
        supplierFinanceService.getRefunds(supplier.id),
        supplierFinanceService.getAccounts(),
        supplierFinanceService.getPayables(supplier.id),
      ]);
      setNotes(rows(debitNotes));
      setRefunds(rows(supplierRefunds));
      setAccounts(rows(moneyAccounts).filter(a => a.isActive && ['Cash', 'Bank', 'UPI'].includes(a.kind)));
      setPayables(aging);
      setError('');
    } catch (cause) {
      setError(errText(cause));
    } finally { setLoading(false); }
  }, [supplier?.id]);

  useEffect(() => { refresh(); }, [refresh]);
  const postedBills = useMemo(() => bills.filter(bill => bill.postingStatus === 'Posted'), [bills]);
  const currentBill = postedBills.find(bill => bill.id === billId);
  const availableLines = useMemo(() => (currentBill?.items || []).map((line, lineIndex) => {
    const returned = notes.filter(note => note.billId === billId)
      .flatMap(note => note.lines || []).filter(row => Number(row.lineIndex) === lineIndex)
      .reduce((sum, row) => sum + amount(row.quantity), 0);
    const remaining = Math.max(0, amount(line.quantity) - returned);
    return { ...line, lineIndex, remaining };
  }), [currentBill, notes, billId]);
  const returnPreview = availableLines.reduce((sum, line) => {
    const qty = amount(quantities[line.lineIndex]);
    return sum + (qty > 0 && qty <= line.remaining
      ? qty * amount(line.total) / Math.max(amount(line.quantity), 1) : 0);
  }, 0);
  const outstandingBills = postedBills.filter(row => amount(row.outstanding) > 0);
  const refundableSources = useMemo(() => [
    ...notes.filter(row => amount(row.creditAvailable) > 0).map(row => ({
      id: 'debit:' + row.id, title: `Debit ${row.number}`, available: row.creditAvailable,
    })),
    ...payments.filter(row => row.kind === 'Advance' && amount(row.unapplied) > 0)
      .map(row => ({
        id: 'advance:' + row.id, title: `Advance ${recordLabel(row.reference || row.id)}`,
        available: row.unapplied,
      })),
  ], [notes, payments]);
  const currentSource = refundableSources.find(row => row.id === refundForm.source);
  const currentCredit = notes.find(row => row.id === application.debitNoteId);
  const selectedAccount = accounts.find(row => row.id === refundForm.accountId);

  const finish = async message => {
    await refresh();
    try { await onChanged?.(); } catch (cause) { setError(errText(cause)); }
    setSuccess(message);
  };

  const postReturn = async event => {
    event.preventDefault();
    if (busy || !canReturn || !currentBill) return;
    const lines = availableLines.filter(line => String(quantities[line.lineIndex] || '').trim())
      .map(line => ({ lineIndex: line.lineIndex, quantity: String(quantities[line.lineIndex]) }));
    if (!returnForm.number.trim() || returnForm.reason.trim().length < 5 || !lines.length) {
      setError('Enter debit note number, return reason and at least one returned quantity.'); return;
    }
    if (lines.some(line => !isMoney(line.quantity) ||
      amount(line.quantity) > availableLines[line.lineIndex].remaining)) {
      setError('Return quantity must not exceed previously purchased, unreturned units.'); return;
    }
    setBusy(true); setError(''); setSuccess('');
    try {
      await supplierFinanceService.createDebitNote({
        billId: currentBill.id, ...returnForm, number: returnForm.number.trim(),
        reason: returnForm.reason.trim(), lines,
      });
      setBillId(''); setQuantities({});
      setReturnForm({ number: '', date: today(), reason: '', requestKey: key() });
      await finish('Supplier debit note posted. Inventory and payable reconciled once.');
    } catch (cause) { setError(errText(cause)); }
    finally { setBusy(false); }
  };

  const applyCredit = async event => {
    event.preventDefault();
    if (busy || !canReturn || !application.debitNoteId || !application.billId ||
      !isMoney(application.amount) || amount(application.amount) > amount(currentCredit?.creditAvailable)) {
      setError('Select a refundable debit credit, another supplier bill and a valid amount.'); return;
    }
    setBusy(true); setError(''); setSuccess('');
    try {
      await supplierFinanceService.applyDebitCredit(application.debitNoteId, {
        billId: application.billId, amount: application.amount,
        requestKey: application.requestKey,
      });
      setApplication({ debitNoteId: '', billId: '', amount: '', requestKey: key() });
      await finish('Supplier debit credit applied to the posted bill without cash deduction.');
    } catch (cause) { setError(errText(cause)); }
    finally { setBusy(false); }
  };

  const receiveRefund = async event => {
    event.preventDefault();
    if (busy || !canPay || !refundForm.source || !selectedAccount ||
      !isMoney(refundForm.amount) ||
      amount(refundForm.amount) > amount(currentSource?.available)) {
      setError('Select an unapplied debit/advance, destination account and valid refund amount.');
      return;
    }
    const [kind, sourceId] = refundForm.source.split(':');
    setBusy(true); setError(''); setSuccess('');
    try {
      await supplierFinanceService.createRefund({
        [kind === 'debit' ? 'debitNoteId' : 'advanceId']: sourceId,
        accountId: selectedAccount.id, method: refundMethod(selectedAccount),
        amount: refundForm.amount, reference: refundForm.reference.trim(),
        refundedOn: refundForm.refundedOn, requestKey: refundForm.requestKey,
      });
      setRefundForm({
        source: '', accountId: '', amount: '', reference: '',
        refundedOn: today(), requestKey: key(),
      });
      await finish('Supplier refund recorded to the selected cash/bank/UPI account.');
    } catch (cause) { setError(errText(cause)); }
    finally { setBusy(false); }
  };

  const availableDebitNotes = notes.filter(note => amount(note.creditAvailable) > 0);
  const refundTotal = refunds.reduce((sum, refund) => sum + amount(refund.amount), 0);
  const overdueTotal = ['1-30', '31-60', '61-90', '90+']
    .reduce((sum, band) => sum + amount(payables?.aging?.[band]), 0);
  const workflowTabs = [
    { value: 'returns', label: 'Purchase Returns', icon: PackageMinus, count: notes.length },
    { value: 'credit', label: 'Use Debit Credit', icon: ArrowRightLeft, count: availableDebitNotes.length },
    { value: 'refund', label: 'Receive Refund', icon: ArrowDownLeft, count: refundableSources.length },
    { value: 'ledger', label: 'History & Aging', icon: BookOpen, count: payables?.bills?.length || 0 },
  ];

  if (USE_MOCK_API) return null;
  return <section className="cg-supplier-returns" aria-label="Supplier purchase returns and refunds">
    <div className="cg-sr-heading">
      <div className="cg-sr-heading-title">
        <span className="cg-sr-heading-icon"><PackageMinus size={19} aria-hidden="true"/></span>
        <div>
          <h2>Supplier Returns &amp; Credits</h2>
          <p>Return parts, use supplier credit, record refunds and review outstanding bills.</p>
        </div>
      </div>
      <button type="button" className="cg-sr-refresh" disabled={loading || busy} onClick={refresh}>
        <RefreshCw size={16} aria-hidden="true"/> Refresh
      </button>
    </div>
    {error && <p role="alert" className="cg-sr-error">{error}</p>}
    {success && <p role="status" className="cg-sr-success">{success}</p>}
    {loading && <p role="status" className="cg-sr-loading">Loading supplier returns and balances…</p>}
    {payables && <div className="cg-sr-stats" aria-label="Supplier return and payable summary">
      <div className="cg-sr-stat">
        <span><Wallet size={15} aria-hidden="true"/> Supplier outstanding</span>
        <strong>{currency(payables.totalOutstanding)}</strong>
        <small>Unpaid posted bills</small>
      </div>
      <div className="cg-sr-stat">
        <span><ArrowRightLeft size={15} aria-hidden="true"/> Available debit credit</span>
        <strong>{currency(availableDebitNotes.reduce((sum, note) => sum + amount(note.creditAvailable), 0))}</strong>
        <small>Can offset another bill</small>
      </div>
      <div className="cg-sr-stat">
        <span><ArrowDownLeft size={15} aria-hidden="true"/> Refunds received</span>
        <strong>{currency(refundTotal)}</strong>
        <small>Recorded cash / bank receipts</small>
      </div>
      <div className="cg-sr-stat">
        <span><Clock3 size={15} aria-hidden="true"/> Overdue</span>
        <strong>{currency(overdueTotal)}</strong>
        <small>1+ days past due</small>
      </div>
    </div>}
    <div className="cg-sr-tabs" role="group" aria-label="Supplier return workflows">
      {workflowTabs.map(({ value, label, icon: Icon, count }) =>
        <button key={value} type="button"
          aria-pressed={tab === value} className={tab === value ? 'selected' : ''}
          onClick={() => { setTab(value); setError(''); }}>
          <Icon size={16} aria-hidden="true"/>
          <span>{label}</span>
          <span className="cg-sr-tab-count">{count}</span>
        </button>)}
    </div>
    {tab === 'returns' && <>
      {canReturn && <form className="cg-sr-form" onSubmit={postReturn}>
        <div className="cg-sr-form-heading">
          <h3><PackageMinus size={18} aria-hidden="true"/> New Purchase Return</h3>
          <p>Choose a posted invoice, enter returned quantities, and record a debit note.</p>
        </div>
        <label>Purchase invoice *<select required value={billId} disabled={busy || !postedBills.length}
          onChange={e => { setBillId(e.target.value); setQuantities({}); }}>
          <option value="">Select supplier bill</option>
          {postedBills.map(row => <option key={row.id} value={row.id}>
            {row.invoiceNumber} · {currency(row.total)} · {row.status}
          </option>)}
        </select></label>
        {!postedBills.length && <p className="cg-sr-empty">No posted purchase bills available for a return.</p>}
        {currentBill && <div className="cg-sr-table cg-sr-return-lines">
          <table><thead><tr><th>Purchased Item</th><th>Qty purchased</th>
            <th>Available to return</th><th>Return qty</th></tr></thead>
            <tbody>{availableLines.map(line => <tr key={line.lineIndex}>
              <td data-label="Item">{line.description}</td><td data-label="Purchased">{line.quantity}</td>
              <td data-label="Returnable">{line.remaining.toFixed(2)}</td>
              <td data-label="Return Qty"><input aria-label={`Return quantity for ${line.description}`}
                type="number" min="0" step="any" inputMode="decimal" disabled={busy || line.remaining <= 0}
                value={quantities[line.lineIndex] || ''}
                onChange={e => setQuantities(previous => ({
                  ...previous, [line.lineIndex]: e.target.value,
                }))}/></td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className="cg-sr-grid">
          <label>Debit note number *<input required maxLength={100} disabled={busy}
            value={returnForm.number} onChange={e => setReturnForm(v => ({
              ...v, number: e.target.value,
            }))} placeholder="Supplier return reference"/></label>
          <label>Return date *<input required type="date" disabled={busy} value={returnForm.date}
            onChange={e => setReturnForm(v => ({ ...v, date: e.target.value }))}/></label>
        </div>
        <label>Return reason *<textarea required rows={2} minLength={5} maxLength={2000} disabled={busy}
          value={returnForm.reason} onChange={e => setReturnForm(v => ({
            ...v, reason: e.target.value,
          }))} placeholder="For example: Damaged or incorrectly supplied part"/></label>
        <div className="cg-sr-form-summary">
          <span>Estimated debit credit</span><strong>{currency(returnPreview)}</strong>
          <small>Final GST and stock values come from the posted purchase.</small>
        </div>
        <div className="cg-sr-form-actions">
          <button disabled={busy || !currentBill || returnPreview <= 0} type="submit" className="cg-sr-primary">
            {busy ? 'Posting…' : 'Post Return & Debit Note'}
          </button>
        </div>
      </form>}
      <div className="cg-sr-section-heading"><h3><ReceiptText size={17} aria-hidden="true"/> Posted Debit Notes</h3>
        <span>{notes.length} {notes.length === 1 ? 'record' : 'records'}</span></div>
      <div className="cg-sr-table cg-sr-history-table"><table><thead><tr>
        <th>Debit note</th><th>Supplier invoice</th><th>Returned</th>
        <th>Payable reduced</th><th>Available credit</th></tr></thead>
        <tbody>{notes.length ? notes.map(row => <tr key={row.id}>
          <td data-label="Debit note">{row.number}<small>{row.date}</small></td>
          <td data-label="Supplier invoice">{row.invoiceNumber}</td>
          <td data-label="Returned">{currency(row.total)}</td>
          <td data-label="Payable reduced">{currency(row.payableReduction)}</td>
          <td data-label="Available credit"><strong>{currency(row.creditAvailable)}</strong></td>
        </tr>) : <tr><td colSpan={5}>No supplier debit notes yet.</td></tr>}</tbody>
      </table></div>
    </>}
    {tab === 'credit' && <>
      {canReturn && <form className="cg-sr-form" onSubmit={applyCredit}>
        <div className="cg-sr-form-heading">
          <h3><ArrowRightLeft size={18} aria-hidden="true"/> Apply Debit Credit</h3>
          <p>Use a credit from a return to reduce another unpaid purchase bill.</p>
        </div>
        <div className="cg-sr-grid">
          <label>Available debit credit *<select required value={application.debitNoteId} disabled={busy || !availableDebitNotes.length}
            onChange={e => setApplication(v => ({ ...v, debitNoteId: e.target.value, billId: '' }))}>
            <option value="">Select available debit credit</option>
            {notes.filter(note => amount(note.creditAvailable) > 0).map(note =>
              <option key={note.id} value={note.id}>{note.number} · {currency(note.creditAvailable)}</option>)}
          </select></label>
          <label>Apply to purchase bill *<select required disabled={busy}
            value={application.billId} onChange={e => setApplication(v => ({ ...v, billId: e.target.value }))}>
            <option value="">Select outstanding bill</option>
            {outstandingBills.filter(row => row.id !== currentCredit?.billId).map(row =>
              <option key={row.id} value={row.id}>{row.invoiceNumber} · Due {currency(row.outstanding)}</option>)}
          </select></label>
          <label>Credit amount (₹) *<input required type="number" min="0.01" step="0.01" inputMode="decimal" disabled={busy}
            value={application.amount} onChange={e => setApplication(v => ({
              ...v, amount: e.target.value,
            }))}/></label>
        </div>
        <p className="cg-sr-note">Applying existing supplier credit does not deduct money from your Bank / Cash balance again.</p>
        <div className="cg-sr-form-actions">
          <button className="cg-sr-primary" disabled={busy || !availableDebitNotes.length || !outstandingBills.length} type="submit">
            {busy ? 'Applying…' : 'Apply Debit Credit'}
          </button>
        </div>
      </form>}
      {!availableDebitNotes.length &&
        <p className="cg-sr-empty" role="status">
          No available debit credit yet. Post a purchase return first to generate supplier credit.
        </p>}
      {!!availableDebitNotes.length && !outstandingBills.length &&
        <p className="cg-sr-empty" role="status">
          No outstanding purchase bill is available to receive this credit.
        </p>}
    </>}
    {tab === 'refund' && <>
      {canPay && <form className="cg-sr-form" onSubmit={receiveRefund}>
        <div className="cg-sr-form-heading">
          <h3><ArrowDownLeft size={18} aria-hidden="true"/> Receive Supplier Refund</h3>
          <p>Record money received from the supplier into a Cash, Bank or UPI account.</p>
        </div>
        <div className="cg-sr-grid">
          <label>Refund source *<select value={refundForm.source} required disabled={busy || !refundableSources.length}
            onChange={e => setRefundForm(v => ({ ...v, source: e.target.value, amount: '' }))}>
            <option value="">Select credit / unapplied advance</option>
            {refundableSources.map(source => <option key={source.id} value={source.id}>
              {source.title} · {currency(source.available)}
            </option>)}
          </select></label>
          <label>Receiving account *<select required disabled={busy} value={refundForm.accountId}
            onChange={e => setRefundForm(v => ({ ...v, accountId: e.target.value }))}>
            <option value="">Select bank, cash or UPI account</option>
            {accounts.map(account => <option key={account.id} value={account.id}>
              {account.name} · {account.kind}
            </option>)}
          </select></label>
          <label>Refund amount (₹) *<input required type="number" min="0.01" step="0.01" inputMode="decimal" disabled={busy}
            value={refundForm.amount} onChange={e => setRefundForm(v => ({ ...v, amount: e.target.value }))}/></label>
          <label>Received on *<input required type="date" disabled={busy} value={refundForm.refundedOn}
            onChange={e => setRefundForm(v => ({ ...v, refundedOn: e.target.value }))}/></label>
          <label className="full">Bank / UPI / cash reference<input maxLength={120} disabled={busy}
            value={refundForm.reference} onChange={e => setRefundForm(v => ({
              ...v, reference: e.target.value,
            }))}/></label>
        </div>
        <div className="cg-sr-form-summary">
          <span>Available to refund</span><strong>{currency(currentSource?.available)}</strong>
          <small>{selectedAccount
            ? 'Money will be received into ' + selectedAccount.name + '.'
            : 'Choose the receiving account to increase its Finance balance.'}</small>
        </div>
        <div className="cg-sr-form-actions">
          <button className="cg-sr-primary" disabled={busy || !refundableSources.length || !accounts.length} type="submit">
            {busy ? 'Recording…' : 'Record Supplier Refund'}
          </button>
        </div>
      </form>}
      {!refundableSources.length &&
        <p className="cg-sr-empty" role="status">
          No unapplied advance or debit-note credit is available to refund.
        </p>}
      {!accounts.length && !loading &&
        <p className="cg-sr-empty" role="status">
          No active receiving account found. Add a Cash, Bank or UPI account in Finance.
        </p>}
      <div className="cg-sr-section-heading">
        <h3><ArrowDownLeft size={17} aria-hidden="true"/> Received Refunds</h3>
        <span>{refunds.length} {refunds.length === 1 ? 'record' : 'records'}</span>
      </div>
      <div className="cg-sr-table cg-sr-history-table"><table><thead><tr><th>Date</th><th>Source</th>
        <th>Method</th><th>Reference</th><th>Amount in</th></tr></thead>
        <tbody>{refunds.length ? refunds.map(row => <tr key={row.id}>
          <td data-label="Date">{row.refundedOn}</td><td data-label="Source">{row.debitNoteId ? 'Debit note' : 'Advance'}</td>
          <td data-label="Method">{row.method}</td><td data-label="Reference">{row.reference || '—'}</td>
          <td data-label="Amount in"><strong>{currency(row.amount)}</strong></td>
        </tr>) : <tr><td colSpan={5}>No supplier refunds received yet.</td></tr>}</tbody></table></div>
    </>}
    {tab === 'ledger' && <>
      <div className="cg-sr-section-heading">
        <h3><BookOpen size={18} aria-hidden="true"/> Purchase Bill Aging</h3>
        <span>{payables?.bills?.length || 0} unpaid bills</span>
      </div>
      <p className="cg-sr-muted">Review outstanding purchase bills by due date. These are balances owed to the supplier.</p>
      <div className="cg-sr-table cg-sr-history-table"><table><thead><tr><th>Supplier invoice</th>
        <th>Due date</th><th>Aging band</th><th>Outstanding</th></tr></thead>
        <tbody>{payables?.bills?.length ? payables.bills.map(row => <tr key={row.billId}>
          <td data-label="Supplier invoice">{row.invoiceNumber}</td>
          <td data-label="Due date">{row.dueDate || 'Not set'}</td>
          <td data-label="Aging band">{row.band}</td>
          <td data-label="Outstanding"><strong>{currency(row.outstanding)}</strong></td>
        </tr>) : <tr><td colSpan={4}>No unpaid posted bills.</td></tr>}</tbody></table></div>
    </>}
  </section>;
}
