import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  invoiceOutstanding, makePaymentPayload, normalizePaymentRow,
  payableInvoices, formatPaymentDate
} from '../src/components/payments/payments.utils.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../src/pages/payments/PaymentList.jsx');
const toolbar = read('../src/components/payments/PaymentFilterToolbar.jsx');
const css = read('../src/styles/payments-unified.css');
const records = read('../src/components/payments/PaymentRecordsPanel.jsx');

const totals = (invoice) => ({ balance: Number(invoice.total) - Number(invoice.paid || 0) });
const invoice = {
  id: '8bb394b0-450d-4efa-a1dc-d39b334b00c9',
  customerId: 'e5f32adc-b5a6-4d81-89f5-293b8a3ca1c8',
  number: 'INV-2026-0043', customer: { name: 'Actual Customer' },
  kind: 'invoice', status: 'Finalized', balance: '700.00', total: '1000.00', paid: '300.00'
};
const form = {
  date: '2026-10-13', invoiceId: invoice.id, method: 'UPI',
  amount: '500.00', reference: 'UPI123', accountId: 'cash-account-1'
};

test('normalizes Django Payment API customer/invoice fields without rendering objects', () => {
  const payment = normalizePaymentRow({
    id: 'uuid-1', customer: { id: 'C1', name: 'Visitor' },
    invoice: { id: 'I1', number: 'INV-1' }, date: '2026-10-13',
    method: 'UPI', amount: '500.00', reference: 'BANK1', status: 'Completed'
  });
  assert.equal(payment.customer, 'Visitor');
  assert.equal(payment.invoice, 'INV-1');
  assert.equal(payment.receiptNo, 'uuid-1'); // reference is not an official receipt number
  assert.equal(payment.amount, 500);
  assert.ok(formatPaymentDate(payment.date).includes('2026'));
});

test('only outstanding finalized invoices are offered for payment', () => {
  const options = payableInvoices([
    invoice,
    { ...invoice, id: 'draft', status: 'Draft' },
    { ...invoice, id: 'cancelled', status: 'Cancelled' },
    { ...invoice, id: 'fully-paid', balance: '0' },
    { ...invoice, id: 'estimate', kind: 'estimate' }
  ], totals);
  assert.deepEqual(options.map((row) => row.id), [invoice.id]);
  assert.equal(invoiceOutstanding(invoice, totals), 700);
  assert.equal(invoiceOutstanding({ ...invoice, balance: null }, totals), 700);
});

test('backend payment payload uses invoice UUID, customer UUID and completed status', () => {
  assert.deepEqual(makePaymentPayload(form, invoice, 700), {
    date: '2026-10-13', amount: '500.00', method: 'UPI',
    reference: 'UPI123', status: 'Completed', account: 'cash-account-1',
    customer: invoice.customerId, invoice: invoice.id
  });
  assert.equal(makePaymentPayload(form, invoice, 700, true).invoice, invoice.number);
});

test('posting rejects zero, overpaid, invalid precision, and missing customer before API request', () => {
  assert.throws(() => makePaymentPayload({ ...form, amount: '0' }, invoice, 700), /greater than zero/);
  assert.throws(() => makePaymentPayload({ ...form, amount: '701' }, invoice, 700), /exceeds/);
  assert.throws(() => makePaymentPayload({ ...form, amount: '5.123' }, invoice, 700), /two decimal/);
  assert.throws(() => makePaymentPayload(form, { ...invoice, customerId: null }, 700), /customer ID/);
  assert.throws(() => makePaymentPayload(form, null, 700), /Select an invoice/);
});

test('Payments provides real API posting and safe form/filter states', () => {
  assert.match(page, /makePaymentPayload\(form, selectedInvoice, outstanding, USE_MOCK_API\)/);
  assert.match(page, /await paymentService\.create\(payload\)/);
  assert.match(page, /<strong>Completed<\/strong>/);
  assert.match(page, /form\.direction === "IN" && \(form\.receiptKind === 'advance' \? !form\.customerId : !selectedInvoice\)/);
  assert.match(page, /role="alert"/);
  assert.match(toolbar, /onClear/);
  assert.match(toolbar, /onRefresh/);
  assert.match(toolbar, /aria-label="Search payment records"/);
});

test('Payments UI has readable responsive cards, single search border, and regular inputs', () => {
  assert.match(page, /payments-unified\.css/);
  assert.match(css, /font-size:13px!important;font-weight:400!important/);
  assert.match(css, /border:0!important;border-radius:0!important/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /\.payments-dashboard-mobile-card/);
  assert.match(css, /\.payment-form-grid/);
  assert.match(records, /aria-label=\{'View payment ' \+/);
  assert.doesNotMatch(records, /<span>\{row\.id\}<\/span>/);
});

test('Outgoing payments require an account and do not create an invoice receipt', () => {
  const outgoing = { ...form, direction: 'OUT', accountId: 'account-1', category: 'Rent', notes: 'Landlord' };
  const payload = makePaymentPayload(outgoing, null, 0);
  assert.equal(payload.direction, 'OUT');
  assert.equal(payload.account, 'account-1');
  assert.equal(payload.category, 'Rent');
  assert.equal(payload.notes, 'Landlord');
  assert.equal('invoice' in payload, false);
  assert.throws(() => makePaymentPayload({ ...outgoing, accountId: '' }, null, 0), /Choose the account/);
});
