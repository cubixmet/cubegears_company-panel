import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { USE_MOCK_API } from '../../api/apiConfig';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { stockCatalogService } from '../../services/stockCatalog.service';
import { stockState, ZERO_GST_CLASSIFICATIONS } from '../../utils/stockPresentation';
import '../../styles/stock-product-page.css';

const cash = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
});
const validIdentifier = (value) => /^[A-Za-z0-9_-]{1,80}$/.test(value);

function ProductDetails({ id, branchId, backSearch }) {
  const { can } = useFeatureAccess();
  const heading = useRef(null);
  const validId = validIdentifier(id);
  const [product, setProduct] = useState(validId ? undefined : null);
  const [branchBalance, setBranchBalance] = useState(
    branchId && !USE_MOCK_API && validIdentifier(branchId) ? undefined : null,
  );

  useLayoutEffect(() => {
    heading.current.closest('main')?.scrollTo({ top: 0, behavior: 'instant' });
    heading.current.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!validId) return undefined;
    let active = true;
    stockCatalogService.getItem(id)
      .then((item) => { if (active) setProduct(item); })
      .catch(() => { if (active) setProduct(null); });
    return () => { active = false; };
  }, [id, validId]);

  useEffect(() => {
    if (!validId || !branchId || USE_MOCK_API || !validIdentifier(branchId)) return undefined;
    let active = true;
    apiClient.get('/stock/branch-balances')
      .then((data) => {
        if (!active) return;
        const rows = Array.isArray(data) ? data : data?.results || [];
        setBranchBalance(rows.find((row) => row.itemId === id && row.branchId === branchId) ?? null);
      })
      .catch(() => { if (active) setBranchBalance(null); });
    return () => { active = false; };
  }, [branchId, id, validId]);

  const unit = product?.unit || 'PCS';
  const quantity = (value) => `${Number(value) || 0} ${unit}`;
  const stock = branchId ? branchBalance : product;
  const gstClassification = ZERO_GST_CLASSIFICATIONS.find(([code]) => code === product?.zeroTaxClassification)?.[1];
  const fields = product && [
    ...(branchBalance ? [
      ['Branch', branchBalance.branchName],
      ['On Hand', quantity(branchBalance.onHand)],
      ['Reserved', quantity(branchBalance.reserved)],
    ] : []),
    ...(stock ? [
      ['Available Stock', quantity(stock.available)],
      ['Stock Status', stockState({ available: stock.available, minimumStock: product.minimumStock }).label],
    ] : []),
    ['Minimum Stock', quantity(product.minimumStock)],
    ['Rack / Storage Location', product.location || product.rack],
    ['SKU', product.sku],
    ['Part Number', product.partNumber],
    ['Brand', product.brand],
    ['Category', product.categoryName || (USE_MOCK_API && product.category)],
    ['Supplier', product.supplierName || (USE_MOCK_API && product.supplier)],
    ['Selling Price', cash.format(Number(product.sellingPrice) || 0)],
    ['Purchase Price', can('stock.edit') ? cash.format(Number(product.costPrice) || 0) : 'Restricted'],
    ['GST Rate', gstClassification && !product.tax ? `0% · ${gstClassification}` : `${product.tax}%`],
    ['HSN / SAC Code', product.hsnCode],
  ];

  return (
    <article className="cg-stock-product-page" aria-labelledby="stock-product-title">
      <Link className="cg-stock-product-back" to={{ pathname: '/stock', search: backSearch }}>
        <ArrowLeft size={18} aria-hidden="true" /> Back to Stock
      </Link>
      <h1 id="stock-product-title" tabIndex={-1} ref={heading}>{product?.partName || 'Product Details'}</h1>
      {product === null && <p role="alert">Product details are unavailable.</p>}
      {product === undefined && <p role="status">Loading product details…</p>}
      {product && branchId && branchBalance === undefined && <p role="status">Loading branch stock…</p>}
      {product && branchId && branchBalance === null && <p role="alert">Branch stock is unavailable.</p>}
      {fields && (
        <dl>
          {fields.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>
          ))}
        </dl>
      )}
    </article>
  );
}

export default function StockProductPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('branch');
  const backParams = new URLSearchParams(searchParams);
  backParams.delete('branch');

  return <ProductDetails key={JSON.stringify([id, branchId])}
    id={id} branchId={branchId} backSearch={backParams.toString()} />;
}
