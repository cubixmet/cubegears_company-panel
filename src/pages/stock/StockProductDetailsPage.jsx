import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { USE_MOCK_API } from '../../api/apiConfig';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { stockCatalogService } from '../../services/stockCatalog.service';
import { formatStockPrice, stockState, ZERO_GST_CLASSIFICATIONS } from '../../utils/stockPresentation';
import { isStockProductId, stockInventoryLocation } from '../../utils/stockProductRoutes';
import '../../styles/stock-product-details.css';

function ProductFields({ title, fields }) {
  return (
    <section className="cg-stock-detail-section">
      <h2>{title}</h2>
      <dl className="cg-stock-product-details">
        {fields.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>
        ))}
      </dl>
    </section>
  );
}

function ProductDetails({ productId, branchId, inventoryLocation }) {
  const { can } = useFeatureAccess();
  const validId = isStockProductId(productId);
  const [product, setProduct] = useState(validId ? undefined : null);
  const [branchBalance, setBranchBalance] = useState();
  const headingRef = useRef(null);

  useEffect(() => {
    const heading = headingRef.current;
    const scrollArea = heading?.closest('.app-scroll-area');
    if (scrollArea) scrollArea.scrollTop = 0;
    heading?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!validId) return undefined;
    let active = true;
    stockCatalogService.getItem(productId)
      .then(item => { if (active) setProduct(item); })
      .catch(() => { if (active) setProduct(null); });
    if (branchId) {
      stockCatalogService.getBranchBalances()
        .then(balances => {
          if (active) setBranchBalance(balances.find(row => row.itemId === productId && row.branchId === branchId) ?? null);
        })
        .catch(() => { if (active) setBranchBalance(null); });
    }
    return () => { active = false; };
  }, [productId, branchId, validId]);

  const unit = product?.unit || 'PCS';
  const stock = branchId ? branchBalance : product;
  const gstClassification = ZERO_GST_CLASSIFICATIONS.find(([code]) => code === product?.zeroTaxClassification)?.[1];

  return (
    <div className="cg-stock-product-page">
      <Link className="cg-stock-product-back" to={inventoryLocation} replace>
        <ArrowLeft size={18} aria-hidden="true" /> Back to Inventory
      </Link>
      <header className="cg-stock-detail-header">
        <h1 tabIndex={-1} ref={headingRef}>{product?.partName || 'Product Details'}</h1>
      </header>
      {product === undefined && <p role="status">Loading product details…</p>}
      {product === null && <p className="cg-stock-detail-error" role="alert">Product details are unavailable.</p>}
      {product && <>
        {branchId && branchBalance === undefined && <p role="status">Loading branch stock…</p>}
        {branchId && branchBalance === null && (
          <p className="cg-stock-detail-error" role="alert">Branch stock is unavailable.</p>
        )}
        <ProductFields title="Stock" fields={[
          ...(branchBalance ? [
            ['Branch', branchBalance.branchName],
            ['On Hand', `${Number(branchBalance.onHand)} ${unit}`],
            ['Reserved', `${Number(branchBalance.reserved)} ${unit}`],
          ] : []),
          ...(stock ? [
            ['Available Stock', `${Number(stock.available)} ${unit}`],
            ['Stock Status', stockState({ available: stock.available, minimumStock: product.minimumStock }).label],
          ] : []),
          ['Minimum Stock', `${product.minimumStock} ${unit}`],
          ['Rack / Storage Location', product.location || product.rack],
        ]} />
        <ProductFields title="Product Information" fields={[
          ['SKU', product.sku],
          ['Part Number', product.partNumber],
          ['Brand', product.brand],
          ['Category', product.categoryName || (USE_MOCK_API && product.category)],
          ['Supplier', product.supplierName || (USE_MOCK_API && product.supplier)],
        ]} />
        <ProductFields title="Pricing & GST" fields={[
          ['Selling Price', formatStockPrice(product.sellingPrice)],
          ['Purchase Price', can('stock.edit') ? formatStockPrice(product.costPrice) : 'Restricted'],
          ['GST Rate', gstClassification && !product.tax ? `0% · ${gstClassification}` : `${product.tax}%`],
          ['HSN / SAC Code', product.hsnCode],
        ]} />
      </>}
    </div>
  );
}

export default function StockProductDetailsPage() {
  const { productId } = useParams();
  const { search } = useLocation();
  const branchId = new URLSearchParams(search).get('productBranch');
  return <ProductDetails key={`${productId}/${branchId}`} productId={productId}
    branchId={branchId} inventoryLocation={stockInventoryLocation(search)} />;
}
