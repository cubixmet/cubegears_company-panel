import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const workflow = read('src/components/suppliers/SupplierPurchaseFlow.jsx');
const supplier = read('src/pages/suppliers/SuppliersPage.jsx');
const routes = read('src/routes/AppRoutes.jsx');
const stock = read('src/pages/stock/StockEasyPage.jsx');
const service = read('src/services/supplierFinance.service.js');

test('supplier purchase remains company API-backed and never creates mock balances', () => {
  assert.match(service, /Supplier credit accounting requires the live Django backend/);
  assert.match(service, /\/inventory\/procurement/);
  assert.match(workflow, /supplierFinanceService\.getAccounts\(\)/);
  assert.match(workflow, /supplierFinanceService\.getGSTOptions\(\)/);
  assert.match(workflow, /stockCatalogService\.getItems\(\)/);
});

test('one product at a time with additional products, then post once', () => {
  assert.match(workflow, /Add This Product/);
  assert.match(workflow, /Add Another Product/);
  assert.match(workflow, /Finish Adding Products/);
  assert.match(workflow, /Create New Product/);
  assert.match(workflow, /stockQuantity: 0/);
  assert.match(workflow, /postNow: true/);
  assert.match(workflow, /receiveIntoStock: true/);
  assert.match(workflow, /supplierFinanceService\.createBill/);
});

test('splits pay from Cash Bank or UPI with separate idempotency keys', () => {
  assert.match(workflow, /Add Cash \/ Bank \/ UPI Payment/);
  assert.match(workflow, /payments: splits\.map/);
  assert.match(workflow, /idempotencyKey: row\.id/);
  assert.match(workflow, /n\(account\.recordedBalance\)/);
  assert.match(workflow, /Supplier Credit \(Due\)/);
  assert.match(workflow, /Paid amount cannot exceed the purchase total/);
});

test('supplier due is paid oldest bill first, no stock receipt or duplicate expense', () => {
  assert.match(workflow, /sort\(\(a, b\) => String\(a\.invoiceDate\)\.localeCompare/);
  assert.match(workflow, /allocations\.push\(\{ billId: bill\.id/);
  assert.match(workflow, /supplierFinanceService\.recordPayment/);
  assert.match(workflow, /No pending supplier bills/);
  assert.match(workflow, /no second stock receipt or expense/);
});

test('old standalone supplier finance route is a redirect, not a page', () => {
  assert.match(routes, /path="\/stock\/suppliers" element=\{<LegacySupplierRouteRedirect \/>}/);
  assert.match(stock, /navigate\('\/suppliers\/' \+ encodeURIComponent\(part\.supplier\)/);
  assert.match(supplier, /<SupplierPurchaseFlow/);
});
