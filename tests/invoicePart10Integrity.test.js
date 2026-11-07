import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('invoice draft API never posts status or paid received to Django', () => {
  const payload = read('src/utils/invoicePayload.js');
  assert.match(payload, /paid: _serverPaid/);
  assert.match(payload, /status: _serverStatus/);
  assert.doesNotMatch(payload, /paid: numberField\(draft\.paid/);
  assert.match(payload, /discount: numberField\(draft\.discount/);
});

test('actual money received is read only in all invoice editor routes', () => {
  const primary = read('src/pages/invoices/InvoiceRoutePage.jsx');
  const legacy = read('src/pages/invoices/BillingWorkspace.jsx');
  assert.match(primary, /Received ₹ \(posted payments only\)/);
  assert.match(primary, /readOnly aria-label="Recorded payments"/);
  assert.doesNotMatch(primary, /onChange=\{\(e\) => update\('paid'/);
  assert.match(legacy, /Received ₹ \(posted payments\)/);
  assert.doesNotMatch(legacy, /onChange=\{\(e\) => update\('paid'/);
});

test('record payment links to real Payments page instead of changing invoice paid', () => {
  const page = read('src/pages/invoices/InvoiceRoutePage.jsx');
  const payment = read('src/pages/payments/PaymentList.jsx');
  assert.match(page, /\/payments\/new\?invoiceId=/);
  assert.match(payment, /new URLSearchParams\(location\.search\)\.get\('invoiceId'\)/);
  assert.match(payment, /eligibleInvoices\.find/);
  assert.match(payment, /invoiceOutstanding\(linked, calculateDocumentTotals\)/);
});

test('invoice audit history cannot be deleted from document UI', () => {
  const list = read('src/components/invoices/InvoiceRecordsPanel.jsx');
  const page = read('src/pages/invoices/InvoiceRoutePage.jsx');
  assert.doesNotMatch(list, /onDelete\(document\)/);
  assert.doesNotMatch(page, /billingService\.remove\(id\)/);
  assert.match(page, /Draft documents can be cancelled, but never permanently deleted/);
  assert.match(list, /document\.status === 'Draft'/);
});
