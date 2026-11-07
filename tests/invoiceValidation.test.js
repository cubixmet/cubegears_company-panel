import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareInvoicePayloadForApi,
  validateInvoiceDraft,
  extractInvoiceFieldErrors,
  formatInvoiceValidationError
} from '../src/utils/invoicePayload.js';

const draft = () => ({
  invoiceType: 'regular', date: '2026-10-27',
  customer: { name: 'Walk-in customer' },
  paid: '', discount: '', adjustment: '',
  cgstRate: 9, sgstRate: 9, igstRate: 18,
  items: [{
    id: 'ROW-1', type: 'Labour', unit: 'PCS', description: 'Car wash',
    qty: 1, rate: '', purchasePrice: '', discount: '',
    taxRate: '', inventoryId: '', hsnCode: ''
  }]
});

test('empty optional invoice numbers become zero only in API payload', () => {
  const original = draft();
  const payload = prepareInvoicePayloadForApi(original);
  // Invoice drafts never send cash received; payment ledger owns this field.
  assert.equal(payload.paid, undefined);
  assert.equal(payload.adjustment, '0');
  assert.equal(payload.discount, '0');
  assert.equal(payload.items[0].rate, '0');
  assert.equal(payload.items[0].purchasePrice, '0');
  assert.equal(payload.items[0].taxRate, '0');
  assert.equal(payload.items[0].inventoryId, null);
  assert.equal(original.paid, '');
  assert.equal(original.items[0].rate, '');
  assert.equal(original.items[0].inventoryId, '');
});

test('incorrect quantity and rate show item-level actionable messages', () => {
  const input = draft();
  input.items[0].qty = '';
  input.items[0].rate = '1.2.3';
  const errors = validateInvoiceDraft(input);
  assert.match(errors['items.0.qty'], /required/);
  assert.match(errors['items.0.rate'], /valid number/);
  assert.throws(() => prepareInvoicePayloadForApi(input), (error) =>
    Boolean(error.fieldErrors['items.0.qty'] && error.fieldErrors['items.0.rate']));
});

test('GST invoice requires classified tax rate and HSN', () => {
  const input = draft();
  input.invoiceType = 'gst';
  const errors = validateInvoiceDraft(input);
  assert.match(errors['items.0.taxRate'], /required/);
  assert.match(errors['items.0.hsnCode'], /HSN/);
});

test('decimal format and invalid adjustment values are rejected', () => {
  const input = draft();
  input.paid = '7.123';
  input.adjustment = 'xyz';
  assert.equal(validateInvoiceDraft(input).paid, undefined);
  assert.match(validateInvoiceDraft(input).adjustment, /valid number/);
  // Malformed paid in a browser form cannot alter the saved invoice balance.
  input.adjustment = '0';
  assert.equal(prepareInvoicePayloadForApi(input).paid, undefined);
});

test('nested Django item errors are mapped into input paths and summarized', () => {
  const error = {
    message: 'A valid number is required.',
    data: {
      items: [{ rate: ['A valid number is required.'], qty: ['Ensure this value is greater than 0.'] }],
      paid: ['A valid number is required.']
    }
  };
  const fields = extractInvoiceFieldErrors(error);
  assert.equal(fields['items.0.rate'], 'A valid number is required.');
  assert.equal(fields.paid, 'A valid number is required.');
  assert.match(formatInvoiceValidationError(error), /items\[1\].rate: A valid number/);
});
