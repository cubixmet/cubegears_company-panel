import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('src/components/suppliers/SupplierPurchaseFlow.jsx');
const css = read('src/styles/supplier-purchase-flow.css');

test('supplier single-page purchase uses standard 16px accessible form fields', () => {
  assert.match(page, /const fieldClass = 'cg-supplier-purchase-input'/);
  assert.match(page, /type="number"/);
  assert.match(page, /type="search"/);
  assert.match(page, /type="date" readOnly/);
  assert.match(page, /role="alert"/);
  assert.match(page, /scrollIntoView/);
  assert.match(css, /font-size:16px/);
  assert.match(css, /min-height:46px/);
});

test('purchase does not clutter navigation with modal payment popups', () => {
  assert.doesNotMatch(page, /paymentPopupBill/);
  assert.match(page, /Finish Adding Products/);
  assert.match(page, /Add Another Product/);
  assert.match(page, /No payment = full credit/);
  assert.match(page, /auto|automatic/i);
  assert.match(page, /Confirm Purchase & Payment/);
});

test('responsive layout keeps fields and payment splits usable on small phones', () => {
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:500px\)/);
  assert.match(css, /min-width:0/);
  assert.match(css, /var\(--surface/);
  assert.match(css, /var\(--text-primary/);
});
