// Production Vite env preflight. All VITE_* values are PUBLIC in the browser.
// Run before Vercel / CI production builds; never place credentials in VITE_*.
import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), 'VITE_');
const problems = [];
const rawUrl = String(env.VITE_API_URL || '').trim();
if (!rawUrl) {
  problems.push('VITE_API_URL is required, e.g. https://api.your-domain.com/api/v1');
} else {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') problems.push('VITE_API_URL must use HTTPS.');
    if (!url.hostname || /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(url.hostname) ||
        /(^|\.)example\.(com|org|net|invalid|test)$/.test(url.hostname) ||
        /\.(invalid|test|localhost)$/.test(url.hostname)) {
      problems.push('VITE_API_URL must be a real production backend host.');
    }
    if (!/\/api\/v1\/?$/.test(url.pathname)) {
      problems.push('VITE_API_URL must end in /api/v1.');
    }
    if (url.username || url.password || url.search || url.hash) {
      problems.push('Do not include passwords, query strings or tokens in VITE_API_URL.');
    }
  } catch {
    problems.push('VITE_API_URL is not a valid absolute HTTPS URL.');
  }
}
if (String(env.VITE_USE_MOCK_API || '').toLowerCase() !== 'false') {
  problems.push('VITE_USE_MOCK_API must be explicitly false for production.');
}
if (problems.length) {
  for (const message of problems) console.error('[production env] ' + message);
  process.exitCode = 1;
} else {
  console.log('[production env] Real Django API configured; no credentials printed.');
}
