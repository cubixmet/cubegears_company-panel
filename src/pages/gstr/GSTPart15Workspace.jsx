import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookCheck, FileCheck2, FileMinus2, RefreshCw } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import './gst-part15.css';

const list = result => Array.isArray(result) ? result : result?.results || [];
const today = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')].join('-');
};
const requestKey = () => globalThis.crypto?.randomUUID?.() ||
  `gst-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const money = value => value == null ? 'Not verified' : new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(value) || 0);
const errorText = cause => {
  const d = cause?.response?.data || cause?.data;
  if (typeof d?.detail === 'string') return d.detail;
  if (typeof d?.message === 'string') return d.message;
  if (d && typeof d === 'object') {
    const first = Object.values(d).find(Boolean);
    if (typeof first === 'string') return first;
    if (Array.isArray(first) && first[0]) return String(first[0]);
  }
  return cause?.message || 'GST review could not be saved.';
};
const signedTax = row =>
  ['cgst', 'sgst', 'igst'].reduce((total, head) => total + (Number(row?.[head]) || 0), 0);

export default function GSTPart15Workspace({ tab, period, report, onChanged }) {
  const access = useFeatureAccess();
  const canReview = access.can('gstr.reconcile');
  const [batches, setBatches] = useState([]);
  const [credits, setCredits] = useState([]);
  const [creditNotes, setCreditNotes] = useState([]);
  const [taxLedger, setTaxLedger] = useState([]);
  const [filing, setFiling] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  const [itcForm, setITCForm] = useState({
    importId: '', billId: '', eligibilityReason: '',
  });
  const [creditForm, setCreditForm] = useState({
    invoiceId: '', number: '', taxable: '', reason: '',
    date: today(), requestKey: requestKey(),
  });
  const [filingForm, setFilingForm] = useState({
    status: 'Reviewed', note: '', reference: '', filedOn: '',
  });

  const load = useCallback(async () => {
    setFetching(true);
    setLoadError('');
    try {
      const params = { period };
      const [batchData, itcData, notesData, ledgerData, filingData, invoiceData] =
        await Promise.all([
          apiClient.get('/gstr/imports', { params }),
          apiClient.get('/gstr/itc', { params }),
          apiClient.get('/gstr/credit-notes', { params }),
          apiClient.get('/gstr/tax-ledger', { params }),
          apiClient.get('/gstr/filing-review', { params }),
          apiClient.get('/invoices', { params: { page_size: 200 } }).catch(() => []),
        ]);
      setBatches(list(batchData));
      setCredits(itcData || {});
      setCreditNotes(list(notesData));
      setTaxLedger(list(ledgerData?.entries));
      setFiling(filingData);
      setInvoices(list(invoiceData));
      setError('');
    } catch (cause) {
      setLoadError(errorText(cause));
      setBatches([]);
      setCredits([]);
      setCreditNotes([]);
      setTaxLedger([]);
      setFiling(null);
      setInvoices([]);
    } finally { setFetching(false); }
  }, [period]);

  useEffect(() => {
    if (['itc', 'credits', 'ledger', 'exports'].includes(tab)) load();
  }, [load, tab, version]);
  const batch = batches.find(row => row.id === itcForm.importId);
  const eligibleBills = useMemo(() => (batch?.matchedBills || []).filter(row =>
    ['Y', 'YES'].includes(String(row.itcAvailableOnPortal || '').toUpperCase()) &&
    !(credits?.claims || []).some(claim => claim.billId === row.billId),
  ), [batch, credits]);
  const eligibleInvoices = useMemo(() => {
    const collection = [...(report?.gstr1?.rows || []), ...invoices];
    const ids = new Set();
    return collection.filter(row => {
      const id = row.id;
      if (!id || ids.has(id)) return false;
      ids.add(id);
      const kind = row.kind;
      const invoiceType = row.invoice_type || row.invoiceType;
      const status = row.status;
      return (kind == null || kind === 'invoice') &&
        (invoiceType == null || invoiceType === 'gst') &&
        status !== 'Draft' && status !== 'Cancelled' &&
        (row.finalized_at || row.finalizedAt || row.taxable != null);
    }).slice(0, 200);
  }, [report, invoices]);

  const save = async (action, done) => {
    if (saving || !canReview) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await action();
      done();
      await load();
      onChanged?.();
    } catch (cause) { setError(errorText(cause)); }
    finally { setSaving(false); }
  };
  const approve = event => {
    event.preventDefault();
    if (!itcForm.billId || !itcForm.importId || itcForm.eligibilityReason.trim().length < 20) {
      setError('Select a saved official match and document a detailed eligibility review.'); return;
    }
    save(() => apiClient.post('/gstr/itc', {
      ...itcForm, period, eligibilityReason: itcForm.eligibilityReason.trim(),
    }), () => {
      setITCForm({ importId: '', billId: '', eligibilityReason: '' });
      setMessage('Internally approved ITC recorded once against this supplier bill.');
    });
  };
  const credit = event => {
    event.preventDefault();
    if (!creditForm.invoiceId || !/^(?:\d+)(?:\.\d{1,2})?$/.test(creditForm.taxable) ||
      Number(creditForm.taxable) <= 0 || creditForm.reason.trim().length < 15) {
      setError('Select a finalized GST invoice and enter valid taxable amount and reason.'); return;
    }
    save(() => apiClient.post('/gstr/credit-notes', {
      ...creditForm, reason: creditForm.reason.trim(),
    }), () => {
      setCreditForm({ invoiceId: '', number: '', taxable: '', reason: '',
        date: today(), requestKey: requestKey() });
      setMessage('Sales GST credit note posted for preparation, without issuing a customer refund.');
    });
  };
  const review = event => {
    event.preventDefault();
    if (filingForm.note.trim().length < 15 ||
      (filingForm.status === 'Reported Filed' &&
        (!filingForm.reference.trim() || !filingForm.filedOn))) {
      setError('Provide a review note and, when reporting filing, portal acknowledgment and date.');
      return;
    }
    save(() => apiClient.post('/gstr/filing-review', {
      ...filingForm, note: filingForm.note.trim(),
    }, { params: { period } }), () => {
      setMessage('Filing evidence recorded internally. GST Portal verification is not connected.');
    });
  };

  return <section className="gstr15-workspace" aria-label="GST compliance decisions">
    <div className="gstr15-heading">
      <div><h2>{
        tab === 'itc' ? 'Input Tax Credit (ITC) Review' :
        tab === 'credits' ? 'Sales GST Credit Notes' :
        tab === 'ledger' ? 'GST Tax Ledger' : 'Internal Filing Review'
      }</h2><p>Review workshop tax evidence. Saving here never files a GST return on the portal.</p></div>
      <button type="button" onClick={() => setVersion(v => v + 1)}
        disabled={fetching || saving}><RefreshCw size={16}/> Refresh</button>
    </div>
    {(error || loadError) && <div className="gstr15-error" role="alert">
      <span>{loadError || error}</span>
      {loadError && <button type="button" onClick={() => setVersion(v => v + 1)} disabled={fetching}>Retry</button>}
    </div>}
    {message && <p className="gstr15-success" role="status">{message}</p>}
    {fetching && <p className="gstr15-loading" role="status">Loading reviewed GST records…</p>}
    {!fetching && !loadError && <>

    {tab === 'itc' && <>
      <p className="gstr15-note">Step 1: select saved GSTR-2B match evidence with source ITC availability confirmed. Step 2: choose a matching supplier bill. Step 3: document the independent ITC eligibility review before approving. A match alone is not legal eligibility.</p>
      <div className="gstr15-stats">
        <div><span>Saved 2B Imports</span><strong>{batches.length}</strong></div>
        <div><span>Approved ITC</span><strong>{money(report?.overview?.eligibleITC)}</strong></div>
        <div><span>ITC Reversals</span><strong>{money(report?.overview?.reversedITC)}</strong></div>
      </div>
      {canReview && <form className="gstr15-form" onSubmit={approve}>
        <h3><BookCheck size={17}/> Review &amp; Approve ITC</h3>
        <label>Saved GSTR-2B reconciliation<select required disabled={saving}
          value={itcForm.importId} onChange={e => setITCForm(v => ({
            ...v, importId: e.target.value, billId: '',
          }))}>
          <option value="">Select 2B upload</option>
          {batches.map(row => <option key={row.id} value={row.id}>
            {row.importedAt?.slice(0, 10)} · {row.matchedCount} matched invoices
          </option>)}
        </select></label>
        {batch?.unsupportedSections?.length > 0 && <p className="gstr15-note">
          Unsupported 2B sections: {batch.unsupportedSections.join(', ')}. Review independently.
        </p>}
        <label>Matched supplier purchase<select required disabled={saving}
          value={itcForm.billId} onChange={e => setITCForm(v => ({
            ...v, billId: e.target.value,
          }))}>
          <option value="">Choose a matched invoice marked ITC available</option>
          {eligibleBills.map(row => <option key={row.billId} value={row.billId}>
            {row.number} · {row.supplierGSTIN} · {money(signedTax(row))}
          </option>)}
        </select></label>
        <label>Why is this input tax credit eligible? (review notes)
          <textarea required rows={3} minLength={20} maxLength={500}
            placeholder="Verify business use, tax document, eligibility restrictions and supplier compliance"
            disabled={saving} value={itcForm.eligibilityReason}
            onChange={e => setITCForm(v => ({ ...v, eligibilityReason: e.target.value }))}/>
        </label>
        <button type="submit" disabled={saving || !eligibleBills.length}>
          {saving ? 'Recording…' : 'Approve Internal ITC'}
        </button>
      </form>}
      <h3>Approved Purchase Credits</h3>
      <div className="gstr15-table"><table><thead><tr><th>Purchase Invoice</th>
        <th>Period</th><th>CGST</th><th>SGST/UTGST</th><th>IGST</th></tr></thead>
        <tbody>{(credits?.claims || []).length ? credits.claims.map(row =>
          <tr key={row.id}><td>{row.invoiceNumber}</td><td>{row.period}</td>
            <td>{money(row.cgst)}</td><td>{money(row.sgst)}</td><td>{money(row.igst)}</td></tr>)
          : <tr><td colSpan={5}>No internally approved ITC for this period.</td></tr>}</tbody>
      </table></div>
      <h3>Purchase Return ITC Reversals</h3>
      <div className="gstr15-table"><table><thead><tr><th>Debit Note</th><th>CGST</th>
        <th>SGST/UTGST</th><th>IGST</th></tr></thead>
        <tbody>{(credits?.reversals || []).length ? credits.reversals.map(row =>
          <tr key={row.id}><td>{row.debitNoteNumber}</td><td>{money(row.cgst)}</td>
            <td>{money(row.sgst)}</td><td>{money(row.igst)}</td></tr>) :
          <tr><td colSpan={4}>No ITC reversals in this period.</td></tr>}</tbody>
      </table></div>
    </>}

    {tab === 'credits' && <>
      <p className="gstr15-note">Credit notes use the original finalized GST invoice tax heads. Recording one here does not cancel an invoice, return inventory, or transfer money to the customer.</p>
      {canReview && <form className="gstr15-form" onSubmit={credit}>
        <h3><FileMinus2 size={17}/> Add Sales GST Credit Note</h3>
        <div className="gstr15-grid">
          <label>Original GST invoice<select required value={creditForm.invoiceId} disabled={saving}
            onChange={e => setCreditForm(v => ({ ...v, invoiceId: e.target.value }))}>
            <option value="">Select finalized invoice</option>
            {eligibleInvoices.map(row =>
              <option key={row.id} value={row.id}>
                {row.number} · Taxable {money(row.taxable)}
              </option>)}
          </select></label>
          <label>Credit Note Number<input required maxLength={100} disabled={saving}
            value={creditForm.number}
            onChange={e => setCreditForm(v => ({ ...v, number: e.target.value }))}/></label>
          <label>Credit note date<input required type="date" disabled={saving}
            value={creditForm.date} onChange={e => setCreditForm(v => ({
              ...v, date: e.target.value,
            }))}/></label>
          <label>Taxable Amount to Credit (₹)<input required inputMode="decimal" disabled={saving}
            value={creditForm.taxable} onChange={e => setCreditForm(v => ({
              ...v, taxable: e.target.value,
            }))}/></label>
          <label className="gstr15-wide">Reason for Credit Note<input required minLength={15} maxLength={500}
            disabled={saving} value={creditForm.reason}
            onChange={e => setCreditForm(v => ({ ...v, reason: e.target.value }))}/></label>
        </div>
        <button type="submit" disabled={saving || !eligibleInvoices.length}>
          {saving ? 'Saving…' : 'Post GST Credit Note'}
        </button>
      </form>}
      <h3>Recorded Outward Credit Notes</h3>
      <div className="gstr15-table"><table><thead><tr><th>Credit Note</th><th>Invoice</th>
        <th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th></tr></thead>
        <tbody>{creditNotes.length ? creditNotes.map(row =>
          <tr key={row.id}><td>{row.number}<small>{row.date}</small></td>
            <td>{row.invoiceNumber}</td><td>{money(row.taxable)}</td>
            <td>{money(row.cgst)}</td><td>{money(row.sgst)}</td>
            <td>{money(row.igst)}</td></tr>) :
          <tr><td colSpan={6}>No credit notes in this return period.</td></tr>}</tbody>
      </table></div>
    </>}

    {tab === 'ledger' && <>
      <p className="gstr15-note">Positive amounts show tax on recorded sales; negative amounts show tax reductions from credit notes. Approved ITC and reversals are listed separately. This is not the official GST Portal electronic ledger.</p>
      <div className="gstr15-table"><table><thead><tr><th>Date</th><th>Source</th><th>Number</th>
        <th>Category</th><th>CGST</th><th>SGST/UTGST</th><th>IGST</th></tr></thead>
        <tbody>{taxLedger.length ? taxLedger.map((row, i) =>
          <tr key={row.sourceId + ':' + i}><td>{row.date}</td><td>{row.type}</td>
            <td>{row.number}</td><td>{row.claimCategory}</td><td>{money(row.cgst)}</td>
            <td>{money(row.sgst)}</td><td>{money(row.igst)}</td></tr>) :
          <tr><td colSpan={7}>No GST tax-head activity for this month.</td></tr>}</tbody>
      </table></div>
    </>}

    {tab === 'exports' && <div className="gstr15-form">
      <h3><FileCheck2 size={17}/> Record Internal Filing Evidence</h3>
      <p className="gstr15-note">Internal review status: {filing?.status || 'Not Reviewed'}. This status does not independently confirm a GST Portal submission.</p>
      {canReview && filing?.status !== 'Reported Filed' && <form className="gstr15-filing" onSubmit={review}>
        <label>Review status<select value={filingForm.status} disabled={saving}
          onChange={e => setFilingForm(v => ({ ...v, status: e.target.value }))}>
          <option value="Reviewed">Reviewed</option>
          <option value="Reported Filed">Reported Filed (unverified)</option>
        </select></label>
        {filingForm.status === 'Reported Filed' && <div className="gstr15-grid">
          <label>GST Portal acknowledgment / reference<input required maxLength={120} disabled={saving}
            value={filingForm.reference}
            onChange={e => setFilingForm(v => ({ ...v, reference: e.target.value }))}/></label>
          <label>Actual filing date<input required type="date" disabled={saving}
            value={filingForm.filedOn}
            onChange={e => setFilingForm(v => ({ ...v, filedOn: e.target.value }))}/></label>
        </div>}
        <label>Review Notes &amp; Evidence<textarea required rows={3} minLength={15}
          maxLength={1000} disabled={saving} value={filingForm.note}
          onChange={e => setFilingForm(v => ({ ...v, note: e.target.value }))}/></label>
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record Internal Review'}</button>
      </form>}
      {filing?.reference && <p>Recorded acknowledgment: {filing.reference} · {filing.filedOn}</p>}
      <p className="gstr15-note">To file a GST return, sign in separately to the official GST Portal and complete its verification and submission steps. This app does not confirm the electronic credit ledger or portal filing.</p>
    </div>}
    </>}
  </section>;
}
