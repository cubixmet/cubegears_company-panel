import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('mobile staff login requires a complete real backend session', () => {
  const context = read('src/context/AuthContext.jsx');
  assert.match(context, /apiClient\.post\('\/auth\/login', credentials\)/);
  assert.match(context, /typeof refreshToken !== 'string'/);
  assert.match(context, /apiClient\.get\('\/auth\/me'\)/);
  assert.match(context, /!resolvedUser\?\.id/);
  assert.match(context, /window\.addEventListener\('storage', syncSession\)/);
  assert.match(context, /window\.removeEventListener\('storage', syncSession\)/);
});

test('login surfaces throttle errors and accepts mobile/email without OTP', () => {
  const login = read('src/pages/auth/Login.jsx');
  assert.match(login, /error\?\.status === 429/);
  assert.match(login, /retryAfterSeconds/);
  assert.match(login, /inputMode=\{identifier\.includes\('@'\) \? 'email' : 'tel'\}/);
  assert.doesNotMatch(login, /OTP Code|Send OTP/);
});

test('signup never claims that an unconfirmed WhatsApp message was delivered', () => {
  const signup = read('src/pages/auth/WorkshopMobileSignup.jsx');
  assert.match(signup, /platform_whatsapp_pending/);
  assert.match(signup, /does not mean the message was delivered/);
  assert.match(signup, /response\.status === 429/);
  assert.doesNotMatch(signup, /setupLink: data/);
});

test('invalid credentials are shown once, without duplicate field errors', () => {
  const login = read('src/pages/auth/Login.jsx');
  assert.match(login, /setFormError\(error\?\.status === 429/);
  assert.match(login, /backendFields\.identifier \? \{ identifier: backendFields\.identifier \}/);
  assert.match(login, /backendFields\.password \? \{ password: backendFields\.password \}/);
  assert.doesNotMatch(login, /identifier: credentialError, password: credentialError/);
  assert.match(login, /generic invalid[\s\S]*credentials only once/);
});
