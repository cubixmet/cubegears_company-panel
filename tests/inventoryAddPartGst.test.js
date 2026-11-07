import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Add New Part uses the same CGST / SGST / IGST rate choices as invoices', () => {
  const page = read('src/pages/stock/StockEasyPage.jsx');
  assert.ok(page.includes('label="GST Component / Rate *"'));
  assert.ok(page.includes("STOCK_GST_CHOICES = invoiceLineTaxChoices('unknown')"));
  assert.ok(page.includes('invoiceTotalRateFromChoice'));
  assert.doesNotMatch(page, /GST_RATE_PRESETS/);
  assert.ok(page.includes('Saved/Other HSN-Specific Rate (custom %)'));
  assert.ok(page.includes('Custom GST Rate (%)'));
});
test('GST and optional alphanumeric HSN/SAC are persisted with new stock item', () => {
  const page = read('src/pages/stock/StockEasyPage.jsx');
  const service = read('src/services/stockCatalog.service.js');
  assert.match(page, /tax: '0', zeroTaxClassification: '', hsnCode: ''/);
  assert.match(page, /label="HSN \/ SAC Code"/);
  assert.match(page, /maxLength=\{20\}/);
  assert.match(page, /if \(!validGstRate\(part\.tax\)\)/);
  assert.match(page, /tax: Number\(part\.tax\), zeroTaxClassification:/);
  assert.match(page, /hsnCode: part\.hsnCode\.trim\(\)/);
  assert.match(service, /tax: number\(payload\.tax\)/);
  assert.match(service, /hsnCode: payload\.hsnCode \|\| ''/);
  assert.match(service, /apiClient\.post\('\/stock', await productPayload\(payload, \{ creating: true \}\)\)/);
});

test('GST is item metadata, not a change to Receive Stock or Issue Stock behavior', () => {
  const page = read('src/pages/stock/StockEasyPage.jsx');
  const service = read('src/services/stockCatalog.service.js');
  assert.match(page, /stockCatalogService\.stockIn\(payload\)/);
  assert.match(page, /stockCatalogService\.stockOut\(payload\)/);
  assert.match(page, /stockQuantity: 0/);
  assert.ok(page.includes("navigate('/suppliers/' + encodeURIComponent(part.supplier)"));
  assert.match(service, /hsnCode: item\.hsnCode \|\| item\.hsn_code \|\| ''/);
});
