import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Payments page loads live finance, audited account ledger and period filters without mock balances', () => {
  const page = read('src/pages/payments/PaymentList.jsx');
  const financeApi = read('src/services/finance.service.js');
  assert.match(page, /financeService\.getDashboard\(\{ period: financePeriod \}\)/);
  assert.match(page, /financeService\.getLedger\(filters\)/);
  assert.match(page, /ledgerAccount/);
  assert.match(page, /ledgerQuery/);
  assert.match(page, /ledgerPage/);
  assert.match(page, /financePeriod === 'today'/);
  assert.match(page, /dateLocal\(\)\.slice\(0, 8\) \+ '01'/);
  assert.match(page, /<PaymentFinanceOverview/);
  assert.match(page, /onPeriodChange=\{value =>/);
  assert.match(page, /canManage=\{canManageAccounts\}/);
  assert.match(financeApi, /getDashboard: \(params = \{\}\)/);
  assert.match(page, /can\('payments.edit'\)/);
});

test('Payment finance overview separates todays cash movement and recognized sales and cost', () => {
  const view = read('src/components/payments/PaymentFinanceOverview.jsx');
  assert.ok(view.includes("Today's Money In"));
  assert.ok(view.includes("Today's Money Out"));
  for (const key of [
    'bankBalance', 'cashBalance', 'netSalesRevenue', 'recordedExpenses',
    'knownCostOfSales', 'estimatedProfit', 'profitNote', 'todayReceived', 'todayPaid',
    'todayExpensesRecorded', 'todaySupplierPaid'
  ]) assert.ok(view.includes(key), key);
  assert.ok(view.includes('All Time'));
  assert.ok(view.includes('This Month'));
  assert.ok(view.includes('Today'));
  assert.ok(view.includes('not live bank statements'));
});

test('Account setup and corrections use real APIs, not editable current balance', () => {
  const view = read('src/components/payments/PaymentFinanceOverview.jsx');
  assert.match(view, /financeService\.createAccount\(newAccount\)/);
  assert.match(view, /financeService\.adjustBalance\(adjustment\.accountId/);
  assert.match(view, /reason: adjustment\.reason\.trim\(\)/);
  assert.match(view, /openingBalance: '0'/);
  assert.match(view, /Opening balance/);
  assert.match(view, /Post Audited Adjustment/);
  assert.doesNotMatch(view, /setCurrentBalance/);
});

test('Actual payment and expense ledger columns are responsive and readable', () => {
  const view = read('src/components/payments/PaymentFinanceOverview.jsx');
  const css = read('src/styles/payment-finance-overview.css');
  assert.match(view, /Account Debit \/ Credit Log/);
  assert.match(view, /entry\.credit/);
  assert.match(view, /entry\.debit/);
  assert.match(css, /font-size:16px/);
  assert.match(css, /overflow-x:auto/);
  assert.match(css, /@media\(max-width:600px\)/);
});
