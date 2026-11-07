import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('src/pages/stock/StockEasyPage.jsx');
const css = read('src/styles/stock-list-polish.css');
const routes = read('src/routes/AppRoutes.jsx');

test('Stock page has route-local UI style after pre-existing modal styles', () => {
  assert.match(routes, /path="\/stock" element=\{<StockEasyPage \/>\}/);
  assert.match(page, /import '..\/..\/styles\/stock-easy\.css';\s*import '..\/..\/styles\/stock-form-polish\.css';\s*import '..\/..\/styles\/stock-list-polish\.css';/);
  assert.match(css, /\.cg-easy-stock > \.cg-easy-metrics/);
  assert.match(css, /\.cg-easy-stock > \.cg-easy-shortcuts/);
  assert.match(css, /\.cg-easy-stock > \.cg-easy-panel \.cg-easy-table/);
  assert.doesNotMatch(css, /^\s*\.responsive-modal-sheet\s*\{/m);
});

test('Inventory summary, five quick actions and history remain visible', () => {
  for (const label of [
    'Inventory Management', 'Total parts', 'Stock value', 'Low stock', 'Out of stock',
    'Buy / Receive from Supplier', 'Internal Use', 'Job Card Parts', 'Stock History', 'Suppliers',
    'Parts & Products', 'Recent movements',
  ]) assert.ok(page.includes(label), label);
  assert.match(page, /href="#stock-history"/);
  assert.match(page, /to="\/suppliers"/);
  assert.match(page, /aria-live="polite"/);
});

test('Catalog search/filter controls and server stock operations are unchanged', () => {
  assert.match(page, /type="search" aria-label="Search stock"/);
  assert.match(page, /updateQueryParam\('search', value\)/);
  assert.match(page, /updateQueryParam\('filter', value\)/);
  assert.match(page, /stockCatalogService\.getItems\(/);
  assert.match(page, /stockCatalogService\.getStockDashboard\(/);
  assert.match(page, /stockCatalogService\.stockIn\(payload\)/);
  assert.match(page, /stockCatalogService\.stockOut\(payload\)/);
  assert.match(page, /stockCatalogService\.getLedger\(\)/);
});

test('Stock table preserves financial columns and accessible receiving', () => {
  for (const label of ['Part','Rack','Available','Cost','Selling','Status','Action'])
    assert.ok(page.includes('<th scope="col">'+label+'</th>'), label);
  assert.match(page, /aria-label=\{\`Receive stock for \$\{item\.partName \|\| item\.name\}\`\}/);
  assert.match(page, /onClick=\{\(\) => beginMove\('in', item\.id\)\}/);
  assert.match(page, /cg-easy-status is-/);
});

test('Stock mobile layout uses readable two-column cards without page overflow', () => {
  for (const rule of [
    '@media(max-width:1150px)', '@media(max-width:900px)',
    '@media(max-width:600px)', '@media(max-width:350px)',
    "grid-template-areas:'part part' 'available status' 'rack rack' 'cost selling' 'action action'",
    'grid-template-columns:repeat(2,minmax(0,1fr))',
    'min-height:44px',
    'font-size:16px!important',
    'var(--surface',
    'var(--border',
    'var(--primary',
    'overflow-x:clip',
  ]) assert.ok(css.includes(rule), rule);
  assert.match(css, /\.cg-easy-stock > \.cg-easy-panel \.cg-easy-table td:nth-child\(7\) button \{width:100%;min-height:44px\}/);
});

test('Modal stock validation, supplier creation and receipts are preserved', () => {
  assert.match(page, /savePart = async/);
  assert.match(page, /saveMovement = async/);
  assert.match(page, /supplierService\.create\(/);
  assert.match(page, /<ResponsiveModalSheet isOpen=\{partOpen\}/);
  assert.match(page, /<ResponsiveModalSheet isOpen=\{moveOpen\}/);
  assert.match(page, /Use the same prices for old stock and new stock\?/);
});
