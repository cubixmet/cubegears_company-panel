import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../api/apiClient';
import { USE_MOCK_API } from '../../api/apiConfig';
import { AlertTriangle, Boxes, ChevronRight, History, PackageMinus, PackagePlus, Plus, RefreshCw, Search, ShoppingCart, Wrench } from 'lucide-react';
import { ResponsiveModalSheet } from '../../components/common/ResponsiveModalSheet';
import { stockCatalogService } from '../../services/stockCatalog.service';
import InventoryBranchOperations from '../../components/stock/InventoryBranchOperations';
import StockProductLink from '../../components/stock/StockProductLink';
import InventoryCategories from '../../components/stock/InventoryCategories';
import { supplierService } from '../../services/supplier.service';
import { CountryPhoneField } from '../../components/common/CountryPhoneField';
import { stockState, ZERO_GST_CLASSIFICATIONS } from '../../utils/stockPresentation';
import { validInternationalPhone } from '../../utils/jobCreateAdapters';
import { supplierFinanceService } from '../../services/supplierFinance.service';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import StockFinanceConnections from '../../components/stock/StockFinanceConnections';
import StockPurchaseStartDialog from '../../components/stock/StockPurchaseStartDialog';
import { invoiceLineTaxChoices, invoiceTotalRateFromChoice } from '../../utils/invoiceTaxUi';
import { INDIA_STATES } from '../../utils/indiaGst';
import { normalizeSupplierGstin, supplierGstinStateCode } from '../../utils/supplierGstin';
import { localDate } from '../../services/expense.mapper';
import '../../styles/stock-easy.css';
import '../../styles/stock-form-polish.css';
import '../../styles/stock-list-polish.css';

const number = (value) => Number(value) || 0;
// Inventory uses the same CGST / SGST / IGST component options as invoices.
const STOCK_GST_CHOICES = invoiceLineTaxChoices('unknown');
const validGstRate = (value) =>
  /^\d{1,3}(?:\.\d{1,2})?$/.test(String(value)) &&
  Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100;
const list = (result) => Array.isArray(result) ? result : (result?.results || []);
const MAX_STOCK_QUANTITY = 9_999_999_999.99;
const initialPart = { partName: '', partNumber: '', supplier: '', brand: '', category: '', unit: 'Piece',
  costPrice: '', sellingPrice: '', tax: '0', zeroTaxClassification: '', hsnCode: '', stockQuantity: '',
  minimumStock: '5', location: '', stockSource: '', requestKey: '', invoiceNumber: '', invoiceDate: '',
  placeOfSupply: '' };
const initialSupplier = { name: '', phone: '', gstNo: '', address: '' };

function OutlinedInput({ label, ...props }) {
  return <label className="cg-easy-floating">
    <input {...props} placeholder=" " />
    <span>{label}</span>
  </label>;
}

function OutlinedSelect({ label, children, ...props }) {
  return <label className="cg-easy-floating is-select">
    <select {...props}>{children}</select>
    <span>{label}</span>
  </label>;
}
function RackCombobox({ value, onChange, suggestions }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const id = useId();
  const options = useMemo(() => suggestions.filter((name) =>
    name.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 12),
    [suggestions, value]);
  const newLocation = value.trim() &&
    !suggestions.some((name) => name.toLowerCase() === value.trim().toLowerCase());
  const entries = [...options, ...(newLocation ? [value.trim()] : [])];
  const select = (name) => { onChange(name); setActive(-1); setOpen(false); };
  return <div className="cg-rack-combobox">
    <label htmlFor={id}>Rack / Storage Location</label>
    <input id={id} role="combobox" aria-expanded={open} aria-controls={id + '-options'}
      aria-autocomplete="list" aria-activedescendant={open && active >= 0 ? id + '-option-' + active : undefined}
      placeholder="Search or enter location" value={value} maxLength={80}
      onChange={e => { onChange(e.target.value); setActive(-1); setOpen(true); }}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={e => {
        if (e.key === 'Escape') { setOpen(false); setActive(-1); }
        if (e.key === 'ArrowDown' && entries.length) { e.preventDefault(); setOpen(true); setActive(i => (i + 1) % entries.length); }
        if (e.key === 'ArrowUp' && entries.length) { e.preventDefault(); setOpen(true); setActive(i => (i - 1 + entries.length) % entries.length); }
        if (e.key === 'Enter' && open && active >= 0 && entries[active]) { e.preventDefault(); select(entries[active]); }
      }} />
    {open && entries.length > 0 && <div role="listbox" id={id + '-options'} className="cg-rack-options">
      {entries.map((name, index) => <button type="button" role="option" aria-selected={active === index}
        id={id + '-option-' + index} key={name.toLowerCase()}
        className={active === index ? 'is-active' : ''}
        onPointerDown={event => event.preventDefault()}
        onClick={() => select(name)}>
        {newLocation && index === entries.length - 1 ? '+ Use new location: ' : ''}{name}
      </button>)}
    </div>}
  </div>;
}

const inventoryRequestKey = () => globalThis.crypto?.randomUUID?.() || `stock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const initialMove = { mode: 'in', itemId: '', quantity: '1', invoiceNo: '', notes: '', costPrice: '', sellingPrice: '', priceMode: '', requestKey: '' };

export default function StockEasyPage() {
  const navigate = useNavigate();
  const { can } = useFeatureAccess();
  const canManageStock = can('stock.edit');
  const canCreateStock = can('stock.create');
  const canPurchaseStock = can('stock.view') && can('stock.create') &&
    can('stock.edit') && can('payments.view') && can('payments.create') &&
    !USE_MOCK_API;
  const canViewGSTR = can('gstr.view');
  // Supplier credit is financial data. The balances endpoint requires both
  // stock.view and payments.view; catalog access alone never grants it.
  const canViewSupplierFinance = can('stock.view') && can('payments.view') && !USE_MOCK_API;
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get('search') || '').slice(0, 120);
  const filterValue = searchParams.get('filter') || 'all';
  const filter = ['all', 'low', 'out'].includes(filterValue) ? filterValue : 'all';
  const supplierId = searchParams.get('supplier') || '';
  const [branchBalances, setBranchBalances] = useState(USE_MOCK_API ? [] : null);
  const updateQueryParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: key === 'search' });
  };
  const setQuery = (value) => updateQueryParam('search', value);
  const setFilter = (value) => updateQueryParam('filter', value);
  const [supplier, setSupplier] = useState(null);
  const [supplierError, setSupplierError] = useState('');
  useEffect(() => {
    if (!supplierId) { setSupplier(null); setSupplierError(''); return undefined; }
    let alive = true;
    setSupplier(null);
    setSupplierError('');
    if (USE_MOCK_API) {
      setSupplierError('Supplier details require the live Django backend.');
      return undefined;
    }
    apiClient.get(`/stock/suppliers/${encodeURIComponent(supplierId)}`)
      .then((data) => { if (alive) setSupplier(data); })
      .catch((cause) => { if (alive) setSupplierError(cause?.message || 'Supplier not found or unavailable.'); });
    return () => { alive = false; };
  }, [supplierId]);
  const [items, setItems] = useState([]);
  const [remoteMatches, setRemoteMatches] = useState(null);
  const [rackLocations, setRackLocations] = useState([]);
  const [partErrors, setPartErrors] = useState({});
  const partFormRef = useRef(null);
  const [ledger, setLedger] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryLoadError, setCategoryLoadError] = useState('');
  const [draftBrands, setDraftBrands] = useState([]);
  const [partChoice, setPartChoice] = useState(null);
  const [partChoiceSaving, setPartChoiceSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [quickSupplierOpen, setQuickSupplierOpen] = useState(false);
  const [quickSupplier, setQuickSupplier] = useState(initialSupplier);
  const [quickSupplierError, setQuickSupplierError] = useState('');
  const [quickSupplierSaving, setQuickSupplierSaving] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [supplierBalances, setSupplierBalances] = useState(null);
  const [financeError, setFinanceError] = useState('');
  const [financeLoading, setFinanceLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (loading || !['#branch-stock', '#parts-products'].includes(hash)) return;
    const section = document.getElementById(hash.slice(1));
    section?.focus({ preventScroll: true });
    section?.scrollIntoView({ block: 'start' });
  }, [hash, loading]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [partOpen, setPartOpen] = useState(false);
  const [part, setPart] = useState(initialPart);
  const [partGstChoice, setPartGstChoice] = useState('none');
  const [partLookup, setPartLookup] = useState('');
  const [partMode, setPartMode] = useState('find');
  const [moveLookup, setMoveLookup] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [move, setMove] = useState(initialMove);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveItem, setReceiveItem] = useState(null);

  const reload = async () => {
    setLoading(true);
    setFinanceLoading(canViewSupplierFinance);
    setFinanceError('');
    if (!canViewSupplierFinance) setSupplierBalances(null);
    try {
      const [inventory, stats, movements, groups, vendors, supplierCredit] = await Promise.allSettled([
        stockCatalogService.getItems(),
        stockCatalogService.getStockDashboard(),
        stockCatalogService.getLedger(),
        stockCatalogService.getCategories(),
        stockCatalogService.getSuppliers(),
        canViewSupplierFinance ? supplierFinanceService.getSupplierBalances() : Promise.resolve(null),
      ]);
      if (inventory.status === 'fulfilled') {
        setItems(list(inventory.value).sort((a, b) =>
          String(b.created_at || b.createdAt || '').localeCompare(String(a.created_at || a.createdAt || ''))
        ));
      }
      if (canViewSupplierFinance) {
        if (supplierCredit.status === 'fulfilled' && Array.isArray(supplierCredit.value)) {
          setSupplierBalances(supplierCredit.value);
        } else {
          setSupplierBalances(null);
          setFinanceError(supplierCredit.reason?.message || 'Supplier balances are unavailable.');
        }
      }
      setDashboard(stats.status === 'fulfilled' ? stats.value : null);
      setLedger(movements.status === 'fulfilled' ? list(movements.value) : []);
      setCategories(groups.status === 'fulfilled' ? list(groups.value) : []);
      setCategoryLoadError(groups.status === 'rejected' ? 'Unable to load inventory categories.' : '');
      setSuppliers(vendors.status === 'fulfilled' ? list(vendors.value) : []);
      setError(inventory.status === 'rejected' ? inventory.reason?.message || 'Could not load stock. Check the backend connection.' : '');
    } catch (exception) {
      setError(exception?.message || 'Could not load stock. Check the backend connection.');
    } finally {
      setLoading(false);
      setFinanceLoading(false);
    }
  };

  // Feature access loads asynchronously. Reload supplier balances when the
  // logged-in role is resolved without ever querying restricted Finance data.
  useEffect(() => { reload(); }, [canViewSupplierFinance]);

  // Query the persisted backend catalogue rather than only the currently loaded page.
  useEffect(() => {
    if (!query.trim()) { setRemoteMatches(null); return undefined; }
    let alive = true;
    const timer = setTimeout(() => {
      stockCatalogService.getItems(query.trim())
        .then(rows => { if (alive) setRemoteMatches(list(rows)); })
        .catch(() => { if (alive) setRemoteMatches(null); });
    }, 200);
    return () => { alive = false; clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    if (!partOpen || partMode !== 'new') return undefined;
    let alive = true;
    const timer = setTimeout(() => {
      stockCatalogService.getRackLocations(part.location.trim())
        .then(values => { if (alive) setRackLocations(list(values).filter(v => typeof v === 'string')); })
        .catch(() => { if (alive) setRackLocations([]); });
    }, 180);
    return () => { alive = false; clearTimeout(timer); };
  }, [partOpen, partMode, part.location]);

  const filtered = useMemo(() => (remoteMatches ?? items).filter((item) => {
    const search = [item.partName, item.name, item.partNumber, item.sku, item.barcode, item.brand, item.rack, item.location, item.supplierName, item.categoryName]
      .join(' ').toLowerCase().includes(query.trim().toLowerCase());
    const matchingSupplier = !supplierId || String(item.supplier?.id || item.supplier || '') === String(supplierId);
    return search && matchingSupplier && (filter === 'all' || stockState(item).tone === filter);
  }), [items, remoteMatches, query, filter, supplierId]);

  const lowCount = items.filter((item) => stockState(item).tone === 'low').length;
  const outCount = items.filter((item) => stockState(item).tone === 'out').length;
  const totalValue = canManageStock ? (dashboard?.totalValue ?? items.reduce(
    (total, item) => total + number(item.onHand) * number(item.costPrice), 0
  )) : null;
  const selected = items.find((item) => String(item.id) === String(move.itemId));
  const selectedAvailable = selected ? number(selected.branchAvailable ?? selected.available ?? (number(selected.onHand) - number(selected.reserved))) : 0;
  const matchingParts = useMemo(() => items.filter((item) =>
    [item.partName, item.partNumber, item.sku, item.barcode, item.brand].join(' ').toLowerCase().includes(partLookup.trim().toLowerCase())
  ).slice(0, 8), [items, partLookup]);
  const brands = useMemo(() => {
    const names = new Map();
    for (const value of [...items.map((item) => item.brand), ...draftBrands]) {
      const name = String(value ?? '').trim();
      if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
    }
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }, [items, draftBrands]);
  const receiptMatches = useMemo(() => items.filter((item) =>
    [item.partName, item.partNumber, item.sku, item.barcode, item.brand].join(' ').toLowerCase().includes(moveLookup.trim().toLowerCase())
  ).slice(0, 12), [items, moveLookup]);
  const receiptPricesDiffer = selected && move.mode === 'in' &&
    (Number(move.costPrice) !== number(selected.costPrice) || Number(move.sellingPrice) !== number(selected.sellingPrice));
  const selectMovePart = (item) => {
    setMove((current) => ({ ...current, itemId: String(item.id),
      costPrice: String(item.costPrice ?? '0'), sellingPrice: String(item.sellingPrice ?? '0'), priceMode: '' }));
    setMoveLookup(item.partName || item.name || item.sku || '');
    setError('');
  };
  const openPartDialog = (lookup = '') => {
    setError('');
    setPart({ ...initialPart, supplier: supplierId });
    setPartGstChoice('none');
    setPartErrors({});
    setQuickSupplierOpen(false);
    setQuickSupplierError('');
    setPartChoice(null);
    setDraftBrands([]);
    setPartMode('find'); setPartLookup(lookup); setPartOpen(true);
  };

  const createCategory = async (name, parent) => {
    const category = await stockCatalogService.createCategory({ name, parent });
    setCategories(previous => [...previous.filter(row => String(row.id) !== String(category.id)), category]);
    return category;
  };

  const openPartChoice = (kind) => {
    setQuickSupplierOpen(false);
    setPartChoice({ kind, name: '', parent: '', error: '' });
  };

  const savePartChoice = async () => {
    if (!partChoice || partChoiceSaving) return;
    const name = partChoice.name.trim();
    if (!name) return;
    if (partChoice.kind === 'brand') {
      const existing = brands.find(brand => brand.toLowerCase() === name.toLowerCase());
      if (!existing) setDraftBrands(previous => [...previous, name]);
      setPart(previous => ({ ...previous, brand: existing || name }));
      setPartChoice(null);
      return;
    }
    setPartChoiceSaving(true);
    try {
      const category = await createCategory(name, partChoice.parent);
      setPart(previous => ({ ...previous, category: String(category.id) }));
      setPartChoice(null);
    } catch (cause) {
      setPartChoice(previous => ({ ...previous, error: cause?.message || 'Unable to save category.' }));
    } finally {
      setPartChoiceSaving(false);
    }
  };

  const createQuickSupplier = async () => {
    if (quickSupplierSaving || !quickSupplier.name.trim()) {
      setQuickSupplierError('Supplier Name is required.');
      return;
    }
    if (quickSupplier.phone.trim() && !validInternationalPhone(quickSupplier.phone)) {
      setQuickSupplierError('Enter the supplier phone with the correct country-code length.');
      return;
    }
    setQuickSupplierSaving(true);
    setQuickSupplierError('');
    try {
      const vendor = await supplierService.create({
        ...quickSupplier, name: quickSupplier.name.trim(),
      });
      setSuppliers(previous => [vendor, ...previous.filter(row => String(row.id) !== String(vendor.id))]);
      setPart(previous => ({ ...previous, supplier: String(vendor.id) }));
      setQuickSupplier(initialSupplier);
      setQuickSupplierOpen(false);
    } catch (cause) {
      const detail = cause?.response?.data || {};
      setQuickSupplierError(detail?.gstNo?.[0] || detail?.name?.[0] || detail?.message ||
        cause?.message || 'Unable to create supplier.');
    } finally {
      setQuickSupplierSaving(false);
    }
  };

  const beginMove = (mode, itemId = '', partItem = null) => {
    setError('');
    // Supplier purchases must use the canonical bill + GST + Finance workflow.
    // Selecting a supplier in this dialog is sufficient for catalog items that
    // have never been assigned to a supplier; posting the bill links the item.
    const item = partItem || items.find(row => String(row.id) === String(itemId)) ||
      (remoteMatches || []).find(row => String(row.id) === String(itemId));
    if (mode === 'in') {
      if (!canPurchaseStock) {
        setError('Receiving a supplier purchase needs Stock Edit and Payments permissions.');
        return;
      }
      setReceiveItem(item || null);
      setReceiveOpen(true);
      return;
    }
    setMove({ ...initialMove, mode, requestKey: inventoryRequestKey(), itemId: String(itemId || ''),
      costPrice: item ? String(item.costPrice ?? 0) : '',
      sellingPrice: item ? String(item.sellingPrice ?? 0) : '' });
    setMoveLookup(item?.partName || item?.name || '');
    setMoveOpen(true);
  };

  const continueStockPurchase = ({ itemId, supplierId: selectedSupplierId, quantity, purchaseRate }) => {
    setReceiveOpen(false);
    setReceiveItem(null);
    navigate('/suppliers/' + encodeURIComponent(selectedSupplierId) + '#supplier-purchase-form', {
      state: {
        purchasePrefill: {
          itemId, quantity, purchaseRate, supplierId: selectedSupplierId,
        },
      },
    });
  };

  const selectedPartSupplier = suppliers.find(supplier => String(supplier.id) === String(part.supplier));
  const partSupplierGstin = normalizeSupplierGstin(selectedPartSupplier?.gstin || selectedPartSupplier?.gstNo);
  const stockSource = number(part.stockQuantity) > 0 ? part.stockSource : '';
  const isCreditPurchase = stockSource === 'credit';
  const isSupplierStep = stockSource === 'supplier';

  const savePart = async (event) => {
    event.preventDefault();
    if (saving || partChoice) return;
    if (!part.partName.trim() ||
        part.costPrice === '' || part.sellingPrice === '' ||
        !Number.isFinite(Number(part.costPrice)) || Number(part.costPrice) < 0 ||
        !Number.isFinite(Number(part.sellingPrice)) || Number(part.sellingPrice) < 0) {
      setError('Enter a part name, valid purchase cost and selling price.');
      partFormRef.current?.querySelector('input[required]')?.focus(); return;
    }
    if (part.partNumber.trim() && !/^[A-Za-z0-9][A-Za-z0-9._/+#() -]*$/.test(part.partNumber.trim())) {
      setPartErrors({ partNumber: 'Enter a valid manufacturer part number.' });
      partFormRef.current?.querySelector('[data-field="partNumber"]')?.focus();
      return;
    }
    if (!validGstRate(part.tax)) {
      setError('Choose a valid GST rate between 0% and 100% (up to two decimals).'); return;
    }
    if (Number(part.tax) === 0 &&
        !ZERO_GST_CLASSIFICATIONS.some(([code]) => code === part.zeroTaxClassification)) {
      const message = 'Choose a 0% GST classification.';
      setPartErrors(previous => ({ ...previous, zeroTaxClassification: message }));
      setError(message);
      requestAnimationFrame(() => partFormRef.current?.querySelector('[data-field="zeroTaxClassification"]')?.focus());
      return;
    }
    const quantityText = String(part.stockQuantity ?? '').trim();
    const quantity = number(quantityText);
    if (!/^\d+(?:\.\d{1,2})?$/.test(quantityText || '0') || quantity < 0 || quantity > 1000000) {
      const message = 'Enter a quantity from 0 to 1,000,000 with up to two decimal places.';
      setPartErrors(previous => ({ ...previous, stockQuantity: message }));
      setError(message);
      requestAnimationFrame(() => {
        const input = partFormRef.current?.querySelector('[data-field="stockQuantity"]');
        input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input?.focus();
      });
      return;
    }
    if (quantity > 0 && !stockSource) {
      setError('Choose how to receive this quantity.');
      partFormRef.current?.querySelector('[data-field="stockSource"]')?.focus();
      return;
    }
    if ((isCreditPurchase || isSupplierStep) && !canPurchaseStock) {
      setError('Receiving a purchase needs Stock Edit and Payments permissions. You may save the product with quantity 0.');
      return;
    }
    if ((isCreditPurchase || isSupplierStep) && !part.supplier) {
      setError('Select or add the supplier for this purchase.');
      partFormRef.current?.querySelector('[data-field="supplier"]')?.focus();
      return;
    }
    if (isCreditPurchase && partSupplierGstin && number(part.tax) > 0) {
      const sameState = supplierGstinStateCode(partSupplierGstin) === part.placeOfSupply;
      const component = partGstChoice.split(':')[0];
      if ((sameState && component === 'igst') ||
          (!sameState && ['cgst', 'sgst'].includes(component))) {
        setError('Choose a GST component that matches the supplier state and place of supply.');
        partFormRef.current?.querySelector('[data-field="partTax"]')?.focus();
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const created = await stockCatalogService.createItem({
        ...part, reserved: 0, reorderLevel: number(part.minimumStock),
        costPrice: number(part.costPrice), sellingPrice: number(part.sellingPrice),
        tax: Number(part.tax), zeroTaxClassification: Number(part.tax) === 0 ? part.zeroTaxClassification : '',
        hsnCode: part.hsnCode.trim(),
        minimumStock: number(part.minimumStock),
        stockQuantity: stockSource === 'opening' ? quantity : 0,
        requestKey: stockSource === 'opening' || isCreditPurchase ? part.requestKey : '',
        ...(isCreditPurchase ? { purchase: {
          quantity: quantityText, invoiceNumber: part.invoiceNumber.trim(), invoiceDate: part.invoiceDate,
          placeOfSupply: partSupplierGstin ? part.placeOfSupply : undefined,
        } } : {}),
      });
      setPartOpen(false);
      setPart(initialPart);
      setPartLookup('');
      setPartMode('find');
      if (isSupplierStep && created?.id) {
        navigate('/suppliers/' + encodeURIComponent(part.supplier) + '#supplier-purchase-form', {
          state: {
            purchasePrefill: {
              itemId: String(created.id), quantity: quantityText,
              purchaseRate: String(part.costPrice),
              supplierId: String(part.supplier),
            },
          },
        });
        return;
      }
      setSuccess(stockSource
        ? 'Part saved. ' + quantity + ' ' + part.unit + ' added to available stock.'
        : 'Part saved.');
      await reload();
    } catch (exception) {
      const details = exception?.response?.data || exception?.data || {};
      if (typeof details === 'object' && details && !Array.isArray(details)) {
        const next = {};
        for (const [name, value] of Object.entries(details)) {
          const fieldName = ['onHand', 'on_hand', 'quantity'].includes(name) ? 'stockQuantity' :
            name === 'supplierId' ? 'supplier' : name;
          next[fieldName] = Array.isArray(value) ? value[0] : String(value);
        }
        setPartErrors(next);
        const key = Object.keys(next)[0];
        if (key) requestAnimationFrame(() => partFormRef.current?.querySelector('[data-field="' + key + '"]')?.focus());
      }
      setError(exception?.message || 'Unable to add part.');
    } finally { setSaving(false); }
  };

  const saveMovement = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (move.mode === 'in' && !USE_MOCK_API) {
      // Legacy stock-in modal must not create an unbilled purchase.
      // Supplier purchase posting is the only normal Stock purchase action.
      setMoveOpen(false);
      beginMove('in', move.itemId);
      return;
    }
    const quantity = Number(move.quantity);
    if (!selected || !Number.isFinite(quantity) || quantity <= 0) {
      setError('Select a part and enter a valid quantity.'); return;
    }
    if (move.mode === 'out' && quantity > selectedAvailable) {
      setError('Not enough available stock for this issue.'); return;
    }
    if (move.mode === 'in') {
      if (move.costPrice === '' || move.sellingPrice === '' ||
          ![move.costPrice, move.sellingPrice].every((value) =>
            Number.isFinite(Number(value)) && Number(value) >= 0 &&
            /^\d+(\.\d{1,2})?$/.test(String(value)))) {
        setError('Enter valid purchase cost and selling price (maximum 2 decimals).'); return;
      }
      if (receiptPricesDiffer && !['keep_existing', 'apply_new'].includes(move.priceMode)) {
        setError('Choose whether old stock and new stock should use the same prices.'); return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        itemId: selected.id, quantity: move.quantity, requestKey: move.requestKey,
        notes: move.notes.trim(),
        ...(move.mode === 'in' ? { invoiceNo: move.invoiceNo.trim(),
          costPrice: move.costPrice, sellingPrice: move.sellingPrice,
          priceMode: receiptPricesDiffer ? move.priceMode : 'keep_existing' } : {}),
      };
      if (move.mode === 'in') await stockCatalogService.stockIn(payload);
      else await stockCatalogService.stockOut(payload);
      setMoveOpen(false);
      setMove(initialMove);
      setSuccess(move.mode === 'in' ? 'Stock received successfully.' : 'Internal use recorded.');
      await reload();
    } catch (exception) {
      setError(exception?.message || 'Unable to save stock movement.');
    } finally { setSaving(false); }
  };

  return (
    <div className="cg-easy-stock">
      <header className="cg-easy-head">
        <div>
          <h1>Inventory Management</h1>
        </div>
        <div className="cg-easy-actions">
          <button type="button" className="cg-easy-secondary" onClick={reload} disabled={loading}><RefreshCw size={16}/> Refresh</button>
          {canPurchaseStock && <button type="button" className="cg-easy-secondary"
            onClick={() => beginMove('in')}><PackagePlus size={16}/> Receive Purchase</button>}
          {canCreateStock && <button type="button" className="cg-easy-primary" onClick={() => openPartDialog()}><Plus size={16}/> Add New Part</button>}
        </div>
      </header>

      {error && !partOpen && !moveOpen && <div className="cg-easy-alert" role="alert">{error}</div>}
      {success && <div className="cg-easy-success" role="status">{success}<button type="button" onClick={() => setSuccess('')}>Dismiss</button></div>}
      {supplierId && (
        <section className="cg-easy-supplier-detail" aria-label="Selected supplier details">
          <div>
            <h2>{supplier?.name || 'Supplier details'}</h2>
            {!supplier && !supplierError && <p role="status">Loading supplier…</p>}
            {supplierError && <p role="alert">{supplierError}</p>}
            {supplier && <>
              <p>Contact: {supplier.contactPerson || supplier.contact_person || '—'}</p>
              <p>Phone: {supplier.phone || '—'}</p>
              <p>Email: {supplier.email || '—'}</p>
              <p>GSTIN: {supplier.gstin || '—'}</p>
              <p>{supplier.address || ''}</p>
            </>}
          </div>
          <button type="button" onClick={() => updateQueryParam('supplier', '')}>Close Supplier Details</button>
        </section>
      )}

      <section className="cg-easy-metrics" aria-label="Inventory summary">
        {[
          { label: 'Total parts', value: dashboard?.totalItems ?? items.length, icon: Boxes },
          { label: 'Stock value', value: canManageStock ? cash(totalValue) : 'Restricted', icon: ShoppingCart },
          { label: 'Low stock', value: dashboard?.lowStock ?? lowCount, icon: AlertTriangle },
          { label: 'Out of stock', value: dashboard?.outOfStock ?? outCount, icon: PackageMinus },
        ].map(({ label, value, icon: Icon }) => (
          <article className="cg-easy-metric" key={label}>
            <div><span>{label}</span><strong>{loading ? '—' : value}</strong></div><Icon size={19}/>
          </article>
        ))}
      </section>

      <section className="cg-easy-shortcuts" aria-label="Quick actions">
        <Link to="/suppliers"><PackagePlus size={19}/><span>Buy / Receive from Supplier</span></Link>
        {canManageStock && <button type="button" onClick={() => beginMove('out')}><PackageMinus size={19}/><span>Internal Use</span></button>}
        <Link to="/jobs"><Wrench size={19}/><span>Job Card Parts</span></Link>
        <a href="#stock-history"><History size={19}/><span>Stock History</span></a>
        <Link to="/suppliers"><ShoppingCart size={19}/><span>Suppliers</span></Link>
      </section>

      <StockFinanceConnections
        items={items}
        loading={loading}
        showGST={canViewGSTR}
        showSupplierFinance={canViewSupplierFinance}
        supplierBalances={supplierBalances}
        financeLoading={financeLoading}
        financeError={financeError}
        canViewValuation={canManageStock}
        stockValue={totalValue}
      />

      <InventoryBranchOperations onChanged={reload}/>
      <InventoryCategories categories={categories} loadError={categoryLoadError} onCreate={createCategory}/>

      <section className="cg-easy-panel" id="parts-products" tabIndex={-1} aria-labelledby="stock-parts-heading">
        <div className="cg-easy-panel-header">
          <h2 id="stock-parts-heading">Parts & Products</h2>
        </div>
        <div className="cg-easy-filters">
          <label className="cg-easy-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Search stock" placeholder="Search part name, Part Number, SKU, supplier or rack" value={query} onChange={(e) => setQuery(e.target.value)}/></label>
          <div className="cg-easy-filter-buttons" aria-label="Stock status filter">
            {[['all', 'All'], ['low', 'Low Stock'], ['out', 'Out of Stock']].map(([value, label]) => (
              <button key={value} className={filter === value ? 'is-active' : ''} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value}>{label}</button>
            ))}
          </div>
        </div>
        {loading ? <div className="cg-easy-empty">Loading stock...</div>
          : filtered.length === 0 ? <div className="cg-easy-empty">No matching parts. {canCreateStock && <button type="button" className="cg-easy-inline-add" onClick={() => openPartDialog(query)}><Plus size={15}/> Add New Part</button>}</div>
          : (
            <div className="cg-easy-table-wrap">
              <table className="cg-easy-table">
                <thead><tr><th scope="col">Part</th><th scope="col">Rack</th><th scope="col">Available</th><th scope="col">Cost</th><th scope="col">Selling</th><th scope="col">GST / HSN</th><th scope="col">Supplier</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
                <tbody>{filtered.map((item) => {
                  const state = stockState(item);
                  return <tr key={item.id}>
                    <td data-label="Part">
                      <StockProductLink itemId={item.id}>
                        <span>
                          <strong>{item.partName || item.name}</strong>
                          <small>{[item.partNumber, item.sku, item.brand].filter(Boolean).join(' · ')}</small>
                        </span>
                        <ChevronRight size={17} aria-hidden="true"/>
                      </StockProductLink>
                    </td>
                    <td data-label="Rack" title={item.location || item.rack || '—'}>{item.location || item.rack || '—'}</td>
                    <td data-label="Available">{number(item.available ?? (number(item.onHand) - number(item.reserved)))} {item.unit || 'PCS'}</td>
                    <td data-label="Cost">{canManageStock ? cash(item.costPrice) : 'Restricted'}</td>
                    <td data-label="Selling">{cash(item.sellingPrice)}</td>
                    <td data-label="GST / HSN">
                      <div className="cg-easy-gst-metadata">
                        <strong>{number(item.tax)}% GST</strong>
                        <small className={number(item.tax) > 0 && !item.hsnCode ? 'is-missing' : ''}>
                          {item.hsnCode ? 'HSN/SAC ' + item.hsnCode
                            : number(item.tax) > 0 ? 'HSN/SAC review' : (item.zeroTaxClassification || '0% category review')}
                        </small>
                      </div>
                    </td>
                    <td data-label="Supplier">
                      {item.supplier?.id || item.supplier
                        ? <Link className="cg-easy-supplier-link" to={'/suppliers/' + encodeURIComponent(item.supplier?.id || item.supplier)}>
                          {item.supplierName || 'View Supplier'}
                        </Link>
                        : <span>Not linked</span>}
                    </td>
                    <td data-label="Status"><span className={'cg-easy-status is-' + state.tone}>{state.label}</span></td>
                    <td data-label="Action">{canCreateStock
                      ? <button type="button" aria-label={`Receive stock for ${item.partName || item.name}`} onClick={() => beginMove('in', item.id)}>Receive</button>
                      : <span>View only</span>}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}
        <footer className="cg-easy-footer"><span aria-live="polite">{loading || error ? '—' : filtered.length} parts shown</span></footer>
      </section>

      <section className="cg-easy-bottom" id="stock-history">
        <div className="cg-easy-panel-header"><h2>Recent movements</h2></div>
        <div className="cg-easy-history">{ledger.length ? ledger.slice(0, 5).map((entry) => (
          <div key={entry.id} className="cg-easy-history-row"><div><strong>{entry.partName || entry.itemName || 'Stock Item'}</strong><small>{entry.type || entry.movement_type || 'Movement'}</small></div><b>{number(entry.quantity ?? entry.qty) > 0 ? '+' : ''}{number(entry.quantity ?? entry.qty)}</b></div>
        )) : <p>No stock movements yet.</p>}</div>
      </section>

      <StockPurchaseStartDialog
        isOpen={receiveOpen}
        items={items}
        suppliers={suppliers}
        initialItem={receiveItem}
        canPurchase={canPurchaseStock}
        onClose={() => { setReceiveOpen(false); setReceiveItem(null); }}
        onContinue={continueStockPurchase}
      />

      <ResponsiveModalSheet isOpen={partOpen} onClose={() => !saving && !partChoiceSaving && setPartOpen(false)} title="Add New Part" maxWidth="600px">
        {partMode === 'find' ? (
          <div className="cg-easy-form">
            
            <label>Search part name / Part Number / SKU / barcode
              <div className="cg-easy-picker-search"><Search size={17}/><input autoFocus placeholder="Search existing products..." value={partLookup} onChange={(event) => setPartLookup(event.target.value)} /></div>
            </label>
            <div className="cg-easy-pick-list">
              {matchingParts.length ? matchingParts.map((item) => (
                <button key={item.id} type="button" onClick={() => { setPartOpen(false); beginMove('in', item.id, item); }}>
                  <span><strong>{item.partName || item.name}</strong><small>{item.sku || 'No SKU'} · {item.available} available</small></span>
                  <span>Receive </span>
                </button>
              )) : <p className="cg-easy-hint">No existing products matched your search.</p>}
            </div>
            <button type="button" className="cg-easy-new-product" onClick={() => {
              const exists = matchingParts.some((item) =>
                (item.partName || item.name || '').toLowerCase() === partLookup.trim().toLowerCase());
              if (exists) { setError('This part already exists. Select it from the list above.'); return; }
              setError('');
              setPart({ ...initialPart, supplier: supplierId, partName: partLookup.trim(),
                requestKey: inventoryRequestKey(), invoiceDate: localDate() });
              setPartMode('new');
            }}><Plus size={17}/> Add as New Product</button>
            {error && <p className="cg-easy-alert" role="alert">{error}</p>}
          </div>
        ) : (
          <form className="cg-easy-form cg-easy-part-create" ref={partFormRef} onSubmit={savePart}>
            <button type="button" className="cg-easy-back-picker" disabled={partChoiceSaving}
              onClick={() => { setPartMode('find'); setPartChoice(null); setError(''); }}>← Search Existing Products</button>
            {error && <p className="cg-easy-alert" role="alert">{error}</p>}
            <div className="cg-easy-fields">
              <OutlinedInput label="Part Name *" required maxLength={180} value={part.partName} onChange={(e) => setPart({ ...part, partName: e.target.value })}/>
              <OutlinedInput label="Part Number" data-field="partNumber" aria-invalid={Boolean(partErrors.partNumber)}
                maxLength={100} value={part.partNumber} onChange={(e) => { setPart({ ...part, partNumber: e.target.value }); setPartErrors({ ...partErrors, partNumber: '' }); }}/>
              {partErrors.partNumber && <p className="cg-easy-alert" role="alert">{partErrors.partNumber}</p>}
            </div>
            <div className="cg-easy-option-field">
              <OutlinedSelect label="Supplier" data-field="supplier" value={part.supplier}
                required={isCreditPurchase || isSupplierStep}
                onChange={e => setPart({ ...part, supplier: e.target.value, placeOfSupply: '' })}>
                <option value="">No supplier selected</option>
                {suppliers.filter(x => x.is_active !== false).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </OutlinedSelect>
              <button type="button" className="cg-easy-option-add" disabled={partChoiceSaving}
                onClick={() => { setPartChoice(null); setQuickSupplierOpen(v => !v); setQuickSupplierError(''); }}>
                <Plus size={15}/> Add Supplier
              </button>
            </div>
            {quickSupplierOpen && <div className="cg-easy-inline-editor" aria-label="Create supplier without leaving this form">
              <strong>New Supplier</strong>
              <OutlinedInput label="Supplier Name *" maxLength={180} value={quickSupplier.name} onChange={e => setQuickSupplier({ ...quickSupplier, name: e.target.value })}/>
              <div className="cg-easy-fields">
                <CountryPhoneField label="Phone" value={quickSupplier.phone} onChange={value => setQuickSupplier(old => ({ ...old, phone: value }))}/>
                <OutlinedInput label="GSTIN" maxLength={20} value={quickSupplier.gstNo} onChange={e => setQuickSupplier({ ...quickSupplier, gstNo: e.target.value })}/>
              </div>
              <OutlinedInput label="Address" value={quickSupplier.address} onChange={e => setQuickSupplier({ ...quickSupplier, address: e.target.value })}/>
              {quickSupplierError && <p className="cg-easy-alert" role="alert">{quickSupplierError}</p>}
              <div className="cg-easy-quick-actions">
                <button type="button" disabled={quickSupplierSaving} onClick={() => setQuickSupplierOpen(false)}>Cancel</button>
                <button type="button" disabled={quickSupplierSaving || !quickSupplier.name.trim()} onClick={createQuickSupplier}>
                  {quickSupplierSaving ? 'Saving…' : 'Save Supplier'}
                </button>
              </div>
            </div>}
            <div className="cg-easy-fields">
              <div className="cg-easy-option-field">
                <OutlinedSelect label="Brand" value={part.brand}
                  onChange={e => setPart(previous => ({ ...previous, brand: e.target.value }))}>
                  <option value="">No brand selected</option>
                  {brands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                </OutlinedSelect>
                <button type="button" className="cg-easy-option-add" disabled={partChoiceSaving || quickSupplierSaving || saving}
                  onClick={() => openPartChoice('brand')}><Plus size={15}/> Add Brand</button>
              </div>
              <OutlinedSelect label="Unit" value={part.unit} onChange={(e) => setPart({ ...part, unit: e.target.value })}>
                {['Piece', 'Bottle', 'Litre', 'Millilitre', 'Kilogram', 'Gram', 'Set', 'Pair', 'Box', 'Pack', 'Metre', 'Can'].map(x => <option key={x} value={x}>{x}</option>)}
              </OutlinedSelect>
            </div>
            <div className="cg-easy-fields">
              <div className="cg-easy-option-field">
                <OutlinedSelect label="Category" value={part.category}
                  onChange={e => setPart(previous => ({ ...previous, category: e.target.value }))}>
                  <option value="">Uncategorized</option>
                  {categories.filter(x => x.is_active !== false).map(x =>
                    <option key={x.id} value={x.id}>{x.parentName ? x.parentName + ' / ' : ''}{x.name}</option>)}
                </OutlinedSelect>
                <button type="button" className="cg-easy-option-add" disabled={partChoiceSaving || quickSupplierSaving || saving}
                  onClick={() => openPartChoice('category')}><Plus size={15}/> Add Category</button>
              </div>
              <OutlinedInput label="HSN / SAC Code" maxLength={20} value={part.hsnCode} onChange={(e) => setPart({ ...part, hsnCode: e.target.value })}/>
            </div>
            {partChoice && <div className="cg-easy-inline-editor" role="group" aria-label={partChoice.kind === 'brand' ? 'New brand' : 'New category'}>
              <OutlinedInput label={partChoice.kind === 'brand' ? 'Brand Name' : 'Category Name'}
                maxLength={partChoice.kind === 'brand' ? 100 : 120} value={partChoice.name} disabled={partChoiceSaving}
                onChange={e => setPartChoice(previous => ({ ...previous, name: e.target.value, error: '' }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); void savePartChoice(); }
                }}/>
              {partChoice.kind === 'category' && <OutlinedSelect label="Parent Category (optional)"
                value={partChoice.parent} disabled={partChoiceSaving}
                onChange={e => setPartChoice(previous => ({ ...previous, parent: e.target.value, error: '' }))}>
                <option value="">Main Category</option>
                {categories.filter(x => !x.parent && x.is_active !== false).map(x =>
                  <option key={x.id} value={x.id}>{x.name}</option>)}
              </OutlinedSelect>}
              {partChoice.error && <p className="cg-easy-alert" role="alert">{partChoice.error}</p>}
              <div className="cg-easy-quick-actions">
                <button type="button" disabled={partChoiceSaving} onClick={() => setPartChoice(null)}>Cancel</button>
                <button type="button" disabled={partChoiceSaving || !partChoice.name.trim()} onClick={savePartChoice}>
                  {partChoiceSaving ? 'Saving…' : partChoice.kind === 'brand' ? 'Use Brand' : 'Save Category'}
                </button>
              </div>
            </div>}
            <div className="cg-easy-fields">
              <OutlinedSelect label="GST Component / Rate *" data-field="partTax" value={partGstChoice}
                onChange={e => {
                  const choice = e.target.value;
                  const tax = choice === 'none' ? '0' :
                    choice === 'custom' ? '' : invoiceTotalRateFromChoice(choice);
                  setPartGstChoice(choice);
                  setPart({ ...part, tax, zeroTaxClassification: tax === '0' ? part.zeroTaxClassification : '' });
                  setPartErrors(previous => ({ ...previous, zeroTaxClassification: '' }));
                }}>
                <option value="none">0% — Select Tax Classification</option>
                {STOCK_GST_CHOICES.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
                <option value="custom">Saved/Other HSN-Specific Rate (custom %)</option>
              </OutlinedSelect>
              <OutlinedInput label="Purchase / Opening Quantity" type="number" min="0" max="1000000" step="0.01"
                inputMode="decimal" data-field="stockQuantity" aria-invalid={Boolean(partErrors.stockQuantity)}
                value={part.stockQuantity} onChange={e => {
                  setPart({ ...part, stockQuantity: e.target.value });
                  setPartErrors(previous => ({ ...previous, stockQuantity: '' }));
                }} onInvalid={event => {
                  event.preventDefault();
                  const message = 'Enter a quantity from 0 to 1,000,000 with up to two decimal places.';
                  setPartErrors(previous => ({ ...previous, stockQuantity: message }));
                  setError(message);
                  event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  event.currentTarget.focus();
                }}/>
              {partErrors.stockQuantity && <p className="cg-easy-alert" role="alert">{partErrors.stockQuantity}</p>}
            </div>
            {number(part.stockQuantity) > 0 && (
              <OutlinedSelect label="Stock Source *" aria-label="Stock Source" data-field="stockSource"
                required value={part.stockSource} onChange={e => {
                  setPart({ ...part, stockSource: e.target.value });
                  setError('');
                }}>
                <option value="">Choose stock source</option>
                <option value="opening">Opening Stock (already on hand)</option>
                {canPurchaseStock && <option value="credit">Supplier Purchase on Credit</option>}
                {canPurchaseStock && <option value="supplier">Supplier Purchase with Cash / Bank</option>}
              </OutlinedSelect>
            )}
            {isCreditPurchase && (
              <div className="cg-easy-fields">
                <OutlinedInput label="Supplier Invoice Number *" data-field="invoiceNumber" required maxLength={100}
                  value={part.invoiceNumber} onChange={e => setPart({ ...part, invoiceNumber: e.target.value })}/>
                <OutlinedInput label="Supplier Invoice Date *" data-field="invoiceDate" required type="date"
                  value={part.invoiceDate} onChange={e => setPart({ ...part, invoiceDate: e.target.value })}/>
                {partSupplierGstin && (
                  <OutlinedSelect label="Place of Supply *" data-field="placeOfSupply" aria-label="Place of Supply" required
                    value={part.placeOfSupply} onChange={e => setPart({ ...part, placeOfSupply: e.target.value })}>
                    <option value="">Select state</option>
                    {INDIA_STATES.map(([code, name]) => <option value={code} key={code}>{name}</option>)}
                  </OutlinedSelect>
                )}
              </div>
            )}
            {partGstChoice === 'custom' &&
              <OutlinedInput label="Custom GST Rate (%)" type="number" min="0" max="100" step="0.01" required
                value={part.tax} onChange={e => {
                  setPart({ ...part, tax: e.target.value, zeroTaxClassification: '' });
                  setPartErrors(previous => ({ ...previous, zeroTaxClassification: '' }));
                }}/>}
            {Number(part.tax) === 0 && part.tax !== '' && (
              <div className="cg-easy-zero-gst">
                <OutlinedSelect label="0% GST Classification *" required
                  data-field="zeroTaxClassification"
                  aria-invalid={Boolean(partErrors.zeroTaxClassification)}
                  value={part.zeroTaxClassification}
                  onChange={e => {
                    setPart({ ...part, zeroTaxClassification: e.target.value });
                    setPartErrors(previous => ({ ...previous, zeroTaxClassification: '' }));
                  }}>
                  <option value="">Select classification</option>
                  {ZERO_GST_CLASSIFICATIONS.map(([code, label]) =>
                    <option value={code} key={code}>{label}</option>)}
                </OutlinedSelect>
                {partErrors.zeroTaxClassification &&
                  <p className="cg-easy-alert" role="alert">{partErrors.zeroTaxClassification}</p>}
              </div>
            )}
            {Number(part.tax) > 0 && validGstRate(part.tax) && (
              <div className="cg-easy-gst-preview" role="note">
                <strong>Total {part.tax}% GST</strong>
                <span>Intra-state: {Number(part.tax) / 2}% CGST + {Number(part.tax) / 2}% SGST/UTGST</span>
                <span>Inter-state: {part.tax}% IGST</span>
              </div>
            )}
            <p className="cg-easy-gst-disclaimer">
              Selecting CGST/SGST denotes the paired intra-state total (e.g. 9% + 9% = 18%);
              IGST is the whole inter-state rate. Verify HSN/SAC eligibility.
              Final GST type is determined from the workshop's registration and invoice place of supply.
            </p>
            <div className="cg-easy-fields">
              <OutlinedInput label="Purchase Price (₹) *" required type="number" min="0" step="0.01" value={part.costPrice} onChange={e => setPart({ ...part, costPrice: e.target.value })}/>
              <OutlinedInput label="Selling Price (₹) *" required type="number" min="0" step="0.01" value={part.sellingPrice} onChange={e => setPart({ ...part, sellingPrice: e.target.value })}/>
            </div>
            <div className="cg-easy-fields">
              {canPurchaseStock && (
                <OutlinedSelect label="Stock Source" value={part.stockSource} onChange={e => {
                  setPart(previous => ({ ...previous, stockSource: e.target.value }));
                  setPartErrors(previous => ({ ...previous, stockQuantity: '' }));
                  setError('');
                }}>
                  <option value="opening">Opening Stock (already on hand)</option>
                  <option value="purchase">Supplier Purchase</option>
                </OutlinedSelect>
              )}
              <OutlinedInput label={isSupplierPurchase ? 'Purchase Quantity *' : 'Opening Stock Quantity'}
                type="number" min={isSupplierPurchase ? '0.01' : '0'} max={MAX_STOCK_QUANTITY}
                step="0.01" inputMode="decimal" required={isSupplierPurchase}
                data-field="stockQuantity" aria-invalid={Boolean(partErrors.stockQuantity)}
                aria-describedby={partErrors.stockQuantity ? 'part-quantity-error part-stock-hint' : 'part-stock-hint'}
                value={part.stockQuantity} onChange={e => {
                  setPart(previous => ({ ...previous, stockQuantity: e.target.value }));
                  setPartErrors(previous => ({ ...previous, stockQuantity: '' }));
                }} onInvalid={event => {
                  event.preventDefault();
                  setPartErrors(previous => ({ ...previous, stockQuantity: quantityError }));
                  event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  event.currentTarget.focus();
                }}/>
            </div>
            {partErrors.stockQuantity && (
              <p id="part-quantity-error" className="cg-easy-alert" role="alert">{partErrors.stockQuantity}</p>
            )}
            <p id="part-stock-hint" className="cg-easy-hint cg-easy-part-guidance">
              {isSupplierPurchase
                ? 'Choose a supplier and post the purchase bill to receive this quantity into stock.'
                : 'Enter the quantity already on hand. It becomes available in Inventory as soon as you save.'}
            </p>
            <div className="cg-easy-fields">
              <OutlinedInput label="Minimum Stock" type="number" min="0" step="0.01" value={part.minimumStock} onChange={e => setPart({ ...part, minimumStock: e.target.value })}/>
              <RackCombobox value={part.location} suggestions={rackLocations}
                onChange={location => setPart(previous => ({ ...previous, location }))}/>
            </div>
            <div className="cg-easy-form-actions">
              <button type="button" disabled={partChoiceSaving || saving} onClick={() => setPartOpen(false)}>Cancel</button>
              <button type="submit" disabled={saving || Boolean(partChoice)}>
                {saving ? 'Saving…' : isSupplierStep ? 'Continue to Receive Stock' :
                  isCreditPurchase ? 'Save & Receive on Credit' : stockSource === 'opening' ? 'Save Part & Stock' : 'Save Part'}
              </button>
            </div>
          </form>
        )}
      </ResponsiveModalSheet>

      <ResponsiveModalSheet isOpen={moveOpen} onClose={() => !saving && setMoveOpen(false)} title={move.mode === 'in' ? 'Receive Stock' : 'Internal Use — Stock Out'} maxWidth="590px">
        <form className="cg-easy-form" onSubmit={saveMovement}>
          {error && <p className="cg-easy-alert" role="alert">{error}</p>}
          {move.mode === 'out' && <p className="cg-easy-hint">For customer vehicle repairs, issue stock on the Job Card Parts page instead. This action records internal workshop consumption only.</p>}
          <label>Search Part / Product *
            <div className="cg-easy-picker-search"><Search size={17}/><input placeholder="Search by part name, SKU, barcode or brand" value={moveLookup} onChange={(event) => { setMoveLookup(event.target.value); if(selected) setMove({ ...move, itemId: '', priceMode: '' }); }} /></div>
          </label>
          {(!selected || !moveLookup || ![selected.partName, selected.name].includes(moveLookup)) && (
            <div className="cg-easy-pick-list">
              {receiptMatches.map((item) => (
                <button key={item.id} type="button" onClick={() => selectMovePart(item)}>
                  <span><strong>{item.partName || item.name}</strong><small>{item.sku || 'No SKU'} · {item.available} available</small></span>
                  <span>Select </span>
                </button>
              ))}
              {!receiptMatches.length && <p className="cg-easy-hint">No part found. Add the product first.</p>}
            </div>
          )}
          {selected ? <div className="cg-easy-selected-product">
            <strong><PackagePlus size={16}/> {selected.partName || selected.name}</strong>
            <span>Old stock: {number(selected.onHand)} {selected.unit || 'PCS'} · Purchase {cash(selected.costPrice)} · Selling {cash(selected.sellingPrice)}</span>
            <button type="button" onClick={() => { setMove({ ...move, itemId: '', priceMode: '' }); setMoveLookup(''); }}>Change</button>
          </div> : <button type="button" className="cg-easy-new-product" onClick={() => { setMoveOpen(false); openPartDialog(moveLookup); }}><Plus size={16}/> Add New Product</button>}
          <label>Quantity *<input required type="number" min="0.01" step="0.01" value={move.quantity} onChange={(e) => setMove({ ...move, quantity: e.target.value })}/></label>
          {move.mode === 'in' && selected && (
            <>
              <div className="cg-easy-fields">
                <label>New Purchase Cost / Unit (₹) *<input required type="number" min="0" step="0.01" value={move.costPrice} onChange={(e) => setMove({ ...move, costPrice: e.target.value, priceMode: '' })}/></label>
                <label>New Selling Price / Unit (₹) *<input required type="number" min="0" step="0.01" value={move.sellingPrice} onChange={(e) => setMove({ ...move, sellingPrice: e.target.value, priceMode: '' })}/></label>
              </div>
              {receiptPricesDiffer && (
                <fieldset className="cg-easy-price-choice">
                  <legend>Use the same prices for old stock and new stock? *</legend>
                  <p>Existing: Purchase {cash(selected.costPrice)}, Selling {cash(selected.sellingPrice)}. New: Purchase {cash(move.costPrice)}, Selling {cash(move.sellingPrice)}.</p>
                  <label className={move.priceMode === 'apply_new' ? 'is-checked' : ''}>
                    <input type="radio" name="receipt-price-choice" required checked={move.priceMode === 'apply_new'} onChange={() => setMove({ ...move, priceMode: 'apply_new' })} />
                    <span><strong>Yes — Apply new prices to all stock</strong><small>Update the product catalogue purchase cost and selling price for old and new quantities.</small></span>
                  </label>
                  <label className={move.priceMode === 'keep_existing' ? 'is-checked' : ''}>
                    <input type="radio" name="receipt-price-choice" checked={move.priceMode === 'keep_existing'} onChange={() => setMove({ ...move, priceMode: 'keep_existing' })} />
                    <span><strong>No — Keep existing product prices</strong><small>Save new purchase and selling prices in receipt history; current catalogue prices remain the same. Separate batch selling prices require separate product SKUs.</small></span>
                  </label>
                </fieldset>
              )}
              <div className="cg-easy-receipt-total"><span>Total Purchase Cost</span><strong>{cash(number(move.quantity) * number(move.costPrice))}</strong></div>
              <label>Purchase invoice (optional)<input value={move.invoiceNo} onChange={(e) => setMove({ ...move, invoiceNo: e.target.value })}/></label>
            </>
          )}
          <label>Reason / Notes {move.mode === 'out' ? '*' : ''}<textarea rows="2" required={move.mode === 'out'} value={move.notes} onChange={(e) => setMove({ ...move, notes: e.target.value })}/></label>
          {selected && <p className="cg-easy-hint">Available now: {selectedAvailable} {selected.unit || 'PCS'}</p>}
          <div className="cg-easy-form-actions"><button type="button" onClick={() => setMoveOpen(false)}>Cancel</button><button type="submit" disabled={saving || !selected || (receiptPricesDiffer && !move.priceMode)}>{saving ? 'Saving...' : (move.mode === 'in' ? 'Confirm Stock In' : 'Confirm Internal Use')}</button></div>
        </form>
      </ResponsiveModalSheet>
    </div>
  );
}
