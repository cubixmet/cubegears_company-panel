import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('src/pages/payments/PaymentList.jsx');
const css = read('src/styles/payments-borderless-forms.css');
const old = read('src/styles/payments-unified.css');
const toolbar = read('src/components/payments/PaymentFilterToolbar.jsx');
const smoke = read('scripts/ui-smoke.mjs');

test('Payment record and dashboard search use scoped styles after legacy sheets', () => {
  assert.match(page,/import '..\/..\/styles\/payments-unified\.css';\s*import '..\/..\/styles\/payments-borderless-forms\.css';/);
  assert.match(old,/border:1px solid var\(--border\)/);
  assert.match(css,/\.payments-page\.payments-entry-page/);
  assert.match(css,/\.payments-page\.payments-dashboard/);
  assert.match(css,/\.payments-dashboard-filter/);
  assert.match(css,/\.payments-dashboard-search/);
});

test('Payment record inputs are borderless, iPhone-safe and accessible', () => {
  assert.match(css,/border:0 !important/);
  assert.match(css,/background:var\(--surface-2\) !important/);
  assert.match(css,/font-size:16px !important/);
  assert.match(css,/font-size:14px !important/);
  assert.match(css,/height:50px !important/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/outline:2px solid var\(--primary\) !important/);
  assert.match(css,/input\[readonly\]/);
  assert.match(css,/@media \(max-width:760px\)/);
  assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/env\(safe-area-inset-bottom,0px\)/);
});

test('Payment dashboard search stays single-outline and filtered', () => {
  assert.match(toolbar,/aria-label="Search payment records"/);
  assert.match(toolbar,/aria-label="Filter by payment method"/);
  assert.match(toolbar,/aria-label="Filter by payment status"/);
  assert.match(css,/:focus-within/);
  assert.match(css,/background:transparent !important/);
  assert.match(css,/outline:0 !important/);
  assert.match(smoke,/Payment form computed styles mismatch/);
});

test('Posting and payment amount validation are unchanged by styling', () => {
  assert.match(page,/makePaymentPayload\(form, selectedInvoice, outstanding, USE_MOCK_API\)/);
  assert.match(page,/paymentService\.create\(payload\)/);
  assert.match(page, /form\.direction === "IN" && \(form\.receiptKind === 'advance' \? !form\.customerId : !selectedInvoice\)/);
  assert.match(page,/inputMode="decimal"/);
  assert.match(page,/Payment Amount \(₹\) \*/);
});
