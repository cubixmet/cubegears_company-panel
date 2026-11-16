import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackagePlus, Search, ReceiptText, Wallet } from 'lucide-react';
import { ResponsiveModalSheet } from '../common/ResponsiveModalSheet';
import SupplierSelectField from '../common/SupplierSelectField';
import '../../styles/stock-purchase-start.css';

const positiveQuantity = value => /^\d+(?:\.\d{1,2})?$/.test(String(value).trim()) &&
  Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 999999.99;

const linkedSupplierId = item => String(item?.supplier?.id || item?.supplier || '');

export default function StockPurchaseStartDialog({
  isOpen, items = [], suppliers = [], initialItem = null,
  canPurchase = false, onClose, onContinue,
}) {
  const [partId, setPartId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setPartId(initialItem?.id ? String(initialItem.id) : '');
    setSupplierId(linkedSupplierId(initialItem));
    setQuantity('1');
    setSearch(initialItem?.partName || initialItem?.name || '');
  }, [isOpen, initialItem?.id]);

  const selected = items.find(item => String(item.id) === partId) ||
    (initialItem && String(initialItem.id) === partId ? initialItem : null);

  const matching = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(item => [item.partName, item.name, item.sku, item.partNumber, item.barcode, item.brand]
      .some(value => String(value || '').toLowerCase().includes(needle))).slice(0, 14);
  }, [items, search]);

  // The shared supplier selector supports creating a supplier immediately.
  // A newly created supplier may not be present in the parent's cached array.
  const valid = Boolean(selected && supplierId && positiveQuantity(quantity) && canPurchase);

  const chooseItem = item => {
    setPartId(String(item.id));
    setSearch(item.partName || item.name || item.sku || '');
    setSupplierId(linkedSupplierId(item));
  };

  const submit = event => {
    event.preventDefault();
    if (!valid) return;
    // The supplier bill is not posted here. The canonical SupplierPurchaseFlow
    // performs GST verification, stock receipt, payment and remaining credit in
    // one atomic backend transaction after final user confirmation.
    onContinue({
      itemId: String(selected.id),
      supplierId,
      quantity: String(quantity).trim(),
      purchaseRate: String(selected.costPrice ?? '0'),
    });
  };

  return <ResponsiveModalSheet
    isOpen={isOpen} onClose={onClose}
    title="Receive Stock · Supplier Purchase" maxWidth="650px">
    <form className="cg-stock-purchase-start" onSubmit={submit}>
      <p className="cg-stock-purchase-intro">
        Choose the stock item, supplier and quantity. Next, enter the supplier bill and GST,
        then select <strong>Cash in Hand, Bank or Credit (Pay Later)</strong>.
      </p>
      {!canPurchase && <p role="alert" className="cg-stock-purchase-error">
        Permission to create and pay supplier purchases is required.
        Ask the workshop owner for Stock and Payments access.
      </p>}
      <label>Search Part / Product *
        <div className="cg-stock-purchase-search">
          <Search size={17} aria-hidden="true"/>
          <input type="search" value={search} placeholder="Search name, Part Number or SKU"
            onChange={event => { setSearch(event.target.value); setPartId(''); setSupplierId(''); }}/>
        </div>
      </label>
      {(!selected || !search) && <div className="cg-stock-purchase-results" role="group" aria-label="Select existing stock item">
        {matching.map(item => <button type="button" key={item.id} onClick={() => chooseItem(item)}>
          <strong>{item.partName || item.name || item.sku || 'Part'}</strong>
          <small>{item.sku || item.partNumber || 'No part number'} · In stock: {item.available ?? item.onHand ?? 0}</small>
        </button>)}
        {!matching.length && <p>No matching part. <Link to="/stock" onClick={onClose}>Add a new part</Link> first.</p>}
      </div>}
      {selected && <div className="cg-stock-purchase-selected">
        <PackagePlus size={18} aria-hidden="true"/>
        <div><strong>{selected.partName || selected.name}</strong>
          <small>Catalog GST {selected.tax ?? 0}% · HSN/SAC {selected.hsnCode || 'Needs review'}</small>
        </div>
        <button type="button" onClick={() => { setPartId(''); setSearch(''); setSupplierId(''); }}>Change</button>
      </div>}
      <div className="cg-stock-purchase-fields">
        <SupplierSelectField label="Supplier" valueMode="id" required
          value={supplierId} onChange={setSupplierId} disabled={!canPurchase}/>
        <label>Purchase Quantity *
          <input type="number" required min="0.01" max="999999.99" step="0.01"
            inputMode="decimal" value={quantity}
            onChange={event => setQuantity(event.target.value)}/>
        </label>
      </div>
      {!suppliers.length && <p role="status" className="cg-stock-purchase-help">
        No suppliers loaded in this list. Use Add New Supplier above to create one without leaving the purchase.
      </p>}
      {selected && !linkedSupplierId(selected) && <p className="cg-stock-purchase-help">
        This catalog part has no linked supplier. The first posted purchase will associate it
        with the supplier you select here. No stock or account balance is changed yet.
      </p>}
      <div className="cg-stock-purchase-next">
        <span><ReceiptText size={16} aria-hidden="true"/> Next: GST invoice / HSN / Place of Supply</span>
        <span><Wallet size={16} aria-hidden="true"/> Cash in Hand / Bank / Partial Payment / Credit</span>
      </div>
      <footer>
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={!valid} className="is-primary">Continue to GST & Payment</button>
      </footer>
    </form>
  </ResponsiveModalSheet>;
}
