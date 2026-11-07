import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('src/components/suppliers/SupplierPurchaseFlow.jsx');
const stock = read('src/pages/stock/StockEasyPage.jsx');

test('supplier purchases select actual place of supply from backend state list', () => {
  assert.match(page, /supplierFinanceService\.getGSTOptions\(\)/);
  assert.match(page, /setStates\(gst\.states \|\| \[\]\)/);
  assert.match(page, /value=\{placeOfSupply\}/);
  assert.match(page, /placeOfSupply: placeOfSupply \|\| undefined/);
  assert.match(page, /Supplier GSTIN/);
});

test('shared CGST SGST IGST options map to a total rate and server jurisdiction check', () => {
  assert.match(page, /invoiceLineTaxChoices\('unknown'\)/);
  assert.match(page, /invoiceTotalRateFromChoice/);
  assert.match(page, /The server determines CGST \+ SGST\/UTGST or IGST/);
  assert.match(page, /gstRate: row\.gstRate/);
  assert.match(stock, /invoiceTotalRateFromChoice/);
});

test('0% purchase GST requires a valid product classification', () => {
  assert.match(page, /zeroClassification/);
  assert.match(page, /Choose why this product has 0% GST/);
  assert.match(page, /gstTreatment: rate === 0 \? part\.zeroClassification : 'taxable'/);
  assert.match(page, /zeroClasses\.map/);
});

test('tax amount and purchase/selling price remain distinct', () => {
  assert.match(page, /purchaseRate: fixed\(cost\)/);
  assert.match(page, /sellingPrice: fixed\(selling\)/);
  assert.match(page, /Update catalogue purchase\/selling prices/);
  assert.match(page, /Purchase Total/);
  assert.match(page, /GST \/ Tax for this product/);
});
