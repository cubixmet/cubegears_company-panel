import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const menu = read('src/routes/routeConfig.js');
const routes = read('src/routes/AppRoutes.jsx');
const profile = read('src/pages/suppliers/SuppliersPage.jsx');
const workflow = read('src/components/suppliers/SupplierPurchaseFlow.jsx');
const finance = read('src/services/supplierFinance.service.js');

test('supplier is one main menu entry and one profile page, no duplicate supplier tabs', () => {
  assert.equal((menu.match(/id: 'suppliers', label: 'Suppliers'/g) || []).length, 1);
  assert.doesNotMatch(menu, /supplierSubmenu|supplier-credits|supplier-payments|supplier-purchases/);
  assert.match(routes, /path="\/suppliers" element=\{<SuppliersPage \/>}/);
  assert.match(routes, /path="\/suppliers\/:id" element=\{<SuppliersPage \/>}/);
  assert.doesNotMatch(profile, /SupplierSectionTabs/);
  assert.match(profile, /<SupplierPurchaseFlow/);
});

test('deprecated URLs redirect to the correct supplier instead of showing a second page', () => {
  for (const oldPath of ['/stock/suppliers', '/suppliers/credits', '/suppliers/purchases', '/suppliers/payments']) {
    assert.ok(routes.includes('path="' + oldPath + '" element={<LegacySupplierRouteRedirect />}'), oldPath);
  }
  assert.match(routes, /new URLSearchParams\(search\).get\('supplier'\)/);
  assert.match(routes, /'\/suppliers\/' \+ encodeURIComponent\(selected\)/);
  assert.doesNotMatch(routes, /SupplierFinancePage|SupplierWorkspace/);
});

test('profile uses canonical company-scoped supplier credit and purchase APIs', () => {
  for (const method of ['getSupplierSummary', 'getBills', 'getPayments']) {
    assert.ok(profile.includes('supplierFinanceService.' + method), method);
  }
  assert.match(finance, /const root = '\/inventory\/procurement'/);
  assert.match(finance, /recordPayment: \(payload\)/);
  assert.match(finance, /createBill: \(payload\)/);
  assert.match(workflow, /supplierFinanceService\.createBill/);
  assert.match(workflow, /supplierFinanceService\.recordPayment/);
  assert.doesNotMatch(workflow, /stockSuppliersMock|localStorage/);
});

test('purchase and payment are permission-gated on the server-aware supplier profile', () => {
  assert.match(profile, /access\.can\('stock\.create'\)/);
  assert.match(profile, /access\.can\('stock\.edit'\)/);
  assert.match(profile, /access\.can\('payments\.create'\)/);
  assert.match(profile, /access\.can\('payments\.view'\)/);
  assert.match(profile, /canPurchase=\{canCreatePurchase\}/);
  assert.match(profile, /canPay=\{canPaySupplier\}/);
});
