import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/', import.meta.url);
const files = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const fullPath = join(directory, entry.name);
  if (entry.isDirectory()) return files(fullPath);
  return /\.(jsx|tsx)$/.test(entry.name) ? [fullPath] : [];
});
const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

test('entire Company Panel renders no decorative ArrowRight icons', () => {
  const paths = files(root.pathname);
  assert.ok(paths.length > 100, 'Expected all page and shared component sources');
  const remaining = paths.filter(path => /<ArrowRight\b|\bimport\s*\{[^}]*\bArrowRight\b/s.test(readFileSync(path, 'utf8')));
  assert.deepEqual(remaining, [], 'Decorative arrows remain in ' + remaining.join(', '));
});

test('removing arrow graphics does not remove navigation and payment actions', () => {
  const dashboard = source('components/dashboard/QuickActionsPanel.jsx');
  const staff = source('pages/staff-management/SimpleStaffOverview.jsx');
  const stock = source('pages/stock/StockEasyPage.jsx');
  const payroll = source('pages/payroll/DailyWagePage.jsx');
  const credits = source('pages/saas/CreditWorkspace.jsx');
  const plans = source('pages/saas/PlanMarketplace.jsx');
  assert.match(dashboard, /onNavigate\(path\)/);
  assert.match(staff, /navigate\('\/staff-management\/staff'\)/);
  assert.match(stock, /to="\/suppliers"/);
  assert.match(stock, /beginMove\('out'\)/);
  assert.match(payroll, /navigate\(\`\/staff\/\$\{w\.id\}\/wages\`\)/);
  assert.match(credits, /onClick=\{\(\) => buy\(pack\)\}/);
  assert.match(plans, /onClick=\{\(\) => request === plan\.id \? submitPlan\(plan\) : setRequest\(plan\.id\)\}/);
  assert.match(credits, /ArrowUpRight/); // Wallet ledger direction, not decorative next arrow.
});

test('functional chevrons for breadcrumbs and month navigation remain visible', () => {
  assert.match(source('components/layout/AppBreadcrumbs.jsx'), /<ChevronRight\b/);
  assert.match(source('pages/attendance-manager/StaffAttendanceDetails.jsx'), /aria-label="Next month"/);
  assert.match(source('pages/jobs/JobCardWorkspace.jsx'), /<ChevronRight\b/);
});
