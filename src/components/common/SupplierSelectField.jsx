import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { USE_MOCK_API } from '../../api/apiConfig';
import { supplierService } from '../../services/supplier.service';
import './SupplierSelectField.css';

const emptySupplier = () => ({ name: '', phone: '', gstNo: '', address: '' });
const activeSupplier = supplier => supplier?.is_active !== false &&
  supplier?.isActive !== false && supplier?.status !== 'Inactive';
const errorMessage = cause => {
  const data = cause?.response?.data || {};
  const details = ['gstNo', 'name', 'phone', 'detail', 'message']
    .map(key => data?.[key]).find(Boolean);
  return Array.isArray(details) ? details.join(' ') :
    typeof details === 'string' ? details :
      cause?.message || 'Unable to save supplier. Please check the details.';
};

/**
 * One company-scoped supplier directory for inventory parts and job purchasing.
 * "id" stores the canonical supplier ID on StockItem; "name" keeps the
 * existing job outside-purchase and PO API vendor TEXT contract unchanged.
 * New supplier creation never receives stock or posts supplier payments.
 */
export default function SupplierSelectField({
  value = '', onChange, valueMode = 'id', label = 'Supplier',
  required = false, disabled = false, allowManual = false,
  className = '', selectName, fullWidth = false,
}) {
  const { user } = useAuth();
  const canCreateSupplier = hasPermission(user, 'stock.create') && !USE_MOCK_API;
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [manual, setManual] = useState(false);
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptySupplier);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError('');
    supplierService.list()
      .then(rows => {
        if (!alive) return;
        setSuppliers(Array.isArray(rows) ? rows : []);
        // A legacy purchase-order record may contain a supplier UUID while
        // the PO API expects a plain vendor name. Resolve it before submission.
        if (valueMode === 'name' && value) {
          const byId = rows.find(row => String(row.id) === String(value));
          if (byId?.name) onChange(byId.name);
        }
      })
      .catch(cause => { if (alive) setLoadError(cause?.message || 'Unable to load suppliers.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refreshKey, valueMode]);

  const available = useMemo(() => suppliers.filter(activeSupplier)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))), [suppliers]);
  const current = available.find(row => valueMode === 'id'
    ? String(row.id) === String(value)
    : String(row.id) === String(value) ||
      String(row.name || '').toLowerCase() === String(value || '').toLowerCase());
  const unknownName = valueMode === 'name' && !!String(value).trim() && !current;
  const selectedValue = manual || unknownName ? '__manual__' : current ? String(current.id) : '';

  const choose = next => {
    setError('');
    setNotice('');
    if (next === '__manual__' && allowManual) {
      setManual(true);
      onChange('');
      return;
    }
    setManual(false);
    const supplier = available.find(row => String(row.id) === String(next));
    onChange(supplier ? (valueMode === 'name' ? supplier.name : String(supplier.id)) : '');
  };

  const saveSupplier = async () => {
    if (!canCreateSupplier || creating || disabled) return;
    const name = draft.name.trim();
    if (!name) { setError('Supplier Name is required.'); return; }
    const phone = draft.phone.trim();
    const gstNo = draft.gstNo.trim().toUpperCase();
    const existing = suppliers.find(row =>
      (gstNo && String(row.gstNo || row.gstin || '').toUpperCase() === gstNo) ||
      (String(row.name || '').trim().toLowerCase() === name.toLowerCase() &&
        String(row.phone || '').trim() === phone));
    if (existing) {
      if (!activeSupplier(existing)) {
        setError('This supplier already exists but is inactive. Activate it in Suppliers.');
        return;
      }
      onChange(valueMode === 'name' ? existing.name : String(existing.id));
      setManual(false);
      setCreatingOpen(false);
      setError('');
      setNotice('Existing supplier selected. A duplicate was not created.');
      return;
    }
    setCreating(true);
    setError('');
    setNotice('');
    try {
      const created = await supplierService.create({
        name, phone, gstNo, address: draft.address.trim(),
      });
      if (!created?.id) throw new Error('Supplier saved without an identifier. Reload the supplier list.');
      setSuppliers(rows => [created, ...rows.filter(row => String(row.id) !== String(created.id))]);
      onChange(valueMode === 'name' ? created.name : String(created.id));
      setManual(false);
      setCreatingOpen(false);
      setDraft(emptySupplier());
      setNotice('Supplier added to the shared Supplier directory. No purchase or payment was posted.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setCreating(false);
    }
  };

  return <div className={'cg-supplier-select-field' +
    (fullWidth ? ' job-parts-modal-full' : '')}>
    <div className="cg-supplier-select-heading">
      <label>
        <span>{label}{required ? ' *' : ''}</span>
        <select className={className} name={selectName} required={required && !selectedValue}
          disabled={disabled}
          aria-label={label} value={selectedValue} onChange={event => choose(event.target.value)}>
          <option value="">Select supplier</option>
          {available.map(row =>
            <option key={row.id} value={String(row.id)}>{row.name}{row.phone ? ' · ' + row.phone : ''}</option>)}
          {allowManual && <option value="__manual__">Other / Outside Shop (enter name)</option>}
        </select>
      </label>
      <div className="cg-supplier-select-actions">
        {canCreateSupplier && <button type="button"
          disabled={disabled || creating} aria-expanded={creatingOpen}
          onClick={() => { setCreatingOpen(next => !next); setError(''); setNotice(''); }}>
          {creatingOpen ? <X size={15}/> : <Plus size={15}/>}
          {creatingOpen ? 'Cancel' : 'Add New Supplier'}
        </button>}
        <button type="button" disabled={disabled || loading} aria-label="Refresh supplier options"
          onClick={() => setRefreshKey(v => v + 1)}><RefreshCw size={15}/></button>
      </div>
    </div>
    {(manual || unknownName) && allowManual && <label className="cg-supplier-select-manual">
      <span>Outside Shop / Supplier Name *</span>
      <input type="text" className={className} required={required} maxLength={160}
        disabled={disabled} value={value}
        onChange={event => onChange(event.target.value)}
        placeholder="Enter outside shop name"/>
    </label>}
    {loadError && <p className="cg-supplier-select-error" role="alert">
      {loadError} <button type="button" onClick={() => setRefreshKey(v => v + 1)}>Retry</button>
    </p>}
    {loading && <small role="status">Loading suppliers…</small>}
    {!loading && !loadError && !available.length &&
      <small>No active suppliers found. Add a supplier or open the Supplier directory.</small>}
    {creatingOpen && canCreateSupplier && <div className="cg-supplier-select-create"
      aria-label="Add supplier without leaving the part form"
      onKeyDown={event => {
        // This editor lives inside a parent Part / Purchase form.
        // Enter on supplier details must not submit that unrelated form.
        if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault();
      }}>
      <strong>New Supplier</strong>
      <label>Supplier Name *<input value={draft.name} maxLength={180} disabled={creating || disabled}
        onChange={event => setDraft(old => ({ ...old, name: event.target.value }))}/></label>
      <label>Mobile / Phone<input type="tel" maxLength={30} value={draft.phone}
        disabled={creating || disabled} onChange={event => setDraft(old => ({ ...old, phone: event.target.value }))}/></label>
      <label>GSTIN (optional)<input maxLength={20} value={draft.gstNo}
        disabled={creating || disabled} onChange={event => setDraft(old => ({ ...old, gstNo: event.target.value.toUpperCase() }))}/></label>
      <label>Address (optional)<input maxLength={240} value={draft.address}
        disabled={creating || disabled} onChange={event => setDraft(old => ({ ...old, address: event.target.value }))}/></label>
      <p>Supplier details are saved once to the shared directory. Stock receipt and payment are separate.</p>
      <button type="button" disabled={creating || disabled || !draft.name.trim()}
        onClick={saveSupplier}>{creating ? 'Saving Supplier…' : 'Save & Select Supplier'}</button>
    </div>}
    {error && <p className="cg-supplier-select-error" role="alert">{error}</p>}
    {notice && <p className="cg-supplier-select-notice" role="status">{notice}</p>}
    <small>Manage suppliers in <Link to="/suppliers">Suppliers</Link>.
      Choosing a supplier does not record a purchase or debit Cash/Bank.</small>
  </div>;
}
