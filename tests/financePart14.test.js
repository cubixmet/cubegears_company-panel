import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Accounting UI uses live finance API for the chart, balanced journals and bank statements', () => {
  const screen = source('src/pages/finance/AccountingWorkspace.jsx');
  const api = source('src/services/finance.service.js');
  for (const action of [
    'getChart', 'getJournals', 'postJournal', 'getStatement',
    'getReconciliations', 'getReconciliationCandidates', 'reconcileBank',
  ]) {
    assert.ok(screen.includes('financeService.' + action), 'Missing UI action ' + action);
    assert.ok(api.includes(action), 'Missing API action ' + action);
  }
  assert.match(screen, /lineTotal\.debit - lineTotal\.credit/);
  assert.match(screen, /requestKey: journalKey/);
  assert.match(screen, /requestKey: key\(\)/);
  assert.match(screen, /entryIds: selected/);
  assert.match(screen, /canWrite/);
  assert.match(screen, /canRead/);
});

test('Financial statements surface incomplete source coverage and suspense accounts', () => {
  const screen = source('src/pages/finance/AccountingWorkspace.jsx');
  assert.match(screen, /CoverageWarning/);
  assert.match(screen, /missingSourceCount/);
  assert.match(screen, /unclassifiedLineCount/);
  assert.match(screen, /trial-balance/);
  assert.match(screen, /profit-loss/);
  assert.match(screen, /balance-sheet/);
  assert.match(screen, /'Bank Reconciliation'/);
});

test('Accounting route and finance overview link exist behind finance permission', () => {
  const routes = source('src/routes/AppRoutes.jsx');
  const permissions = source('src/utils/permissions.js');
  const dashboard = source('src/pages/finance/FinanceDashboard.jsx');
  assert.match(routes, /path="\/finance\/accounting"/);
  assert.match(routes, /AccountingWorkspace/);
  assert.match(permissions, /\['\/finance\/accounting', 'payments.view'\]/);
  assert.match(dashboard, /Accounting & Reports/);
});

test('Responsive reports have accessible status messages and horizontally scrolling tables', () => {
  const screen = source('src/pages/finance/AccountingWorkspace.jsx');
  const css = source('src/styles/finance-accounting.css');
  assert.match(screen, /role="alert"/);
  assert.match(screen, /role="status"/);
  assert.match(screen, /aria-label="Workshop double-entry accounting"/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /max-width: 700px/);
  assert.match(css, /height: 44px/);
});
