import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  invoiceLineTaxChoices, invoiceTotalRateFromChoice,
} from '../src/utils/invoiceTaxUi.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('new parts share CGST SGST IGST dropdown logic with invoices', () => {
  const stock = read('src/pages/stock/StockEasyPage.jsx');
  assert.match(stock, /invoiceLineTaxChoices\('unknown'\)/);
  assert.match(stock, /invoiceTotalRateFromChoice/);
  assert.doesNotMatch(stock, /GST_RATE_PRESETS/);
  assert.deepEqual(invoiceLineTaxChoices('unknown').map(row => row.label), [
    'CGST 2.5%', 'CGST 5%', 'CGST 9%', 'CGST 18%',
    'SGST 2.5%', 'SGST 5%', 'SGST 9%', 'SGST 18%',
    'IGST 5%', 'IGST 18%',
  ]);
  assert.equal(invoiceTotalRateFromChoice('cgst:2.5'), '5');
  assert.equal(invoiceTotalRateFromChoice('sgst:9'), '18');
  assert.equal(invoiceTotalRateFromChoice('igst:18'), '18');
});

test('new supplier part opens supplier details, and only posting the bill adds stock', () => {
  const stock = read('src/pages/stock/StockEasyPage.jsx');
  const purchases = read('src/components/suppliers/SupplierPurchaseFlow.jsx');
  const supplier = read('src/pages/suppliers/SuppliersPage.jsx');
  assert.match(stock, /stockQuantity: 0/);
  assert.ok(stock.includes("navigate('/suppliers/' + encodeURIComponent(part.supplier)"));
  assert.match(stock, /purchasePrefill/);
  assert.match(supplier, /location.state\?\.purchasePrefill/);
  assert.match(purchases, /receiveIntoStock: true/);
  assert.match(purchases, /payments: splits\.map/);
});

test('customer, supplier and expense forms use canonical account-linked payment workflow', () => {
  const customer = read('src/pages/customers/CustomerDetails.jsx');
  const supplier = read('src/pages/suppliers/SuppliersPage.jsx');
  const payments = read('src/pages/payments/PaymentList.jsx');
  const expenses = read('src/pages/expenses/ExpenseList.jsx');
  assert.match(customer, /account: payAccountId/);
  assert.match(customer, /idempotency_key: payRequestKey/);
  assert.match(customer, /Receive Into Account \*/);
  assert.match(supplier, /supplierFinanceService\.getSupplierSummary\(id\)/);
  assert.match(supplier, /supplierFinanceService\.getBills\(id\)/);
  assert.match(supplier, /supplierFinanceService\.getPayments\(id\)/);
  assert.match(supplier, /<SupplierPurchaseFlow/);
  assert.match(payments, /supplier’s own detail page/);
  assert.match(expenses, /supplier bill must never be recorded again/);
  assert.match(expenses, /getPaymentActivity/);
  assert.match(expenses, /supplierPurchases/);
  assert.match(expenses, /supplierPayments/);
  assert.match(expenses, /supplierOutstanding/);
  assert.match(expenses, /Linked supplier purchase accounting/);
});
