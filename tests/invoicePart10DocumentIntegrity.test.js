import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('cancelling a draft sends a real reason to Django; no client-side stock reversal', () => {
  const service = read('src/services/billing.service.js');
  const page = read('src/pages/invoices/BillingWorkspace.jsx');
  assert.match(page, /await appPrompt\(/);
  assert.match(page, /await billingService\.cancel\(form\.id, clean\)/);
  assert.match(service, /cancel\(documentId, reason\)/);
  assert.match(service, /reason: cleanReason/);
  assert.match(service, /cancellationReason: cleanReason/);
  assert.doesNotMatch(service.slice(service.indexOf('async cancel('), service.indexOf('async remove(')), /applyStockMovement\(/);
});

test('official document download uses persisted Django PDF, not browser print', () => {
  const page = read('src/pages/invoices/BillingWorkspace.jsx');
  assert.match(page, /await billingService\.downloadPdf\(form\)/);
  assert.match(page, /Download Official PDF/);
  assert.doesNotMatch(page, /window\.print\(\)/);
  assert.match(page, /disabled=\{busy \|\| !form\.id\}/);
});

test('issued documents are read-only and financial mutations are single-flight', () => {
  const page = read('src/pages/invoices/BillingWorkspace.jsx');
  assert.match(page, /const busyRef = useRef\(false\)/);
  assert.match(page, /if \(busyRef\.current\) return false/);
  assert.match(page, /disabled=\{readOnly \|\| busy\}/);
  assert.match(page, /Save Draft/);
  assert.match(page, /readOnly && <p className="billing-locked-note/);
});

test('saved document numbers cannot be permanently deleted in the client', () => {
  const service = read('src/services/billing.service.js');
  assert.match(service, /async remove\(\)/);
  assert.match(service, /Saved invoices and estimates cannot be deleted/);
  assert.doesNotMatch(service.slice(service.indexOf('async remove('),service.indexOf('async convertEstimateToInvoice')), /apiClient\.delete/);
});
