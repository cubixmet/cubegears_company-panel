import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, HardHat, Package, Plus, Search, Trash2, UserRound,
  Wrench, X, RefreshCw,
} from 'lucide-react';
import { JobBreadcrumbs } from '../../components/jobs/JobBreadcrumbs';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { USE_MOCK_API } from '../../api/apiConfig';
import { billingService } from '../../services/billing.service';
import { financeService } from '../../services/finance.service';
import { quickService } from '../../services/quickService.service';
import { customerService } from '../../services/customer.service';
import { vehicleService } from '../../services/vehicle.service';
import { serviceService } from '../../services/service.service';
import { stockService } from '../../services/stock.service';
import { outsideLabourService } from '../../services/outsideLabour.service';
import { defaultFinanceAccountId, financeAccountsForChannel } from '../../utils/financeCashBank';
import '../../styles/quick-service.css';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const rowsOf = value => Array.isArray(value) ? value : Array.isArray(value?.results) ? value.results : [];
const makeKey = () => globalThis.crypto?.randomUUID?.() || `quick-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const closePermissions = ['jobs.edit', 'invoices.view', 'invoices.create', 'invoices.edit', 'payments.view', 'payments.create'];

const displayVehicle = vehicle => [
  vehicle.registration || vehicle.regNo || vehicle.licensePlate,
  [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(' '),
].filter(Boolean).join(' · ');

function SearchResults({ label, query, onQuery, placeholder, loading, error, results, onAdd, emptyText, renderTitle, renderMeta, isDisabled }) {
  return (
    <div className="quick-service-picker">
      <label className="quick-service-search-label">
        <span>{label}</span>
        <span className="quick-service-search-box">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={query} onChange={event => onQuery(event.target.value)}
            placeholder={placeholder} autoComplete="off" />
        </span>
      </label>
      {error && <p className="quick-service-error" role="alert">{error}</p>}
      {loading ? <p className="quick-service-muted" role="status">Searching…</p> : (
        <div className="quick-service-results">
          {results.map(row => (
            <div className="quick-service-result" key={row.id}>
              <div className="quick-service-result-copy">
                <strong>{renderTitle(row)}</strong>
                <small>{renderMeta(row)}</small>
              </div>
              <button type="button" className="quick-service-add-button" disabled={Boolean(isDisabled?.(row))} onClick={() => onAdd(row)}>
                <Plus size={15} aria-hidden="true" /> Add
              </button>
            </div>
          ))}
          {!results.length && <p className="quick-service-muted">{emptyText}</p>}
        </div>
      )}
    </div>
  );
}

function CustomerVehicleSection({ can, customer, onCustomer, vehicle, onVehicle, resetRequestKey }) {
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerRows, setCustomerRows] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState(false);
  const [customerDraft, setCustomerDraft] = useState({ name: '', phone: '', email: '', address: '' });
  const [customerSaving, setCustomerSaving] = useState(false);
  const canCustomersView = can('customers.view');
  const canVehiclesView = can('vehicles.view');

  const [vehicleQuery, setVehicleQuery] = useState('');
  const [vehicleRows, setVehicleRows] = useState([]);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [vehicleError, setVehicleError] = useState('');
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [newVehicle, setNewVehicle] = useState(false);
  const [vehicleDraft, setVehicleDraft] = useState({ registration: '', make: '', model: '' });
  const [vehicleSaving, setVehicleSaving] = useState(false);

  useEffect(() => {
    if (!canCustomersView || customer || !customerOpen) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setCustomerLoading(true);
      setCustomerError('');
      try {
        const result = await customerService.getCustomers({ search: customerQuery.trim(), status: 'active' });
        if (active) setCustomerRows(rowsOf(result).filter(row => row.status !== 'archived').slice(0, 10));
      } catch (error) {
        if (active) { setCustomerRows([]); setCustomerError(error.message || 'Could not search customers.'); }
      } finally { if (active) setCustomerLoading(false); }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [customerQuery, customerOpen, customer?.id, canCustomersView]);

  useEffect(() => {
    if (!canVehiclesView || vehicle || !vehicleOpen) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setVehicleLoading(true);
      setVehicleError('');
      try {
        const result = await vehicleService.getVehicles({ search: vehicleQuery.trim() });
        let list = rowsOf(result).filter(row => String(row.status || 'Active').toLowerCase() !== 'archived');
        if (customer?.id) list = list.filter(row => String(row.customerId) === String(customer.id));
        if (active) setVehicleRows(list.slice(0, 10));
      } catch (error) {
        if (active) { setVehicleRows([]); setVehicleError(error.message || 'Could not search vehicles.'); }
      } finally { if (active) setVehicleLoading(false); }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [vehicleQuery, vehicleOpen, vehicle?.id, customer?.id, canVehiclesView]);

  const pickCustomer = row => {
    onCustomer(row);
    onVehicle(null);
    setCustomerQuery(row.name || '');
    setCustomerOpen(false);
    setNewCustomer(false);
    resetRequestKey();
  };

  const createCustomer = async event => {
    event.preventDefault();
    if (customerSaving) return;
    if (!customerDraft.name.trim() || !customerDraft.phone.trim()) {
      setCustomerError('Customer name and phone number are required.');
      return;
    }
    setCustomerSaving(true);
    setCustomerError('');
    try {
      const duplicate = await customerService.checkDuplicateCustomer({
        phone: customerDraft.phone.trim(), email: customerDraft.email.trim(),
      });
      if (duplicate?.id) {
        pickCustomer(duplicate);
        setCustomerError('Existing customer found and selected.');
        return;
      }
      const created = await customerService.createCustomer({
        ...customerDraft, customerType: 'individual',
      });
      if (!created?.id) throw new Error('Customer was not saved.');
      pickCustomer(created);
    } catch (error) {
      setCustomerError(error?.response?.data?.phone?.[0] || error?.response?.data?.name?.[0] || error.message || 'Unable to add customer.');
    } finally { setCustomerSaving(false); }
  };

  const pickVehicle = row => {
    onVehicle(row);
    setVehicleQuery(displayVehicle(row));
    setVehicleOpen(false);
    setNewVehicle(false);
    resetRequestKey();
  };

  const createVehicle = async event => {
    event.preventDefault();
    if (vehicleSaving) return;
    if (!customer?.id) { setVehicleError('Select a customer before adding a vehicle.'); return; }
    if (!vehicleDraft.registration.trim()) { setVehicleError('Vehicle registration is required.'); return; }
    setVehicleSaving(true);
    setVehicleError('');
    try {
      const created = await vehicleService.createVehicle({
        customerId: customer.id,
        registration: vehicleDraft.registration.trim(),
        make: vehicleDraft.make.trim(),
        model: vehicleDraft.model.trim(),
      });
      pickVehicle(created);
    } catch (error) {
      setVehicleError(error?.response?.data?.registration?.[0] || error.message || 'Unable to add vehicle.');
    } finally { setVehicleSaving(false); }
  };

  return (
    <section className="quick-service-section quick-service-customer-vehicle-section">
      <div className="quick-service-section-heading">
        <div className="quick-service-section-title"><UserRound size={18} aria-hidden="true" /><div><h2>Customer & Vehicle</h2><p>Optional for walk-in counter work</p></div></div>
        <span className="quick-service-optional">Optional</span>
      </div>
      <div className="quick-service-two-columns">
        {canCustomersView && (
          <div className="quick-service-field-group">
            <div className="quick-service-field-heading">
              <label>Customer</label>
              {can('customers.create') && <button type="button" className="quick-service-text-button" onClick={() => { setNewCustomer(value => !value); setCustomerOpen(false); }}><Plus size={14}/> Add new</button>}
            </div>
            {customer ? (
              <div className="quick-service-selected">
                <div><strong>{customer.name}</strong><small>{customer.phone || customer.email || 'Customer selected'}</small></div>
                <button type="button" aria-label="Remove customer" onClick={() => { onCustomer(null); onVehicle(null); setCustomerQuery(''); resetRequestKey(); }}><X size={16}/></button>
              </div>
            ) : (
              <>
                <div className="quick-service-search-box">
                  <Search size={16} aria-hidden="true"/>
                  <input value={customerQuery} placeholder="Search name or phone" onFocus={() => setCustomerOpen(true)}
                    onChange={event => { setCustomerQuery(event.target.value); setCustomerOpen(true); setNewCustomer(false); }} />
                </div>
                {customerOpen && <div className="quick-service-inline-results">
                  {customerLoading ? <p>Searching…</p> : customerRows.map(row => <button key={row.id} type="button" onClick={() => pickCustomer(row)}><strong>{row.name}</strong><small>{row.phone}</small></button>)}
                  {!customerLoading && !customerRows.length && <p>No matching customers.</p>}
                </div>}
              </>
            )}
            {newCustomer && can('customers.create') && !customer && (
              <form className="quick-service-inline-form" onSubmit={createCustomer}>
                <input required placeholder="Customer name" value={customerDraft.name} onChange={e => setCustomerDraft(old => ({...old,name:e.target.value}))}/>
                <input required inputMode="tel" placeholder="+91 phone number" value={customerDraft.phone} onChange={e => setCustomerDraft(old => ({...old,phone:e.target.value}))}/>
                <input type="email" placeholder="Email (optional)" value={customerDraft.email} onChange={e => setCustomerDraft(old => ({...old,email:e.target.value}))}/>
                <div className="quick-service-inline-actions"><button type="button" onClick={() => setNewCustomer(false)}>Cancel</button><button type="submit" disabled={customerSaving}>{customerSaving ? 'Saving…' : 'Save customer'}</button></div>
              </form>
            )}
            {customerError && <p className="quick-service-error" role="alert">{customerError}</p>}
          </div>
        )}
        {canVehiclesView && (
          <div className="quick-service-field-group">
            <div className="quick-service-field-heading">
              <label>Vehicle</label>
              {can('vehicles.create') && <button type="button" className="quick-service-text-button" onClick={() => { setNewVehicle(value => !value); setVehicleOpen(false); }}><Plus size={14}/> Add new</button>}
            </div>
            {vehicle ? (
              <div className="quick-service-selected">
                <div><strong>{displayVehicle(vehicle) || vehicle.registration}</strong><small>{vehicle.customerName || customer?.name || 'Vehicle selected'}</small></div>
                <button type="button" aria-label="Remove vehicle" onClick={() => { onVehicle(null); setVehicleQuery(''); resetRequestKey(); }}><X size={16}/></button>
              </div>
            ) : (
              <>
                <div className="quick-service-search-box">
                  <Search size={16} aria-hidden="true"/>
                  <input value={vehicleQuery} placeholder="Search registration / model" onFocus={() => setVehicleOpen(true)}
                    onChange={event => { setVehicleQuery(event.target.value); setVehicleOpen(true); setNewVehicle(false); }} />
                </div>
                {vehicleOpen && <div className="quick-service-inline-results">
                  {vehicleLoading ? <p>Searching…</p> : vehicleRows.map(row => <button key={row.id} type="button" onClick={() => pickVehicle(row)}><strong>{displayVehicle(row)}</strong><small>{row.customerName || ''}</small></button>)}
                  {!vehicleLoading && !vehicleRows.length && <p>{customer ? 'No vehicle found for this customer.' : 'No matching vehicles.'}</p>}
                </div>}
              </>
            )}
            {newVehicle && can('vehicles.create') && !vehicle && (
              <form className="quick-service-inline-form" onSubmit={createVehicle}>
                {!customer && <p className="quick-service-muted">Select a customer first to add a vehicle.</p>}
                <input required placeholder="Vehicle registration" value={vehicleDraft.registration} onChange={e => setVehicleDraft(old => ({...old,registration:e.target.value.toUpperCase()}))}/>
                <div className="quick-service-two-columns"><input placeholder="Make" value={vehicleDraft.make} onChange={e => setVehicleDraft(old => ({...old,make:e.target.value}))}/><input placeholder="Model" value={vehicleDraft.model} onChange={e => setVehicleDraft(old => ({...old,model:e.target.value}))}/></div>
                <div className="quick-service-inline-actions"><button type="button" onClick={() => setNewVehicle(false)}>Cancel</button><button type="submit" disabled={vehicleSaving || !customer}>{vehicleSaving ? 'Saving…' : 'Save vehicle'}</button></div>
              </form>
            )}
            {vehicleError && <p className="quick-service-error" role="alert">{vehicleError}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function QuickServiceCheckout({ service, onClose, onCancel }) {
  const hasSavedItems = Array.isArray(service.items) && service.items.length > 0;
  const [legacyItems, setLegacyItems] = useState(() => [{ description: service.description, qty: '1', rate: '', hsnCode: '', taxRate: '' }]);
  const [details, setDetails] = useState(null);
  const [method, setMethod] = useState('Cash');
  const [account, setAccount] = useState('');
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([billingService.getGstContext(), financeService.listAccounts()])
      .then(([gst, accounts]) => {
        if (!active) return;
        setDetails({ gst: gst.registered, accounts });
        setAccount(defaultFinanceAccountId(accounts, 'Cash'));
      })
      .catch(err => { if (active) setError(err.message || 'Could not load checkout.'); });
    return () => { active = false; };
  }, [loadAttempt]);

  const updateLegacy = (index, field, value) => {
    setLegacyItems(rows => rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
    setQuote(null);
    setError('');
  };

  async function submit(event) {
    event.preventDefault();
    if (busy || !details) return;
    if (details.gst && !hasSavedItems && legacyItems.some(item => !item.hsnCode.trim() || item.taxRate === '')) {
      setError('Enter SAC and GST percentage for every GST invoice line.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (!quote) {
        setQuote(await quickService.preview(service.id, hasSavedItems ? {} : { items: legacyItems }));
        return;
      }
      const closed = await quickService.close(service.id, {
        ...(hasSavedItems ? {} : { items: legacyItems }),
        paymentMethod: method, account, expectedTotal: quote.total,
      });
      onClose(closed);
    } catch (err) {
      if (err.fieldErrors?.expectedTotal) setQuote(null);
      setError(err.message || 'Could not complete Quick Service.');
    } finally { setBusy(false); }
  }

  if (!details) return (
    <div className="quick-service-checkout">
      {error ? <p role="alert" className="quick-service-error">{error}</p> : <p role="status">Loading payment options…</p>}
      <div className="quick-service-actions">
        {error && <button type="button" className="dashboard-button" onClick={() => { setError(''); setLoadAttempt(value => value + 1); }}>Retry</button>}
        <button type="button" className="dashboard-button" onClick={onCancel}>Back</button>
      </div>
    </div>
  );

  const accounts = financeAccountsForChannel(details.accounts, method);
  return (
    <form className="quick-service-checkout" onSubmit={submit} aria-label={`Close ${service.description}`}>
      <h3>Review service & collect payment</h3>
      {hasSavedItems ? (
        <ul className="quick-service-checkout-items">
          {service.items.map((item, index) => <li key={item.outsideLabourId || item.serviceId || item.inventoryId || index}><span>{item.description}</span><strong>{currency.format(Number(item.rate || item.customerCharge || 0) * Number(item.qty || 1))}</strong></li>)}
        </ul>
      ) : (
        <>
          <p className="quick-service-muted">This service was started in an older version. Add its charges before invoicing.</p>
          {legacyItems.map((item, index) => <fieldset className="quick-service-line" key={index} disabled={busy}>
            <legend>Charge {index + 1}</legend>
            <label>Description<input required value={item.description} onChange={e => updateLegacy(index,'description',e.target.value)}/></label>
            <label>Qty<input required type="number" min="0.01" step="0.01" value={item.qty} onChange={e => updateLegacy(index,'qty',e.target.value)}/></label>
            <label>Rate (₹)<input required type="number" min="0.01" step="0.01" value={item.rate} onChange={e => updateLegacy(index,'rate',e.target.value)}/></label>
            {details.gst && <><label>SAC<input required value={item.hsnCode} onChange={e => updateLegacy(index,'hsnCode',e.target.value)}/></label><label>GST %<input required type="number" min="0" max="100" step="0.01" value={item.taxRate} onChange={e => updateLegacy(index,'taxRate',e.target.value)}/></label></>}
          </fieldset>)}
        </>
      )}
      {quote && <fieldset className="quick-service-payment" disabled={busy}>
        <legend>Payment received</legend>
        <div className="quick-service-total" role="status"><span>Invoice total</span><strong>{currency.format(Number(quote.total))}</strong></div>
        <label>Payment method<select value={method} onChange={event => { const next=event.target.value; setMethod(next); setAccount(defaultFinanceAccountId(details.accounts,next)); }}><option value="Cash">Cash</option><option value="Bank">Bank / UPI</option></select></label>
        <label>Receiving account<select required value={account} onChange={event => setAccount(event.target.value)}><option value="">Choose account</option>{accounts.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        {!accounts.length && <p>No active {method} account. <Link to="/finance/accounts">Open finance accounts</Link></p>}
      </fieldset>}
      {error && <p className="quick-service-error" role="alert">{error}</p>}
      <div className="quick-service-actions">
        <button type="button" className="dashboard-button" disabled={busy} onClick={onCancel}>Back</button>
        <button type="submit" className="dashboard-button is-primary" disabled={busy || Boolean(quote && !account)}>{busy ? 'Saving…' : quote ? 'Record Payment & Close' : 'Review Invoice Total'}</button>
      </div>
    </form>
  );
}

export function QuickServicePage() {
  const { can } = useFeatureAccess();
  const allowed = can('jobs.view') && !USE_MOCK_API;
  const canStart = can('jobs.create');
  const canClose = closePermissions.every(permission => can(permission));
  const canViewInvoice = can('invoices.view');
  const [services, setServices] = useState([]);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [customer, setCustomer] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [items, setItems] = useState([]);
  const [gstRegistered, setGstRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [closed, setClosed] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const requestKey = useRef(makeKey());

  const [serviceQuery, setServiceQuery] = useState('');
  const [serviceRows, setServiceRows] = useState([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceError, setServiceError] = useState('');
  const [partQuery, setPartQuery] = useState('');
  const [partRows, setPartRows] = useState([]);
  const [partLoading, setPartLoading] = useState(false);
  const [partError, setPartError] = useState('');
  const [outsideQuery, setOutsideQuery] = useState('');
  const [outsideRows, setOutsideRows] = useState([]);
  const [outsideDraft, setOutsideDraft] = useState({
    workerName: '', workerPhone: '', workDescription: '',
    customerCharge: '', workerCharge: '', hsnCode: '', taxRate: '',
  });
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState({ description: '', qty: '1', rate: '', hsnCode: '', taxRate: '' });
  const canServicesView = can('services.view');
  const canStockView = can('stock.view');
  const canStockEdit = can('stock.edit');
  const canExpensesView = can('expenses.view');

  const resetRequestKey = () => { requestKey.current = makeKey(); };

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true);
    setLoadError('');
    Promise.all([
      quickService.list(),
      billingService.getGstContext().catch(() => null),
      canExpensesView ? outsideLabourService.list().catch(() => []) : Promise.resolve([]),
    ]).then(([data, gst, workers]) => {
      if (!active) return;
      setServices(rowsOf(data));
      setGstRegistered(Boolean(gst?.registered));
      const unique = new Map();
      rowsOf(workers).forEach(row => {
        const name = String(row.workerName || '').trim();
        if (!name) return;
        const key = name.toLocaleLowerCase() + '|' + String(row.workerPhone || '');
        if (!unique.has(key)) unique.set(key, { id: row.id, workerName: name, workerPhone: row.workerPhone || '' });
      });
      setOutsideRows([...unique.values()]);
    }).catch(err => { if (active) setLoadError(err.message || 'Could not load Quick Services.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, reload, canExpensesView]);

  useEffect(() => {
    if (!canServicesView) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setServiceLoading(true); setServiceError('');
      try {
        const data = await serviceService.getServices({ search: serviceQuery.trim(), status: 'active' });
        if (active) setServiceRows(rowsOf(data).filter(row => row.status !== 'inactive').slice(0, 12));
      } catch (err) { if (active) { setServiceRows([]); setServiceError(err.message || 'Could not search services.'); } }
      finally { if (active) setServiceLoading(false); }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [serviceQuery, canServicesView]);

  useEffect(() => {
    if (!canStockView) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setPartLoading(true); setPartError('');
      try {
        const data = await stockService.getStockItems({ search: partQuery.trim() });
        if (active) setPartRows(rowsOf(data).slice(0, 12));
      } catch (err) { if (active) { setPartRows([]); setPartError(err.message || 'Could not search inventory.'); } }
      finally { if (active) setPartLoading(false); }
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [partQuery, canStockView]);

  const addService = row => {
    setItems(old => [...old, {
      key: makeKey(), kind: 'service', serviceId: row.id,
      description: row.name, qty: '1', rate: String(row.price || 0),
      hsnCode: row.hsnSac || '', taxRate: String(row.taxRate ?? 0), unit: row.unit || 'Job',
    }]);
    resetRequestKey();
  };

  const addPart = row => {
    const available = Number(row.branchAvailable ?? row.available ?? row.onHand ?? 0);
    if (available <= 0) return;
    const existing = items.find(item => item.kind === 'part' && String(item.inventoryId) === String(row.id));
    if (existing) {
      const nextQty = Number(existing.qty || 0) + 1;
      if (nextQty > available) {
        setError(`Only ${available} of ${row.partName || row.name} are available in this branch.`);
        return;
      }
      setItems(old => old.map(item => item.key === existing.key ? { ...item, qty: String(nextQty) } : item));
      setError('');
      resetRequestKey();
      return;
    }
    setItems(old => [...old, {
      key: makeKey(), kind: 'part', inventoryId: row.id,
      description: row.partName || row.name, sku: row.sku || '',
      qty: '1', rate: String(row.sellingPrice ?? row.price ?? 0),
      hsnCode: row.hsnCode || '', taxRate: String(row.tax ?? row.taxRate ?? 0),
      unit: row.unit || 'Piece', available,
    }]);
    resetRequestKey();
  };

  const addOutside = () => {
    if (!outsideDraft.workerName.trim() || !outsideDraft.workDescription.trim() ||
        Number(outsideDraft.customerCharge) <= 0 || Number(outsideDraft.workerCharge) <= 0) {
      setError('Enter outside worker, work description, customer charge and worker cost.');
      return;
    }
    if (gstRegistered && (!outsideDraft.hsnCode.trim() || outsideDraft.taxRate === '')) {
      setError('Enter SAC and GST percentage for outside labour.');
      return;
    }
    setItems(old => [...old, {
      key: makeKey(), kind: 'outside', description: outsideDraft.workDescription,
      workerName: outsideDraft.workerName.trim(), workerPhone: outsideDraft.workerPhone.trim(),
      workDescription: outsideDraft.workDescription.trim(),
      customerCharge: outsideDraft.customerCharge, workerCharge: outsideDraft.workerCharge,
      rate: outsideDraft.customerCharge, qty: '1',
      hsnCode: outsideDraft.hsnCode.trim(), taxRate: gstRegistered ? outsideDraft.taxRate : '0',
    }]);
    setOutsideDraft({ workerName: '', workerPhone: '', workDescription: '', customerCharge: '', workerCharge: '', hsnCode: '', taxRate: '' });
    setError('');
    resetRequestKey();
  };

  const addCustom = () => {
    if (!customDraft.description.trim() || Number(customDraft.rate) <= 0) {
      setError('Enter a custom service description and a positive rate.');
      return;
    }
    if (gstRegistered && (!customDraft.hsnCode.trim() || customDraft.taxRate === '')) {
      setError('Enter SAC and GST percentage for the custom service.');
      return;
    }
    setItems(old => [...old, {
      key: makeKey(), kind: 'custom', type: 'Labour',
      description: customDraft.description.trim(), qty: customDraft.qty || '1',
      rate: customDraft.rate, hsnCode: customDraft.hsnCode.trim(),
      taxRate: gstRegistered ? customDraft.taxRate : '0',
    }]);
    setCustomDraft({ description: '', qty: '1', rate: '', hsnCode: '', taxRate: '' });
    setCustomOpen(false);
    setError('');
    resetRequestKey();
  };

  const updateItem = (key, field, value) => {
    setItems(old => old.map(item => item.key === key ? { ...item, [field]: value } : item));
    setError('');
    resetRequestKey();
  };

  const removeItem = key => {
    setItems(old => old.filter(item => item.key !== key));
    resetRequestKey();
  };

  const subtotal = useMemo(() => items.reduce((sum, item) =>
    sum + Number(item.rate || item.customerCharge || 0) * Number(item.qty || 1), 0), [items]);

  async function start(event) {
    event.preventDefault();
    if (starting || !items.length) return;
    setStarting(true);
    setError('');
    setClosed(null);
    const payloadItems = items.map(item => {
      if (item.kind === 'service') return { kind: 'service', serviceId: item.serviceId, qty: item.qty };
      if (item.kind === 'part') return { kind: 'part', inventoryId: item.inventoryId, qty: item.qty };
      if (item.kind === 'outside') return {
        kind: 'outside', workerName: item.workerName, workerPhone: item.workerPhone,
        workDescription: item.workDescription, customerCharge: item.customerCharge,
        workerCharge: item.workerCharge, hsnCode: item.hsnCode, taxRate: item.taxRate,
      };
      return {
        kind: 'custom', type: 'Labour', description: item.description, qty: item.qty,
        rate: item.rate, hsnCode: item.hsnCode, taxRate: item.taxRate,
      };
    });
    try {
      const created = await quickService.start({
        requestId: requestKey.current,
        description: description.trim(),
        customerId: customer?.id || null,
        vehicleId: vehicle?.id || null,
        items: payloadItems,
        notes: notes.trim(),
      });
      setServices(rows => [created, ...rows.filter(row => row.id !== created.id)]);
      setItems([]); setCustomer(null); setVehicle(null); setDescription(''); setNotes('');
      requestKey.current = makeKey();
    } catch (err) {
      setError(err.message || 'Could not start Quick Service.');
    } finally { setStarting(false); }
  }

  function finish(service) {
    setServices(rows => rows.map(row => row.id === service.id ? service : row));
    setSelectedId(null);
    setClosed(service);
  }

  return (
    <main className="dashboard-page job-management-page quick-service-page">
      <JobBreadcrumbs current="Quick Service" />
      <header className="dashboard-heading quick-service-heading">
        <div className="dashboard-heading-copy">
          <h1>Quick Service</h1>
          <p>Create a counter service in one form. Customer and vehicle details are optional.</p>
        </div>
        <button type="button" className="dashboard-button" onClick={() => setReload(value => value + 1)} disabled={loading}><RefreshCw size={15}/> Refresh</button>
      </header>
      {!allowed ? <p role="status">{USE_MOCK_API ? 'Quick Service requires a connected workshop.' : 'You do not have access to Quick Service.'}</p> : <>
        {canStart && (
          <form className="quick-service-builder" onSubmit={start}>
            <section className="quick-service-section quick-service-title-section">
              <label>Quick Service title (optional)<input value={description} maxLength={255} onChange={event => { setDescription(event.target.value); resetRequestKey(); }} placeholder="e.g. Minor repair / walk-in service"/></label>
            </section>
            <CustomerVehicleSection can={can} customer={customer} onCustomer={setCustomer}
              vehicle={vehicle} onVehicle={setVehicle} resetRequestKey={resetRequestKey}/>

            <section className="quick-service-section">
              <div className="quick-service-section-heading">
                <div className="quick-service-section-title"><Wrench size={18}/><div><h2>Services</h2><p>Search the workshop service catalogue and add the work</p></div></div>
              </div>
              {canServicesView ? (
                <SearchResults label="Search services" query={serviceQuery} onQuery={setServiceQuery}
                  placeholder="Service name or code" loading={serviceLoading} error={serviceError}
                  results={serviceRows} onAdd={addService} emptyText="No services found."
                  renderTitle={row => row.name} renderMeta={row => `${row.code || 'Service'} · ${currency.format(Number(row.price || 0))} · ${row.unit || 'Job'}`}/>
              ) : <p className="quick-service-muted">Services View permission is required to search the catalogue.</p>}
              <button type="button" className="quick-service-secondary-action" onClick={() => setCustomOpen(value => !value)}><Plus size={15}/> Add custom service</button>
              {customOpen && <div className="quick-service-inline-form quick-service-custom-form">
                <label>Work description<input value={customDraft.description} onChange={e => setCustomDraft(old => ({...old,description:e.target.value}))} placeholder="e.g. Minor adjustment"/></label>
                <div className="quick-service-two-columns"><label>Qty<input type="number" min="0.01" step="0.01" value={customDraft.qty} onChange={e => setCustomDraft(old => ({...old,qty:e.target.value}))}/></label><label>Rate (₹)<input type="number" min="0.01" step="0.01" value={customDraft.rate} onChange={e => setCustomDraft(old => ({...old,rate:e.target.value}))}/></label></div>
                {gstRegistered && <div className="quick-service-two-columns"><label>SAC<input value={customDraft.hsnCode} onChange={e => setCustomDraft(old => ({...old,hsnCode:e.target.value}))}/></label><label>GST %<input type="number" min="0" max="100" step="0.01" value={customDraft.taxRate} onChange={e => setCustomDraft(old => ({...old,taxRate:e.target.value}))}/></label></div>}
                <div className="quick-service-inline-actions"><button type="button" onClick={() => setCustomOpen(false)}>Cancel</button><button type="button" onClick={addCustom}>Add to service</button></div>
              </div>}
            </section>

            <section className="quick-service-section">
              <div className="quick-service-section-heading"><div className="quick-service-section-title"><Package size={18}/><div><h2>Spare Parts</h2><p>Search stock and add the required quantity</p></div></div></div>
              {canStockView ? <SearchResults label="Search parts" query={partQuery} onQuery={setPartQuery}
                placeholder="Part name, SKU or brand" loading={partLoading} error={partError}
                results={partRows} onAdd={addPart} isDisabled={row => !canStockEdit || Number(row.branchAvailable ?? row.available ?? row.onHand ?? 0) <= 0} emptyText="No matching parts found. Add new parts in Inventory first."
                renderTitle={row => row.partName || row.name} renderMeta={row => {
                  const available=Number(row.branchAvailable ?? row.available ?? row.onHand ?? 0);
                  return `${row.sku || 'No SKU'} · ${available} available · ${currency.format(Number(row.sellingPrice ?? row.price ?? 0))}`;
                }}/> : <p className="quick-service-muted">Stock View permission is required to search parts.</p>}
              {!canStockEdit && canStockView && <p className="quick-service-muted">Stock Edit permission is required to add parts to an invoice.</p>}
              <p className="quick-service-hint"><Link to="/stock">Open Inventory to add a new part</Link></p>
            </section>

            <section className="quick-service-section">
              <div className="quick-service-section-heading"><div className="quick-service-section-title"><HardHat size={18}/><div><h2>Outside Labour</h2><p>Find a previous worker or add a new outside job</p></div></div></div>
              {can('expenses.create') ? <>
                <label className="quick-service-search-label"><span>Search previous workers</span><span className="quick-service-search-box"><Search size={16}/><input value={outsideQuery} onChange={e => {setOutsideQuery(e.target.value); const found=outsideRows.find(row => row.workerName.toLowerCase().includes(e.target.value.toLowerCase())); if(found) setOutsideDraft(old=>({...old,workerName:found.workerName,workerPhone:found.workerPhone}));}} placeholder="Worker name or phone"/></span></label>
                {!!outsideQuery.trim() && <div className="quick-service-inline-results">
                  {outsideRows.filter(row => [row.workerName,row.workerPhone].some(value => String(value||'').toLowerCase().includes(outsideQuery.toLowerCase()))).slice(0,8).map(row=><button type="button" key={row.id} onClick={()=>setOutsideDraft(old=>({...old,workerName:row.workerName,workerPhone:row.workerPhone}))}><strong>{row.workerName}</strong><small>{row.workerPhone}</small></button>)}
                </div>}
                <div className="quick-service-outside-form">
                  <div className="quick-service-two-columns"><label>Worker name<input value={outsideDraft.workerName} onChange={e=>setOutsideDraft(old=>({...old,workerName:e.target.value}))} placeholder="Outside worker"/></label><label>Phone<input inputMode="tel" value={outsideDraft.workerPhone} onChange={e=>setOutsideDraft(old=>({...old,workerPhone:e.target.value}))} placeholder="Optional"/></label></div>
                  <label>Work description<input value={outsideDraft.workDescription} onChange={e=>setOutsideDraft(old=>({...old,workDescription:e.target.value}))} placeholder="e.g. Denting / painting"/></label>
                  <div className="quick-service-two-columns"><label>Customer charge (₹)<input type="number" min="0.01" step="0.01" value={outsideDraft.customerCharge} onChange={e=>setOutsideDraft(old=>({...old,customerCharge:e.target.value}))}/></label><label>Worker cost (₹)<input type="number" min="0.01" step="0.01" value={outsideDraft.workerCharge} onChange={e=>setOutsideDraft(old=>({...old,workerCharge:e.target.value}))}/></label></div>
                  {gstRegistered && <div className="quick-service-two-columns"><label>SAC<input value={outsideDraft.hsnCode} onChange={e=>setOutsideDraft(old=>({...old,hsnCode:e.target.value}))}/></label><label>GST %<input type="number" min="0" max="100" step="0.01" value={outsideDraft.taxRate} onChange={e=>setOutsideDraft(old=>({...old,taxRate:e.target.value}))}/></label></div>}
                  <button type="button" className="quick-service-secondary-action" onClick={addOutside}><Plus size={15}/> Add outside labour</button>
                </div>
              </> : <p className="quick-service-muted">Expenses Create permission is required to add outside labour.</p>}
            </section>

            <section className="quick-service-section quick-service-added-section">
              <div className="quick-service-section-heading">
                <div className="quick-service-section-title"><CheckCircle2 size={18}/><div><h2>Added to this Quick Service</h2><p>{items.length} line{items.length === 1 ? '' : 's'} selected</p></div></div>
                <strong className="quick-service-subtotal">{currency.format(subtotal)}</strong>
              </div>
              {!items.length ? <p className="quick-service-empty">Search and add a service, spare part or outside labour above.</p> : (
                <div className="quick-service-added-list">
                  {items.map(item=><article className="quick-service-added-item" key={item.key}>
                    <div className="quick-service-added-title"><div><strong>{item.description || item.workDescription}</strong><small>{item.kind === 'part' ? `Spare Part · ${item.sku}` : item.kind === 'outside' ? `Outside Labour · ${item.workerName}` : item.kind === 'service' ? 'Catalogue Service' : 'Custom Service'}</small></div><button type="button" aria-label={`Remove ${item.description}`} onClick={()=>removeItem(item.key)}><Trash2 size={16}/></button></div>
                    <div className="quick-service-added-controls">
                      <label>Qty<input type="number" min="0.01" max={item.kind === 'part' ? item.available : undefined} step="0.01" value={item.qty} onChange={e=>updateItem(item.key,'qty',e.target.value)} disabled={item.kind==='outside'} aria-label={`${item.description} quantity`}/></label>
                      {item.kind==='outside' ? <><label>Customer charge<input type="number" min="0.01" step="0.01" value={item.customerCharge} onChange={e=>{updateItem(item.key,'customerCharge',e.target.value); updateItem(item.key,'rate',e.target.value);}}/></label><label>Worker cost<input type="number" min="0.01" step="0.01" value={item.workerCharge} onChange={e=>updateItem(item.key,'workerCharge',e.target.value)}/></label></> : item.kind==='custom' ? <label>Rate (₹)<input type="number" min="0.01" step="0.01" value={item.rate} onChange={e=>updateItem(item.key,'rate',e.target.value)}/></label> : <div className="quick-service-line-price"><small>Unit price</small><strong>{currency.format(Number(item.rate||0))}</strong></div>}
                      <div className="quick-service-line-total"><small>Line total</small><strong>{currency.format(Number(item.rate || item.customerCharge || 0)*Number(item.qty||1))}</strong></div>
                    </div>
                  </article>)}
                </div>
              )}
              <label className="quick-service-notes">Notes (optional)<textarea rows="2" maxLength="2000" value={notes} onChange={e=>{setNotes(e.target.value);resetRequestKey();}} placeholder="Any additional service note"/></label>
            </section>
            {error && <p className="quick-service-error" role="alert">{error}</p>}
            <div className="quick-service-start-footer">
              <div><small>Estimated subtotal before GST</small><strong>{currency.format(subtotal)}</strong></div>
              <button type="submit" className="dashboard-button is-primary" disabled={starting || !items.length}>{starting ? 'Starting…' : 'Start Quick Service'}</button>
            </div>
          </form>
        )}

        {closed && <p className="quick-service-success" role="status">Service closed. Invoice {closed.invoiceNumber} · {currency.format(Number(closed.invoiceTotal))} received.</p>}
        <section aria-labelledby="quick-service-list-heading" className="quick-service-list">
          <div className="quick-service-list-heading"><h2>Quick Services</h2><span>{services.length} records</span></div>
          {loadError && <p className="quick-service-error" role="alert">{loadError}</p>}
          {loading && <p role="status">Loading services…</p>}
          {!loading && !loadError && services.length === 0 && <p className="quick-service-empty">No quick services yet.</p>}
          {services.map(service => (
            <article key={service.id} className="quick-service-card">
              <div className="quick-service-card-head">
                <div className="quick-service-card-main">
                  <h3>{service.description}</h3>
                  <p>{service.customerName || 'Walk-in'}{service.vehicleReg ? ` · ${service.vehicleReg}` : ''} · {new Date(service.created_at).toLocaleString('en-IN')}</p>
                  <small>{(service.items || []).length} item(s) · {service.closedAt ? 'Closed' : 'In progress'}</small>
                </div>
                <div className="quick-service-actions">
                  {service.invoiceId && canViewInvoice && <Link className="dashboard-button" to={`/invoices/${service.invoiceId}`}>View Invoice {service.invoiceNumber}</Link>}
                  {!service.closedAt && canClose && selectedId !== service.id && <button type="button" className="dashboard-button is-primary" onClick={()=>setSelectedId(service.id)}>Finish Service</button>}
                </div>
              </div>
              {service.id === selectedId && !service.closedAt && canClose && <QuickServiceCheckout service={service} onClose={finish} onCancel={()=>setSelectedId(null)}/>}
            </article>
          ))}
        </section>
      </>}
    </main>
  );
}
