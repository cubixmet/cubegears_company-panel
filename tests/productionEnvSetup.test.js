import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const root = new URL('../', import.meta.url);

test('Frontend local and production environment templates separate HTTP local / HTTPS live API', () => {
  const local = read('.env.example');
  const production = read('.env.production.example');
  const source = read('scripts/verify-production-env.mjs');
  const config = JSON.parse(read('vercel.json'));
  const packageJson = JSON.parse(read('package.json'));

  assert.match(local, /VITE_API_URL=http:\/\/127\.0\.0\.1:8000\/api\/v1/);
  assert.match(production, /VITE_API_URL=https:\/\/api\.example\.com\/api\/v1/);
  assert.match(production, /VITE_USE_MOCK_API=false/);
  assert.doesNotMatch(local + production, /EMAIL_HOST_PASSWORD=|POSTGRES_PASSWORD=|DJANGO_SECRET_KEY=|JWT_SIGNING_KEY=|RAZORPAY_KEY_SECRET=/);
  assert.match(source, /loadEnv\('production'/);
  assert.match(source, /VITE_USE_MOCK_API must be explicitly false/);
  assert.equal(config.buildCommand, 'npm run build:production');
  assert.match(packageJson.scripts['build:production'], /check:production-env/);
});

test('Production env validation rejects localhost, http and mock API', () => {
  const result = spawnSync(process.execPath, ['scripts/verify-production-env.mjs'], {
    cwd: root,
    env: { ...process.env, VITE_API_URL: 'http://localhost:8000/api/v1', VITE_USE_MOCK_API: 'true' },
    encoding: 'utf8',
    timeout: 12000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must use HTTPS/);
  assert.match(result.stderr, /must be explicitly false/);
});

test('Production env validation accepts verified-style HTTPS API URL with real data mode', () => {
  const result = spawnSync(process.execPath, ['scripts/verify-production-env.mjs'], {
    cwd: root,
    env: { ...process.env, VITE_API_URL: 'https://api.cubegears.app/api/v1', VITE_USE_MOCK_API: 'false' },
    encoding: 'utf8',
    timeout: 12000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Real Django API configured/);
});
