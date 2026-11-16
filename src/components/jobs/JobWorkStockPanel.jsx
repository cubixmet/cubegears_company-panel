import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, PackageCheck, PackagePlus, Plus, RefreshCw, Search, X } from 'lucide-react';
import { stockService } from '../../services/stock.service';
import { stockCatalogService } from '../../services/stockCatalog.service';
import { Link } from 'react-router-dom';
import { jobService } from '../../services/job.service';
import { appConfirm } from '../common/appDialogs';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { invoiceLineTaxChoices, invoiceTotalRateFromChoice } from '../../utils/invoiceTaxUi';
import SupplierSelectField from '../common/SupplierSelectField';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
});
const num = (value) => Number(value || 0);
const blankNewPart = {
  partName: '', partNumber: '', brand: '', unit: 'Piece', category: '', supplier: '',
  costPrice: '', sellingPrice: '', hsnCode: '', tax: '',
  zeroTaxClassification: '', minimumStock: '0', location: '',
};
const unitOptions = ['Piece', 'Bottle', 'Litre', 'Millilitre', 'Kilogram', 'Gram', 'Set', 'Pair', 'Box', 'Pack', 'Metre', 'Can'];
const gstChoices = invoiceLineTaxChoices('unknown');
const zeroGstOptions = [
  ['exempt', 'Exempt'], ['nil_rated', 'Nil-rated'],
  ['zero_rated', 'Zero-rated'], ['non_gst', 'Non-GST'],
];
const available = item => Math.max(0, num(item.available ?? (num(item.onHand) - num(item.reserved))));

/** Stock entries are issued through Django's atomic Job.issue_part action.
 * Selecting/searching a part never deducts inventory.
 */
export function JobWorkStockPanel({ jobId, issuedParts = [], canEdit = true, onChanged, focusSearchToken = 0 }) {
  const { user } = useAuth();
  const canView = hasPermission(user, 'stock.view');
  const canIssue = canEdit && hasPermission(user, 'stock.edit') && hasPermission(user, 'jobs.edit');
  const [inventory, setInventory] = useState([]);
  const searchInputRef = useRef(null);
  useEffect(() => {
    if (focusSearchToken > 0 && canIssue) searchInputRef.current?.focus();
  }, [focusSearchToken, canIssue]);
  const [lookup, setLookup] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newPart, setNewPart] = useState(blankNewPart);
  const [newPartGstChoice, setNewPartGstChoice] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [categories, setCategories] = useState([]);
  const [createNotice, setCreateNotice] = useState('');
  const [createdSupplierId, setCreatedSupplierId] = useState('');
  const [createdPurchasePrefill, setCreatedPurchasePrefill] = useState(null);

  const refresh = async () => {
    if (!canView) return;
    setLoading(true);
    setError('');
    try {
      const result = await stockService.getStockItems();
      setInventory(Array.isArray(result) ? result : result?.results || []);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Unable to load stock catalogue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedId('');
    setLookup('');
    setQuantity('1');
    setSuccess('');
    setShowCreate(false);
    setNewPart(blankNewPart);
    setNewPartGstChoice('');
    setCreateError('');
    setCreateNotice('');
    setCreatedSupplierId('');
    setCreatedPurchasePrefill(null);
    refresh();
  }, [jobId, canView]);

  const matches = useMemo(() => {
    const term = lookup.trim().toLowerCase();
    const list = inventory.filter(item => !term || [
      item.partName, item.name, item.sku, item.barcode, item.brand,
    ].some(value => String(value || '').toLowerCase().includes(term)));
    // Make the add form useful without requiring a search first.
    // The server remains authoritative for branch-specific stock on issue.
    return (term ? list : [...list].sort((a, b) => Number(available(b) > 0) - Number(available(a) > 0))).slice(0, 8);
  }, [inventory, lookup]);

  const selected = inventory.find(item => String(item.id) === String(selectedId));
  const stockQty = selected ? available(selected) : 0;
  const requested = Number(quantity);
  const validQty = Number.isFinite(requested) && requested > 0 &&
    requested <= stockQty && /^\d+(?:\.\d{1,2})?$/.test(quantity);

  const issue = async (event) => {
    event.preventDefault();
    if (!canIssue || busy) return;
    if (!selected || !validQty) {
      setError('Select a stock item and enter a quantity within available stock.');
      return;
    }
    const confirmed = await appConfirm(
      `Issue ${quantity} ${selected.unit || 'units'} of ${selected.partName || selected.name} to this Job Card? Stock will be deducted.`
    );
    if (!confirmed) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await jobService.issueJobStockPart(jobId, selected.id, requested);
      setSelectedId('');
      setLookup('');
      setQuantity('1');
      setSuccess('Stock issued to this Job Card. Inventory balance updated.');
      // The issue succeeded. A refresh failure must not make it appear as
      // though nothing was issued, otherwise users might issue it twice.
      const refreshed = await Promise.allSettled([stockService.getStockItems(), onChanged?.()]);
      if (refreshed[0].status === 'fulfilled') {
        const items = refreshed[0].value;
        setInventory(Array.isArray(items) ? items : items?.results || []);
      }
      if (refreshed.some(result => result.status === 'rejected')) {
        setSuccess('Stock issued successfully. Refresh this page to update the list.');
      }
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Stock issue failed. Check quantity and permissions.');
    } finally {
      setBusy(false);
    }
  };

  const openCreate = async () => {
    setShowCreate(true);
    setCreateError('');
    try {
      const result = await stockCatalogService.getCategories();
      setCategories(Array.isArray(result) ? result : result?.results || []);
    } catch {
      setCategories([]);
      // Catalogue creation still works without a category.
    }
  };

  const createPart = async event => {
    event.preventDefault();
    if (!canIssue || creating || busy) return;
    const name = newPart.partName.trim();
    const purchase = Number(newPart.costPrice);
    const selling = Number(newPart.sellingPrice);
    const tax = Number(newPart.tax);
    if (!name || !newPart.costPrice.trim() || !newPart.sellingPrice.trim() ||
        !Number.isFinite(purchase) || purchase < 0 ||
        !Number.isFinite(selling) || selling < 0) {
      setCreateError('Enter a part name, purchase price and selling price (zero or more).');
      return;
    }
    if (newPart.partNumber.trim() && !/^[A-Za-z0-9][A-Za-z0-9._/+#() -]*$/.test(newPart.partNumber.trim())) {
      setCreateError('Enter a valid manufacturer part number.');
      return;
    }
    if (!newPartGstChoice || !newPart.tax.trim() || !/^\d{1,3}(?:\.\d{1,2})?$/.test(newPart.tax) ||
        !Number.isFinite(tax) || tax < 0 || tax > 100 ||
        (tax === 0 && !newPart.zeroTaxClassification)) {
      setCreateError('Choose a valid GST rate and a classification for 0% GST.');
      return;
    }
    setCreating(true);
    setCreateError('');
    setCreateNotice('');
    try {
      // Product registration is not a supplier receipt or opening balance.
      const created = await stockCatalogService.createItem({
        ...newPart,
        partName: name,
        partNumber: newPart.partNumber.trim(),
        costPrice: purchase,
        sellingPrice: selling,
        tax,
        minimumStock: Number(newPart.minimumStock) || 0,
        stockQuantity: 0,
      });
      setInventory(previous => [
        created, ...previous.filter(item => String(item.id) !== String(created.id)),
      ]);
      setSelectedId(String(created.id));
      setLookup(created.partName || name);
      setNewPart(blankNewPart);
      setNewPartGstChoice('');
      setShowCreate(false);
      setCreatedSupplierId(newPart.supplier || '');
      setCreatedPurchasePrefill({
        itemId: String(created.id), quantity: '1', purchaseRate: String(purchase),
        supplierId: newPart.supplier || '',
      });
      setCreateNotice('Part saved with 0 stock. Open Supplier Purchase, add the part, then Post Purchase to receive it.');
    } catch (cause) {
      const response = cause?.response?.data;
      const message = response && typeof response === 'object'
        ? Object.values(response).flat().join(' ') : '';
      setCreateError(message || cause?.message || 'Unable to create the part.');
    } finally {
      setCreating(false);
    }
  };

  if (!canView) return null;

  return (
    <section className="job-work-stock-panel" aria-label="Add stock to job work">
      <header className="job-work-stock-header">
        <div className="job-work-stock-heading">
          <span className="job-work-stock-icon" aria-hidden="true"><PackagePlus size={18}/></span>
          <div>
            <h3>Stock & Parts Used</h3>
            <p>Add parts from existing inventory and review stock issued to this job.</p>
          </div>
        </div>
        <div className="job-work-stock-header-actions">
          {canIssue && (
            <button type="button" className="job-work-stock-new-part"
              aria-expanded={showCreate} aria-controls="job-work-new-part-form"
              disabled={busy || creating}
              onClick={() => showCreate ? setShowCreate(false) : openCreate()}>
              {showCreate ? <X size={16} aria-hidden="true"/> : <Plus size={16} aria-hidden="true"/>}
              {showCreate ? 'Cancel New Part' : 'Add New Part'}
            </button>
          )}
          <button type="button" className="job-work-stock-refresh" onClick={refresh} disabled={loading || busy || creating}>
            <RefreshCw size={16} aria-hidden="true"/> {loading ? 'Loading…' : 'Refresh Stock'}
          </button>
        </div>
      </header>

      {error && <p className="job-work-stock-error" role="alert">{error}</p>}
      {success && <p className="job-work-stock-success" role="status"><CheckCircle2 size={16} aria-hidden="true"/>{success}</p>}
      {createNotice && <p className="job-work-stock-success" role="status">{createNotice} <Link
        to={createdSupplierId
          ? '/suppliers/' + encodeURIComponent(createdSupplierId) + '#supplier-purchase-form'
          : '/stock'}
        state={createdSupplierId && createdPurchasePrefill
          ? { purchasePrefill: createdPurchasePrefill } : undefined}
      >Buy / Receive Stock</Link></p>}

      {canIssue && showCreate && (
        <form id="job-work-new-part-form" className="job-work-new-part-form" onSubmit={createPart}>
          <div className="job-work-stock-history-head">
            <h4>Create New Inventory Part</h4>
            <span>Catalogue registration only · Does not add stock or supplier debt</span>
          </div>
          {createError && <p className="job-work-stock-error" role="alert">{createError}</p>}
          <div className="job-work-new-part-fields">
            <label>Part Name *<input required maxLength="180" value={newPart.partName}
              onChange={e => setNewPart(v => ({ ...v, partName: e.target.value }))}/></label>
            <label>Part Number<input maxLength="100" value={newPart.partNumber}
              onChange={e => setNewPart(v => ({ ...v, partNumber: e.target.value }))}/></label>
            <label>Brand<input maxLength="100" value={newPart.brand}
              onChange={e => setNewPart(v => ({ ...v, brand: e.target.value }))}/></label>
            <SupplierSelectField label="Supplier (Stock & Parts)" valueMode="id"
              value={newPart.supplier} disabled={creating || busy}
              onChange={supplier => setNewPart(v => ({ ...v, supplier }))}/>
            <label>Unit<select value={newPart.unit} onChange={e => setNewPart(v => ({ ...v, unit: e.target.value }))}>
              {unitOptions.map(value => <option key={value} value={value}>{value}</option>)}
            </select></label>
            <label>Category<select value={newPart.category} onChange={e => setNewPart(v => ({ ...v, category: e.target.value }))}>
              <option value="">Uncategorized</option>
              {categories.filter(c => c.is_active !== false).map(category =>
                <option key={category.id} value={category.id}>{category.name}</option>)}
            </select></label>
            <label>HSN / SAC<input maxLength="20" value={newPart.hsnCode}
              onChange={e => setNewPart(v => ({ ...v, hsnCode: e.target.value }))}/></label>
            <label>Purchase Price (₹) *<input type="number" inputMode="decimal" min="0" step="0.01" required
              value={newPart.costPrice} onChange={e => setNewPart(v => ({ ...v, costPrice: e.target.value }))}/></label>
            <label>Selling Price (₹) *<input type="number" inputMode="decimal" min="0" step="0.01" required
              value={newPart.sellingPrice} onChange={e => setNewPart(v => ({ ...v, sellingPrice: e.target.value }))}/></label>
            <label>GST Rate (%) *
              <select required aria-label="GST Rate (%)" value={newPartGstChoice}
                onChange={e => {
                  const choice = e.target.value;
                  const total = choice === 'none' ? '0' : choice === 'custom' ? '' :
                    invoiceTotalRateFromChoice(choice);
                  setNewPartGstChoice(choice);
                  setNewPart(v => ({ ...v, tax: total, zeroTaxClassification: '' }));
                }}>
                <option value="">Select GST Component / Rate</option>
                <option value="none">0% — Select Tax Classification</option>
                {gstChoices.map(choice =>
                  <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                <option value="custom">Saved/Other HSN-Specific Rate (custom %)</option>
              </select>
            </label>
            {newPartGstChoice === 'custom' && (
              <label>Custom GST Rate (%) *
                <input type="number" inputMode="decimal" min="0" max="100" step="0.01" required
                  value={newPart.tax}
                  onChange={e => setNewPart(v => ({
                    ...v, tax: e.target.value, zeroTaxClassification: '',
                  }))}/>
              </label>
            )}
            {newPartGstChoice && newPart.tax !== '' && (
              <p className="job-work-new-part-gst-note">
                Total GST saved for this item: <strong>{newPart.tax}%</strong>.
                CGST / SGST selections are component rates; the matching total is saved once.
                GST jurisdiction is determined when the item is invoiced.
              </p>
            )}
            {newPart.tax !== '' && Number(newPart.tax) === 0 && (
              <label>0% GST Classification *<select required value={newPart.zeroTaxClassification}
                onChange={e => setNewPart(v => ({ ...v, zeroTaxClassification: e.target.value }))}>
                <option value="">Choose classification</option>
                {zeroGstOptions.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
              </select></label>
            )}
            <label>Minimum Stock<input type="number" inputMode="decimal" min="0" step="0.01"
              value={newPart.minimumStock} onChange={e => setNewPart(v => ({ ...v, minimumStock: e.target.value }))}/></label>
            <label>Rack / Location<input maxLength="80" value={newPart.location}
              onChange={e => setNewPart(v => ({ ...v, location: e.target.value }))}/></label>
          </div>
          <p className="job-work-stock-note">Saving creates the product at 0 available stock. To use it on this job, first record an actual purchase/receipt through inventory or the supplier ledger, then issue it below.</p>
          <div className="job-work-new-part-actions">
            <button type="button" disabled={creating} onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" disabled={creating || busy}>{creating ? 'Saving…' : 'Save New Part'}</button>
          </div>
        </form>
      )}

      {!canIssue && (
        <p className="job-work-stock-note" role="status">
          {canEdit
            ? 'To add a part, your role needs both Jobs Edit and Stock Edit permissions.'
            : 'Parts are read-only after the Work stage is locked or completed.'}
        </p>
      )}
      {canIssue && (
        <form className="job-work-stock-form" onSubmit={issue}>
          <div className="job-work-stock-history-head">
            <h4>Add Part to Job</h4>
            <span>Select inventory item, enter quantity, then confirm stock issue.</span>
          </div>
          <div className="job-work-stock-search-wrap">
            <label htmlFor="job-work-stock-search">Find Stock Item</label>
            <div className="job-work-stock-search">
              <Search size={17} aria-hidden="true"/>
              <input ref={searchInputRef} id="job-work-stock-search" autoComplete="off" value={lookup}
                disabled={busy} placeholder="Search part name, SKU, barcode or brand"
                onChange={event => { setLookup(event.target.value); setSelectedId(''); setSuccess(''); }}/>
            </div>
            {!selected && !loading && (
              <div className="job-work-stock-results" aria-label="Matching stock items">
                {matches.length ? matches.map(item => (
                  <button type="button" key={item.id} disabled={busy}
                    onClick={() => { setSelectedId(String(item.id)); setLookup(item.partName || item.name || item.sku); setError(''); }}>
                    <span><strong>{item.partName || item.name}</strong>
                      <small>{item.sku || 'No SKU'} · {item.brand || 'Stock'}</small>
                    </span>
                    <span className={available(item) > 0 ? 'is-available' : 'is-empty'}>
                      {available(item)} {item.unit || 'units'} available
                    </span>
                  </button>
                )) : <p>{lookup.trim()
                  ? 'No matching stock product. Add it on the Stock page first.'
                  : 'No stock items available. Create a product in Stock before adding parts to a job.'}</p>}
              </div>
            )}
          </div>

          {selected && (
            <div className="job-work-stock-selected" role="status">
              <PackageCheck size={18} aria-hidden="true"/>
              <div><strong>{selected.partName || selected.name}</strong>
                <span>SKU {selected.sku || '—'} · Rack {selected.location || '—'} · {money.format(selected.sellingPrice || 0)} / {selected.unit || 'unit'}</span>
              </div>
              <b>{stockQty} available</b>
            </div>
          )}

          <div className="job-work-stock-bottom">
            <label htmlFor="job-work-stock-quantity">Issue Quantity
              <input id="job-work-stock-quantity" type="number" inputMode="decimal"
                min="0.01" max={selected ? stockQty : undefined} step="0.01" value={quantity}
                disabled={busy || !selected} onChange={event => setQuantity(event.target.value)}/>
            </label>
            <div className="job-work-stock-amount">
              <span>Stock value</span>
              <strong>{money.format(selected ? requested * num(selected.sellingPrice) || 0 : 0)}</strong>
            </div>
            <button type="submit" className="job-work-stock-issue" disabled={busy || loading || !selected || !validQty}>
              <PackageCheck size={17} aria-hidden="true"/> {busy ? 'Issuing…' : 'Issue Stock to Job'}
            </button>
          </div>
          <p className="job-work-stock-note">Stock is deducted only after confirming Issue Stock. Available quantity is checked against this job's branch again when you issue.</p>
        </form>
      )}

      <div className="job-work-stock-history">
        <div className="job-work-stock-history-head">
          <h4>Issued Parts</h4><span>{issuedParts.length} records</span>
        </div>
        {issuedParts.length ? (
          <div className="job-work-stock-history-list">
            {issuedParts.map((part, index) => (
              <div className="job-work-stock-history-item" key={part.id || index}>
                <div><strong>{part.itemName || part.partName || part.name || 'Stock Item'}</strong>
                  <small>{part.sku || 'Stock'} · Qty {num(part.quantity ?? part.qty)} · {money.format(part.unit_price ?? part.unitPrice ?? part.sellingPrice ?? 0)} / unit</small>
                </div>
                <strong>{money.format(num(part.quantity ?? part.qty) * num(part.unit_price ?? part.unitPrice ?? part.sellingPrice))}</strong>
              </div>
            ))}
          </div>
        ) : <p className="job-work-stock-empty">No parts issued.</p>}
      </div>
    </section>
  );
}
