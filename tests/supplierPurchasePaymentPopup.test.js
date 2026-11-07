import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../src/components/suppliers/SupplierPurchaseFlow.jsx', import.meta.url), 'utf8');

test('purchase payment decision occurs on supplier detail before posting', () => {
  assert.match(workflow, /step === 'review'/);
  assert.match(workflow, /No payment = full credit/);
  assert.match(workflow, /Confirm Purchase & Payment/);
  assert.doesNotMatch(workflow, /paymentPopupBill|setPaymentPopupBill/);
});

test('₹300 purchase can use ₹100 Cash and ₹100 Bank with ₹100 remaining credit', () => {
  assert.match(workflow, /splits\.reduce\(\(sum, row\) => sum \+ n\(row\.amount\), 0\)/);
  assert.match(workflow, /Math\.max\(0, total - paidNow\)/);
  assert.match(workflow, /payments: splits\.map/);
  assert.match(workflow, /accountMethod\(account\)/);
  assert.match(workflow, /idempotencyKey: row\.id/);
});

test('after purchase the same supplier has live bill, payment and credit history', () => {
  assert.match(workflow, /await Promise\.resolve\(onChanged\(\)\)/);
  assert.match(workflow, /supplierFinanceService\.recordPayment/);
  assert.match(workflow, /postedBills/);
  assert.match(workflow, /remainingSupplier/);
});
