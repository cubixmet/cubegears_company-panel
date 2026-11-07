import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('Part 15 GSTR page retains prior reports and adds tax-review tabs', () => {
  const page = source('src/pages/gstr/GSTRDashboard.jsx');
  for (const tab of [
    "'gstr1'", "'gstr3b'", "'gstr2b'", "'hsn'",
    "'itc'", "'credits'", "'ledger'",
  ]) assert.ok(page.includes(tab), `Missing GSTR tab ${tab}`);
  assert.match(page, /import GSTPart15Workspace/);
  assert.match(page, /<GSTPart15Workspace tab=\{tab\}/);
  assert.match(page, /params: \{ period, save: '1' \}/);
  assert.match(page, /exportCsv\('gstr3b'\)/);
  assert.match(page, /exportCsv\('itc'\)/);
  assert.match(page, /exportCsv\('credits'\)/);
});

test('Part 15 review and ITC work from tenant-scoped canonical backend endpoints', () => {
  const panel = source('src/pages/gstr/GSTPart15Workspace.jsx');
  const paths = [
    '/gstr/imports', '/gstr/itc', '/gstr/credit-notes',
    '/gstr/tax-ledger', '/gstr/filing-review',
  ];
  for (const path of paths) assert.ok(panel.includes(path), `Missing live API ${path}`);
  assert.match(panel, /access\.can\('gstr\.reconcile'\)/);
  assert.match(panel, /eligibilityReason: itcForm\.eligibilityReason\.trim\(\)/);
  assert.match(panel, /requestKey: requestKey\(\)/);
  assert.match(panel, /source ITC availability confirmed/);
  assert.match(panel, /portal acknowledgment/);
});

test('Part 15 mobile screens separate legal filing, cash refunds and internal review', () => {
  const panel = source('src/pages/gstr/GSTPart15Workspace.jsx');
  const style = source('src/pages/gstr/gst-part15.css');
  assert.match(panel, /without issuing a customer refund/);
  assert.match(panel, /GST Portal verification is not connected/);
  assert.match(panel, /role="alert"/);
  assert.match(panel, /role="status"/);
  assert.match(style, /max-width: 680px/);
  assert.match(style, /min-height: 44px/);
  assert.match(style, /overflow-x: auto/);
});
