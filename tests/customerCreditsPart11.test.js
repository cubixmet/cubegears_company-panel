import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  makePaymentPayload, payableInvoices, invoiceOutstanding,
} from '../src/components/payments/payments.utils.js';

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const form = (values = {}) => ({
  date: '2026-11-07', amount: '100.00', method: 'UPI', reference: 'UPI-11',
  accountId: 'bank-1', direction: 'IN', receiptKind: 'invoice',
  requestKey: 'part11-request-1', invoiceId: 'invoice-1', ...values,
});

test('advance receipt goes to a real customer and account without a fake invoice', () => {
  const data = makePaymentPayload(
    form({ receiptKind: 'advance', customerId: 'customer-1', amount: '300.50' }),
    null, 0, false,
  );
  assert.equal(data.customer, 'customer-1');
  assert.equal(data.account, 'bank-1');
  assert.equal(data.direction, 'IN');
  assert.equal(data.invoice, null);
  assert.equal(data.amount, '300.50');
  assert.equal(data.idempotency_key, 'part11-request-1');
  assert.equal(data.category, 'Customer Advance');
  assert.throws(() => makePaymentPayload(
    form({ receiptKind: 'advance', customerId: '' }), null, 0, false,
  ), /customer/);
});

test('partial settlement remains a payable invoice and never overpays', () => {
  const invoice = {
    id: 'invoice-1', kind: 'invoice', status: 'Partially Paid',
    customerId: 'customer-1', balance: '700.00', total: '1000.00', paid: '300.00',
  };
  const eligible = payableInvoices([invoice], () => ({ balance: 700 }));
  assert.equal(eligible.length, 1);
  assert.equal(invoiceOutstanding(invoice, () => ({ balance: 0 })), 700);
  const data = makePaymentPayload(form(), invoice, 700, false);
  assert.equal(data.invoice, 'invoice-1');
  assert.equal(data.amount, '100.00');
  assert.equal(data.customer, 'customer-1');
  assert.throws(() => makePaymentPayload(
    form({ amount: '700.01' }), invoice, 700, false,
  ), /exceeds/);
});

test('payments screen offers real invoice and advance modes and does not expose fake account balances', () => {
  const screen = source('src/pages/payments/PaymentList.jsx');
  assert.match(screen, /Customer Advance \/ Unapplied Credit/);
  assert.match(screen, /Invoice Payment \/ Partial Settlement/);
  assert.match(screen, /customerService\.getCustomers/);
  assert.match(screen, /receiptKind === 'advance'/);
  assert.match(screen, /new URLSearchParams\(location\.search\)\.get\('customerId'\)/);
  assert.doesNotMatch(screen, /money\.format\(Number\(account\.currentBalance \|\| 0\)\)/);
});

test('customer credits use real Django APIs, support apply, refund and audit reversal', () => {
  const api = source('src/services/customerCredit.service.js');
  const panel = source('src/components/customers/CustomerCreditLedgerPanel.jsx');
  const customer = source('src/pages/customers/CustomerDetails.jsx');
  assert.match(api, /\/apply-advance/);
  assert.match(api, /\/reverse-advance-application/);
  assert.match(api, /\/refund-advance/);
  assert.match(api, /\/ledger/);
  assert.match(panel, /Customer Credit Ledger/);
  assert.match(panel, /customerCreditService\.applyAdvance/);
  assert.match(panel, /customerCreditService\.refundAdvance/);
  assert.match(panel, /customerCreditService\.reverseApplication/);
  assert.match(customer, /<CustomerCreditLedgerPanel customerId=\{customer\.id\}/);
  assert.doesNotMatch(customer, /account\.currentBalance \|\| 0/);
});
