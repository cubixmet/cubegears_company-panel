import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowRightLeft, BookOpen, PackageMinus, RefreshCw } from 'lucide-react';
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
        id: 'advance:' + row.id, title: `Advance ${row.reference || row.id.slice(0, 8)}`,
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

  if (USE_MOCK_API) return null;
  return <section className="cg-supplier-returns" aria-label="Supplier purchase returns and refunds">
    <div className="cg-sr-heading">
      <div><h2>Returns, Debit Notes &amp; Payables</h2>
        <p>Live supplier credit reconciliation, not a separate expense or payment.</p></div>
      <button type="button" disabled={loading || busy} onClick={refresh}>
        <RefreshCw size={16} aria-hidden="true"/> Refresh
      </button>
    </div>
    {error && <p role="alert" className="cg-sr-error">{error}</p>}
    {success && <p role="status" className="cg-sr-success">{success}</p>}
    {loading && <p role="status">Loading supplier returns and payables…</p>}
    {payables && <div className="cg-sr-stats">
      <div><span>Supplier outstanding</span><strong>{currency(payables.totalOutstanding)}</strong></div>
      <div><span>Overdue 1–30 days</span><strong>{currency(payables.aging?.['1-30'])}</strong></div>
      <div><span>Overdue 31+ days</span><strong>{currency(
        ['31-60', '61-90', '90+'].reduce((sum, band) => sum + amount(payables.aging?.[band]), 0)
      )}</strong></div>
    </div>}
    <div className="cg-sr-tabs" role="group" aria-label="Supplier credit workflow">
      {[
        ['returns', 'Purchase Returns'], ['credit', 'Use Debit Credit'],
        ['refund', 'Receive Refund'], ['ledger', 'History & Aging'],
      ].map(([value, label]) => <button key={value} type="button"
        aria-pressed={tab === value} className={tab === value ? 'selected' : ''}
        onClick={() => { setTab(value); setError(''); }}>{label}</button>)}
    </div>
    {tab === 'returns' && <>
      {canReturn && <form className="cg-sr-form" onSubmit={postReturn}>
        <h3><PackageMinus size={18}/> Post Purchase Return / Debit Note</h3>
        <label>Posted purchase invoice<select required value={billId} disabled={busy}
          onChange={e => { setBillId(e.target.value); setQuantities({}); }}>
          <option value="">Select supplier bill</option>
          {postedBills.map(row => <option key={row.id} value={row.id}>
            {row.invoiceNumber} · {currency(row.total)} · {row.status}
          </option>)}
        </select></label>
        {currentBill && <div className="cg-sr-table">
          <table><thead><tr><th>Purchased Item</th><th>Qty purchased</th>
            <th>Available to return</th><th>Return qty</th></tr></thead>
            <tbody>{availableLines.map(line => <tr key={line.lineIndex}>
              <td>{line.description}</td><td>{line.quantity}</td>
              <td>{line.remaining.toFixed(2)}</td>
              <td><input aria-label={`Return quantity for ${line.description}`}
                inputMode="decimal" disabled={busy || line.remaining <= 0}
                value={quantities[line.lineIndex] || ''}
                onChange={e => setQuantities(previous => ({
                  ...previous, [line.lineIndex]: e.target.value,
                }))}/></td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className="cg-sr-grid">
          <label>Debit note number<input required maxLength={100} disabled={busy}
            value={returnForm.number} onChange={e => setReturnForm(v => ({
              ...v, number: e.target.value,
            }))} placeholder="Supplier return reference"/></label>
          <label>Return date<input required type="date" disabled={busy} value={returnForm.date}
            onChange={e => setReturnForm(v => ({ ...v, date: e.target.value }))}/></label>
        </div>
        <label>Return reason<input required minLength={5} maxLength={2000} disabled={busy}
          value={returnForm.reason} onChange={e => setReturnForm(v => ({
            ...v, reason: e.target.value,
          }))} placeholder="Defective, damaged or wrongly supplied item"/></label>
        <p className="cg-sr-note">Estimated credit: {currency(returnPreview)}. Actual GST and values are calculated from the posted purchase snapshot by Django. Stock cannot become negative.</p>
        <button disabled={busy || !currentBill} type="submit">{busy ? 'Posting…' : 'Post Return & Debit Note'}</button>
      </form>}
      <h3>Posted Debit Notes</h3>
      <div className="cg-sr-table"><table><thead><tr>
        <th>Debit note</th><th>Supplier invoice</th><th>Returned</th>
        <th>Payable reduced</th><th>Available credit</th></tr></thead>
        <tbody>{notes.length ? notes.map(row => <tr key={row.id}>
          <td>{row.number}<small>{row.date}</small></td><td>{row.invoiceNumber}</td>
          <td>{currency(row.total)}</td><td>{currency(row.payableReduction)}</td>
          <td>{currency(row.creditAvailable)}</td>
        </tr>) : <tr><td colSpan={5}>No supplier debit notes yet.</td></tr>}</tbody>
      </table></div>
    </>}
    {tab === 'credit' && <>
      {canReturn && <form className="cg-sr-form" onSubmit={applyCredit}>
        <h3><ArrowRightLeft size={18}/> Apply debit credit to another bill</h3>
        <div className="cg-sr-grid">
          <label>Debit note credit<select required value={application.debitNoteId} disabled={busy}
            onChange={e => setApplication(v => ({ ...v, debitNoteId: e.target.value, billId: '' }))}>
            <option value="">Select available debit credit</option>
            {notes.filter(note => amount(note.creditAvailable) > 0).map(note =>
              <option key={note.id} value={note.id}>{note.number} · {currency(note.creditAvailable)}</option>)}
          </select></label>
          <label>Apply to purchase bill<select required disabled={busy}
            value={application.billId} onChange={e => setApplication(v => ({ ...v, billId: e.target.value }))}>
            <option value="">Select outstanding bill</option>
            {outstandingBills.filter(row => row.id !== currentCredit?.billId).map(row =>
              <option key={row.id} value={row.id}>{row.invoiceNumber} · Due {currency(row.outstanding)}</option>)}
          </select></label>
          <label>Credit amount<input required inputMode="decimal" disabled={busy}
            value={application.amount} onChange={e => setApplication(v => ({
              ...v, amount: e.target.value,
            }))}/></label>
        </div>
        <p className="cg-sr-note">No bank withdrawal occurs when supplier credit settles a different bill.</p>
        <button disabled={busy} type="submit">{busy ? 'Applying…' : 'Apply Debit Credit'}</button>
      </form>}
      {!notes.some(note => amount(note.creditAvailable) > 0) &&
        <p className="cg-sr-muted">There are no unapplied debit-note credits.</p>}
    </>}
    {tab === 'refund' && <>
      {canPay && <form className="cg-sr-form" onSubmit={receiveRefund}>
        <h3><ArrowDownLeft size={18}/> Receive Supplier Refund</h3>
        <div className="cg-sr-grid">
          <label>Refund source<select value={refundForm.source} required disabled={busy}
            onChange={e => setRefundForm(v => ({ ...v, source: e.target.value, amount: '' }))}>
            <option value="">Select credit / unapplied advance</option>
            {refundableSources.map(source => <option key={source.id} value={source.id}>
              {source.title} · {currency(source.available)}
            </option>)}
          </select></label>
          <label>Receiving account<select required disabled={busy} value={refundForm.accountId}
            onChange={e => setRefundForm(v => ({ ...v, accountId: e.target.value }))}>
            <option value="">Select bank, cash or UPI account</option>
            {accounts.map(account => <option key={account.id} value={account.id}>
              {account.name} · {account.kind}
            </option>)}
          </select></label>
          <label>Refund amount<input required inputMode="decimal" disabled={busy}
            value={refundForm.amount} onChange={e => setRefundForm(v => ({ ...v, amount: e.target.value }))}/></label>
          <label>Received on<input required type="date" disabled={busy} value={refundForm.refundedOn}
            onChange={e => setRefundForm(v => ({ ...v, refundedOn: e.target.value }))}/></label>
          <label className="full">Bank / UPI / cash reference<input maxLength={120} disabled={busy}
            value={refundForm.reference} onChange={e => setRefundForm(v => ({
              ...v, reference: e.target.value,
            }))}/></label>
        </div>
        <p className="cg-sr-note">Available to refund: {currency(currentSource?.available)}. Amount posts as money received into the selected account; no second supplier payment is created.</p>
        <button disabled={busy} type="submit">{busy ? 'Recording…' : 'Record Supplier Refund'}</button>
      </form>}
      <h3>Received Refunds</h3>
      <div className="cg-sr-table"><table><thead><tr><th>Date</th><th>Source</th>
        <th>Method</th><th>Reference</th><th>Amount in</th></tr></thead>
        <tbody>{refunds.length ? refunds.map(row => <tr key={row.id}>
          <td>{row.refundedOn}</td><td>{row.debitNoteId ? 'Debit note' : 'Advance'}</td>
          <td>{row.method}</td><td>{row.reference || '—'}</td><td>{currency(row.amount)}</td>
        </tr>) : <tr><td colSpan={5}>No supplier refunds received yet.</td></tr>}</tbody></table></div>
    </>}
    {tab === 'ledger' && <>
      <h3><BookOpen size={18}/> Payables Aging</h3>
      <div className="cg-sr-table"><table><thead><tr><th>Supplier invoice</th>
        <th>Due date</th><th>Aging band</th><th>Outstanding</th></tr></thead>
        <tbody>{payables?.bills?.length ? payables.bills.map(row => <tr key={row.billId}>
          <td>{row.invoiceNumber}</td><td>{row.dueDate || 'Not set'}</td>
          <td>{row.band}</td><td>{currency(row.outstanding)}</td>
        </tr>) : <tr><td colSpan={4}>No unpaid posted bills.</td></tr>}</tbody></table></div>
    </>}
  </section>;
}
