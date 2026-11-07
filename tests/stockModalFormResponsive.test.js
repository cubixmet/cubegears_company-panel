import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url),'utf8');
const stockPage = read('src/pages/stock/StockEasyPage.jsx');
const css = read('src/styles/stock-form-polish.css');
const oldCss = read('src/styles/stock-easy.css');
const smoke = read('scripts/ui-smoke.mjs');

test('Stock modal stylesheet loads after old 12px/13px form styles', () => {
  assert.match(oldCss,/\.cg-easy-form label\{[^}]*font-size:12px/);
  assert.match(oldCss,/\.cg-easy-form :is\(input,select,textarea\)\{[^}]*min-height:42px/);
  assert.match(stockPage,/import '..\/..\/styles\/stock-easy\.css';\s*import '..\/..\/styles\/stock-form-polish\.css';/);
  assert.match(css,/\.cg-easy-stock \.cg-easy-form label\s*\{/);
  assert.match(css,/font-size: 14px/);
  assert.match(css,/font-size: 16px/);
  assert.match(css,/min-height: 49px/);
});

test('Stock modal search has exactly one visible border and radios keep native height', () => {
  assert.match(css,/\.cg-easy-picker-search > input:not\(\[type="radio"\]\)/);
  assert.match(css,/height: 100%;\s*min-height: 0;\s*padding: 0;\s*border: 0/);
  assert.match(css,/\.cg-easy-form \.cg-easy-price-choice input\[type="radio"\]/);
  assert.match(css,/width: 20px;\s*height: 20px;\s*min-height: 20px/);
  assert.match(css,/:focus-visible/);
});

test('Add New Part, Receive Stock and Internal Use retain current save logic', () => {
  for(const text of ['Add New Part', 'Receive Stock', 'Internal Use — Stock Out',
    'savePart', 'saveMovement', 'Confirm Stock In', 'Confirm Internal Use',
    'Use the same prices for old stock and new stock?', 'Search part name / Part Number / SKU / barcode']){
    assert.ok(stockPage.includes(text), text);
  }
  assert.match(css,/@media \(max-width: 520px\)/);
  assert.match(css,/\.cg-easy-fields \{ grid-template-columns: minmax\(0,1fr\)/);
  assert.match(css,/position: sticky/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(smoke,/Stock Add Product form UI mismatch/);
  assert.match(smoke,/Purchased stock must route to Supplier details workflow/);
  assert.match(stockPage,/Buy \/ Receive from Supplier/);
});

test('New Part uses accessible outlined floating fields; search keeps one border', () => {
  assert.match(stockPage, /function OutlinedInput/);
  assert.match(stockPage, /function OutlinedSelect/);
  assert.match(stockPage, /function RackCombobox/);
  assert.match(css, /label\.cg-easy-floating/);
  assert.match(css, /border: 1px solid var\(--border,#dce3ea\) !important/);
  assert.match(css, /font-size: 16px/);
  assert.match(css, /:focus-within/);
  assert.match(css, /\.cg-easy-picker-search:focus-within/);
});
