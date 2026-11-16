import { recordLabel } from '../../utils/recordReferences';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CreditCard, Plus, RefreshCw, Wallet } from 'lucide-react';
import { supplierFinanceService as finance } from '../../services/supplierFinance.service';
import { SupplierSectionTabs } from '../../components/suppliers/SupplierSectionTabs';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { supplierComponentChoices, previewManualPurchaseTax } from '../../utils/manualGstComponents';
import '../../styles/supplier-finance-polish.css';

const field = 'w-full min-w-0 min-h-12 rounded-[10px] border border-line bg-surface px-3 py-2 text-base text-content outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60';
const secondary = 'min-h-11 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-content disabled:opacity-50';
const primary = 'min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const box = 'cg-supplier-finance-card';
const today = () => new Date().toLocaleDateString('en-CA');
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value || 0));
const num = value => { const amount = Number(value); return Number.isFinite(amount) ? amount : 0; };
const line = () => ({ itemId: '', description: '', quantity: '1', purchaseRate: '', gstRate: '0', taxComponents: [], gstTreatment: '', zeroRatingBasis: '' });
const paymentKey = () => globalThis.crypto?.randomUUID?.() || ('PAY-' + Date.now() + '-' + Math.random().toString(36).slice(2));

export default function SupplierFinancePage({ section = '' }) {
  const supplierSection = section === 'credits' || section === 'payments';
  const access = useFeatureAccess();
  const canPay = access.can('payments.create');
  const canPost = canPay && access.can('stock.edit');
  const canCreateBill = canPay && access.can('stock.create');
  const canCreateSupplier = access.can('stock.create');
  const paymentFormRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [gstOptions, setGSTOptions] = useState({ states: [], rates: [] });
  const [selectedSupplier, setSelectedSupplier] = useState(() => searchParams.get('supplier') || '');
  const [summary, setSummary] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const supplierRequest = useRef(0);
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paymentErrors, setPaymentErrors] = useState({});
  const [creditSearch, setCreditSearch] = useState('');
  const [creditStatus, setCreditStatus] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [supplierDraft, setSupplierDraft] = useState({ name: '', phone: '', gstNo: '', address: '' });
  const [accountDraft, setAccountDraft] = useState({ name: '', kind: 'Cash', openingBalance: '0' });
  const [draft, setDraft] = useState({
    invoiceNumber: '', invoiceDate: today(), dueDate: '', placeOfSupply: '', receiveIntoStock: false,
    lines: [line()],
  });
  const [purchasePayment, setPurchasePayment] = useState({
    mode: 'Credit', amount: '', accountId: '', method: 'Cash', reference: '', lineAmounts: {},
  });
  const [paymentPopupBill, setPaymentPopupBill] = useState(null);
  const [paymentPopupError, setPaymentPopupError] = useState('');
  const [paymentDraft, setPaymentDraft] = useState({
    kind: 'Payment', accountId: '', method: 'Bank Transfer', amount: '',
    paidOn: today(), reference: '', allocations: {}, lineAllocations: {},
  });
  const [applyDraft, setApplyDraft] = useState({ paymentId: '', billId: '', amount: '' });
  const [activeTab, setActiveTab] = useState(() => {
    if (section === 'payments') return 'payment';
    if (section === 'credits') return 'overview';
    const requested = searchParams.get('tab');
    return ['overview', 'bill', 'payment', 'accounts'].includes(requested) ? requested : 'overview';
  });
  // React Router can retain a mounted page while its supplier section changes.
  useEffect(() => {
    if (section === 'credits') setActiveTab('overview');
    if (section === 'payments') setActiveTab('payment');
  }, [section]);

  const requestKey = useRef(paymentKey());
  const purchaseRequestKey = useRef(paymentKey());
  const inFlight = useRef(false);

  const refresh = useCallback(async (supplierId = selectedSupplier) => {
    const token = ++supplierRequest.current;
    setSupplierLoading(true);
    setSummary(null);
    setLedger(null);
    try {
      // All authoritative amounts come from the Django procurement API.
      // A failed endpoint is an error, never an empty or zero-valued ledger.
      const [supplierData, accountData, billData, paymentData, productData] = await Promise.all([
        finance.getSuppliers(), finance.getAccounts(), finance.getBills(),
        finance.getPayments(), finance.getInventoryItems(),
      ]);
      if (token !== supplierRequest.current) return;
      setSuppliers(supplierData);
      setAccounts(accountData);
      setBills(billData);
      setPayments(paymentData);
      setInventory(productData);
      const target = supplierData.some(row => String(row.id) === String(supplierId))
        ? supplierId : supplierData[0]?.id || '';
      setSelectedSupplier(target);
      setPaymentDraft(old => ({ ...old, accountId: old.accountId || accountData[0]?.id || '' }));
      setPurchasePayment(old => ({
        ...old, accountId: old.accountId || accountData[0]?.id || '',
        method: old.accountId ? old.method : (accountData[0]?.kind === 'Cash' ? 'Cash' : accountData[0]?.kind === 'UPI' ? 'UPI' : 'Bank Transfer'),
      }));
      if (target) {
        const [details, activity] = await Promise.all([
          finance.getSupplierSummary(target), finance.getSupplierLedger(target),
        ]);
        if (token !== supplierRequest.current) return;
        setSummary(details);
        setLedger(activity);
      }
    } finally {
      if (token === supplierRequest.current) setSupplierLoading(false);
    }
  }, [selectedSupplier]);

  useEffect(() => {
    if (!Object.keys(paymentErrors).length) return;
    const first = paymentFormRef.current?.querySelector('[aria-invalid="true"]');
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first.focus({ preventScroll: true });
    }
  }, [paymentErrors]);

  useEffect(() => {
    let valid = true;
    setLoading(true);
    refresh().catch((exception) => {
      if (valid) setError(exception?.message || 'Unable to load supplier accounting.');
    }).finally(() => { if (valid) setLoading(false); });
    return () => { valid = false; };
    // Changing the supplier uses the explicit selector below; never refetch on every state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    finance.getGSTOptions()
      .then(options => { if (active) setGSTOptions(options); })
      .catch(() => { if (active) setGSTOptions({ states: [], rates: [] }); });
    return () => { active = false; };
  }, []);

  const selectSupplier = async (id) => {
    const token = ++supplierRequest.current;
    setSelectedSupplier(id);
    const nextQuery = new URLSearchParams(searchParams);
    if (id) nextQuery.set('supplier', id); else nextQuery.delete('supplier');
    setSearchParams(nextQuery, { replace: true });
    setSummary(null);
    setLedger(null);
    setSupplierLoading(Boolean(id));
    setPaymentDraft(prev => ({ ...prev, amount: '', reference: '', allocations: {}, lineAllocations: {} }));
    setPaymentErrors({});
    requestKey.current = paymentKey();
    setDraft(previous => ({ ...previous, placeOfSupply: '' }));
    setError('');
    setNotice('');
    if (!id) return;
    try {
      const [details, activity] = await Promise.all([
        finance.getSupplierSummary(id), finance.getSupplierLedger(id),
      ]);
      if (token === supplierRequest.current) {
        setSummary(details);
        setLedger(activity);
      }
    } catch (exception) {
      if (token === supplierRequest.current) setError(exception?.message || 'Supplier records could not be loaded.');
    } finally {
      if (token === supplierRequest.current) setSupplierLoading(false);
    }
  };

  const run = async (label, task, success) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(label); setError(''); setNotice('');
    try {
      const nextSupplierId = await task();
      setNotice(success);
      try {
        await refresh(typeof nextSupplierId === 'string' ? nextSupplierId : selectedSupplier);
      } catch (refreshError) {
        setError('Saved successfully, but the latest records could not be refreshed: ' +
          (refreshError?.message || 'Please refresh this page.'));
      }
    } catch (exception) {
      if (label === 'payment' && exception?.fieldErrors) {
        const api = exception.fieldErrors;
        setPaymentErrors({
          ...(api.amount ? { amount: api.amount } : {}),
          ...(api.accountId ? { account: api.accountId } : {}),
          ...(api.paidOn ? { paidOn: api.paidOn } : {}),
          ...(api.allocations || api.lineAllocations ? { allocations: api.allocations || api.lineAllocations } : {}),
        });
      }
      setError(exception?.message || 'Unable to save. Please review the current record before retrying.');
    } finally {
      setBusy(''); inFlight.current = false;
    }
  };

  const supplierBills = useMemo(() => bills.filter((b) => b.supplierId === selectedSupplier), [bills, selectedSupplier]);
  const outstandingBills = supplierBills.filter((b) => b.postingStatus === 'Posted' && Number(b.outstanding) > 0);
  const advances = payments.filter((p) => p.supplierId === selectedSupplier && p.kind === 'Advance' && Number(p.unapplied) > 0);
  const filteredBills = supplierBills.filter((bill) => {
    const status = bill.postingStatus === 'Posted' && num(bill.outstanding) > 0 &&
      bill.dueDate && bill.dueDate < today() ? 'Overdue' : bill.status;
    return (!creditStatus || status === creditStatus) &&
      [bill.invoiceNumber, bill.invoiceDate, bill.dueDate, status].some(value =>
        String(value || '').toLowerCase().includes(creditSearch.trim().toLowerCase()));
  });
  const supplierPayments = payments.filter(row => String(row.supplierId) === String(selectedSupplier));
  const filteredPayments = supplierPayments.filter(row =>
    [row.paidOn, row.reference, row.method, row.kind].some(value =>
      String(value || '').toLowerCase().includes(paymentSearch.trim().toLowerCase())));
  const paidTotal = supplierPayments.reduce((sum, row) => sum + num(row.amount), 0);
  const appliedTotal = supplierPayments.reduce((sum, row) => sum + num(row.applied), 0);
  const account = accounts.find((a) => a.id === paymentDraft.accountId);
  const selectedSupplierRecord = suppliers.find((record) => record.id === selectedSupplier);
  const selectedSupplierName = selectedSupplierRecord?.name || 'Supplier';
  const supplierGSTIN = String(selectedSupplierRecord?.gstin || selectedSupplierRecord?.gstNo || '').trim().toUpperCase();
  const purchaseTaxMode = !draft.placeOfSupply ? 'unselected' :
    !supplierGSTIN ? 'unregistered' :
      supplierGSTIN.slice(0, 2) === draft.placeOfSupply ? 'cgst_sgst' : 'igst';
  const stateTaxLabel = ['04', '26', '31', '35', '38'].includes(draft.placeOfSupply) ? 'UTGST' : 'SGST';
  const posting = Boolean(busy);
  // Preview only explicitly selected components; server validates before posting.
  const purchaseTaxLines = useMemo(() => draft.lines.map((row) =>
    previewManualPurchaseTax(row, purchaseTaxMode, stateTaxLabel)
  ), [draft.lines, purchaseTaxMode, stateTaxLabel]);
  const purchaseLines = purchaseTaxLines.map((item) => item.total);
  const purchaseTotal = purchaseLines.reduce((sum, amount) => sum + amount, 0);
  const purchaseCGST = purchaseTaxLines.reduce((sum, item) => sum + item.cgst, 0);
  const purchaseStateTax = purchaseTaxLines.reduce((sum, item) => sum + item.stateTax, 0);
  const purchaseIGST = purchaseTaxLines.reduce((sum, item) => sum + item.igst, 0);
  const paymentBaseTotal = num(paymentPopupBill?.outstanding ?? purchaseTotal);
  const paidNow = purchasePayment.mode === 'Credit' ? 0
    : purchasePayment.mode === 'Full Paid' ? paymentBaseTotal : num(purchasePayment.amount);
  const newCredit = Math.max(0, paymentBaseTotal - paidNow);

  const createSupplier = (event) => {
    event.preventDefault();
    if (!canCreateSupplier) return;
    run('supplier', async () => {
      const created = await finance.addSupplier(supplierDraft);
      setSupplierDraft({ name: '', phone: '', gstNo: '', address: '' });
      return created.id;
    }, 'Supplier saved.');
  };

  const createAccount = (event) => {
    event.preventDefault();
    if (!canPay) return;
    run('account', () => finance.createAccount(accountDraft), 'Recorded financial account created.');
  };

  const updateLine = (index, patch) => setDraft((prev) => ({
    ...prev,
    lines: prev.lines.map((row, pos) => pos === index ? { ...row, ...patch } : row),
  }));

  const createBill = (event) => {
    event.preventDefault();
    if (!canCreateBill) return;
    const postNow = event.nativeEvent.submitter?.value === 'post';
    if (!draft.placeOfSupply) {
      setError('Select the legal Place of Supply before saving this purchase.');
      return;
    }
    if (supplierGSTIN && !/^[0-9]{2}[A-Z0-9]{13}$/.test(supplierGSTIN)) {
      setError('Verify the supplier GSTIN before applying GST.');
      return;
    }
    if (postNow) {
      const invalidLine = purchaseTaxLines.findIndex(result => result.status !== 'valid');
      if (invalidLine >= 0) {
        setError('Line ' + (invalidLine + 1) + ': ' +
          (purchaseTaxLines[invalidLine].message || 'Correct the GST selection before posting.'));
        return;
      }
    }
    run('bill', async () => {
      const previousOutstanding = num(summary?.outstanding);
      const confirmedBill = await finance.createBill({
        supplierId: selectedSupplier, invoiceNumber: draft.invoiceNumber.trim(),
        invoiceDate: draft.invoiceDate, dueDate: draft.dueDate || null,
        placeOfSupply: draft.placeOfSupply,
        receiveIntoStock: draft.receiveIntoStock, postNow,
        items: draft.lines.map((row) => ({
          ...row, itemId: row.itemId || null,
          description: row.description.trim(),
        })),
      });
      if (postNow) {
        setPaymentPopupBill({
          ...confirmedBill, supplierId: selectedSupplier, supplierName: selectedSupplierName,
          previousOutstanding,
        });
        setPaymentPopupError('');
        purchaseRequestKey.current = paymentKey();
      }
      setPurchasePayment((prev) => ({ ...prev, mode: 'Credit', amount: '', reference: '', lineAmounts: {} }));
      setDraft({ invoiceNumber: '', invoiceDate: today(), dueDate: '', placeOfSupply: draft.placeOfSupply, receiveIntoStock: false, lines: [line()] });
      setActiveTab('overview');
    }, postNow
      ? 'Purchase posted and payable recorded. Choose Full / Partial / Credit in the payment popup.'
      : 'Supplier bill saved as Draft. Posting is required to create liability and receive stock.');
  };

  const settlePurchasePopup = async () => {
    if (!paymentPopupBill || inFlight.current) return;
    if (purchasePayment.mode === 'Credit') {
      setPaymentPopupBill(null);
      setPaymentPopupError('');
      setNotice('Purchase retained as Full Credit. Supplier balance remains outstanding.');
      return;
    }
    const amount = paidNow;
    const available = num(paymentPopupBill.outstanding);
    const chosenAccount = accounts.find(row => String(row.id) === String(purchasePayment.accountId));
    if (!Number.isFinite(amount) || amount <= 0 || amount > available + 0.001 ||
        (purchasePayment.mode === 'Partial Paid' &&
          !/^\d+(?:\.\d{1,2})?$/.test(String(purchasePayment.amount)))) {
      setPaymentPopupError('Paid Now must be positive, at most two decimals and not exceed this bill balance.');
      return;
    }
    if (!chosenAccount?.isActive ||
        ({ Cash: 'Cash', UPI: 'UPI', 'Bank Transfer': 'Bank' }[purchasePayment.method] !== chosenAccount.kind)) {
      setPaymentPopupError('Select a matching active Cash, Bank or UPI account.');
      return;
    }
    const lineAllocations = Object.entries(purchasePayment.lineAmounts)
      .filter(([, value]) => num(value) > 0)
      .map(([lineIndex, value]) => ({
        lineIndex: Number(lineIndex), amount: Number(value).toFixed(2),
      }));
    if (lineAllocations.length &&
        (Math.abs(lineAllocations.reduce((sum, row) => sum + num(row.amount), 0) - amount) > 0.001 ||
          lineAllocations.some(row => row.lineIndex < 0 ||
            row.lineIndex >= paymentPopupBill.items.length ||
            num(row.amount) > num(paymentPopupBill.items[row.lineIndex]?.lineOutstanding)))) {
      setPaymentPopupError('Item allocations must sum to Paid Now and remain within line balances.');
      return;
    }
    inFlight.current = true;
    setBusy('popup-payment');
    setPaymentPopupError('');
    try {
      await finance.recordPayment({
        supplierId: paymentPopupBill.supplierId,
        accountId: purchasePayment.accountId, method: purchasePayment.method,
        kind: 'Payment', amount: amount.toFixed(2), paidOn: today(),
        reference: purchasePayment.reference.trim(),
        idempotencyKey: purchaseRequestKey.current,
        allocations: [{
          billId: paymentPopupBill.id, amount: amount.toFixed(2),
          ...(lineAllocations.length ? { lineAllocations } : {}),
        }],
      });
      purchaseRequestKey.current = paymentKey();
      setPaymentPopupBill(null);
      setNotice('Supplier payment recorded once in the selected ledger. Outstanding updated.');
      try {
        await refresh(selectedSupplier);
      } catch (exception) {
        setError('Payment recorded, but summary refresh failed. Refresh to view the latest balance.');
      }
    } catch (exception) {
      // Keep the same idempotency key after network errors; never auto-retry
      // with a new key and risk charging the cash/bank ledger twice.
      setPaymentPopupError(exception?.message ||
        'Payment was not confirmed. Check supplier history before retrying.');
    } finally {
      inFlight.current = false;
      setBusy('');
    }
  };

  const paySupplier = (event) => {
    event.preventDefault();
    if (!canPay || inFlight.current) return;
    const errors = {};
    const amount = Number(paymentDraft.amount);
    const chosenAccount = accounts.find(item => String(item.id) === String(paymentDraft.accountId));
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(paymentDraft.amount))) {
      errors.amount = 'Enter a positive payment amount with up to two decimals.';
    }
    if (!chosenAccount || !chosenAccount.isActive) {
      errors.account = 'Select an active payment account.';
    } else if ({ Cash: 'Cash', 'Bank Transfer': 'Bank', UPI: 'UPI' }[paymentDraft.method] !== chosenAccount.kind) {
      errors.account = 'Payment method must match the selected account type.';
    }
    if (!paymentDraft.paidOn) errors.paidOn = 'Choose a payment date.';
    if (paymentDraft.kind === 'Payment') {
      let allocatedCents = 0;
      for (const bill of outstandingBills) {
        const raw = paymentDraft.allocations[bill.id];
        if (raw === '' || raw === undefined) continue;
        const billAmount = Number(raw);
        if (!Number.isFinite(billAmount) || billAmount < 0 || !/^\d+(\.\d{1,2})?$/.test(String(raw)) ||
            billAmount > Number(bill.outstanding)) {
          errors['bill:' + bill.id] = 'Allocation must not exceed the posted bill outstanding.';
        }
        if (billAmount > 0 && Number.isFinite(billAmount)) {
          allocatedCents += Math.round(billAmount * 100);
          const lineAmounts = Object.entries(paymentDraft.lineAllocations[bill.id] || {})
            .filter(([, value]) => value !== '' && value !== undefined);
          if (lineAmounts.length) {
            let lineCents = 0;
            for (const [index, value] of lineAmounts) {
              const lineAmount = Number(value);
              const item = bill.items?.[Number(index)];
              if (!item || !Number.isFinite(lineAmount) || lineAmount < 0 ||
                  !/^\d+(\.\d{1,2})?$/.test(String(value)) ||
                  lineAmount > Number(item.lineOutstanding)) {
                errors['bill:' + bill.id] = 'Item allocation exceeds an item outstanding amount.';
              }
              if (Number.isFinite(lineAmount) && lineAmount > 0) lineCents += Math.round(lineAmount * 100);
            }
            if (lineCents !== Math.round(billAmount * 100)) {
              errors['bill:' + bill.id] = 'Item allocations must equal this bill allocation.';
            }
          }
        }
      }
      if (!errors.amount && allocatedCents !== Math.round(amount * 100)) {
        errors.allocations = 'Bill allocations must equal the payment amount.';
      }
    }
    if (Object.keys(errors).length) {
      setPaymentErrors(errors);
      setError(Object.values(errors)[0]);
      return;
    }
    setPaymentErrors({});
    const allocations = paymentDraft.kind === 'Advance' ? [] : outstandingBills
      .filter((bill) => Number(paymentDraft.allocations[bill.id] || 0) > 0)
      .map((bill) => {
        const rows = Object.entries(paymentDraft.lineAllocations[bill.id] || {})
          .filter(([, value]) => num(value) > 0)
          .map(([lineIndex, amount]) => ({ lineIndex: Number(lineIndex), amount }));
        return {
          billId: bill.id, amount: paymentDraft.allocations[bill.id],
          ...(rows.length ? { lineAllocations: rows } : {}),
        };
      });
    run('payment', async () => {
      await finance.recordPayment({
        supplierId: selectedSupplier, accountId: paymentDraft.accountId,
        kind: paymentDraft.kind, method: paymentDraft.method, amount: paymentDraft.amount,
        paidOn: paymentDraft.paidOn, reference: paymentDraft.reference,
        idempotencyKey: requestKey.current, allocations,
      });
      requestKey.current = paymentKey();
      setPaymentDraft((old) => ({ ...old, amount: '', reference: '', allocations: {}, lineAllocations: {} }));
    }, 'Supplier payment recorded in the selected account ledger.');
  };

  const applyAdvance = (event) => {
    event.preventDefault();
    if (!canPay) return;
    const amount = Number(applyDraft.amount);
    const advance = advances.find(item => String(item.id) === String(applyDraft.paymentId));
    const bill = outstandingBills.find(item => String(item.id) === String(applyDraft.billId));
    if (!advance || !bill || !Number.isFinite(amount) || amount <= 0 ||
        amount > Number(advance.unapplied) || amount > Number(bill.outstanding)) {
      setError('Choose an advance, outstanding bill and a valid amount within both remaining balances.');
      return;
    }
    run('advance', () => finance.applyAdvance(applyDraft.paymentId, {
      billId: applyDraft.billId, amount: applyDraft.amount,
    }).then(() => setApplyDraft({ paymentId: '', billId: '', amount: '' })),
    'Advance applied against the supplier bill. No second bank deduction was made.');
  };

  return (
    <main className="cg-supplier-finance mx-auto flex w-full min-w-0 flex-col gap-4 p-3 pb-24 text-content md:p-6">
      <header className="cg-supplier-finance-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={supplierSection ? '/suppliers' : '/stock'} className="text-sm font-semibold text-primary">
            {supplierSection ? 'Suppliers' : 'Inventory Management'}
          </Link>
          <h1 className="mt-1 text-[23px] font-semibold text-content">
            {section === 'credits' ? 'Credit Management' : section === 'payments' ? 'Supplier Payments' : 'Supplier Credit & Payments'}
          </h1>
          {!supplierSection && <p className="mt-1 text-sm text-muted">Purchases, payables and recorded cash / bank entries.</p>}
        </div>
        <button type="button" className={secondary} disabled={posting || loading}
          onClick={() => run('refresh', () => refresh(), 'Supplier records refreshed.')}>
          <span className="inline-flex items-center gap-2"><RefreshCw size={16}/> Refresh</span>
        </button>
      </header>

      {supplierSection && <SupplierSectionTabs />}
      {section === 'credits' && canPay && (
        <div className="flex flex-wrap gap-2">
          <Link to={'/suppliers/payments?supplier=' + encodeURIComponent(selectedSupplier)} className={secondary}>Pay Supplier</Link>
        </div>
      )}
      {section === 'payments' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondary}
            onClick={() => setActiveTab(current => current === 'accounts' ? 'payment' : 'accounts')}>
            {activeTab === 'accounts' ? 'Back to Supplier Payments' : 'Manage Cash / Bank Accounts'}
          </button>
        </div>
      )}

      {loading && <p role="status" className={box}>Loading supplier records…</p>}
      {error && <div role="alert" className="rounded-xl border border-red-500/30 p-3 text-sm text-red-600">{error}</div>}
      {notice && <div role="status" className={box + ' border-green-600/40 text-green-700 dark:text-green-400'}><CheckCircle2 size={16} className="inline"/> {notice}</div>}

      <section className={box} aria-label="Select supplier">
        <div className="cg-supplier-finance-selector">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">
            Supplier
            <select value={selectedSupplier} onChange={(event) => selectSupplier(event.target.value)} className={field}>
              {!suppliers.length && <option value="">No suppliers yet</option>}
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
          {canCreateSupplier && <details className="min-w-0 md:w-64">
            <summary className={secondary + ' cursor-pointer'}>+ Add Supplier</summary>
            <form className="mt-3 grid gap-2" onSubmit={createSupplier}>
              <input required maxLength={180} className={field} placeholder="Supplier name" aria-label="New supplier name"
                value={supplierDraft.name} onChange={(event) => setSupplierDraft({ ...supplierDraft, name: event.target.value })}/>
              <input className={field} placeholder="Mobile number" aria-label="New supplier mobile"
                value={supplierDraft.phone} onChange={(event) => setSupplierDraft({ ...supplierDraft, phone: event.target.value })}/>
              <input className={field} placeholder="GSTIN (optional)" aria-label="New supplier GSTIN"
                value={supplierDraft.gstNo} onChange={(event) => setSupplierDraft({ ...supplierDraft, gstNo: event.target.value })}/>
              <input className={field} placeholder="Address (optional)" aria-label="Supplier address"
                value={supplierDraft.address} onChange={(event) => setSupplierDraft({ ...supplierDraft, address: event.target.value })}/>
              <button type="submit" disabled={posting} className={primary}>Save Supplier</button>
            </form>
          </details>}
        </div>
      </section>

      {supplierLoading && !loading && <p role="status" className="cg-supplier-finance-empty">Loading supplier balance…</p>}
      {!loading && !supplierLoading && !selectedSupplier && !error &&
        <p className="cg-supplier-finance-empty">Add a supplier to view purchases and payments.</p>}
      {summary && (
        <div className="cg-supplier-finance-metrics" aria-label="Supplier financial summary">
          {[
            ['Purchase total', summary.totalPurchases], ['Outstanding', summary.outstanding],
            ['Applied payments', summary.totalPaymentsApplied], ['Available advance', summary.availableAdvance],
            ['Overdue bills', summary.overdue],
          ].map(([name, amount]) => (
            <div key={name} className="cg-supplier-finance-metric">
              <span>{name}</span>
              <strong>{amount == null ? 'Unavailable' : money(amount)}</strong>
            </div>
          ))}
        </div>
      )}

      {!supplierSection && <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Supplier accounting sections">
        {[
          ['overview', 'Bills & Ledger'], ['bill', 'New Purchase'],
          ['payment', 'Pay Supplier'], ['accounts', 'Cash / Bank'],
        ].map(([value, label]) => (
          <button type="button" key={value} onClick={() => setActiveTab(value)}
            aria-pressed={activeTab === value}
            className={(activeTab === value ? primary : secondary) + ' whitespace-normal'}>
            {label}
          </button>
        ))}
      </nav>}

      {activeTab === 'overview' && summary && (
        <div className="grid min-w-0 gap-4">
          <section className={box}>
            <div className="cg-supplier-finance-heading">
              <div className="min-w-0">
                <h2>Purchase Bills</h2>
                <p className="cg-supplier-finance-selected" title={selectedSupplierName}>{selectedSupplierName}</p>
              </div>
              {supplierSection ? (canCreateBill && <Link to="/stock/suppliers?tab=bill" className={secondary}>+ New Purchase</Link>)
                : (canCreateBill && <button className={secondary} type="button" onClick={() => setActiveTab('bill')}>+ New Purchase</button>)}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">Search bills
                <input className={field} aria-label="Search supplier bills" placeholder="Invoice number, date or status"
                  value={creditSearch} onChange={event => setCreditSearch(event.target.value)}/>
              </label>
              <label className="grid gap-1 text-sm">Payment status
                <select className={field} aria-label="Filter bill status" value={creditStatus}
                  onChange={event => setCreditStatus(event.target.value)}>
                  <option value="">All statuses</option>
                  {['Draft', 'Unpaid', 'Partially Paid', 'Paid', 'Overdue'].map(status =>
                    <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3 grid gap-2">
              {filteredBills.map((bill) => (
                <article key={bill.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <strong>{bill.invoiceNumber}</strong>
                    <p className="text-sm text-muted">
                      {bill.postingStatus === 'Posted' && num(bill.outstanding) > 0 && bill.dueDate && bill.dueDate < today()
                        ? 'Overdue' : bill.status}
                      {' · '}{bill.invoiceDate} · Due date {bill.dueDate || '—'}
                      {' · '}{bill.receiveIntoStock ? 'Inventory receipt' : 'Direct purchase'}
                    </p>
                    <p className="text-sm">Total {money(bill.total)} · Paid {money(bill.paid)}
                      {' · '}<strong>Outstanding {bill.postingStatus === 'Posted' ? money(bill.outstanding) : 'Not posted'}</strong>
                    </p>
                    {bill.taxComponentsVerified && <p className="text-xs text-muted">
                      {bill.taxMode === 'igst' ? 'IGST ' + money(bill.igst) :
                        'CGST ' + money(bill.cgst) + ' · ' +
                        (Number(bill.utgst) ? 'UTGST ' + money(bill.utgst) : 'SGST ' + money(bill.sgst))}
                    </p>}
                  </div>
                  {canPost && bill.postingStatus === 'Draft' && <button type="button" disabled={posting}
                    className={primary}
                    onClick={() => run('post', async () => {
                      const confirmedBill = await finance.postBill(bill.id);
                      setPaymentPopupBill({
                        ...confirmedBill, supplierId: selectedSupplier,
                        supplierName: selectedSupplierName,
                        previousOutstanding: num(summary?.outstanding),
                      });
                      setPurchasePayment(prev => ({
                        ...prev, mode: 'Credit', amount: '', reference: '', lineAmounts: {},
                      }));
                      setPaymentPopupError('');
                      purchaseRequestKey.current = paymentKey();
                      return selectedSupplier;
                    }, 'Purchase posted. Select a payment in the popup; closing retains the credit.')}>
                    {busy === 'post' ? 'Posting…' : 'Confirm & Post Bill'}
                  </button>}
                </article>
              ))}
              {!filteredBills.length && <p className="cg-supplier-finance-empty">No matching purchase bills.</p>}
            </div>
          </section>
          <section className={box}>
            <h2 className="text-base font-semibold">Supplier Ledger</h2>
            <div className="mt-3 grid gap-2">
              {(ledger?.entries || []).map((entry, index) => (
                <div key={entry.sourceId + '-' + index} className="grid grid-cols-2 gap-2 border-b border-line py-2 text-sm md:grid-cols-4">
                  <span><strong>{entry.type}</strong><small className="block text-muted">{recordLabel(entry.reference || entry.id)}</small></span>
                  <span className="text-muted">{new Date(entry.date).toLocaleDateString()}</span>
                  <span>+{money(entry.payableIncrease)} / −{money(entry.payableDecrease)}</span>
                  <strong>Due {money(entry.runningPayable)}</strong>
                </div>
              ))}
              {!ledger?.entries?.length && <p className="cg-supplier-finance-empty">No posted transactions.</p>}
            </div>
          </section>
          {canPay && !!advances.length && <section className={box}>
            <h2 className="text-lg font-bold">Apply Supplier Advance</h2>
            <form onSubmit={applyAdvance} className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="grid gap-1 text-sm">Advance
                <select className={field} required value={applyDraft.paymentId}
                  onChange={(event) => setApplyDraft({ ...applyDraft, paymentId: event.target.value })}>
                  <option value="">Choose advance</option>
                  {advances.map((advance) => <option key={advance.id} value={advance.id}>Available {money(advance.unapplied)} · {advance.paidOn}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm">Outstanding bill
                <select className={field} required value={applyDraft.billId}
                  onChange={(event) => setApplyDraft({ ...applyDraft, billId: event.target.value })}>
                  <option value="">Choose bill</option>
                  {outstandingBills.map((bill) => <option key={bill.id} value={bill.id}>{bill.invoiceNumber} · {money(bill.outstanding)}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm">Apply amount
                <input required type="number" min="0.01" step="0.01" className={field}
                  value={applyDraft.amount} onChange={(event) => setApplyDraft({ ...applyDraft, amount: event.target.value })}/>
              </label>
              <button className={primary + ' md:col-span-3'} disabled={posting} type="submit">Apply Advance (No Additional Bank Debit)</button>
            </form>
          </section>}
        </div>
      )}

      {activeTab === 'bill' && canCreateBill && (
        <form className={box + ' grid gap-4'} onSubmit={createBill}>
          <h2 className="text-lg font-semibold">New Supplier Purchase — Draft</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold">Supplier invoice number
              <input className={field} required maxLength={100} value={draft.invoiceNumber}
                onChange={(event) => setDraft({ ...draft, invoiceNumber: event.target.value })}/>
            </label>
            <label className="grid gap-1 text-sm font-semibold">Invoice date
              <input className={field} type="date" required value={draft.invoiceDate}
                onChange={(event) => setDraft({ ...draft, invoiceDate: event.target.value })}/>
            </label>
            <label className="grid gap-1 text-sm font-semibold">Due date (optional)
              <input className={field} type="date" value={draft.dueDate}
                onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}/>
            </label>
          </div>
          <section className="grid gap-2 rounded-xl border border-line p-3">
            <label className="grid gap-1 text-sm font-semibold">Place of Supply *
              <select className={field} required value={draft.placeOfSupply}
                onChange={event => setDraft(previous => ({ ...previous, placeOfSupply: event.target.value }))}>
                <option value="">Select legal supply state / UT</option>
                {gstOptions.states.map(state => <option key={state.code} value={state.code}>
                  {state.name} ({state.code})
                </option>)}
              </select>
            </label>
            <p className="text-xs text-muted">Supplier GSTIN: {supplierGSTIN || 'Not recorded (unregistered supplier)'}.
              Verify the legal Place of Supply and HSN/SAC rate before posting.</p>
            {draft.placeOfSupply && <p className="text-sm font-semibold" role="status">
              {purchaseTaxMode === 'cgst_sgst' ? 'Intra-state: CGST + ' + stateTaxLabel :
                purchaseTaxMode === 'igst' ? 'Inter-state: IGST' : 'Unregistered supplier: no GST charged'}
            </p>}
            {!gstOptions.states.length && <p role="alert" className="text-sm text-red-600">
              GST state options unavailable. Refresh before posting a purchase.
            </p>}
          </section>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.receiveIntoStock}
              onChange={(event) => setDraft({ ...draft, receiveIntoStock: event.target.checked })}/>
            Receive products into Inventory only when this bill is posted
          </label>
          {draft.lines.map((row, index) => (
            <div key={index} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="grid gap-1 text-sm lg:col-span-2">Inventory product (optional for direct purchases)
                <select className={field} value={row.itemId}
                  onChange={(event) => {
                    const item = inventory.find((record) => record.id === event.target.value);
                    updateLine(index, {
                      itemId: event.target.value, description: item?.partName || item?.name || row.description,
                      purchaseRate: item?.costPrice || item?.cost || row.purchaseRate,
                      gstRate: item?.tax ?? row.gstRate, taxComponents: [], gstTreatment: '', zeroRatingBasis: '',
                    });
                  }}>
                  <option value="">Custom / direct purchase</option>
                  {inventory.map((item) => <option key={item.id} value={item.id}>{item.partName || item.name} · {item.sku}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm">Product name
                <input className={field} required maxLength={180} value={row.description}
                  onChange={(event) => updateLine(index, { description: event.target.value })}/>
              </label>
              <label className="grid gap-1 text-sm">Quantity
                <input className={field} type="number" required min="0.01" step="0.01" value={row.quantity}
                  onChange={(event) => updateLine(index, { quantity: event.target.value })}/>
              </label>
              <label className="grid gap-1 text-sm">Purchase rate (₹)
                <input className={field} type="number" required min="0" step="0.01" value={row.purchaseRate}
                  onChange={(event) => updateLine(index, { purchaseRate: event.target.value })}/>
              </label>
              <div className="grid gap-2 text-sm lg:col-span-5">
                <label className="grid gap-1">Manual GST Component *
                  <select className={field} value=""
                    onChange={event => {
                      const choice = event.target.value;
                      if (!choice) return;
                      if (choice === 'zero') {
                        updateLine(index, { taxComponents: ['zero'], gstTreatment: '', zeroRatingBasis: '' });
                        return;
                      }
                      const previous = row.taxComponents.filter(value => value !== 'zero');
                      if (previous.some(selected => selected.split(':')[0] === choice.split(':')[0])) {
                        setError('This GST component already has a selected rate. Remove it before changing.');
                        return;
                      }
                      if (previous.length >= 2) {
                        setError('Remove a selected GST component before adding another.');
                        return;
                      }
                      updateLine(index, {
                        taxComponents: [...previous, choice], gstTreatment: 'taxable', zeroRatingBasis: '',
                      });
                      setError('');
                    }}>
                    <option value="">Add a GST component manually</option>
                    {supplierComponentChoices(stateTaxLabel).map(option =>
                      <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2" aria-label="Selected GST components">
                  {row.taxComponents.length === 0 && <span className="text-muted">No component selected</span>}
                  {row.taxComponents.map(choice => (
                    <span key={choice} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2">
                      {supplierComponentChoices(stateTaxLabel).find(option => option.value === choice)?.label || choice}
                      <button type="button" className="text-red-600 underline"
                        aria-label={'Remove ' + choice}
                        onClick={() => updateLine(index, {
                          taxComponents: row.taxComponents.filter(value => value !== choice),
                          gstTreatment: '', zeroRatingBasis: '',
                        })}>Remove</button>
                    </span>
                  ))}
                </div>
                {row.taxComponents.includes('zero') && purchaseTaxMode !== 'unregistered' &&
                  <label className="grid gap-1">0% GST Treatment *
                    <select className={field} value={row.gstTreatment || ''}
                      onChange={event => updateLine(index, {
                        gstTreatment: event.target.value, zeroRatingBasis: '',
                      })}>
                      <option value="">Select classification</option>
                      <option value="exempt">Exempt supply</option>
                      <option value="nil_rated">Nil-rated supply</option>
                      <option value="zero_rated">Zero-rated (eligible export / SEZ only)</option>
                      <option value="non_gst">Non-GST supply</option>
                    </select>
                  </label>}
                {row.taxComponents.includes('zero') && row.gstTreatment === 'zero_rated' &&
                  <label className="grid gap-1">Zero-rating basis *
                    <select className={field} value={row.zeroRatingBasis || ''}
                      onChange={event => updateLine(index, { zeroRatingBasis: event.target.value })}>
                      <option value="">Select basis</option>
                      <option value="export">Export</option>
                      <option value="sez">SEZ</option>
                    </select>
                  </label>}
                <div className="text-xs text-muted" role="status">
                  CGST {money(purchaseTaxLines[index]?.cgst)}
                  {' · '}{stateTaxLabel} {money(purchaseTaxLines[index]?.stateTax)}
                  {' · '}IGST {money(purchaseTaxLines[index]?.igst)}
                  <strong className="ml-2 text-content">Line Total {money(purchaseLines[index])}</strong>
                  {purchaseTaxLines[index]?.status !== 'valid' &&
                    <p className="mt-1 text-red-600">{purchaseTaxLines[index]?.message}
                      {' '}Draft may be saved, but posting is blocked until corrected.
                    </p>}
                </div>
              </div>
              {draft.lines.length > 1 && <button className={secondary} type="button"
                onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, i) => i !== index) })}>Remove line</button>}
            </div>
          ))}
          <button type="button" className={secondary} onClick={() => setDraft({ ...draft, lines: [...draft.lines, line()] })}>
            <span className="inline-flex items-center gap-2"><Plus size={16}/> Add Product Line</span>
          </button>
          <section className="grid gap-2 rounded-xl border border-line p-3" aria-label="Purchase GST breakdown">
            <h3 className="text-sm font-bold">Purchase GST Breakdown (preview)</h3>
            {purchaseTaxMode === 'cgst_sgst' && <p className="text-sm">
              CGST: {money(purchaseCGST)} · {stateTaxLabel}: {money(purchaseStateTax)}
            </p>}
            {purchaseTaxMode === 'igst' && <p className="text-sm">IGST: {money(purchaseIGST)}</p>}
            {purchaseTaxMode === 'unregistered' && <p className="text-sm">GST charged: {money(0)}</p>}
            {purchaseTaxMode === 'unselected' && <p className="text-sm text-muted">Select Place of Supply.</p>}
            <p className="text-xs text-muted">Preview totals use only selected components.
              CGST-only drafts never add SGST automatically. Valid statutory components
              and HSN/SAC rate are required before posting. Django Decimal totals are authoritative.</p>
          </section>
          <section className="rounded-xl border border-line p-3 text-sm" aria-label="Purchase payment">
            <strong>Purchase Summary</strong>
            <p className="mt-2">Total: <strong>{money(purchaseTotal)}</strong>
              {' · '}Previous Due: <strong>{summary ? money(summary.outstanding) : 'Unavailable'}</strong>
            </p>
            <p className="mt-1 text-xs text-muted">After posting, choose Full Paid, Partial Paid or Credit.</p>
          </section>
          <div className="grid gap-2 sm:grid-cols-2">
            <button className={secondary} disabled={posting || !selectedSupplier} type="submit" value="draft">
              Save Draft
            </button>
            <button className={primary} disabled={posting || !selectedSupplier || purchaseTotal <= 0}
              type="submit" value="post">{busy === 'bill' ? 'Posting…' : 'Confirm & Post Purchase'}</button>
          </div>

        </form>
      )}

      {activeTab === 'payment' && canPay && summary && (
        <form ref={paymentFormRef} noValidate className={box + ' cg-supplier-finance-payment-form grid gap-4'} onSubmit={paySupplier}>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Pay Supplier</h2>
            <p className="cg-supplier-finance-selected" title={selectedSupplierName}>{selectedSupplierName}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">Payment type
              <select value={paymentDraft.kind} className={field} onChange={(event) =>
                setPaymentDraft({ ...paymentDraft, kind: event.target.value, allocations: {}, lineAllocations: {} })}>
                <option value="Payment">Pay Outstanding Bills</option>
                <option value="Advance">Advance Payment</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">Payment account
              <select required value={paymentDraft.accountId} aria-invalid={Boolean(paymentErrors.account)}
                className={field + (paymentErrors.account ? ' border-red-600' : '')} onChange={(event) => {
                const selected = accounts.find((x) => x.id === event.target.value);
                setPaymentDraft({ ...paymentDraft, accountId: event.target.value,
                  method: selected?.kind === 'Cash' ? 'Cash' : selected?.kind === 'UPI' ? 'UPI' : 'Bank Transfer' });
              }}>
                <option value="">Choose account</option>
                {accounts.filter((x) => x.isActive).map((a) =>
                  <option key={a.id} value={a.id}>{a.name} · Recorded {money(a.recordedBalance)}</option>)}
              </select>
              {paymentErrors.account && <small role="alert" className="text-xs text-red-600">{paymentErrors.account}</small>}
            </label>
            <label className="grid gap-1 text-sm font-semibold">Method
              <select value={paymentDraft.method} className={field} onChange={(event) =>
                setPaymentDraft({ ...paymentDraft, method: event.target.value })}>
                {['Cash', 'Bank Transfer', 'UPI'].map((method) => <option key={method}>{method}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">Amount (₹)
              <input required min="0.01" step="0.01" type="number" aria-invalid={Boolean(paymentErrors.amount)}
                className={field + (paymentErrors.amount ? ' border-red-600' : '')}
                value={paymentDraft.amount} onChange={(event) =>
                  setPaymentDraft({ ...paymentDraft, amount: event.target.value })}/>
              {paymentErrors.amount && <small role="alert" className="text-xs text-red-600">{paymentErrors.amount}</small>}
            </label>
            <label className="grid gap-1 text-sm font-semibold">Payment date
              <input type="date" required aria-invalid={Boolean(paymentErrors.paidOn)}
                className={field + (paymentErrors.paidOn ? ' border-red-600' : '')} value={paymentDraft.paidOn}
                onChange={(event) => setPaymentDraft({ ...paymentDraft, paidOn: event.target.value })}/>
              {paymentErrors.paidOn && <small role="alert" className="text-xs text-red-600">{paymentErrors.paidOn}</small>}
            </label>
            <label className="grid gap-1 text-sm font-semibold">Reference (optional)
              <input className={field} maxLength={120} value={paymentDraft.reference}
                onChange={(event) => setPaymentDraft({ ...paymentDraft, reference: event.target.value })}/>
            </label>
          </div>
          {paymentDraft.kind === 'Payment' && <div className="grid gap-2">
            <strong className="text-sm">Allocate payment across posted bills</strong>
            {outstandingBills.map((bill) => <div key={bill.id}
              className="grid gap-2 rounded-xl border border-line p-3">
              <label className="grid gap-1 text-sm">
                {bill.invoiceNumber} · Due {money(bill.outstanding)}
                <input className={field + (paymentErrors['bill:' + bill.id] || paymentErrors.allocations ? ' border-red-600' : '')}
                  aria-invalid={Boolean(paymentErrors['bill:' + bill.id] || paymentErrors.allocations)}
                  type="number" min="0" max={bill.outstanding} step="0.01"
                  value={paymentDraft.allocations[bill.id] || ''}
                  placeholder="Allocate amount (₹)"
                  onChange={(event) => setPaymentDraft((prev) => ({
                    ...prev, allocations: { ...prev.allocations, [bill.id]: event.target.value },
                  }))}/>
                {paymentErrors['bill:' + bill.id] && <small role="alert" className="text-xs text-red-600">
                  {paymentErrors['bill:' + bill.id]}</small>}
              </label>
              {!!num(paymentDraft.allocations[bill.id]) && <details className="text-sm">
                <summary className="cursor-pointer">Allocate to specific purchase items (optional)</summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {bill.items.map((item, index) => <label key={item.lineId || index} className="grid gap-1">
                    {item.description} · Remaining item allocation {money(item.lineOutstanding)}
                    <input className={field} type="number" min="0" step="0.01"
                      max={item.lineOutstanding} placeholder="Item payment"
                      value={paymentDraft.lineAllocations[bill.id]?.[index] || ''}
                      onChange={event => setPaymentDraft(prev => ({
                        ...prev, lineAllocations: {
                          ...prev.lineAllocations,
                          [bill.id]: { ...(prev.lineAllocations[bill.id] || {}), [index]: event.target.value },
                        },
                      }))}/>
                  </label>)}
                </div>
              </details>}
            </div>)}
            {!outstandingBills.length && <p className="cg-supplier-finance-empty">No unpaid bills. You can select Advance Payment.</p>}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-sm">
              <span>Allocated {money(Object.values(paymentDraft.allocations).reduce((sum, value) => sum + num(value), 0))}</span>
              <strong>Unallocated {money(num(paymentDraft.amount) -
                Object.values(paymentDraft.allocations).reduce((sum, value) => sum + num(value), 0))}</strong>
            </div>
            {paymentErrors.allocations && <p role="alert" className="text-sm text-red-600">
              {paymentErrors.allocations}</p>}

          </div>}
          <p className="text-xs text-muted">Payments update the recorded account ledger, not a real-time bank balance.</p>
          <button className={primary} type="submit" disabled={posting || !selectedSupplier || !paymentDraft.accountId ||
            !paymentDraft.amount || (paymentDraft.kind === 'Payment' && !outstandingBills.length)}>
            {busy === 'payment' ? 'Posting payment…' : 'Confirm Supplier Payment'}
          </button>
        </form>
      )}

      {activeTab === 'payment' && summary && (
        <section className={box + ' grid gap-3'} aria-label="Supplier payment history">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Payment History</h2>
            <span className="text-sm text-muted">{supplierPayments.length} records</span>
          </div>
          <p className="text-xs text-muted">Recorded payments: <strong>{money(paidTotal)}</strong>
            {' · '}Applied to bills: <strong>{money(appliedTotal)}</strong></p>
          <label className="grid gap-1 text-sm">Search payments
            <input className={field} aria-label="Search supplier payments" placeholder="Reference, method, type or date"
              value={paymentSearch} onChange={event => setPaymentSearch(event.target.value)}/>
          </label>
          <div className="grid gap-2">
            {filteredPayments.map(row => (
              <article key={row.id} className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-xl border border-line p-3">
                <div className="min-w-0">
                  <strong className="text-sm">{row.kind} · {row.method}</strong>
                  <p className="text-xs text-muted">{row.paidOn} · {recordLabel(row.reference || row.id, 'No reference')}</p>
                  <p className="text-xs text-muted">Allocated {money(row.applied)} · Unallocated {money(row.unapplied)}</p>
                </div>
                <strong className="text-sm">{money(row.amount)}</strong>
              </article>
            ))}
            {!filteredPayments.length && <p className="cg-supplier-finance-empty">No matching payments.</p>}
          </div>
        </section>
      )}

      {activeTab === 'accounts' && <div className="grid gap-4">
        <section className={box}>
          <h2 className="text-lg font-bold">Recorded Cash & Bank Accounts</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {accounts.map((a) => <div key={a.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-line p-3">
              {a.kind === 'Cash' ? <Wallet size={18}/> : <CreditCard size={18}/>}
              <div className="min-w-0"><strong>{a.name}</strong><p className="text-xs text-muted">{a.kind} · Recorded balance</p>
                <strong>{money(a.recordedBalance)}</strong></div>
            </div>)}
            {!accounts.length && <p className="text-sm text-muted">No recorded financial accounts yet.</p>}
          </div>
        </section>
        {canPay && <form className={box + ' grid gap-3 sm:grid-cols-3'} onSubmit={createAccount}>
          <h3 className="text-lg font-bold sm:col-span-3">Add Financial Account</h3>
          <label className="grid gap-1 text-sm">Account name
            <input required maxLength={120} className={field} value={accountDraft.name}
              onChange={(event) => setAccountDraft({ ...accountDraft, name: event.target.value })}/>
          </label>
          <label className="grid gap-1 text-sm">Type
            <select className={field} value={accountDraft.kind}
              onChange={(event) => setAccountDraft({ ...accountDraft, kind: event.target.value })}>
              {['Cash', 'Bank', 'UPI'].map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">Opening recorded balance
            <input required type="number" min="0" step="0.01" className={field} value={accountDraft.openingBalance}
              onChange={(event) => setAccountDraft({ ...accountDraft, openingBalance: event.target.value })}/>
          </label>
          <button type="submit" className={primary + ' sm:col-span-3'} disabled={posting}>Create Account</button>
          <p className="text-xs text-muted sm:col-span-3">Opening balances are recorded snapshots; never label them as synced live bank balances.</p>
        </form>}
      </div>}

      <p className="text-xs text-muted" title="Supplier payments settle liabilities; they do not change purchase expenses.">
        Customer selling rates are separate from supplier purchase costs.
      </p>

      {paymentPopupBill && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-3 sm:p-5">
        <section role="dialog" aria-modal="true" aria-labelledby="purchase-payment-popup-title"
          className="flex w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl border border-line bg-surface p-4 text-content shadow-xl sm:p-6"
          style={{ maxHeight: 'calc(100dvh - 32px)' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="purchase-payment-popup-title" className="text-lg font-semibold">Supplier Payment</h2>
              <p className="cg-supplier-finance-subtitle" title={paymentPopupBill.supplierName}>{paymentPopupBill.supplierName}</p>
              <p className="text-sm text-muted">Bill {paymentPopupBill.invoiceNumber}</p>
            </div>
            <button type="button" className={secondary} disabled={posting}
              onClick={() => { setPaymentPopupBill(null); setPaymentPopupError(''); }}>
              Close
            </button>
          </div>
          <p className="text-xs text-muted">Closing keeps the supplier credit. No account is debited until payment is confirmed.</p>
          <label className="grid gap-1 text-sm">Payment Mode
            <select className={field} value={purchasePayment.mode}
              onChange={event => {
                setPaymentPopupError('');
                setPurchasePayment(prev => ({ ...prev, mode: event.target.value, lineAmounts: {} }));
              }}>
              <option value="Full Paid">Full Paid</option>
              <option value="Partial Paid">Partial Paid</option>
              <option value="Credit">Full Credit</option>
            </select>
          </label>
          {purchasePayment.mode !== 'Credit' && <div className="grid gap-3 sm:grid-cols-2">
            {purchasePayment.mode === 'Partial Paid' && <label className="grid gap-1 text-sm">
              Paid Now (₹)
              <input className={field} type="number" min="0.01" step="0.01" max={paymentBaseTotal}
                value={purchasePayment.amount}
                onChange={event => setPurchasePayment(prev => ({ ...prev, amount: event.target.value }))}/>
            </label>}
            <label className="grid gap-1 text-sm">Cash / Bank / UPI Account
              <select className={field} value={purchasePayment.accountId}
                onChange={event => {
                  const account = accounts.find(record => record.id === event.target.value);
                  setPurchasePayment(prev => ({
                    ...prev, accountId: event.target.value,
                    method: account?.kind === 'Cash' ? 'Cash' : account?.kind === 'UPI' ? 'UPI' : 'Bank Transfer',
                  }));
                }}>
                <option value="">Select account</option>
                {accounts.filter(account => account.isActive).map(account =>
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.kind}) · Recorded {money(account.recordedBalance)}
                  </option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Payment Reference
              <input className={field} value={purchasePayment.reference} maxLength={120}
                onChange={event => setPurchasePayment(prev => ({ ...prev, reference: event.target.value }))}/>
            </label>
          </div>}
          {purchasePayment.mode !== 'Credit' && <details>
            <summary className="cursor-pointer text-sm font-semibold">Optional Item-wise Payment Allocation</summary>
            <div className="mt-2 grid gap-2">
              {paymentPopupBill.items.map((item, index) =>
                <label key={index} className="grid gap-1 text-sm">
                  {item.description} · Remaining {money(item.lineOutstanding)}
                  <input className={field} type="number" min="0" step="0.01"
                    max={item.lineOutstanding} value={purchasePayment.lineAmounts[index] || ''}
                    onChange={event => setPurchasePayment(prev => ({
                      ...prev, lineAmounts: { ...prev.lineAmounts, [index]: event.target.value },
                    }))}/>
                </label>)}
            </div>
          </details>}
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {[
              ['Purchase Amount', num(paymentPopupBill.subtotal)],
              ['GST Amount', num(paymentPopupBill.tax)],
              ['Total Purchase', num(paymentPopupBill.total)],
              ['Previous Due', num(paymentPopupBill.previousOutstanding)],
              ['Paid Now', paidNow],
              ['New Credit', newCredit],
              ['Total Supplier Outstanding', num(paymentPopupBill.previousOutstanding) + newCredit],
            ].map(([label, value]) =>
              <div key={label} className="rounded-lg border border-line p-2">
                <span className="block text-xs text-muted">{label}</span>
                <strong>{money(value)}</strong>
              </div>)}
          </div>
          {paymentPopupError && <p className="text-sm text-red-600" role="alert">{paymentPopupError}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className={secondary} disabled={posting}
              onClick={() => { setPaymentPopupBill(null); setPaymentPopupError(''); }}>
              Close Without Payment
            </button>
            <button type="button" className={primary} disabled={posting}
              onClick={settlePurchasePopup}>
              {busy === 'popup-payment' ? 'Recording…' :
                purchasePayment.mode === 'Credit' ? 'Confirm Full Credit' : 'Record Supplier Payment'}
            </button>
          </div>
        </section>
      </div>}


    </main>
  );
}
