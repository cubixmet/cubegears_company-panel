import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  estimatePdfData, latestApprovedEstimate, pdfBytesFromJpegPages,
} from '../src/utils/approvedEstimatePdf.js';

const job = {
  id: 'f8430b1e-c0c2-4752-89dc-3787695bb31a',
  jobNumber: 'JOB-102',
  customerName: 'Anjali Menon', customerPhone: '9876543210',
  vehicleReg: 'KL-10-AA-1234', vehicleInfo: 'Swift Dzire',
  company: { name: 'Demo Workshop' },
};
const approved = {
  id: 'approved-estimate-id', version: 2, status: 'Approved',
  approved_at: '2026-10-13T10:00:00.000Z',
  items: [
    { description: 'Brake inspection', type: 'Labour', quantity: '1', unitPrice: '400' },
    { description: 'Brake Pads', type: 'Part', quantity: '2', unitPrice: '350' },
    { _pricing: { discount: '100', taxPercent: '18' } },
  ],
};

test('latestApprovedEstimate always returns a saved approved version, never an unsaved draft', () => {
  assert.equal(latestApprovedEstimate([{ ...approved, status: 'Draft' }]), null);
  assert.equal(latestApprovedEstimate([approved, { ...approved, id: 'draft', status: 'Draft' }]).id,
    'approved-estimate-id');
  assert.equal(latestApprovedEstimate([]), null);
});

test('approved PDF data contains saved lines and correct financial totals', () => {
  const data = estimatePdfData(job, approved);
  assert.equal(data.jobNumber, 'JOB-102');
  assert.equal(data.workshop, 'Demo Workshop');
  assert.equal(data.customerName, 'Anjali Menon');
  assert.equal(data.customerPhone, '9876543210');
  assert.equal(data.vehicleRegistration, 'KL-10-AA-1234');
  assert.equal(data.version, '2');
  assert.equal(data.items.length, 2);
  assert.equal(data.items[0].type, 'Work');
  assert.equal(data.items[1].type, 'Part');
  assert.equal(data.subtotal, 1100);
  assert.equal(data.discount, 100);
  assert.equal(data.taxPercent, 18);
  assert.equal(data.tax, 180);
  assert.equal(data.total, 1180);
});

test('rejected, pending or draft estimates cannot generate an approved PDF', () => {
  for (const status of ['Draft', 'Pending', 'Rejected', undefined]) {
    assert.throws(() => estimatePdfData(job, { ...approved, status }), /saved, approved/i);
  }
  assert.throws(() => estimatePdfData(job, null), /saved, approved/i);
  assert.throws(() => estimatePdfData(job, { ...approved, items: [] }), /line items/i);
});

test('PDF file has a valid multi-page structure and byte-offset cross reference', () => {
  // A small JPEG header and EOI are enough for testing binary stream boundaries.
  const jpeg = Uint8Array.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 255, 217]);
  const pdf = pdfBytesFromJpegPages([
    { data: jpeg, width: 1240, height: 1754 },
    { data: jpeg, width: 1240, height: 1754 },
  ]);
  const text = Buffer.from(pdf).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.match(text, /\/Count 2/);
  assert.equal((text.match(/\/Type \/Page \/Parent/g) || []).length, 2);
  assert.equal((text.match(/\/Filter \/DCTDecode/g) || []).length, 2);
  assert.match(text, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.match(text, /xref\n0 9\n/);
  const offset = Number(text.match(/startxref\n(\d+)\n%%EOF/)[1]);
  assert.equal(text.slice(offset, offset + 4), 'xref');
  assert.ok(pdf.byteLength > jpeg.length * 2);
  assert.throws(() => pdfBytesFromJpegPages([]), /No PDF pages/);
});

test('approval offers PDF only after server confirms successful stage completion', () => {
  const parent = readFileSync(new URL('../src/pages/jobs/JobCardWorkspace.jsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../src/components/jobs/QuickEstimatePanel.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/styles/approved-estimate-pdf.css', import.meta.url), 'utf8');
  assert.match(parent, /await jobService\.completeJobStage\(job\.id, stage, options\)/);
  assert.match(parent, /stage === 'estimate' && result\.completed\?\.includes\('estimate'\)/);
  assert.match(parent, /setPdfOffer\(\{/);
  assert.match(parent, /title="Estimate Approved"/);
  assert.match(parent, /Download PDF/);
  assert.match(parent, /Continue to Work/);
  assert.match(parent, /onDownloadApproved=\{\(approvedEstimate\) => openApprovedPdfShare\(job, approvedEstimate\)\}/);
  assert.match(panel, /Download Approved PDF/);
  assert.match(css, /job-approved-pdf-offer-actions/);
});

test('PDF is downloaded only when the user clicks, not automatically on approval', () => {
  const parent = readFileSync(new URL('../src/pages/jobs/JobCardWorkspace.jsx', import.meta.url), 'utf8');
  assert.match(parent, /onClick=\{\(\) => downloadApprovalPdf\(pdfOffer\.job, pdfOffer\.estimate\)\}/);
  assert.match(parent, /onClick=\{continueAfterApproval\}/);
  assert.match(parent, /Confirm that the customer approved this exact saved Estimate/);
  assert.match(parent, /not a customer electronic signature/);
});

test('iPhone and desktop share the approved PDF file without touching draft data', () => {
  const parent = readFileSync(new URL('../src/pages/jobs/JobCardWorkspace.jsx', import.meta.url), 'utf8');
  const utility = readFileSync(new URL('../src/utils/approvedEstimatePdf.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/styles/approved-estimate-pdf.css', import.meta.url), 'utf8');
  assert.match(parent, /createApprovedEstimatePdfFile\(pdfOffer\.job, pdfOffer\.estimate\)/);
  assert.match(parent, /navigator\.share\(\{/);
  assert.match(parent, /files: \[approvedPdfFile\]/);
  assert.match(parent, /onClick=\{shareApprovedPdf\}/);
  assert.match(parent, /Share PDF/);
  assert.match(parent, /Download PDF/);
  assert.match(parent, /if \(next\) navigate/);
  assert.match(utility, /export const createApprovedEstimatePdfFile/);
  assert.match(utility, /return new File\(\[pdf\], filename, \{ type: 'application\/pdf' \}\)/);
  assert.match(css, /safe-area-inset-bottom/);
});
