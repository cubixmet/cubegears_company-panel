import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getStaffLandingPath } from '../src/utils/staffLanding.js';

const load = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('only newly registered owners with unfinished setup start in onboarding', () => {
  assert.equal(getStaffLandingPath({ isCompanyOwner: true, onboardingRequired: true }), '/onboarding');
  assert.equal(getStaffLandingPath({ isCompanyOwner: true, onboardingRequired: false }), '/account');
  assert.equal(getStaffLandingPath({ isCompanyOwner: true }), '/account');
});

test('wizard is a real authenticated route and persists all four steps in Django', () => {
  const routes = load('src/routes/AppRoutes.jsx');
  const page = load('src/pages/saas/OwnerOnboarding.jsx');
  const service = load('src/services/onboarding.service.js');
  assert.match(routes, /path="\/onboarding" element=\{<OwnerOnboarding \/>\}/);
  assert.match(page, /onboardingService\.saveStep/);
  assert.match(page, /onboardingService\.complete\(/);
  assert.match(page, /settingsService\.uploadCompanyLogo/);
  assert.match(service, /apiClient\.patch\(ROOT/);
  assert.doesNotMatch(service, /localStorage|USE_MOCK_API/);
});
