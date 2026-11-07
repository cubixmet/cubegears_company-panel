import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, CreditCard, Mail, MessageCircle, Package, Pencil, Phone, Plus, Search, ShoppingBag } from 'lucide-react';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { supplierService } from '../../services/supplier.service';
import { supplierFinanceService } from '../../services/supplierFinance.service';
import { ResponsiveModalSheet } from '../../components/common/ResponsiveModalSheet';
import { USE_MOCK_API } from '../../api/apiConfig';
import SupplierPurchaseFlow from '../../components/suppliers/SupplierPurchaseFlow';
import SupplierReturnsPanel from '../../components/suppliers/SupplierReturnsPanel';
import { useLocation } from 'react-router-dom';
import { customerContactLinks } from '../../components/jobs/customerContact.utils';
import '../../styles/suppliers-workspace.css';

const asText = value => String(value ?? '').trim();
const formFields = ['name', 'contact_person', 'phone', 'email', 'gstNo', 'address'];
const money = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value))
  ? 'Unavailable'
  : new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR' }).format(Number(value));
const status = item => item?.is_active === false ? 'Inactive' : 'Active';
const supplierIdOf = row => String(typeof row?.supplier === 'object' ? row.supplier?.id : row?.supplier || row?.supplierId || '');
const initialForm = supplier => ({
  name:asText(supplier?.name),
  contact_person:asText(supplier?.contact_person || supplier?.contactPerson),
  phone:asText(supplier?.phone),
  email:asText(supplier?.email),
  gstNo:asText(supplier?.gstNo || supplier?.gstin),
  address:asText(supplier?.address),
  is_active:supplier?.is_active !== false,
});


function SupplierContactActions({ supplier, compact = false }) {
  const { callUrl, whatsappUrl } = customerContactLinks({ customerPhone: supplier?.phone });
  const name = asText(supplier?.name) || 'supplier';
  return <span className={'cg-supplier-contact-actions' + (compact ? ' is-compact' : '')}>
    {callUrl
      ? <a className="cg-supplier-contact-btn is-call" href={callUrl} aria-label={'Call ' + name}><Phone size={14} aria-hidden="true"/> Call</a>
      : <span className="cg-supplier-contact-btn is-disabled" title="No valid phone number"><Phone size={14} aria-hidden="true"/> Call</span>}
    {whatsappUrl
      ? <a className="cg-supplier-contact-btn is-whatsapp" href={whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label={'WhatsApp ' + name}><MessageCircle size={14} aria-hidden="true"/> WhatsApp</a>
      : <span className="cg-supplier-contact-btn is-disabled" title="No valid WhatsApp number"><MessageCircle size={14} aria-hidden="true"/> WhatsApp</span>}
  </span>;
}

function SupplierEditor({ supplier, onClose, onSaved }) {
  const access = useFeatureAccess();
  const canWrite = access.can(supplier ? 'stock.edit' : 'stock.create') && !USE_MOCK_API;
  const [form, setForm] = useState(() => initialForm(supplier));
  const [busy, setBusy] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [error, setError] = useState('');
  const inputRefs = useRef({});
  const labels = {
    name: 'Supplier Name *', contact_person: 'Contact Person', phone: 'Mobile Number',
    email: 'Email', gstNo: 'GSTIN', address: 'Address',
  };

  useEffect(() => {
    const first = formFields.find(key => formErrors[key]);
    const element = first ? inputRefs.current[first] : null;
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.focus({ preventScroll: true });
    }
  }, [formErrors]);

  const setField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setFormErrors(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const submit = async event => {
    event.preventDefault();
    if (!canWrite || busy) return;
    const errors = {};
    if (!form.name.trim()) errors.name = 'Supplier Name is required.';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      setError('');
      return;
    }
    setBusy(true);
    setError('');
    setFormErrors({});
    try {
      const payload = { ...form, name: form.name.trim(), email: form.email.trim() };
      const saved = supplier
        ? await supplierService.update(supplier.id, payload)
        : await supplierService.create(payload);
      onSaved(saved);
    } catch (cause) {
      const data = cause?.fieldErrors || cause?.data || cause?.response?.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const normalized = {};
        const aliases = { gstin: 'gstNo', gst_no: 'gstNo', contactPerson: 'contact_person' };
        for (const [key, value] of Object.entries(data)) {
          const target = aliases[key] || key;
          const message = Array.isArray(value) ? value.join(' ') : String(value ?? '');
          if (formFields.includes(target)) normalized[target] = message;
        }
        if (Object.keys(normalized).length) {
          setFormErrors(normalized);
          setError('');
        } else {
          const detail = data.detail || data.message || data.non_field_errors;
          setError(Array.isArray(detail) ? detail.join(' ') : String(detail || cause?.message || 'Unable to save supplier.'));
        }
      } else {
        setError(cause?.message || 'Unable to save supplier.');
      }
    } finally {
      setBusy(false);
    }
  };

  return <ResponsiveModalSheet isOpen onClose={() => !busy && onClose()}
    title={supplier ? 'Edit Supplier' : 'Add Supplier'} maxWidth="590px">
    <form className="cg-supplier-form" noValidate onSubmit={submit}>
      {formFields.map(key => <label key={key} className="cg-supplier-field">
        <span>{labels[key]}</span>
        {key === 'address'
          ? <textarea ref={node => { inputRefs.current[key] = node; }} rows={2}
              aria-invalid={Boolean(formErrors[key])} aria-describedby={formErrors[key] ? 'supplier-error-' + key : undefined}
              value={form[key]} onChange={e => setField(key, e.target.value)} />
          : <input ref={node => { inputRefs.current[key] = node; }} required={key === 'name'}
              type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
              maxLength={key === 'name' ? 180 : key === 'contact_person' ? 120 : key === 'phone' ? 30 : key === 'gstNo' ? 20 : 254}
              aria-invalid={Boolean(formErrors[key])} aria-describedby={formErrors[key] ? 'supplier-error-' + key : undefined}
              value={form[key]} onChange={e => setField(key, e.target.value)} />}
        {formErrors[key] && <small id={'supplier-error-' + key} role="alert"
          className="cg-supplier-field-error">{formErrors[key]}</small>}
      </label>)}
      {supplier && <label className="cg-supplier-toggle">
        <input type="checkbox" checked={form.is_active} onChange={e => setField('is_active', e.target.checked)} />
        <span>Active Supplier</span>
      </label>}
      {error && <p role="alert" className="cg-supplier-error">{error}</p>}
      {USE_MOCK_API && <p className="cg-supplier-note">Saving requires the Django backend.</p>}
      <div className="cg-supplier-modal-actions">
        <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="primary" disabled={!canWrite || busy}>
          {busy ? 'Saving…' : 'Save Supplier'}
        </button>
      </div>
    </form>
  </ResponsiveModalSheet>;
}

export default function SuppliersPage({ section = 'all' }) {
  const purchaseView = section === 'purchases';
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const access = useFeatureAccess();
  const canCreate = access.can('stock.create') && !USE_MOCK_API;
  const canEdit = access.can('stock.edit') && !USE_MOCK_API;
  const canViewFinance = access.can('payments.view') && access.can('stock.view');
  const canCreatePurchase = canViewFinance && access.can('stock.create') && access.can('stock.edit') &&
    access.can('payments.create') && !USE_MOCK_API;
  const canPaySupplier = canViewFinance && access.can('payments.create') && !USE_MOCK_API;
  const canDelete = access.can('stock.delete') && !USE_MOCK_API;
  const [suppliers, setSuppliers] = useState([]);
  const [creditBalances, setCreditBalances] = useState(null);
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [purchaseBillsError, setPurchaseBillsError] = useState('');
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [purchaseQuery, setPurchaseQuery] = useState('');
  const [purchaseSupplier, setPurchaseSupplier] = useState(() => params.get('supplier') || '');
  const [purchaseStatus, setPurchaseStatus] = useState('');
  const [purchaseFrom, setPurchaseFrom] = useState('');
  const [purchaseTo, setPurchaseTo] = useState('');
  const [purchaseHistoryLoading, setPurchaseHistoryLoading] = useState(false);
  const [purchaseHistoryError, setPurchaseHistoryError] = useState('');
  const [supplier, setSupplier] = useState(null);
  const [supplierFinancials, setSupplierFinancials] = useState(null);
  const [supplierBills, setSupplierBills] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [supplierFinanceError, setSupplierFinanceError] = useState('');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const statusFilter = params.get('status') || 'all';
  const search = params.get('q') || '';

  useEffect(() => {
    if (USE_MOCK_API) {
      setSuppliers([]);
      setLoading(false);
      setError('Supplier records require the live Django backend. Disable mock mode.');
      return undefined;
    }
    let active=true;
    setLoading(true);setError('');
    supplierService.list()
      .then(rows => { if(active)setSuppliers(rows); })
      .catch(cause => { if(active)setError(cause?.message || 'Could not load suppliers.'); })
      .finally(() => { if(active)setLoading(false); });
    return()=>{active=false};
  }, []);

  useEffect(() => {
    if (!id) { setSupplier(null);setOrders([]);setProducts([]);setDetailsLoading(false);return undefined; }
    if (USE_MOCK_API) {
      setSupplier(null);
      setDetailsLoading(false);
      setError('Supplier details require the live Django backend.');
      return undefined;
    }
    let active=true;
    setDetailsLoading(true);setSupplier(null);setError('');
    Promise.all([supplierService.get(id), supplierService.purchaseOrders(), supplierService.products()])
      .then(([found,purchases,stock]) => {
        if(!active)return;
        setSupplier(found);
        setOrders(purchases.filter(row=>supplierIdOf(row)===String(id)));
        setProducts(stock.filter(row=>supplierIdOf(row)===String(id)));
      }).catch(cause=>{if(active)setError(cause?.message || 'Unable to load supplier details.');})
      .finally(()=>{if(active)setDetailsLoading(false);});
    return()=>{active=false};
  }, [id]);

  useEffect(() => {
    if (!id || !canViewFinance || USE_MOCK_API) {
      setSupplierFinancials(null);
      setSupplierBills([]);
      setSupplierPayments([]);
      return undefined;
    }
    let active = true;
    setSupplierFinanceError('');
    Promise.all([
      supplierFinanceService.getSupplierSummary(id),
      supplierFinanceService.getBills(id),
      supplierFinanceService.getPayments(id),
    ]).then(([summary, bills, payments]) => {
      if (!active) return;
      setSupplierFinancials(summary);
      setSupplierBills(bills);
      setSupplierPayments(payments);
    }).catch(error => {
      if (active) setSupplierFinanceError(error?.message || 'Supplier finance records could not be loaded.');
    });
    return () => { active = false; };
  }, [id, canViewFinance]);

  useEffect(() => {
    if (!purchaseView) return undefined;
    if (USE_MOCK_API) {
      setPurchaseHistory([]);
      setPurchaseHistoryLoading(false);
      setPurchaseHistoryError('Purchase history requires the live Django backend.');
      return undefined;
    }
    let active = true;
    setPurchaseHistoryLoading(true);
    setPurchaseHistoryError('');
    supplierService.purchaseOrders()
      .then(rows => { if (active) setPurchaseHistory(rows); })
      .catch(cause => { if (active) setPurchaseHistoryError(cause?.message || 'Unable to load purchase history.'); })
      .finally(() => { if (active) setPurchaseHistoryLoading(false); });
    return () => { active = false; };
  }, [purchaseView]);

  useEffect(() => {
    if (!canViewFinance || USE_MOCK_API) return undefined;
    let active = true;
    // SupplierBill is the authoritative posted payable, not a draft PO or an expense.
    setPurchaseBillsError('');
    supplierFinanceService.getBills().then(rows => {
      if (!active) return;
      setPurchaseBills(rows);
      const balances = new Map();
      for (const bill of rows) {
        if (bill.postingStatus !== 'Posted') continue;
        const key = String(bill.supplierId);
        balances.set(key, (balances.get(key) || 0) + Number(bill.outstanding || 0));
      }
      setCreditBalances(balances);
    }).catch(cause => {
      if (!active) return;
      setCreditBalances(null);
      setPurchaseBills([]);
      setPurchaseBillsError(cause?.message || 'Unable to load supplier purchase bills.');
    });
    return () => { active = false; };
  }, [canViewFinance]);

  const matches = useMemo(() => {
    const needle=search.trim().toLowerCase();
    return suppliers.filter(row =>
      (statusFilter === 'all' || status(row).toLowerCase() === statusFilter) &&
      [row.name, row.phone, row.contact_person, row.contactPerson, row.gstNo, row.gstin, row.email]
        .some(value=>asText(value).toLowerCase().includes(needle))
    );
  },[search,suppliers,statusFilter]);

  // Purchase orders and posted supplier bills are distinct records; never sum them as
  // separate outstanding liabilities. Filter each data source independently.
  const matchesPurchase = (number, rowSupplier, date, state, postingState = '') => {
    const supplierName = suppliers.find(row => String(row.id) === String(rowSupplier))?.name || '';
    const query = purchaseQuery.trim().toLowerCase();
    if (purchaseSupplier && String(rowSupplier) !== purchaseSupplier) return false;
    if (purchaseStatus && ![state, postingState].some(value => String(value || '').toLowerCase() === purchaseStatus)) return false;
    if (purchaseFrom && (!date || String(date).slice(0, 10) < purchaseFrom)) return false;
    if (purchaseTo && (!date || String(date).slice(0, 10) > purchaseTo)) return false;
    return !query || [number, supplierName, state].some(value => asText(value).toLowerCase().includes(query));
  };
  const filteredPurchaseHistory = purchaseHistory.filter(order =>
    matchesPurchase(order.purchaseNo || order.number, supplierIdOf(order),
      order.purchaseDate || order.orderDate || order.date || order.createdAt, order.status));
  const filteredPurchaseBills = purchaseBills.filter(bill =>
    matchesPurchase(bill.invoiceNumber, bill.supplierId, bill.invoiceDate, bill.status, bill.postingStatus));

  async function deactivateSupplier() {
    if (!supplier || !canEdit || actionBusy) return;
    setActionBusy(true); setError('');
    try {
      const changed = await supplierService.update(supplier.id, { is_active: false });
      setSupplier(changed);
      setSuppliers(rows => rows.map(x => String(x.id) === String(changed.id) ? changed : x));
    } catch (cause) {
      setError(cause?.response?.data?.message || cause?.message || 'Could not deactivate supplier.');
    } finally { setActionBusy(false); }
  }

  async function deleteSupplier() {
    if (!supplier || !canDelete || actionBusy) return;
    setActionBusy(true); setError('');
    try {
      await supplierService.remove(supplier.id);
      setDeleteConfirmOpen(false);
      setSuppliers(rows => rows.filter(x => String(x.id) !== String(supplier.id)));
      navigate('/suppliers');
    } catch (cause) {
      setError(cause?.response?.data?.message || cause?.message || 'Cannot delete this supplier. Deactivate it instead.');
    } finally { setActionBusy(false); }
  }

  const refreshSupplierDetails = async () => {
    if (!id) return;
    const [summary, bills, payments, catalog] = await Promise.all([
      supplierFinanceService.getSupplierSummary(id),
      supplierFinanceService.getBills(id),
      supplierFinanceService.getPayments(id),
      supplierService.products(),
    ]);
    setSupplierFinancials(summary);
    setSupplierBills(bills);
    setSupplierPayments(payments);
    setProducts(catalog.filter(row => supplierIdOf(row) === String(id)));
    setNotice('Supplier purchase, stock, payments and outstanding balance updated.');
  };

  function onSaved(saved) {
    setEditor(null);
    setNotice(supplier ? 'Supplier updated successfully.' : 'Supplier saved successfully.');
    setSuppliers(rows => {
      const exists=rows.some(row=>String(row.id)===String(saved.id));
      return exists ? rows.map(row=>String(row.id)===String(saved.id)?saved:row) : [saved,...rows];
    });
    if(id) setSupplier(saved);
    else navigate('/suppliers/'+encodeURIComponent(saved.id));
  }

  return <div className="cg-suppliers-page">
    <div className="cg-suppliers-head">
      <div>
        {id&&<Link className="cg-suppliers-back" to="/suppliers"><ArrowLeft size={16}/> All Suppliers</Link>}
        <h1 title={id ? (supplier?.name || 'Supplier Details') : undefined}>
          {id ? (supplier?.name || 'Supplier Details') : purchaseView ? 'Purchase History' : 'Suppliers'}
        </h1>
      </div>
      {id ? canEdit && supplier && <button type="button" className="cg-supplier-button" onClick={()=>setEditor(supplier)}>Edit Supplier</button>
        : canCreate && <button type="button" className="cg-supplier-button primary" onClick={()=>setEditor({create:true})}><Plus size={17}/> Add Supplier</button>}
    </div>


    {error&&<div className="cg-supplier-error" role="alert">{error} <button type="button" onClick={()=>window.location.reload()}>Retry</button></div>}
    {notice&&<p className="cg-supplier-success" role="status">{notice}</p>}

    {!id&&!purchaseView&&<>
      <div className="cg-supplier-toolbar">
        <label className="cg-supplier-search"><Search size={18} aria-hidden="true"/>
          <input aria-label="Search suppliers" value={search} placeholder="Search name, phone or GSTIN"
            onChange={e=>{const p=new URLSearchParams(params);if(e.target.value)p.set('q',e.target.value);else p.delete('q');setParams(p,{replace:true});}}/>
        </label>
        <label className="cg-supplier-filter">
          <span className="sr-only">Filter suppliers</span>
          <select aria-label="Filter suppliers" value={statusFilter} onChange={event => {
            const p = new URLSearchParams(params);
            if (event.target.value === 'all') p.delete('status'); else p.set('status', event.target.value);
            setParams(p, { replace: true });
          }}>
            <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </label>
        <span>{matches.length} suppliers</span>
      </div>
      <div className="cg-supplier-directory-heading">
        <div><h2>All Suppliers</h2>
          <span className="cg-supplier-directory-count">{loading ? '—' : matches.length + ' / ' + suppliers.length}</span>
        </div>
      </div>
      {loading ? <p role="status" className="cg-supplier-empty">Loading suppliers…</p>
        : error ? null : matches.length ? <>
          <div className="cg-supplier-directory-table-wrap">
            <table className="cg-supplier-directory-table">
              <thead><tr>
                <th scope="col">Supplier</th>
                <th scope="col">Phone / WhatsApp</th>
                <th scope="col">Contact Person</th>
                <th scope="col">GSTIN</th>
                {canViewFinance && <th scope="col">Outstanding</th>}
                <th scope="col">Status</th>
                <th scope="col" className="cg-supplier-actions-col">Actions</th>
              </tr></thead>
              <tbody>{matches.map(row => {
                const name = asText(row.name) || 'Unnamed Supplier';
                const phone = asText(row.phone);
                const gstin = asText(row.gstNo || row.gstin);
                const person = asText(row.contact_person || row.contactPerson);
                const balance = creditBalances?.get(String(row.id));
                return <tr key={row.id}>
                  <td><Link className="cg-supplier-name-link" to={'/suppliers/' + encodeURIComponent(row.id)} title={name}>{name}</Link>
                    {row.email && <span className="cg-supplier-secondary-text" title={row.email}>{row.email}</span>}
                  </td>
                  <td><span className="cg-supplier-directory-phone">{phone || 'Not added'}</span>
                    <SupplierContactActions supplier={row} compact/>
                  </td>
                  <td>{person || '—'}</td>
                  <td><span className="cg-supplier-gstin-cell" title={gstin || undefined}>{gstin || '—'}</span></td>
                  {canViewFinance && <td><strong className={'cg-supplier-balance' + (creditBalances && Number(balance ?? 0) > 0 ? ' has-due' : '')}>
                    {creditBalances ? money(balance ?? 0) : 'Unavailable'}
                  </strong></td>}
                  <td><span className={row.is_active === false ? 'cg-supplier-directory-status inactive' : 'cg-supplier-directory-status'}>{status(row)}</span></td>
                  <td><span className="cg-supplier-row-actions">
                    <Link className="cg-supplier-row-view" to={'/suppliers/' + encodeURIComponent(row.id)}>View</Link>
                    {canEdit && <button type="button" className="cg-supplier-row-edit" aria-label={'Edit ' + name}
                      title={'Edit ' + name} onClick={() => setEditor(row)}><Pencil size={15} aria-hidden="true"/></button>}
                  </span></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div className="cg-supplier-mobile-directory">
            {matches.map(row => {
              const name = asText(row.name) || 'Unnamed Supplier';
              const gstin = asText(row.gstNo || row.gstin);
              const person = asText(row.contact_person || row.contactPerson);
              const balance = creditBalances?.get(String(row.id));
              return <article className="cg-supplier-mobile-entry" key={row.id}>
                <header className="cg-supplier-mobile-head">
                  <div><Link className="cg-supplier-name-link" to={'/suppliers/' + encodeURIComponent(row.id)}>{name}</Link>
                    <span className="cg-supplier-secondary-text">{row.email || person || 'Supplier'}</span></div>
                  <span className={row.is_active === false ? 'cg-supplier-directory-status inactive' : 'cg-supplier-directory-status'}>{status(row)}</span>
                </header>
                <div className="cg-supplier-mobile-details">
                  <div><span>Contact Person</span><strong>{person || '—'}</strong></div>
                  <div><span>GSTIN</span><strong>{gstin || '—'}</strong></div>
                  {canViewFinance && <div><span>Outstanding</span><strong className={'cg-supplier-balance' + (creditBalances && Number(balance ?? 0) > 0 ? ' has-due' : '')}>
                    {creditBalances ? money(balance ?? 0) : 'Unavailable'}
                  </strong></div>}
                </div>
                <div className="cg-supplier-mobile-bottom">
                  <div><span className="cg-supplier-directory-phone">{asText(row.phone) || 'No phone number'}</span>
                    <SupplierContactActions supplier={row}/></div>
                  <span className="cg-supplier-row-actions">
                    <Link className="cg-supplier-row-view" to={'/suppliers/' + encodeURIComponent(row.id)}>View</Link>
                    {canEdit && <button type="button" className="cg-supplier-row-edit" aria-label={'Edit ' + name}
                      title={'Edit ' + name} onClick={() => setEditor(row)}><Pencil size={15} aria-hidden="true"/></button>}
                  </span>
                </div>
              </article>;
            })}
          </div>
        </> : <p className="cg-supplier-empty">{search ? 'No suppliers match your search.' : 'No suppliers added yet.'}</p>}
    </>}

    {!id&&purchaseView&&(
      <section className="cg-supplier-purchase-history" aria-label="Supplier purchase history">
        <div className="cg-supplier-purchase-filters">
          <label>Search purchases
            <input aria-label="Search purchases" placeholder="Purchase number, invoice or supplier"
              value={purchaseQuery} onChange={event => setPurchaseQuery(event.target.value)} />
          </label>
          <label>Supplier
            <select aria-label="Purchase supplier" value={purchaseSupplier}
              onChange={event => setPurchaseSupplier(event.target.value)}>
              <option value="">All suppliers</option>
              {suppliers.map(row => <option key={row.id} value={String(row.id)}>{row.name}</option>)}
            </select>
          </label>
          <label>Status
            <select aria-label="Purchase status" value={purchaseStatus}
              onChange={event => setPurchaseStatus(event.target.value)}>
              <option value="">All statuses</option>
              {['Draft', 'Received', 'Completed', 'Posted', 'Unpaid', 'Partially Paid', 'Paid'].map(value =>
                <option key={value} value={value.toLowerCase()}>{value}</option>)}
            </select>
          </label>
          <label className="cg-supplier-filter-date">From date
            <input aria-label="Purchase from date" type="date" value={purchaseFrom}
              max={purchaseTo || undefined} onChange={event => setPurchaseFrom(event.target.value)} />
          </label>
          <label className="cg-supplier-filter-date">To date
            <input aria-label="Purchase to date" type="date" value={purchaseTo}
              min={purchaseFrom || undefined} onChange={event => setPurchaseTo(event.target.value)} />
          </label>
        </div>
        {purchaseHistoryError && <p role="alert" className="cg-supplier-error">{purchaseHistoryError}</p>}
        {purchaseHistoryLoading ? <p role="status" className="cg-supplier-empty">Loading purchase history…</p> : !purchaseHistoryError && (
          <div className="cg-supplier-profile">
            <div className="cg-supplier-profile-head">
              <ShoppingBag size={20}/><h2>Purchase Orders</h2><span>{filteredPurchaseHistory.length} records</span>
            </div>
            {filteredPurchaseHistory.map(order => (
              <div className="cg-supplier-record" key={'po-'+order.id}>
                <div>
                  <strong>{order.purchaseNo || order.number || 'Purchase Order'}</strong>
                  <small>{suppliers.find(row => String(row.id) === supplierIdOf(order))?.name || order.supplierName || 'Supplier'} · {order.status || '—'}</small>
                </div>
                <b>{money(order.total)}</b>
              </div>
            ))}
            {!filteredPurchaseHistory.length && <p className="cg-supplier-empty">No matching purchase orders found.</p>}
          </div>
        )}
        {canViewFinance && (
          <div className="cg-supplier-profile">
            <div className="cg-supplier-profile-head">
              <Package size={20}/><h2>Supplier Purchase Bills</h2><span>{filteredPurchaseBills.length} records</span>
            </div>
            {purchaseBillsError && <p className="cg-supplier-error" role="alert">{purchaseBillsError}</p>}
            {!purchaseBillsError && filteredPurchaseBills.map(bill => (
              <div className="cg-supplier-record" key={'bill-'+bill.id}>
                <div>
                  <strong>{bill.invoiceNumber}</strong>
                  <small>{suppliers.find(row => String(row.id) === String(bill.supplierId))?.name || 'Supplier'} · {bill.status} · {bill.invoiceDate} · {bill.postingStatus === 'Posted' ? 'Posted liability' : 'Draft — not payable'}</small>
                </div>
                <b>{bill.postingStatus === 'Posted' ? 'Due ' + money(bill.outstanding) : 'Draft ' + money(bill.total)}</b>
              </div>
            ))}
            {!purchaseBillsError && !filteredPurchaseBills.length && <p className="cg-supplier-empty">No matching supplier bills found.</p>}
          </div>
        )}
      </section>
    )}

    {id&&!detailsLoading&&supplier&&<>
      <section className="cg-supplier-profile">
        <div className="cg-supplier-profile-head"><Building2 size={20}/><h2>Supplier Information</h2>
          <span className={supplier.is_active===false?'cg-supplier-status inactive':'cg-supplier-status'}>{status(supplier)}</span>
        </div>
        <div className="cg-supplier-fields">
          <div><span>Contact Person</span><strong>{supplier.contact_person||supplier.contactPerson||'—'}</strong></div>
          <div><span>Phone</span><strong>{supplier.phone||'—'}</strong></div>
          <div><span>Email</span><strong>{supplier.email||'—'}</strong></div>
          <div><span>GSTIN</span><strong>{supplier.gstNo||'—'}</strong></div>
          <div className="full"><span>Address</span><strong>{supplier.address||'—'}</strong></div>
        </div>
        {canViewFinance && <div style={{ marginTop: 10, fontSize: 14 }}>
          Credit outstanding: <strong>{supplierFinancials
            ? money(supplierFinancials.outstanding)
            : 'Loading / Unavailable'}</strong>
          <a href="#supplier-pay-now" style={{ marginLeft: 12, color: 'var(--primary)' }}>Pay / Settle Credit</a>
        </div>}
        <div className="cg-supplier-contacts">
          {supplier.phone&&<a href={'tel:'+String(supplier.phone).replace(/[^\d+]/g,'')}><Phone size={15}/> Call</a>}
          {supplier.email&&<a href={'mailto:'+supplier.email}><Mail size={15}/> Email</a>}
          <Link to={'/stock?supplier='+encodeURIComponent(supplier.id)}><Package size={15}/> Inventory</Link>
          {canCreatePurchase && <a href="#supplier-purchase-form">
            <ShoppingBag size={15}/> Add Purchased Part</a>}
          {canPaySupplier && <a href="#supplier-pay-now">
            <CreditCard size={15}/> Pay Supplier</a>}
          {supplier.is_active !== false && canEdit && <button type="button" disabled={actionBusy}
            onClick={deactivateSupplier} className="cg-supplier-button">Deactivate</button>}
          {canDelete && <button type="button" disabled={actionBusy}
            onClick={() => setDeleteConfirmOpen(true)} className="cg-supplier-button">Delete Supplier</button>}
        </div>
      </section>
      {(canCreatePurchase || canPaySupplier) && (
        <SupplierPurchaseFlow
          supplier={supplier}
          initialPart={location.state?.purchasePrefill || null}
          canPurchase={canCreatePurchase}
          canPay={canPaySupplier}
          bills={supplierBills}
          onChanged={refreshSupplierDetails}
        />
      )}
      {canViewFinance && (
        <SupplierReturnsPanel
          supplier={supplier}
          bills={supplierBills}
          payments={supplierPayments}
          canReturn={canEdit && access.can('payments.edit')}
          canPay={canPaySupplier}
          onChanged={refreshSupplierDetails}
        />
      )}
      {canViewFinance && (
        <section className="cg-supplier-profile" aria-label="Supplier credit and settlement">
          <div className="cg-supplier-profile-head">
            <CreditCard size={20}/><h2>Supplier Accounts & Payments</h2>
          </div>
          {supplierFinanceError && <p className="cg-supplier-error" role="alert">{supplierFinanceError}</p>}
          {supplierFinancials && (
            <div className="cg-supplier-fields">
              <div><span>Total Posted Purchases</span><strong>{money(supplierFinancials.totalPurchases)}</strong></div>
              <div><span>Paid Against Bills</span><strong>{money(supplierFinancials.totalPaymentsApplied)}</strong></div>
              <div><span>Remaining Credit</span><strong>{money(supplierFinancials.outstanding)}</strong></div>
              <div><span>Unapplied Advances</span><strong>{money(supplierFinancials.availableAdvance)}</strong></div>
              <div><span>Purchase Returns</span><strong>{money(supplierFinancials.totalReturns)}</strong></div>
              <div><span>Debit Note Credit Available</span><strong>{money(supplierFinancials.availableDebitCredit)}</strong></div>
            </div>
          )}
          <p>Purchase and payment actions are available above on this Supplier page.</p>
          <h3>Purchase Bills</h3>
          {supplierBills.filter(b => b.postingStatus === 'Posted').map(bill => (
            <div key={bill.id} className="cg-supplier-record">
              <div><strong>{bill.invoiceNumber}</strong>
                <small>{bill.postedAt
                  ? new Date(bill.postedAt).toLocaleString('en-IN')
                  : bill.invoiceDate} · Paid {money(bill.paid)} · {bill.status}</small>
                <small>{bill.items?.map(item => item.description).join(', ') || 'Supplier purchase'} · Bought by {bill.purchasedBy || 'Workshop staff'}</small>
              </div>
              <b>Due {money(bill.outstanding)}</b>
            </div>
          ))}
          {!supplierBills.length && <p className="cg-supplier-empty">No supplier purchase bills recorded.</p>}
          <h3>Payment History</h3>
          {supplierPayments.map(payment => (
            <div key={payment.id} className="cg-supplier-record">
              <div><strong>{payment.kind} · {payment.method}</strong>
                <small>{payment.createdAt
                  ? new Date(payment.createdAt).toLocaleString('en-IN')
                  : payment.paidOn} · {payment.billReferences?.join(', ') || payment.reference || 'Advance / Unallocated'}</small>
              </div><b>{money(payment.amount)}</b>
            </div>
          ))}
          {!supplierPayments.length && <p className="cg-supplier-empty">No supplier payments recorded.</p>}
        </section>
      )}
      <div className="cg-supplier-details-grid">
        <section className="cg-supplier-profile">
          <div className="cg-supplier-profile-head"><ShoppingBag size={20}/><h2>Purchase Orders</h2><span>{orders.length} loaded</span></div>
          {orders.length? orders.map(order=><div className="cg-supplier-record" key={order.id}>
            <div><strong>{order.purchaseNo||order.number||'Purchase Order'}</strong><small>{order.status||'—'}</small></div>
            <b>{money(order.total)}</b>
          </div>):<p className="cg-supplier-empty">No purchase orders found.</p>}
        </section>
        <section className="cg-supplier-profile">
          <div className="cg-supplier-profile-head"><Package size={20}/><h2>Supplied Products</h2><span>{products.length} loaded</span></div>
          {products.length? products.map(item=><div className="cg-supplier-record" key={item.id}>
            <div>
              <strong>{item.partName||item.name}</strong>
              <small>{item.sku||'—'} · Purchase {money(item.costPrice ?? item.cost)} · Selling {money(item.sellingPrice ?? item.price)}</small>
              <small>GST {item.tax ?? 0}% · {item.hsnCode || item.hsn_code || 'No HSN'}</small>
            </div>
            <span>{item.onHand??'—'} in stock</span>
          </div>):<p className="cg-supplier-empty">No products linked yet.</p>}
        </section>
      </div>
    </>}
    {id&&detailsLoading&&<p role="status" className="cg-supplier-empty">Loading supplier details…</p>}
    {id&&!detailsLoading&&!supplier&&!error&&<p className="cg-supplier-empty">Supplier not found.</p>}
    {editor&&<SupplierEditor key={editor.id||'new'} supplier={editor.create?null:editor}
      onClose={()=>setEditor(null)} onSaved={onSaved}/>}
    <ResponsiveModalSheet isOpen={deleteConfirmOpen}
      onClose={() => !actionBusy && setDeleteConfirmOpen(false)}
      title="Delete Supplier" maxWidth="440px">
      <div className="cg-supplier-delete-confirm">
        <p>Delete <strong>{supplier?.name || 'this supplier'}</strong>?</p>
        <p>Suppliers with inventory or purchase history cannot be deleted. Deactivate them instead.</p>
        <div className="cg-supplier-modal-actions">
          <button type="button" disabled={actionBusy} onClick={() => setDeleteConfirmOpen(false)}>Cancel</button>
          <button type="button" disabled={actionBusy} className="primary" onClick={deleteSupplier}>
            {actionBusy ? 'Deleting…' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </ResponsiveModalSheet>
  </div>;
}
