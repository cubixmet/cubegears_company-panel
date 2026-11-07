import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Part 13 supplier finance service uses live debit, refund and aging endpoints', () => {
  const service = src('src/services/supplierFinance.service.js');
  for (const endpoint of [
    '/debit-notes', '/debit-notes/', '/refunds', '/payables',
  ]) assert.ok(service.includes(endpoint), `Missing endpoint ${endpoint}`);
  for (const api of [
    'getDebitNotes', 'createDebitNote', 'applyDebitCredit',
    'getRefunds', 'createRefund', 'getPayables',
  ]) assert.ok(service.includes(api), `Missing ${api}`);
  assert.match(service, /requireLiveBackend/);
});

test('Part 13 purchase return form submits original item quantities and a safe request key', () => {
  const page = src('src/components/suppliers/SupplierReturnsPanel.jsx');
  assert.match(page, /supplierFinanceService\.createDebitNote/);
  assert.match(page, /requestKey: key\(\)/);
  assert.match(page, /lineIndex: line\.lineIndex/);
  assert.match(page, /availableLines\[line\.lineIndex\]\.remaining/);
  assert.match(page, /canReturn/);
  assert.match(page, /Supplier Refund/);
  assert.match(page, /supplierFinanceService\.applyDebitCredit/);
  assert.match(page, /supplierFinanceService\.createRefund/);
});

test('Part 13 supplier profile keeps purchases, payments and posted returns together', () => {
  const page = src('src/pages/suppliers/SuppliersPage.jsx');
  assert.match(page, /import SupplierPurchaseFlow/);
  assert.match(page, /import SupplierReturnsPanel/);
  assert.match(page, /<SupplierReturnsPanel/);
  assert.match(page, /canReturn=\{canEdit && access\.can\('payments\.edit'\)\}/);
  assert.match(page, /supplierFinancials\.totalReturns/);
  assert.match(page, /supplierFinancials\.availableDebitCredit/);
});

test('Part 13 UI provides mobile-safe refund and aging tables', () => {
  const component = src('src/components/suppliers/SupplierReturnsPanel.jsx');
  const css = src('src/styles/supplier-returns.css');
  assert.match(component, /aria-label="Supplier purchase returns and refunds"/);
  assert.match(component, /role="alert"/);
  assert.match(component, /role="status"/);
  assert.match(component, /Payables Aging/);
  assert.match(css, /max-width: 700px/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /min-height: 44px/);
});
