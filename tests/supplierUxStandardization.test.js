import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const supplier = read('src/pages/suppliers/SuppliersPage.jsx');
const form = read('src/components/suppliers/SupplierPurchaseFlow.jsx');
const css = read('src/styles/suppliers-workspace.css');
const flowCss = read('src/styles/supplier-purchase-flow.css');

test('supplier editor uses static labels and first-error focus', () => {
  assert.match(supplier, /className="cg-supplier-field"/);
  assert.match(supplier, /formFields\.find\(key => formErrors\[key\]\)/);
  assert.match(supplier, /scrollIntoView/);
  assert.match(supplier, /aria-invalid=\{Boolean\(formErrors\[key\]\)\}/);
  assert.match(css, /\.cg-supplier-field-error/);
});

test('single-page purchase and settlement are responsive without supplier tab navigation', () => {
  assert.match(supplier, /<SupplierPurchaseFlow/);
  assert.doesNotMatch(supplier, /SupplierSectionTabs/);
  assert.match(flowCss, /@media\(max-width:740px\)/);
  assert.match(flowCss, /@media\(max-width:500px\)/);
  assert.doesNotMatch(flowCss, /scroll-snap|translateX/);
});

test('supplier bills and purchased products are shown from real backend records', () => {
  assert.match(supplier, /supplierFinanceService\.getBills/);
  assert.match(supplier, /supplierFinanceService\.getPayments/);
  assert.match(supplier, /supplierService\.products/);
  assert.match(supplier, /bill\.items\?\.map/);
  assert.match(supplier, /item\.costPrice/);
  assert.match(supplier, /item\.sellingPrice/);
});

test('payment form validates amount and account balance before mutation', () => {
  assert.match(form, /paidNow > total/);
  assert.match(form, /n\(account\.recordedBalance\)/);
  assert.match(form, /idempotencyKey: row\.id/);
  assert.match(form, /settleKey\.current/);
  assert.match(form, /allocations/);
  assert.match(form, /supplierFinanceService\.recordPayment/);
});

test('credit and payment history use company-scoped supplier APIs', () => {
  assert.match(supplier, /supplierFinanceService\.getSupplierSummary/);
  assert.match(supplier, /supplierBills\.filter/);
  assert.match(supplier, /supplierPayments\.map/);
  assert.match(form, /postNow: true/);
  assert.match(form, /no second stock receipt or expense/);
  assert.doesNotMatch(form, /localStorage|stockSuppliersMock/);
});
