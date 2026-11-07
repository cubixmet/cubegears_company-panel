import test from 'node:test';
import assert from 'node:assert/strict';
import { expenseToApiPayload, normalizeExpense, localDate, splitDescription } from '../src/services/expense.mapper.js';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('src/pages/expenses/ExpenseList.jsx');
const service = read('src/services/expense.service.js');

test('Django snake_case expense rows display correctly, without inventing vendor or dates', () => {
  const row = normalizeExpense({
    id: 15,
    description: 'Workshop electricity bill\n\nOctober meter reading',
    date: '2026-10-28',
    category: 'Utilities',
    vendor: 'Energy Supplier',
    amount: '123.45',
    tax: '12.34',
    payment_method: 'UPI',
    reference: 'UTR-123',
    status: 'Paid',
    attachment: 'https://example.com/receipt.pdf',
  });
  assert.equal(row.title, 'Workshop electricity bill');
  assert.equal(row.notes, 'October meter reading');
  assert.equal(row.expenseDate, '2026-10-28');
  assert.equal(row.paymentMethod, 'UPI');
  assert.equal(row.taxAmount, 12.34);
  assert.equal(row.amount, 123.45);
  assert.equal(row.referenceNo, 'UTR-123');
  assert.equal(row.receiptUrl, 'https://example.com/receipt.pdf');
  assert.equal(row.status, 'paid');
  assert.equal(normalizeExpense({}).vendor, '');
  assert.equal(normalizeExpense({}).expenseDate, '');
});

test('UI expense form serializes only backend-supported field names', () => {
  const values = {
    title: 'Lubricants', notes: 'For lift maintenance',
    amount: '155.25', taxAmount: '5.25',
    expenseDate: '2026-10-28', category: 'Consumables & Tools',
    vendor: 'Local Supplier', paymentMethod: 'Cash',
    referenceNo: 'BILL-123', status: 'approved',
    receiptUrl: 'https://example.com/bill.pdf',
  };
  const payload = expenseToApiPayload(values);
  assert.deepEqual(payload, {
    date: '2026-10-28', category: 'Consumables & Tools',
    vendor: 'Local Supplier', description: 'Lubricants\n\nFor lift maintenance',
    amount: '155.25', tax: '5.25', payment_method: 'Cash',
    reference: 'BILL-123', attachment: 'https://example.com/bill.pdf',
    status: 'approved',
  });
  assert.equal(splitDescription(payload.description).notes, values.notes);
});

test('Expense amount and receipt URL input validation', () => {
  const valid = {title: 'Rent', expenseDate: '2026-10-28', amount: '20'};
  assert.throws(() => expenseToApiPayload({...valid, amount: '0'}), /greater than zero/);
  assert.throws(() => expenseToApiPayload({...valid, amount: 'abc'}), /greater than zero/);
  assert.throws(() => expenseToApiPayload({...valid, amount: '2.999'}), /two decimal/);
  assert.throws(() => expenseToApiPayload({...valid, taxAmount: '-2'}), /negative/);
  assert.throws(() => expenseToApiPayload({...valid, receiptUrl: 'javascript:alert(1)'}), /https/);
  assert.equal(normalizeExpense({ attachment: 'javascript:alert(1)' }).receiptUrl, '');
});

test('Local dates are produced from local calendar components', () => {
  assert.equal(localDate(new Date(2026, 9, 28, 23, 59)), '2026-10-28');
});

test('Expenses form uses API service and has retryable errors and permission checks', () => {
  assert.match(service, /expenseToApiPayload\(data\)/);
  assert.match(service, /rows\.map\(normalizeExpense\)/);
  assert.match(page, /setLoadError\(error\?\.message/);
  assert.match(page, /setActionError\(error\?\.message/);
  assert.match(page, /hasPermission\(user, 'expenses\.delete'\)/);
  assert.match(page, /type="url"/);
  assert.match(page, /expense-ui-polish\.css/);
  assert.match(page, /minimumFractionDigits: 2/);
});

test('Finance expense mapper links paid items to an account and reports partial balance', () => {
  const paid = expenseToApiPayload({
    title: 'Rent', amount: '120.00', taxAmount: '0.00',
    expenseDate: '2026-11-06', paymentMethod: 'Bank Transfer',
    status: 'paid', accountId: 'bank-uuid', requestKey: 'rent-once',
  });
  assert.equal(paid.account, 'bank-uuid');
  assert.equal(paid.idempotencyKey, 'rent-once');
  assert.equal(paid.status, 'paid');
  const row = normalizeExpense({
    amount: '120.00', paidAmount: '45.00', balanceDue: '75.00',
    status: 'Partially Paid', account: 'bank-uuid',
  });
  assert.equal(row.paidAmount, 45);
  assert.equal(row.balanceDue, 75);
  assert.equal(row.status, 'partially paid');
  assert.equal(row.accountId, 'bank-uuid');
});
