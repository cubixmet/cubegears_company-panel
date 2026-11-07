import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('src/pages/stock/StockEasyPage.jsx');
const service = read('src/services/stockCatalog.service.js');
const css = read('src/styles/stock-form-polish.css');

test('inventory GST catalog shares invoice component options and custom HSN treatment', () => {
  assert.ok(page.includes("STOCK_GST_CHOICES = invoiceLineTaxChoices('unknown')"));
  assert.doesNotMatch(page, /GST_RATE_PRESETS/);
  assert.ok(page.includes('invoiceTotalRateFromChoice'));
  assert.ok(page.includes('Saved/Other HSN-Specific Rate (custom %)'));
  assert.ok(page.includes('Custom GST Rate (%)'));
  assert.match(page, /validGstRate/);
});
test('all four 0% classifications are distinct, required and included in stock payload', () => {
  for (const pair of [
    "['exempt', 'Exempt']", "['nil_rated', 'Nil-rated']",
    "['zero_rated', 'Zero-rated']", "['non_gst', 'Non-GST']",
  ]) assert.ok(page.includes(pair), pair);
  assert.match(page, /<OutlinedSelect label="0% GST Classification \*" required/);
  assert.match(page, /data-field="zeroTaxClassification"/);
  assert.match(page, /!ZERO_GST_CLASSIFICATIONS\.some\(\(\[code\]\) => code === part\.zeroTaxClassification\)/);
  assert.match(page, /tax: Number\(part\.tax\), zeroTaxClassification: Number\(part\.tax\) === 0 \? part\.zeroTaxClassification : ''/);
});

test('catalog previews paired CGST/SGST or whole IGST without assuming jurisdiction', () => {
  assert.ok(page.includes('Number(part.tax) > 0 && validGstRate(part.tax)'));
  assert.ok(page.includes('Intra-state: {Number(part.tax) / 2}% CGST + {Number(part.tax) / 2}% SGST/UTGST'));
  assert.ok(page.includes('Inter-state: {part.tax}% IGST'));
  assert.ok(page.includes('invoice place of supply'));
  assert.doesNotMatch(page, /setPart\(\{ \.\.\.part, taxMode:/);
});
test('inventory item catalogue sends and receives classification with mock support', () => {
  assert.match(service, /zeroTaxClassification: item\.zeroTaxClassification \|\| item\.gst_zero_classification \|\| ''/);
  assert.match(service, /zeroTaxClassification: number\(payload\.tax\) === 0 \? \(payload\.zeroTaxClassification \|\| ''\) : ''/);
  assert.match(service, /apiClient\.post\('\/stock'/);
  assert.ok(service.includes("apiClient.patch('/stock/' + id,"));
});

test('zero classification and rate preview are styled inside the inventory modal only', () => {
  assert.match(css, /\.cg-easy-stock \.cg-easy-form \.cg-easy-zero-gst/);
  assert.match(css, /\.cg-easy-stock \.cg-easy-form \.cg-easy-gst-preview/);
  assert.match(css, /font-size:14px/);
  assert.match(page, /stockCatalogService\.stockIn\(payload\)/);
  assert.match(page, /stockCatalogService\.stockOut\(payload\)/);
});
