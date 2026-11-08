import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('stock page is route-split and not eagerly loaded on authentication pages', () => {
  const routes = source('../src/routes/AppRoutes.jsx');
  assert.match(routes, /const StockEasyPage = lazyPage\(\(\) => import\('\.\.\/pages\/stock\/StockEasyPage'\), 'default'\)/);
  assert.doesNotMatch(routes, /import StockEasyPage from/);
});

test('react error stack and raw error message are development-only', () => {
  const errorBoundary = source('../src/components/feedback/AppErrorBoundary.jsx');
  assert.match(errorBoundary, /const isDevelopment = import\.meta\.env\.DEV/);
  assert.match(errorBoundary, /const stack = isDevelopment \?/);
  assert.match(errorBoundary, /const componentStack = isDevelopment \?/);
  assert.match(errorBoundary, /\{isDevelopment && \(/);
});

test('deploy branding and security headers are configured', () => {
  const html = source('../index.html');
  const config = JSON.parse(source('../vercel.json'));
  assert.match(html, /cubixgear \| Workshop Management/);
  assert.ok(config.headers.some(rule =>
    rule.headers.some(header => header.key === 'X-Frame-Options' && header.value === 'DENY')));
  assert.ok(config.headers.some(rule => rule.source === '/index.html' &&
    rule.headers.some(header => header.key === 'Cache-Control' && header.value.includes('no-cache'))));
});
