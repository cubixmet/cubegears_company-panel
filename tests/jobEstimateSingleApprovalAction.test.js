import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/components/jobs/QuickEstimatePanel.jsx', import.meta.url), 'utf8',
);

test('Job Estimate has only Approve & Continue as a primary save/approve action', () => {
  assert.match(source, /className="job-quick-approve"/);
  assert.match(source, /'Approve & Continue'/);
  assert.doesNotMatch(source, /className="job-quick-primary"/);
  assert.doesNotMatch(source, /'Save Draft'/);
  assert.match(source, /await jobService\.saveQuickJobEstimate\(job\.id/);
  assert.match(source, /await onSaved\?\.\(\);[\s\S]*await onApprove\?\.\(target\.id, target\.version\);/);
  assert.match(source, /if \(!latest \|\| changed \|\| stale/);
  assert.doesNotMatch(source, /disabled=\{busy \|\| !latest \|\| changed \|\| stale/);
});

test('no estimate disclaimer or technical CGST/SGST/IGST error is shown', () => {
  assert.doesNotMatch(source, /Estimate only, not a tax invoice/);
  assert.doesNotMatch(source, /className="job-quick-save-note"/);
  assert.doesNotMatch(source, /Selected CGST \/ SGST \/ IGST type conflicts with Place of Supply/);
  assert.match(source, /legalizeLineGst\(line, nextMode\)/);
  assert.match(source, /legalizeLineGst\(line, taxMode\)/);
  assert.match(source, /Select a GST rate for each item based on the Place of Supply/);
});

test('selected GST remains a total rate and respects jurisdiction on the save path', () => {
  assert.match(source, /Number\(option\.totalRate\) === Number\(line\.taxRate\)/);
  assert.match(source, /replacement\.value/);
  assert.match(source, /taxRate: taxRate \|\| '0', taxChoice: taxChoice \|\| ''/);
  assert.match(source, /await onApprove\?\.\(target\.id, target\.version\)/);
});
