import { useEffect, useMemo, useRef, useState } from 'react';
import { supplierFinanceService } from '../../services/supplierFinance.service';
import { stockCatalogService } from '../../services/stockCatalog.service';
import { invoiceLineTaxChoices, invoiceTotalRateFromChoice, invoiceChoiceFromTotalRate } from '../../utils/invoiceTaxUi';
import '../../styles/supplier-purchase-flow.css';

const rupees = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));
const n = value => Number(value) || 0;
const fixed = value => (Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2);
const localDate = () => {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
};
const requestKey = () => globalThis.crypto?.randomUUID?.() ||
  ('PUR-' + Date.now() + '-' + Math.random().toString(36).slice(2));
const purchaseReference = () => 'CG-PUR-' + localDate().replaceAll('-', '') + '-' +
  String(Date.now()).slice(-7) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

const emptyPart = () => ({
  itemId: '', description: '', partNumber: '', hsnCode: '', quantity: '1',
  purchaseRate: '', sellingPrice: '', gstChoice: 'none',
  customTax: '', zeroClassification: '', updateItemPrices: false,
});
const zeroClasses = [
  ['exempt', 'Exempt'], ['nil_rated', 'Nil-rated'],
  ['zero_rated', 'Zero-rated'], ['non_gst', 'Non-GST'],
];
const choices = invoiceLineTaxChoices('unknown');
const totalRate = row => row.gstChoice === 'none' ? 0 :
  row.gstChoice === 'custom' ? n(row.customTax) : n(invoiceTotalRateFromChoice(row.gstChoice));
const accountMethod = account => account?.kind === 'Cash' ? 'Cash' :
  account?.kind === 'UPI' ? 'UPI' : 'Bank Transfer';
const getErrorText = error => {
  const data = error?.response?.data || error?.data || {};
  if (typeof data === 'string') return data;
  const reason = Object.values(data).find(value => typeof value === 'string' || Array.isArray(value));
  return (Array.isArray(reason) ? reason[0] : reason) || error?.message || 'Unable to complete supplier transaction.';
};
const fieldClass = 'cg-supplier-purchase-input';

export default function SupplierPurchaseFlow({
  supplier, initialPart = null, canPurchase = false, canPay = false,
  bills = [], onChanged = () => {},
}) {
  const [stock, setStock] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const errorRef = useRef(null);
  const prefilled = useRef('');
  const [activePart, setActivePart] = useState(emptyPart);
  const [partSearch, setPartSearch] = useState('');
  const [parts, setParts] = useState([]);
  const [step, setStep] = useState('part');
  const [savingPart, setSavingPart] = useState(false);
  const [posting, setPosting] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(localDate);
  const [purchaseOpenedAt, setPurchaseOpenedAt] = useState(() => new Date().toISOString());
  const [invoiceNumber, setInvoiceNumber] = useState(purchaseReference);
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [splits, setSplits] = useState([]);
  const [settlement, setSettlement] = useState({ amount: '', accountId: '', reference: '' });
  const [settling, setSettling] = useState(false);
  const settleKey = useRef(requestKey());

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  const reload = async () => {
    const [items, moneyAccounts, gst] = await Promise.all([
      stockCatalogService.getItems(),
      supplierFinanceService.getAccounts(),
      supplierFinanceService.getGSTOptions(),
    ]);
    setStock(items);
    setAccounts(moneyAccounts.filter(account => account.isActive && ['Cash', 'Bank', 'UPI'].includes(account.kind)));
    setStates(gst.states || []);
  };
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([stockCatalogService.getItems(), supplierFinanceService.getAccounts(),
      supplierFinanceService.getGSTOptions()])
      .then(([items, moneyAccounts, gst]) => {
        if (!alive) return;
        setStock(items);
        setAccounts(moneyAccounts.filter(a => a.isActive && ['Cash', 'Bank', 'UPI'].includes(a.kind)));
        setStates(gst.states || []);
      })
      .catch(cause => { if (alive) setError(getErrorText(cause)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [supplier.id]);

  useEffect(() => {
    if (!initialPart?.itemId || !stock.length || prefilled.current === String(initialPart.itemId)) return;
    const item = stock.find(row => String(row.id) === String(initialPart.itemId));
    if (!item) return;
    prefilled.current = String(initialPart.itemId);
    setActivePart(previous => ({
      ...previous, itemId: String(item.id), description: item.partName || item.name || '',
      partNumber: item.partNumber || '', hsnCode: item.hsnCode || '',
      quantity: String(initialPart.quantity || '1'),
      purchaseRate: String(initialPart.purchaseRate ?? item.costPrice ?? 0),
      sellingPrice: String(item.sellingPrice ?? 0),
      gstChoice: n(item.tax) === 0 ? 'none' :
        invoiceChoiceFromTotalRate(String(item.tax), 'cgst_sgst') || 'custom',
      customTax: String(item.tax || ''),
      zeroClassification: item.zeroTaxClassification || '',
    }));
    setPartSearch(item.partName || item.name || '');
    setStep('part');
    document.getElementById('supplier-purchase-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [initialPart, stock]);

  const stockOptions = useMemo(() => stock.filter(item => {
    const text = [item.partName, item.name, item.partNumber, item.sku].filter(Boolean).join(' ').toLowerCase();
    const ownSupplier = !item.supplier || String(item.supplier?.id || item.supplier) === String(supplier.id);
    return ownSupplier && text.includes(partSearch.trim().toLowerCase());
  }).slice(0, 70), [stock, partSearch, supplier.id]);

  const postedBills = useMemo(() => bills
    .filter(bill => bill.postingStatus === 'Posted' && n(bill.outstanding) > 0)
    .sort((a, b) => String(a.invoiceDate).localeCompare(String(b.invoiceDate))), [bills]);
  const remainingSupplier = postedBills.reduce((total, bill) => total + n(bill.outstanding), 0);
  const costRows = parts.map(item => {
    const sub = Math.round(n(item.quantity) * n(item.purchaseRate) * 100) / 100;
    const tax = Math.round(sub * n(item.gstRate)) / 100;
    return { ...item, subtotal: sub, tax, total: Math.round((sub + tax) * 100) / 100 };
  });
  const subtotal = costRows.reduce((sum, row) => sum + row.subtotal, 0);
  const tax = costRows.reduce((sum, row) => sum + row.tax, 0);
  const total = costRows.reduce((sum, row) => sum + row.total, 0);
  const paidNow = splits.reduce((sum, row) => sum + n(row.amount), 0);
  const remaining = Math.max(0, total - paidNow);

  const selectItem = value => {
    const item = stock.find(row => String(row.id) === String(value));
    if (value === '__new__') {
      setActivePart(emptyPart());
      setActivePart(previous => ({ ...previous, itemId: '__new__' }));
    } else if (item) {
      const rate = n(item.tax);
      const matched = invoiceChoiceFromTotalRate(String(rate), 'cgst_sgst');
      setActivePart(previous => ({
        ...previous, itemId: String(item.id),
        description: item.partName || item.name || '', partNumber: item.partNumber || '',
        hsnCode: item.hsnCode || '', purchaseRate: String(item.costPrice ?? 0),
        sellingPrice: String(item.sellingPrice ?? 0),
        gstChoice: rate === 0 ? 'none' : matched.startsWith('saved:') ? 'custom' : matched,
        customTax: String(rate), zeroClassification: item.zeroTaxClassification || '',
      }));
    } else {
      setActivePart(emptyPart());
    }
    setError('');
  };

  const addPart = async () => {
    if (savingPart) return;
    setError('');
    const part = activePart;
    const qty = Number(part.quantity);
    const cost = Number(part.purchaseRate);
    const selling = Number(part.sellingPrice);
    const rate = totalRate(part);
    if (!part.itemId || (part.itemId === '__new__' && !part.description.trim())) {
      setError('Choose an existing part or enter the new part name.'); return;
    }
    if (!Number.isFinite(qty) || qty <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(String(part.quantity))) {
      setError('Enter a valid quantity greater than zero.'); return;
    }
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(selling) || selling < 0) {
      setError('Enter valid purchase and selling prices.'); return;
    }
    if (part.gstChoice === 'custom' && (!part.customTax || rate < 0 || rate > 100)) {
      setError('Enter a valid HSN-specific total GST percentage.'); return;
    }
    if (rate === 0 && !part.zeroClassification) {
      setError('Choose why this product has 0% GST.'); return;
    }
    if (parts.some(row => row.itemId === part.itemId && row.itemId !== '__new__')) {
      setError('This part is already in the purchase. Edit the quantity in the list instead.'); return;
    }
    if (part.itemId === '__new__' && stock.some(item =>
      String(item.partName || item.name || '').trim().toLowerCase() === part.description.trim().toLowerCase() &&
      (!item.supplier || String(item.supplier?.id || item.supplier) === String(supplier.id))
    )) {
      setError('A product with this name already exists. Search and select it instead of creating a duplicate.');
      return;
    }
    setSavingPart(true);
    try {
      let itemId = part.itemId;
      if (itemId === '__new__') {
        // Create catalog metadata only. No stock, payable or money entry is posted here.
        const created = await stockCatalogService.createItem({
          partName: part.description.trim(), partNumber: part.partNumber.trim(),
          hsnCode: part.hsnCode.trim(), supplier: supplier.id,
          stockQuantity: 0, onHand: 0, costPrice: cost, sellingPrice: selling,
          tax: rate, zeroTaxClassification: rate === 0 ? part.zeroClassification : '',
          unit: 'Piece', minimumStock: 0,
        });
        if (!created?.id) throw new Error('Part creation did not return an ID.');
        itemId = String(created.id);
        await reload();
      }
      setParts(rows => [...rows, {
        itemId, description: part.description, quantity: fixed(qty),
        purchaseRate: fixed(cost), sellingPrice: fixed(selling),
        gstRate: String(rate), gstChoice: part.gstChoice,
        gstTreatment: rate === 0 ? part.zeroClassification : 'taxable',
        updateItemPrices: part.updateItemPrices && part.itemId !== '__new__',
      }]);
      setActivePart(emptyPart());
      setPartSearch('');
      setStep('review');
    } catch (cause) { setError(getErrorText(cause)); }
    finally { setSavingPart(false); }
  };

  const changeSplit = (index, changes) => setSplits(rows => rows.map((row, i) => i === index ? { ...row, ...changes } : row));

  const finishPurchase = async () => {
    if (posting || parts.length === 0) return;
    setError('');
    if (!invoiceNumber.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      setError('A valid purchase reference and date are required.'); return;
    }
    const positiveGst = parts.some(row => n(row.gstRate) > 0);
    if (!placeOfSupply) {
      setError('Choose the workshop / buyer Place of Supply for the purchase GST record.'); return;
    }
    if (positiveGst && !String(supplier.gstNo || supplier.gstin || '').trim()) {
      setError('For GST purchases, select Place of Supply and verify the Supplier GSTIN.'); return;
    }
    const supplierState = String(supplier.gstNo || supplier.gstin || '').slice(0, 2);
    if (positiveGst && !/^\d{2}$/.test(supplierState)) {
      setError('Supplier GSTIN does not contain a valid state code. Verify Supplier Details.'); return;
    }
    if (positiveGst && parts.some(row =>
      (['cgst', 'sgst'].includes(row.gstChoice.split(':')[0]) && placeOfSupply !== supplierState) ||
      (row.gstChoice.startsWith('igst:') && placeOfSupply === supplierState)
    )) {
      setError('GST component does not match the Supplier State and Place of Supply. ' +
        'Use CGST/SGST for same-state purchases or IGST for interstate purchases.');
      return;
    }
    if (splits.length > 5 || paidNow > total + 0.001) {
      setError('Paid amount cannot exceed the purchase total.'); return;
    }
    const accountTotals = new Map();
    for (const row of splits) {
      const account = accounts.find(a => String(a.id) === row.accountId);
      if (!account || !Number.isFinite(Number(row.amount)) ||
        n(row.amount) <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(String(row.amount))) {
        setError('Every Cash/Bank split needs a valid account and amount.'); return;
      }
      accountTotals.set(row.accountId, n(row.amount) + (accountTotals.get(row.accountId) || 0));
    }
    for (const [id, value] of accountTotals.entries()) {
      const account = accounts.find(a => String(a.id) === id);
      if (n(account.recordedBalance) + 0.0001 < value) {
        setError('Insufficient recorded balance in ' + account.name + '.'); return;
      }
    }
    setPosting(true);
    try {
      await supplierFinanceService.createBill({
        supplierId: String(supplier.id), invoiceNumber: invoiceNumber.trim(),
        invoiceDate: purchaseDate, placeOfSupply: placeOfSupply || undefined,
        receiveIntoStock: true, postNow: true,
        items: parts.map(row => ({
          itemId: row.itemId, description: row.description,
          quantity: row.quantity, purchaseRate: row.purchaseRate, gstRate: row.gstRate,
          gstTreatment: row.gstTreatment,
          ...(row.updateItemPrices
            ? { updateItemPrices: true, sellingPrice: row.sellingPrice }
            : {}),
        })),
        ...(splits.length ? {
          payments: splits.map(row => {
            const account = accounts.find(a => String(a.id) === row.accountId);
            return {
              accountId: row.accountId, amount: fixed(row.amount),
              paidOn: purchaseDate, method: accountMethod(account),
              kind: 'Payment', reference: row.reference.trim(),
              idempotencyKey: row.id,
            };
          }),
        } : {}),
      });
      setParts([]); setSplits([]); setStep('part');
      setInvoiceNumber(purchaseReference()); setPurchaseDate(localDate());
      setPurchaseOpenedAt(new Date().toISOString());
      setPlaceOfSupply(''); setActivePart(emptyPart());
      await Promise.resolve(onChanged());
    } catch (cause) { setError(getErrorText(cause)); }
    finally { setPosting(false); }
  };

  const settleExisting = async event => {
    event.preventDefault();
    if (settling) return;
    setError('');
    const amount = Number(settlement.amount);
    const account = accounts.find(a => String(a.id) === String(settlement.accountId));
    if (!account || !Number.isFinite(amount) || amount <= 0 ||
      !/^\d+(?:\.\d{1,2})?$/.test(String(settlement.amount)) ||
      amount > remainingSupplier + 0.001) {
      setError('Select an account and amount within the outstanding supplier credit.'); return;
    }
    if (amount > n(account.recordedBalance) + 0.001) {
      setError('Insufficient recorded account balance.'); return;
    }
    let toAllocate = Math.round(amount * 100);
    const allocations = [];
    for (const bill of postedBills) {
      const applied = Math.min(toAllocate, Math.round(n(bill.outstanding) * 100));
      if (applied > 0) allocations.push({ billId: bill.id, amount: (applied / 100).toFixed(2) });
      toAllocate -= applied;
    }
    if (toAllocate > 0) {
      setError('Payment exceeds the remaining unpaid supplier bills.'); return;
    }
    setSettling(true);
    try {
      await supplierFinanceService.recordPayment({
        supplierId: supplier.id, accountId: account.id, amount: fixed(amount),
        kind: 'Payment', method: accountMethod(account),
        paidOn: localDate(), reference: settlement.reference.trim(),
        allocations, idempotencyKey: settleKey.current,
      });
      settleKey.current = requestKey();
      setSettlement({ amount: '', accountId: '', reference: '' });
      await Promise.resolve(onChanged());
      await reload();
    } catch (cause) { setError(getErrorText(cause)); }
    finally { setSettling(false); }
  };

  return (
    <div className="cg-supplier-purchase-wrap">
      {error && <p ref={errorRef} className="cg-supplier-purchase-error" role="alert">{error}</p>}
      {canPurchase && (
        <section id="supplier-purchase-form" className="cg-supplier-purchase-card">
          <header>
            <div><h2>Buy / Receive Spare Parts</h2>
              <p>One product at a time. Add another, or finish on this Supplier page.</p></div>
            <span className="cg-supplier-purchase-tag">Supplier: {supplier.name}</span>
          </header>
          <div className="cg-supplier-purchase-clock">
            <span>Purchase date: <strong>{purchaseDate}</strong></span>
            <span>Started: <strong>{new Date(purchaseOpenedAt).toLocaleString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}</strong></span>
            <span>Posting timestamp is recorded automatically on confirmation.</span>
          </div>
          {loading && <p role="status">Loading inventory and accounts…</p>}
          {!loading && step === 'part' && (
            <div className="cg-supplier-purchase-grid">
              <label className="wide">Find an existing product
                <input className={fieldClass} type="search" value={partSearch} onChange={e => setPartSearch(e.target.value)}
                  placeholder="Search paint, brush, part number or SKU" />
              </label>
              <label className="wide">Product *
                <select className={fieldClass} value={activePart.itemId} onChange={e => selectItem(e.target.value)}>
                  <option value="">Choose product</option>
                  {stockOptions.map(item => <option key={item.id} value={String(item.id)}>
                    {item.partName || item.name} — Stock {item.onHand ?? 0}
                  </option>)}
                  <option value="__new__">+ Create New Product</option>
                </select>
              </label>
              {activePart.itemId === '__new__' && <>
                <label>New product name *
                  <input className={fieldClass} value={activePart.description}
                    onChange={e => setActivePart(p => ({ ...p, description: e.target.value }))}/>
                </label>
                <label>Part number
                  <input className={fieldClass} value={activePart.partNumber}
                    onChange={e => setActivePart(p => ({ ...p, partNumber: e.target.value }))}/>
                </label>
                <label>HSN / SAC
                  <input className={fieldClass} value={activePart.hsnCode}
                    onChange={e => setActivePart(p => ({ ...p, hsnCode: e.target.value }))}/>
                </label>
              </>}
              <label>Quantity *
                <input className={fieldClass} type="number" min="0.01" step="0.01" inputMode="decimal"
                  value={activePart.quantity} onChange={e => setActivePart(p => ({ ...p, quantity: e.target.value }))}/>
              </label>
              <label>Purchase price / unit (₹) *
                <input className={fieldClass} type="number" min="0" step="0.01" inputMode="decimal"
                  value={activePart.purchaseRate} onChange={e => setActivePart(p => ({ ...p, purchaseRate: e.target.value }))}/>
              </label>
              <label>Selling price / unit (₹) *
                <input className={fieldClass} type="number" min="0" step="0.01" inputMode="decimal"
                  value={activePart.sellingPrice} onChange={e => setActivePart(p => ({ ...p, sellingPrice: e.target.value }))}/>
              </label>
              <label>GST / Tax for this product *
                <select className={fieldClass} value={activePart.gstChoice}
                  onChange={e => setActivePart(p => ({ ...p, gstChoice: e.target.value }))}>
                  <option value="none">0% — Select Classification</option>
                  {choices.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  <option value="custom">Other saved / HSN-specific total %</option>
                </select>
              </label>
              {activePart.gstChoice === 'custom' &&
                <label>Custom total GST (%) *
                  <input className={fieldClass} type="number" min="0" max="100" step="0.01"
                    value={activePart.customTax} onChange={e => setActivePart(p => ({ ...p, customTax: e.target.value }))}/>
                </label>}
              {totalRate(activePart) === 0 &&
                <label>0% classification *
                  <select className={fieldClass} value={activePart.zeroClassification}
                    onChange={e => setActivePart(p => ({ ...p, zeroClassification: e.target.value }))}>
                    <option value="">Choose classification</option>
                    {zeroClasses.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </label>}
              {activePart.itemId && activePart.itemId !== '__new__' &&
                <label className="wide cg-supplier-purchase-checkbox">
                  <input type="checkbox" checked={activePart.updateItemPrices}
                    onChange={e => setActivePart(p => ({ ...p, updateItemPrices: e.target.checked }))}/>
                  Update catalogue purchase/selling prices for this item when posted (existing invoices stay unchanged)
                </label>}
              <p className="wide cg-supplier-purchase-muted">
                GST selected: {totalRate(activePart)}% total. The server determines CGST + SGST/UTGST or IGST
                using the verified Supplier GSTIN and Place of Supply.
              </p>
              <div className="wide cg-supplier-purchase-actions">
                <button type="button" className="primary" disabled={savingPart}
                  onClick={addPart}>{savingPart ? 'Saving part…' : 'Add This Product'}</button>
                {parts.length > 0 && <button type="button" onClick={() => setStep('review')}>Finish Adding Products</button>}
              </div>
            </div>
          )}
          {parts.length > 0 && (
            <div className="cg-supplier-purchase-lines">
              <h3>Purchase Products ({parts.length})</h3>
              {costRows.map((row, index) => (
                <div className="cg-supplier-purchase-line" key={row.itemId}>
                  <div><strong>{row.description}</strong>
                    <small>{row.quantity} × {rupees(row.purchaseRate)} · GST {row.gstRate}%</small>
                    <small>Selling price: {rupees(row.sellingPrice)} / unit</small>
                  </div>
                  <strong>{rupees(row.total)}</strong>
                  <button type="button" onClick={() => setParts(existing => existing.filter((_, i) => i !== index))}
                    disabled={posting} aria-label={'Remove ' + row.description}>Remove</button>
                </div>
              ))}
            </div>
          )}
          {!loading && step === 'review' && (
            <div className="cg-supplier-purchase-review">
              <div className="cg-supplier-purchase-actions">
                <button type="button" onClick={() => setStep('part')}>+ Add Another Product</button>
                <button type="button" onClick={() => { setParts([]); setSplits([]); setStep('part'); }}>Cancel Purchase</button>
              </div>
              {parts.length > 0 && <>
                <div className="cg-supplier-purchase-grid">
                  <label>Supplier Invoice / Purchase Reference *
                    <input className={fieldClass} value={invoiceNumber}
                      onChange={e => setInvoiceNumber(e.target.value)} maxLength={100}/>
                  </label>
                  <label>Purchase date (automatic)
                    <input className={fieldClass} type="date" readOnly value={purchaseDate}/>
                  </label>
                  <label>Place of Supply (GST verification)
                    <select className={fieldClass} value={placeOfSupply}
                      onChange={e => setPlaceOfSupply(e.target.value)}>
                      <option value="">Choose buyer / workshop state</option>
                      {states.map(row => <option key={row.code} value={row.code}>{row.code} — {row.name}</option>)}
                    </select>
                  </label>
                </div>
                <div className="cg-supplier-purchase-total">
                  <div><span>Parts subtotal</span><strong>{rupees(subtotal)}</strong></div>
                  <div><span>GST</span><strong>{rupees(tax)}</strong></div>
                  <div><span>Purchase Total</span><strong>{rupees(total)}</strong></div>
                  <div><span>Pay Now</span><strong>{rupees(paidNow)}</strong></div>
                  <div><span>Supplier Credit (Due)</span><strong>{rupees(remaining)}</strong></div>
                </div>
                <h3>How are you paying the supplier?</h3>
                <p className="cg-supplier-purchase-muted">No payment = full credit. Add Cash, Bank or UPI payments below. Multiple accounts are supported.</p>
                {splits.map((row, index) => (
                  <div className="cg-supplier-purchase-split" key={row.id}>
                    <label>Payment account
                      <select className={fieldClass} value={row.accountId}
                        onChange={e => changeSplit(index, { accountId: e.target.value })}>
                        <option value="">Select account</option>
                        {accounts.map(account => <option key={account.id} value={account.id}>
                          {account.name} ({account.kind}) · {rupees(account.recordedBalance)}
                        </option>)}
                      </select>
                    </label>
                    <label>Amount (₹)
                      <input className={fieldClass} type="number" min="0.01" step="0.01"
                        value={row.amount} onChange={e => changeSplit(index, { amount: e.target.value })}/>
                    </label>
                    <label>Reference (optional)
                      <input className={fieldClass} maxLength={120} value={row.reference}
                        onChange={e => changeSplit(index, { reference: e.target.value })}/>
                    </label>
                    <button type="button" onClick={() => setSplits(old => old.filter((_, i) => i !== index))}>Remove</button>
                  </div>
                ))}
                <div className="cg-supplier-purchase-actions">
                  <button type="button" disabled={splits.length >= 5}
                    onClick={() => setSplits(existing => [...existing, { id: requestKey(), accountId: '', amount: '', reference: '' }])}>
                    + Add Cash / Bank / UPI Payment
                  </button>
                  <button type="button" className="primary" disabled={posting || parts.length === 0}
                    onClick={finishPurchase}>
                    {posting ? 'Posting…' : 'Confirm Purchase & Payment'}
                  </button>
                </div>
                <p className="cg-supplier-purchase-muted">
                  Confirm posts stock, supplier bill, payment splits and remaining credit together.
                  Do not enter the same supplier purchase again under Expenses or generic Payments.
                </p>
              </>}
            </div>
          )}
        </section>
      )}

      {canPay && (
        <section id="supplier-pay-now" className="cg-supplier-purchase-card">
          <header><div><h2>Pay Previous Supplier Credit</h2>
            <p>One payment can clear several unpaid purchase bills, oldest first.</p></div>
            <strong>{rupees(remainingSupplier)} due</strong>
          </header>
          {!postedBills.length
            ? <p className="cg-supplier-purchase-muted">No pending supplier bills.</p>
            : <form className="cg-supplier-purchase-grid" onSubmit={settleExisting}>
              <label>Pay amount (₹) *
                <input className={fieldClass} type="number" min="0.01" max={fixed(remainingSupplier)} step="0.01"
                  value={settlement.amount} onChange={e => setSettlement(old => ({ ...old, amount: e.target.value }))}/>
              </label>
              <label>Cash / Bank / UPI account *
                <select className={fieldClass} value={settlement.accountId}
                  onChange={e => setSettlement(old => ({ ...old, accountId: e.target.value }))}>
                  <option value="">Select account</option>
                  {accounts.map(account => <option key={account.id} value={account.id}>
                    {account.name} ({account.kind}) · {rupees(account.recordedBalance)}
                  </option>)}
                </select>
              </label>
              <label className="wide">Payment reference (optional)
                <input className={fieldClass} value={settlement.reference} maxLength={120}
                  onChange={e => setSettlement(old => ({ ...old, reference: e.target.value }))}/>
              </label>
              <p className="wide cg-supplier-purchase-muted">
                This settles existing posted supplier bills only; no second stock receipt or expense will be created.
                Remaining credit after this payment: {rupees(Math.max(0, remainingSupplier - n(settlement.amount)))}
              </p>
              <div className="wide cg-supplier-purchase-actions">
                <button type="submit" className="primary" disabled={settling || !settlement.amount || !settlement.accountId}>
                  {settling ? 'Recording…' : 'Confirm Supplier Payment'}
                </button>
              </div>
            </form>}
        </section>
      )}
    </div>
  );
}
