import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('new signup is locked into sole fullscreen onboarding until completed', () => {
  const route = source('src/routes/ProtectedRoute.jsx');
  const setup = route.indexOf("user?.onboardingRequired === true");
  const shell = route.indexOf("<DashboardLayout>");
  assert.ok(setup > 0 && setup < shell);
  assert.match(route, /location\.pathname === '\/onboarding'\s*\? <Outlet \/>/);
  assert.match(route, /<Navigate to="\/onboarding" replace \/>/);
  const wizard = source('src/pages/saas/OwnerOnboarding.jsx');
  assert.match(wizard, /\{state\.completed && <Link[^>]*>Return to account/);
  assert.doesNotMatch(wizard, /Finish later/);
  assert.match(wizard, /<main className="cg-setup">/);
  assert.match(wizard, /<form onSubmit=\{submit\}>/);
});

test('mandatory account details and wallet credit balance are server sourced', () => {
  const wizard = source('src/pages/saas/OwnerOnboarding.jsx');
  assert.match(wizard, /state\.account\?\.companyName/);
  assert.match(wizard, /state\.account\?\.ownerName/);
  assert.match(wizard, /state\.account\.walletBalanceCredits/);
  assert.match(wizard, /Read-only balance from CubeGears billing/);
  assert.match(wizard, /window\.location\.replace\('\/account'\)/);
});

test('GST opt-out is an explicit checkbox, not automatic absence or made-up GSTIN', () => {
  const wizard = source('src/pages/saas/OwnerOnboarding.jsx');
  assert.match(wizard, /name="gstNotRegistered"/);
  assert.match(wizard, /No GST registration/);
  assert.match(wizard, /gstNotRegistered: checked/);
  assert.match(wizard, /values\.gstNotRegistered = Boolean\(draft\?\.gstNotRegistered\)/);
  assert.match(wizard, /values\.gstin = ''/);
  assert.match(wizard, /disabled=\{key === 'gstin' && drafts\.company\?\.gstNotRegistered\}/);
});

test('one package describes related modules, links and one backend price', () => {
  const marketplace = source('src/pages/saas/CreditWorkspace.jsx');
  assert.match(marketplace, /bundle\.includedModules/);
  assert.match(marketplace, /bundle\.workflowPaths/);
  assert.match(marketplace, /bundle\.workflowDependencies/);
  assert.match(marketplace, /creditWalletService\.purchaseBundle\(bundle\.id\)/);
  assert.match(marketplace, /bundle\.totalCredits/);
});
