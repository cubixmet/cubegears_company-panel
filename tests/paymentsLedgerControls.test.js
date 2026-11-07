import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('src/pages/payments/PaymentList.jsx');
const overview = read('src/components/payments/PaymentFinanceOverview.jsx');
const css = read('src/styles/payment-finance-overview.css');
const finance = read('src/services/finance.service.js');

test('existing payments route supports account-scoped paged ledger', () => {
  assert.match(page, /ledgerPage, setLedgerPage/);
  assert.match(page, /ledgerAccount, setLedgerAccount/);
  assert.match(page, /ledgerQuery, setLedgerQuery/);
  assert.match(page, /financeService\.getLedger\(filters\)/);
  assert.match(page, /setLedgerTotalPages/);
  assert.match(page, /onLedgerAccountChange/);
  assert.match(page, /onLedgerQueryChange/);
  assert.match(page, /onLedgerPageChange/);
});

test('finance ledger filters and CSV/PDF exports use authorized service', () => {
  assert.match(overview, /Filter payment ledger by account/);
  assert.match(overview, /Search payment ledger reference/);
  assert.match(overview, /financeService\.exportLedgerCSV\(filters\)/);
  assert.match(overview, /financeService\.exportLedgerPDF\(filters\)/);
  assert.match(overview, /ledgerTotalPages/);
  assert.match(finance, /responseType: 'blob'/);
  assert.match(css, /cg-pay-finance-ledger-controls/);
  assert.match(css, /font-size:16px/);
});

test('account adjustments require confirmation, remain audited, and are not revenue', () => {
  assert.match(overview, /appConfirm/);
  assert.match(overview, /financeService\.adjustBalance/);
  assert.match(overview, /Mandatory audit reason/);
  assert.match(overview, /Never overwrite balances directly/);
});
