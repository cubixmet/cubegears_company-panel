import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const profile = read('src/pages/suppliers/SuppliersPage.jsx');
const purchase = read('src/components/suppliers/SupplierPurchaseFlow.jsx');
const routes = read('src/routes/AppRoutes.jsx');
const css = read('src/styles/supplier-purchase-flow.css');

test('supplier directory/detail is the only active supplier UI', () => {
  assert.match(routes, /path="\/suppliers\/:id" element=\{<SuppliersPage \/>}/);
  assert.match(routes, /LegacySupplierRouteRedirect/);
  assert.doesNotMatch(profile, /<SupplierSectionTabs/);
  assert.doesNotMatch(routes, /SupplierFinancePage/);
  assert.match(profile, /<SupplierPurchaseFlow/);
});

test('supplier credit summary, payments and product details come from live APIs', () => {
  assert.match(profile, /supplierFinanceService\.getSupplierSummary/);
  assert.match(profile, /supplierFinanceService\.getBills/);
  assert.match(profile, /supplierFinanceService\.getPayments/);
  assert.match(profile, /supplierService\.products/);
  assert.match(profile, /Supplier Accounts & Payments/);
  assert.match(profile, /Credit outstanding/);
  assert.match(purchase, /supplierFinanceService\.recordPayment/);
});

test('financial actions are not marked as successful until the backend responds', () => {
  assert.match(purchase, /await supplierFinanceService\.createBill/);
  assert.match(purchase, /await supplierFinanceService\.recordPayment/);
  assert.match(purchase, /catch \(cause\)/);
  assert.match(purchase, /disabled=\{posting/);
  assert.match(purchase, /disabled=\{settling/);
});

test('long names, small screens and light/dark themes remain readable', () => {
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(css, /@media\(max-width:500px\)/);
  assert.match(css, /@media\(max-width:740px\)/);
  assert.match(css, /var\(--text-primary/);
  assert.match(css, /var\(--primary/);
});
