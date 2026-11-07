import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/stock/StockEasyPage.jsx', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../src/routes/AppRoutes.jsx', import.meta.url), 'utf8');

test('/stock opens the quick stock page rather than redirecting', () => {
  assert.match(routes, /path="\/stock" element={<StockEasyPage \/>}/);
});

test('easy stock searches real inventory and keeps Job Card parts linked', () => {
  assert.match(page, /stockCatalogService\.getItems\(\)/);
  assert.match(page, /stockCatalogService\.getStockDashboard\(\)/);
  assert.match(page, /Search part name, Part Number, SKU, supplier or rack/);
  assert.match(page, /to="\/jobs"/);
  assert.match(page, /issue parts from the Job Card/);
});

test('stock receiving and internal consumption use backend workflow methods', () => {
  assert.match(page, /stockCatalogService\.stockIn\(payload\)/);
  assert.match(page, /stockCatalogService\.stockOut\(payload\)/);
  assert.match(page, /Stock History/);
  assert.match(page, /Number\.isFinite\(quantity\)/);
});

test('new products never silently receive stock and redirect to supplier profile', () => {
  assert.match(page, /stockQuantity: 0/);
  assert.ok(page.includes("navigate('/suppliers/' + encodeURIComponent(part.supplier)"));
  assert.match(page, /purchasePrefill/);
  assert.match(page, /Save Part & Continue to Supplier/);
});

test('advanced stock management is removed from all navigation', () => {
  assert.doesNotMatch(page, /Advanced stock management|\/stock\/overview|\/stock\/items|\/stock\/movements/);
  assert.match(routes, /path="\/stock\/\*" element={<Navigate to="\/stock" replace \/>}/);
  assert.doesNotMatch(routes, /<StockManagement |<AddStockItem/);
  assert.match(page, /href="#stock-history"/);
});

test('add product searches existing stock before creating duplicate parts', () => {
  assert.match(page, /matchingParts = useMemo/);
  assert.match(page, /Search part name \/ Part Number \/ SKU \/ barcode/);
  assert.match(page, /Add as New Product/);
  assert.match(page, /beginMove\('in', item\.id, item\)/);
  assert.match(page, /Save Part & Continue to Supplier/);
  assert.match(page, /RackCombobox/);
  assert.match(page, /Part Number/);
});

test('receiving stock asks whether new prices apply to old stock', () => {
  assert.match(page, /Use the same prices for old stock and new stock\?/);
  assert.match(page, /priceMode: receiptPricesDiffer \? move\.priceMode : 'keep_existing'/);
  assert.match(page, /move\.priceMode === 'apply_new'/);
  assert.match(page, /move\.priceMode === 'keep_existing'/);
  assert.match(page, /New Purchase Cost \/ Unit/);
  assert.match(page, /New Selling Price \/ Unit/);
  assert.match(page, /Total Purchase Cost/);
});
