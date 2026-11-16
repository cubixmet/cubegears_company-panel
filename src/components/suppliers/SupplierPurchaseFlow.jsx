import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supplierFinanceSetupRoute } from '../../utils/supplierFinanceReturnRoute';
import { supplierFinanceService } from '../../services/supplierFinance.service';
import { stockCatalogService } from '../../services/stockCatalog.service';
import { invoiceLineTaxChoices, invoiceTotalRateFromChoice, invoiceChoiceFromTotalRate } from '../../utils/invoiceTaxUi';
import { FINANCE_CHANNELS, accountChannel, defaultFinanceAccountId, financeAccountsForChannel } from '../../utils/financeCashBank';
import { findPostedSupplierBillReplay } from '../../utils/supplierPurchaseReplay';
import { purchaseProductOptions } from '../../utils/supplierProductSearch';
import { normalizeSupplierGstin, supplierGstinError, supplierGstinStateCode } from '../../utils/supplierGstin';
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
// Supplier bills use the same two Cash/Bank channels as Finance Management.
const getErrorText = error => {
  const data = error?.response?.data || error?.data || {};
  if (typeof data === 'string') return data;
  const reason = Object.values(data).find(value => typeof value === 'string' || Array.isArray(value));
  return (Array.isArray(reason) ? reason[0] : reason) || error?.message || 'Unable to complete supplier transaction.';
};
const fieldClass = 'cg-supplier-purchase-input';

export default function SupplierPurchaseFlow({
  supplier, initialPart = null, canPurchase = false, canPay = false,
  showPurchase = true, showPayments = true,
  bills = [], onChanged = () => {},
}) {
  const location = useLocation();
  const accountSetupRoute = channel => supplierFinanceSetupRoute(location, channel);
  const [stock, setStock] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const resolvedAccountFor = channel => accounts.find(account =>
    String(account.id) === defaultFinanceAccountId(accounts, channel));
  const accountBalanceShown = account => account.recordedBalance != null
    ? ' · ' + rupees(account.recordedBalance) + ' available'
    : '';
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState('');
  const [settlementError, setSettlementError] = useState('');
  const [settlementNotice, setSettlementNotice] = useState('');
  const [cashSetupOpen, setCashSetupOpen] = useState(false);
  const [cashOpeningBalance, setCashOpeningBalance] = useState('');
  const [cashSetupError, setCashSetupError] = useState('');
  const [creatingCashAccount, setCreatingCashAccount] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const errorRef = useRef(null);
  const prefilled = useRef('');
  const [activePart, setActivePart] = useState(emptyPart);
  const [partSearch, setPartSearch] = useState('');
  const [remoteProducts, setRemoteProducts] = useState([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [productSearchError, setProductSearchError] = useState('');
  const [searchRetry, setSearchRetry] = useState(0);
  const [parts, setParts] = useState([]);
  const [step, setStep] = useState('part');
  const [savingPart, setSavingPart] = useState(false);
  const [posting, setPosting] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(localDate);
  const [purchaseOpenedAt, setPurchaseOpenedAt] = useState(() => new Date().toISOString());
  const [invoiceNumber, setInvoiceNumber] = useState(purchaseReference);
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [splits, setSplits] = useState([]);
  const [settlement, setSettlement] = useState({ amount: '', channel: '', reference: '' });
  const [settling, setSettling] = useState(false);
  const settleKey = useRef(requestKey());

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  const reloadAccounts = async () => {
    const moneyAccounts = await supplierFinanceService.getAccounts();
    setAccounts(moneyAccounts.filter(account => account.isActive && accountChannel(account.kind)));
  };

  const refreshPaymentAccounts = async () => {
    setAccountsLoading(true);
    setAccountsError('');
    try {
      await reloadAccounts();
      setSettlementError('');
    } catch (cause) {
      setAccountsError(getErrorText(cause));
    } finally {
      setAccountsLoading(false);
    }
  };

  const reload = async () => {
    // Payment-account updates must not depend on inventory or GST endpoints.
    await reloadAccounts();
    if (canPurchase && showPurchase) {
      const [items, gst] = await Promise.all([
        stockCatalogService.getItems(),
        supplierFinanceService.getGSTOptions(),
      ]);
      setStock(items);
      setStates(gst.states || []);
      setPlaceOfSupply(previous => previous || gst.suggestedBuyerStateCode || '');
    }
  };

  useEffect(() => {
    let alive = true;
    setAccountsLoading(true);
    setAccountsError('');
    supplierFinanceService.getAccounts()
      .then(moneyAccounts => {
        if (alive) setAccounts(moneyAccounts.filter(account =>
          account.isActive && accountChannel(account.kind)));
      })
      .catch(cause => {
        if (alive) {
          setAccounts([]);
          setAccountsError(getErrorText(cause));
        }
      })
      .finally(() => { if (alive) setAccountsLoading(false); });
    return () => { alive = false; };
  }, [supplier.id]);

  useEffect(() => {
    // The payment tab must work independently of stock and GST lookups.
    if (!canPurchase || !showPurchase) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    Promise.all([stockCatalogService.getItems(), supplierFinanceService.getGSTOptions()])
      .then(([items, gst]) => {
        if (!alive) return;
        setStock(items);
        setStates(gst.states || []);
        setPlaceOfSupply(previous => previous || gst.suggestedBuyerStateCode || '');
      })
      .catch(cause => { if (alive) setError(getErrorText(cause)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [supplier.id, canPurchase, showPurchase]);

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
      gstChoice: unregisteredSupplier || n(item.tax) === 0 ? 'none' :
        invoiceChoiceFromTotalRate(String(item.tax), purchaseJurisdiction) || 'custom',
      customTax: unregisteredSupplier ? '' : String(item.tax || ''),
      zeroClassification: unregisteredSupplier ? 'unregistered' : item.zeroTaxClassification || '',
    }));
    setPartSearch(item.partName || item.name || '');
    setStep('part');
    setNotice('Product and quantity ready. Add Product, then confirm purchase.');
    document.getElementById('supplier-purchase-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [initialPart, stock]);

  // Search the authenticated Django stock endpoint; searching a cached first
  // page could not find some products, especially ones linked to other vendors.
  useEffect(() => {
    const query = partSearch.trim();
    if (!query || !showPurchase) {
      setRemoteProducts([]);
      setSearchingProducts(false);
      setProductSearchError('');
      return undefined;
    }
    let current = true;
    setSearchingProducts(true);
    setProductSearchError('');
    const timer = window.setTimeout(async () => {
      try {
        const rows = await stockCatalogService.getItems(query);
        if (current) setRemoteProducts(Array.isArray(rows) ? rows : []);
      } catch (cause) {
        if (current) {
          setRemoteProducts([]);
          setProductSearchError('Could not search stock. Retry or select a loaded product.');
        }
      } finally {
        if (current) setSearchingProducts(false);
      }
    }, 250);
    return () => { current = false; window.clearTimeout(timer); };
  }, [partSearch, searchRetry, showPurchase]);

  const stockOptions = useMemo(
    () => purchaseProductOptions(stock, remoteProducts, partSearch, partSearch.trim() ? 60 : 80),
    [stock, remoteProducts, partSearch],
  );

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
  const supplierGstin = normalizeSupplierGstin(supplier.gstNo || supplier.gstin);
  const gstinProblem = supplierGstinError(supplierGstin);
  const supplierStateCode = supplierGstinStateCode(supplierGstin);
  const unregisteredSupplier = !supplierGstin;
  const purchaseJurisdiction = placeOfSupply && supplierStateCode && placeOfSupply !== supplierStateCode
    ? 'igst' : 'cgst_sgst';
  const gstBreakup = placeOfSupply && supplierStateCode
    ? (placeOfSupply === supplierStateCode
      ? { mode: 'Intra-state', cgst: Math.round(tax * 50) / 100,
          sgst: Math.round(tax * 100 - Math.round(tax * 50)) / 100, igst: 0 }
      : { mode: 'Inter-state', cgst: 0, sgst: 0, igst: tax })
    : null;
  // Preview only. The backend validates and persists the official supplier
  // purchase GST components when the posted bill is created.

  const selectItem = value => {
    const item = [...remoteProducts, ...stock].find(row => String(row.id) === String(value));
    if (value === '__new__') {
      setActivePart({ ...emptyPart(), itemId: '__new__', description: partSearch.trim() });
    } else if (item) {
      setStock(current => current.some(row => String(row.id) === String(item.id))
        ? current : [item, ...current]);
      setPartSearch(item.partName || item.name || item.sku || '');
      const rate = n(item.tax);
      const matched = invoiceChoiceFromTotalRate(String(rate), purchaseJurisdiction);
      setActivePart(previous => ({
        ...previous, itemId: String(item.id),
        description: item.partName || item.name || '', partNumber: item.partNumber || '',
        hsnCode: item.hsnCode || '', purchaseRate: String(item.costPrice ?? 0),
        sellingPrice: String(item.sellingPrice ?? 0),
        gstChoice: unregisteredSupplier || rate === 0 ? 'none'
          : matched.startsWith('saved:') ? 'custom' : matched,
        customTax: unregisteredSupplier ? '' : String(rate),
        zeroClassification: unregisteredSupplier ? 'unregistered' : item.zeroTaxClassification || '',
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
    if (unregisteredSupplier && rate !== 0) {
      setError('Unregistered supplier: GST must be 0%.'); return;
    }
    if (!unregisteredSupplier && rate === 0 && !part.zeroClassification) {
      setError('Select the 0% GST classification.'); return;
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
          tax: unregisteredSupplier ? 0 : rate,
          zeroTaxClassification: rate === 0
            ? (unregisteredSupplier ? 'unregistered' : part.zeroClassification) : '',
          unit: 'Piece', minimumStock: 0,
        });
        if (!created?.id) throw new Error('Part creation did not return an ID.');
        itemId = String(created.id);
        await reload();
      }
      setParts(rows => [...rows, {
        itemId, description: part.description, quantity: fixed(qty),
        purchaseRate: fixed(cost), sellingPrice: fixed(selling),
        gstRate: String(unregisteredSupplier ? 0 : rate), gstChoice: part.gstChoice,
        gstTreatment: unregisteredSupplier ? 'unregistered'
          : rate === 0 ? part.zeroClassification : 'taxable',
        updateItemPrices: part.updateItemPrices && part.itemId !== '__new__',
      }]);
      setActivePart(emptyPart());
      setPartSearch('');
      setStep('review');
    } catch (cause) { setError(getErrorText(cause)); }
    finally { setSavingPart(false); }
  };

  const changeSplit = (index, changes) => setSplits(rows => rows.map((row, i) => i === index ? { ...row, ...changes } : row));
  const addPaymentChannel = channel => {
    if (!FINANCE_CHANNELS.includes(channel) || splits.length >= 5) return;
    setSplits(existing => [...existing, {
      id: requestKey(), channel, amount: '', reference: '',
    }]);
  };

  const finishPurchase = async () => {
    if (posting || parts.length === 0) return;
    setError('');
    if (!invoiceNumber.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      setError('A valid purchase reference and date are required.'); return;
    }
    const positiveGst = parts.some(row => n(row.gstRate) > 0);
    if (!unregisteredSupplier && !placeOfSupply) {
      setError('Select the buyer state for a GST-registered supplier.'); return;
    }
    if (positiveGst && unregisteredSupplier) {
      setError('This supplier has no GSTIN. Set GST to 0%, or add the real GSTIN in Edit Supplier.'); return;
    }
    if (gstinProblem) {
      setError(gstinProblem + ' Open Edit Supplier to correct or clear the saved GSTIN before posting.'); return;
    }
    const supplierState = supplierStateCode;
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
      if (!FINANCE_CHANNELS.includes(row.channel) ||
        !Number.isFinite(Number(row.amount)) || n(row.amount) <= 0 ||
        !/^\d+(?:\.\d{1,2})?$/.test(String(row.amount))) {
        setError('Choose Cash or Bank and enter a valid amount for every payment.'); return;
      }
      const account = resolvedAccountFor(row.channel);
      if (!account) {
        setError('Choose the Default Payment Account for ' + row.channel + ' in Finance > Accounts.'); return;
      }
      accountTotals.set(String(account.id), n(row.amount) + (accountTotals.get(String(account.id)) || 0));
    }
    for (const [id, value] of accountTotals.entries()) {
      const account = accounts.find(a => String(a.id) === id);
      if (account.recordedBalance != null && n(account.recordedBalance) + 0.0001 < value) {
        setError('Insufficient recorded balance in ' + account.name + '.'); return;
      }
    }
    // Keep the same bill reference and payment keys during a network retry.
    // Django posts the supplier bill, stock receipt and money splits atomically.
    const purchasePayload = {
      supplierId: String(supplier.id), invoiceNumber: invoiceNumber.trim(),
      invoiceDate: purchaseDate, placeOfSupply: unregisteredSupplier ? undefined : placeOfSupply || undefined,
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
        // Django resolves the current default account under a DB lock.
        payments: splits.map(row => ({
          amount: fixed(row.amount), paidOn: purchaseDate, method: row.channel,
          kind: 'Payment', reference: row.reference.trim(), idempotencyKey: row.id,
        })),
      } : {}),
    };
    setPosting(true);
    setNotice('');
    try {
      let recovered = false;
      try {
        await supplierFinanceService.createBill(purchasePayload);
      } catch (cause) {
        // A timeout can occur AFTER Django has committed. Never re-post stock
        // or payments to find out: read the supplier ledger and match the bill.
        const responseStatus = Number(cause?.response?.status || cause?.status || 0);
        const duplicate = /supplier invoice already exists/i.test(String(getErrorText(cause)));
        if (responseStatus && responseStatus < 500 && !duplicate) throw cause;
        let posted = null;
        try {
          posted = findPostedSupplierBillReplay(
            await supplierFinanceService.getBills(supplier.id), {
              supplierId: purchasePayload.supplierId,
              invoiceNumber: purchasePayload.invoiceNumber,
              invoiceDate: purchasePayload.invoiceDate,
              placeOfSupply,
              items: purchasePayload.items,
              total,
              paidNow,
            },
          );
        } catch {
          // Do not mask the original error when the readback also fails.
        }
        if (!posted) throw cause;
        recovered = true;
      }
      setParts([]); setSplits([]); setStep('part');
      setInvoiceNumber(purchaseReference()); setPurchaseDate(localDate());
      setPurchaseOpenedAt(new Date().toISOString());
      setPlaceOfSupply(''); setActivePart(emptyPart());
      setNotice(recovered
        ? 'Purchase was already posted. Stock and payment records were verified; nothing was charged twice.'
        : 'Purchase posted. Stock, GST, Cash/Bank payment and remaining credit were recorded together.');
      try {
        await Promise.resolve(onChanged());
      } catch {
        setError('Purchase was posted, but the summary could not refresh. Reload this page to see updated balances.');
      }
    } catch (cause) { setError(getErrorText(cause)); }
    finally { setPosting(false); }
  };

  const createCashInHandAccount = async () => {
    if (creatingCashAccount) return;
    setCashSetupError('');
    const balance = String(cashOpeningBalance).trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(balance)) {
      setCashSetupError('Enter the actual opening cash balance (₹0 or more, up to two decimals).');
      return;
    }
    // A duplicate account must not be created if an active cash ledger already
    // exists, even if the account selector was previously empty.
    if (financeAccountsForChannel(accounts, 'Cash').length) {
      setCashSetupOpen(false);
      setSettlement(previous => ({
        ...previous, channel: 'Cash',
      }));
      return;
    }
    setCreatingCashAccount(true);
    try {
      const created = await supplierFinanceService.createAccount({
        name: 'Cash in Hand', kind: 'Cash', openingBalance: balance,
      });
      // Use the POST result immediately: a subsequent GET failure must not
      // mislead the user into creating the account a second time.
      if (!created?.id) throw new Error('The account was created but no ID was returned. Refresh Finance Accounts before retrying.');
      const account = { ...created, kind: 'Cash', name: 'Cash in Hand',
        isActive: true, recordedBalance: created.recordedBalance ?? balance };
      setAccounts(previous => [...previous.filter(row => String(row.id) !== String(account.id)), account]);
      setSettlement(previous => ({ ...previous, channel: 'Cash' }));
      setCashSetupOpen(false);
      setCashOpeningBalance('');
      setSettlementError('');
      setSettlementNotice('Cash in Hand account created and selected. You can now record a payment within its recorded balance.');
    } catch (cause) {
      setCashSetupError(getErrorText(cause) + ' Check Finance Accounts before creating another account.');
    } finally {
      setCreatingCashAccount(false);
    }
  };

  const settleExisting = async event => {
    event.preventDefault();
    if (settling) return;
    setError('');
    setSettlementError('');
    setSettlementNotice('');
    const amount = Number(settlement.amount);
    const account = resolvedAccountFor(settlement.channel);
    if (!settlement.amount || !Number.isFinite(amount) || amount <= 0 ||
      !/^\d+(?:\.\d{1,2})?$/.test(String(settlement.amount))) {
      setSettlementError('Enter a payment amount greater than zero (up to two decimal places).');
      return;
    }
    if (amount > remainingSupplier + 0.001) {
      setSettlementError('Payment cannot exceed the supplier balance due.');
      return;
    }
    if (!settlement.channel || !FINANCE_CHANNELS.includes(settlement.channel)) {
      setSettlementError('Select Cash or Bank / UPI as the payment method.');
      return;
    }
    if (accountsLoading || accountsError) {
      setSettlementError('Payment accounts have not loaded. Reload the account list before confirming.');
      return;
    }
    if (!account) {
      setSettlementError('Select a Default Payment Account for ' + settlement.channel +
        ' in Finance > Accounts. This keeps the correct ledger balance.');
      return;
    }
    if (account.recordedBalance != null && amount > n(account.recordedBalance) + 0.001) {
      setSettlementError('Insufficient recorded balance in ' + account.name + '.');
      return;
    }
    let toAllocate = Math.round(amount * 100);
    const allocations = [];
    for (const bill of postedBills) {
      const applied = Math.min(toAllocate, Math.round(n(bill.outstanding) * 100));
      if (applied > 0) allocations.push({ billId: bill.id, amount: (applied / 100).toFixed(2) });
      toAllocate -= applied;
    }
    if (toAllocate > 0 || !allocations.length) {
      setSettlementError('Payment exceeds the remaining posted supplier bills. Refresh and try again.');
      return;
    }
    setSettling(true);
    try {
      await supplierFinanceService.recordPayment({
        supplierId: supplier.id, amount: fixed(amount),
        kind: 'Payment', method: settlement.channel,
        paidOn: localDate(), reference: settlement.reference.trim(),
        allocations, idempotencyKey: settleKey.current,
      });
      // The write succeeded. Never suggest retrying the payment because a
      // subsequent read-only balance refresh failed.
      settleKey.current = requestKey();
      setSettlement({ amount: '', channel: '', reference: '' });
      setSettlementNotice('Payment recorded successfully. Supplier credit and account balance have been updated.');
      const refreshes = await Promise.allSettled([Promise.resolve().then(() => onChanged()), reloadAccounts()]);
      if (refreshes.some(result => result.status === 'rejected')) {
        setSettlementNotice('Payment recorded. Some balances could not refresh; reload to view the latest transactions. Do not pay again.');
      }
    } catch (cause) {
      const status = Number(cause?.status || cause?.response?.status || 0);
      const uncertain = !status || status >= 500;
      setSettlementError(uncertain
        ? 'Payment confirmation is unavailable. Check Supplier Transactions before attempting again to prevent a duplicate payment.'
        : getErrorText(cause));
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="cg-supplier-purchase-wrap">
      {error && <p ref={errorRef} className="cg-supplier-purchase-error" role="alert">{error}</p>}
      {notice && <p className="cg-supplier-purchase-muted" role="status">{notice}</p>}
      {canPurchase && (
        <section id="supplier-purchase-form" hidden={!showPurchase} className="cg-supplier-purchase-card">
          <header>
            <div><h2>Buy / Receive Spare Parts</h2>
              <p>Add product and quantity, then confirm purchase.</p></div>
            <span className="cg-supplier-purchase-tag">Supplier: {supplier.name}</span>
          </header>
          <div className="cg-supplier-purchase-clock">
            <span>Purchase date: <strong>{purchaseDate}</strong></span>
            <span>Started: <strong>{new Date(purchaseOpenedAt).toLocaleString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}</strong></span>
          </div>
          {loading && <p role="status">Loading inventory and accounts…</p>}
          {!loading && step === 'part' && (
            <div className="cg-supplier-purchase-grid">
              <div className="wide cg-supplier-product-search">
                <label htmlFor="supplier-stock-search">Search product</label>
                <input id="supplier-stock-search" className={fieldClass} type="search" value={partSearch}
                  onChange={event => {
                    setPartSearch(event.target.value);
                    setActivePart(emptyPart());
                  }}
                  placeholder="Product name, SKU, part number or barcode" autoComplete="off"/>
                {searchingProducts && <small role="status">Searching products…</small>}
                {productSearchError && <p role="alert" className="cg-supplier-purchase-error">
                  {productSearchError} <button type="button" onClick={() => setSearchRetry(n => n + 1)}>Retry</button>
                </p>}
                {partSearch.trim() && !searchingProducts && (
                  <div className="cg-supplier-product-results" role="group" aria-label="Matching products">
                    {stockOptions.slice(0, 12).map(item => (
                      <button key={item.id} type="button"
                        className={String(activePart.itemId) === String(item.id) ? 'is-selected' : ''}
                        onClick={() => selectItem(String(item.id))}>
                        <strong>{item.partName || item.name || 'Product'}</strong>
                        <small>{item.sku || item.partNumber || 'No SKU'} · Stock {item.onHand ?? 0}</small>
                      </button>))}
                    {!stockOptions.length && !productSearchError &&
                      <small>No matching product. Choose Create New Product below.</small>}
                  </div>
                )}
              </div>
              <label className="wide">Product *
                <select className={fieldClass} value={activePart.itemId}
                  onChange={e => selectItem(e.target.value)}>
                  <option value="">Choose product</option>
                  {stockOptions.map(item => <option key={item.id} value={String(item.id)}>
                    {item.partName || item.name} — {item.sku || 'No SKU'} · Stock {item.onHand ?? 0}
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
              {!unregisteredSupplier && (
                <label>GST / Tax for this product *
                  <select className={fieldClass} value={activePart.gstChoice}
                    onChange={e => setActivePart(p => ({ ...p, gstChoice: e.target.value }))}>
                    <option value="none">0% — Select Classification</option>
                    {choices.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    <option value="custom">Other saved / HSN-specific total %</option>
                  </select>
                </label>
              )}
              {!unregisteredSupplier && activePart.gstChoice === 'custom' &&
                <label>Custom total GST (%) *
                  <input className={fieldClass} type="number" min="0" max="100" step="0.01"
                    value={activePart.customTax} onChange={e => setActivePart(p => ({ ...p, customTax: e.target.value }))}/>
                </label>}
              {!unregisteredSupplier && totalRate(activePart) === 0 &&
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
              {unregisteredSupplier && (
                 <p className="wide cg-supplier-purchase-muted">
                   No GST (Unregistered).{' '}
                   <a href="#supplier-profile">Add supplier GSTIN</a> to enable GST purchases.
                 </p>
               )}
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
                  {!unregisteredSupplier && (
                   <label>Buyer State (GST) *
                     <select className={fieldClass} value={placeOfSupply}
                       onChange={e => setPlaceOfSupply(e.target.value)}>
                       <option value="">Select buyer state</option>
                       {states.map(row => <option key={row.code} value={row.code}>{row.code} — {row.name}</option>)}
                     </select>
                   </label>
                 )}
                </div>
                {(gstinProblem || (parts.some(row => n(row.gstRate) > 0) && !supplierGstin)) &&
                  <div className="cg-supplier-purchase-error" role="alert">
                    <strong>Supplier GSTIN needs attention.</strong>{' '}
                    {gstinProblem || 'Supplier is unregistered and cannot charge GST.'}{' '}
                    <a href="#supplier-profile">Open Supplier Details</a>, then use Edit Supplier.
                    If unregistered, leave GSTIN blank and purchase at 0% GST.
                  </div>}
                <div className="cg-supplier-purchase-total">
                  <div><span>Parts subtotal</span><strong>{rupees(subtotal)}</strong></div>
                  <div><span>GST</span><strong>{rupees(tax)}</strong></div>
                  <div><span>Purchase Total</span><strong>{rupees(total)}</strong></div>
                  <div><span>Pay Now</span><strong>{rupees(paidNow)}</strong></div>
                  <div><span>Supplier Credit (Due)</span><strong>{rupees(remaining)}</strong></div>
                </div>
                {gstBreakup && <div className="cg-supplier-gst-breakup" role="status">
                  <strong>{gstBreakup.mode} GST estimate</strong>
                  <span>CGST {rupees(gstBreakup.cgst)}</span>
                  <span>{['04', '26', '31', '35', '38'].includes(placeOfSupply) ? 'UTGST' : 'SGST'} {rupees(gstBreakup.sgst)}</span>
                  <span>IGST {rupees(gstBreakup.igst)}</span>
                  <small>Final statutory GST is calculated and verified by Django when the purchase bill is posted.</small>
                </div>}
                <h3>How are you paying the supplier?</h3>
                <p className="cg-supplier-purchase-muted">No payment = full credit. Choose Cash in Hand or Bank accounts below; multiple payments and partial credit are supported.</p>
                <div className="cg-supplier-payment-channel-actions" aria-label="Choose payment method">
                  <button type="button" onClick={() => setSplits([])} disabled={!splits.length || posting}>
                    Full Credit · Pay Later
                  </button>
                  <button type="button" onClick={() => addPaymentChannel('Cash')} disabled={splits.length >= 5 || posting}>
                    + Cash in Hand
                  </button>
                  <button type="button" onClick={() => addPaymentChannel('Bank')} disabled={splits.length >= 5 || posting}>
                    + Bank Payment
                  </button>
                </div>
                {splits.length > 0 && <p className="cg-supplier-purchase-muted">
                  Pay full or partial now. Outstanding credit after these payments: <strong>{rupees(remaining)}</strong>
                </p>}
                {splits.map((row, index) => (
                  <div className="cg-supplier-purchase-split" key={row.id}>
                    <label>Payment method *
                      <select className={fieldClass} value={row.channel || ''}
                        onChange={e => changeSplit(index, { channel: e.target.value })}>
                        <option value="">Select method</option>
                        <option value="Cash">Cash in Hand</option>
                        <option value="Bank">Bank</option>
                      </select>
                    </label>
                    {row.channel && <p className="cg-supplier-debit-preview">
                      {resolvedAccountFor(row.channel)
                        ? <>Finance debit: <strong>{resolvedAccountFor(row.channel).name}</strong></>
                        : <Link to={accountSetupRoute(row.channel)}>Set default {row.channel} payment account in Finance</Link>}
                    </p>}
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
                    onClick={() => addPaymentChannel('Cash')}>
                    + Add Cash / Bank Payment
                  </button>
                  <button type="button" className="primary" disabled={posting || parts.length === 0}
                    onClick={finishPurchase}>
                    {posting ? 'Posting…' : 'Confirm Purchase & Payment'}
                  </button>
                </div>
                {!accounts.length && <p role="alert" className="cg-supplier-purchase-muted">
                  No active Cash/Bank account found. <Link to="/finance/accounts">Create a Cash or Bank account</Link>,
                  or record this purchase as supplier credit.
                </p>}
                <p className="cg-supplier-purchase-muted">Confirm to receive stock and record payment or supplier credit.</p>
              </>}
            </div>
          )}
        </section>
      )}

      {canPay && (
        <section id="supplier-pay-now" hidden={!showPayments} className="cg-supplier-purchase-card">
          <header><div><h2>Pay Previous Supplier Credit</h2>
            <p>Pay unpaid purchase bills.</p></div>
            <strong>{rupees(remainingSupplier)} due</strong>
          </header>
          {!postedBills.length
            ? <p className="cg-supplier-purchase-muted">No pending supplier bills.</p>
            : <form className="cg-supplier-purchase-grid" onSubmit={settleExisting}>
              <label>Pay amount (₹) *
                <input className={fieldClass} type="number" min="0.01" max={fixed(remainingSupplier)} step="0.01"
                  value={settlement.amount} onChange={e => { setSettlement(old => ({ ...old, amount: e.target.value })); setSettlementError(''); }}/>
              </label>
              <label>Payment method *
                <select className={fieldClass} value={settlement.channel}
                  onChange={e => {
                    const channel = e.target.value;
                    setSettlement(old => ({ ...old, channel }));
                    setCashSetupOpen(false);
                    setCashSetupError('');
                    setSettlementError('');
                  }}>
                  <option value="">Select method</option>
                  <option value="Cash">Cash in Hand</option>
                  <option value="Bank">Bank / UPI (PhonePe, GPay, transfer)</option>
                </select>
              </label>
              {settlement.channel && resolvedAccountFor(settlement.channel) &&
                <p className="cg-supplier-debit-preview" role="status">
                  Automatically deducted from <strong>{resolvedAccountFor(settlement.channel).name}</strong>
                  {accountBalanceShown(resolvedAccountFor(settlement.channel))} in <Link to="/finance">Finance</Link>.
                </p>}
              {settlement.channel && !accountsLoading && !accountsError &&
                !resolvedAccountFor(settlement.channel) &&
                financeAccountsForChannel(accounts, settlement.channel).length > 0 &&
                <div className="cg-supplier-debit-preview" role="alert">
                  Multiple accounts found. Set the {settlement.channel === 'Cash' ? 'Cash' : 'Bank / UPI'} account
                  you want to use for this payment.
                  <div className="cg-supplier-finance-route-actions">
                    <Link to={accountSetupRoute(settlement.channel)} className="cg-supplier-finance-route-link">
                      Set Default {settlement.channel === 'Cash' ? 'Cash' : 'Bank'} Account
                    </Link>
                    <button type="button" className="cg-supplier-finance-refresh" onClick={refreshPaymentAccounts}>
                      Refresh Accounts
                    </button>
                  </div>
                </div>}
              {settlement.channel === 'Cash' && !accountsLoading && !accountsError &&
                financeAccountsForChannel(accounts, 'Cash').length === 0 && (
                  <div className="wide cg-supplier-cash-setup">
                    <p>No active Cash in Hand account found. Create one to track physical cash payments.</p>
                    {!cashSetupOpen
                      ? <button type="button" className="cg-supplier-inline-account-btn" onClick={() => {
                          setCashSetupOpen(true); setCashSetupError('');
                        }}>+ Create Cash in Hand account</button>
                      : <div className="cg-supplier-cash-setup-controls">
                          <label>Actual opening cash balance (₹) *
                            <input className={fieldClass} type="number" min="0" step="0.01"
                              inputMode="decimal" placeholder="e.g. 1500.00" value={cashOpeningBalance}
                              onChange={event => { setCashOpeningBalance(event.target.value); setCashSetupError(''); }} />
                          </label>
                          <small>Enter only cash physically available at the workshop. It will be the account opening balance, not an expense or supplier payment.</small>
                          {cashSetupError && <p className="cg-supplier-purchase-error" role="alert">{cashSetupError}</p>}
                          <div className="cg-supplier-purchase-actions">
                            <button type="button" className="primary" disabled={creatingCashAccount}
                              onClick={createCashInHandAccount}>
                              {creatingCashAccount ? 'Creating…' : 'Create & Select Cash Account'}
                            </button>
                            <button type="button" disabled={creatingCashAccount}
                              onClick={() => { setCashSetupOpen(false); setCashSetupError(''); }}>Cancel</button>
                          </div>
                        </div>}
                    <small>You can also <Link to="/finance/accounts">manage Cash / Bank accounts</Link> in Finance.</small>
                  </div>
                )}
              <label className="wide">Payment reference (optional)
                <input className={fieldClass} value={settlement.reference} maxLength={120}
                  onChange={e => { setSettlement(old => ({ ...old, reference: e.target.value })); setSettlementError(''); }}/>
              </label>
              <p className="wide cg-supplier-purchase-muted">
                This settles existing posted supplier bills only; no second stock receipt or expense will be created.
                Remaining credit after this payment: {rupees(Math.max(0, remainingSupplier - n(settlement.amount)))}
              </p>
              {accountsLoading && <p className="wide cg-supplier-purchase-muted" role="status">Loading payment accounts…</p>}
              {accountsError && <div className="wide cg-supplier-purchase-error" role="alert">
                Unable to load Cash / Bank accounts: {accountsError}{' '}
                <button type="button" onClick={() => {
                  setAccountsLoading(true);
                  setAccountsError('');
                  reloadAccounts().catch(cause => setAccountsError(getErrorText(cause)))
                    .finally(() => setAccountsLoading(false));
                }}>Retry loading accounts</button>
              </div>}
              {!accountsLoading && !accountsError && !accounts.length && settlement.channel !== 'Cash' &&
                <p className="wide cg-supplier-purchase-muted" role="status">
                  No payment account found. <Link to="/finance/accounts">Add a Cash / Bank / UPI account</Link> first.
                </p>}
              {settlementError && <div className="wide cg-supplier-purchase-error" role="alert">
                <p>{settlementError}</p>
                {settlement.channel && !resolvedAccountFor(settlement.channel) && (
                  <div className="cg-supplier-finance-route-actions">
                    <Link to={accountSetupRoute(settlement.channel)} className="cg-supplier-finance-route-link">
                      Set Default {settlement.channel === 'Cash' ? 'Cash' : 'Bank'} Account
                    </Link>
                    <button type="button" className="cg-supplier-finance-refresh" onClick={refreshPaymentAccounts}>
                      Refresh Accounts
                    </button>
                  </div>
                )}
              </div>}
              {settlementNotice && <p className="wide cg-supplier-purchase-muted" role="status">{settlementNotice}</p>}
              <div className="wide cg-supplier-purchase-actions">
                <button type="submit" className="primary" disabled={settling} aria-busy={settling}>
                  {settling ? 'Recording…' : 'Confirm Supplier Payment'}
                </button>
              </div>
            </form>}
        </section>
      )}
    </div>
  );
}
