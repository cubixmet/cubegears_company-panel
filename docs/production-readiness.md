# CubeGears Company Panel — production readiness

The React/Vite company panel is one part of the SaaS product. A passing frontend
CI build does **not** establish that production is ready; Django, tenancy,
billing/credits, background workers, email, storage and Razorpay need independent
backend/staging verification.

## Frontend safety and performance

- Public authentication calls go to Django. Route/role guards are UX only;
  Django must enforce every tenant, permission and billing entitlement.
- Vite requires a configured `VITE_API_URL` during builds. Use the real HTTPS
  Django URL, ending in `/api/v1`, at deployment time.
- Do not put credentials, encryption keys, JWT signing keys or Razorpay secrets
  in any `VITE_*` variable. All such values are exposed to browsers.
- Frontend error boundaries show customer-safe messages in production; debug
  stacks are only available in development.
- Vercel should serve immutable hashed assets and revalidate HTML. SPA deep
  links must work on direct refresh.
- `npm run check:bundle` tracks initial asset budgets (entry JS <=440 kB,
  entry CSS <=950 kB). These are guardrails, **not** performance targets.
  Baseline 2026-10-20 CI: entry JS ~360 kB, entry CSS ~908 kB, both uncompressed.
  The global CSS is the next major optimization area; do not delete/import-split
  styles without page-by-page screenshot comparisons.

## Repeatable frontend release gate

1. `npm ci` using Node 22.
2. `npm run check`, `npm test`.
3. `VITE_API_URL=https://your-api.example.com/api/v1 npm run build`.
4. `npm run check:bundle`.
5. `npx playwright install chromium && UI_PRODUCTION=1 npm run test:ui`.
6. On staging, manually test mobile/desktop login, magic links, permissions,
   account-only onboarding, module activation, draft/final invoice preview/PDF,
   GST totals, staff roles, billing expiry and credit deductions.
7. Confirm browser DevTools shows no production API calls to localhost or
   `api.example.invalid`, no missing chunks, no unexpected 401/403/500.
8. Deploy through an approved pipeline, verify a real test tenant, and monitor
   errors. Revert the frontend deployment if a release regresses core flows.

CI uses an **intentionally invalid placeholder** API URL for a fixture-based
build/test. Passing that CI does not prove that staging/production API is wired
correctly.

## Backend and operational blockers — verify before launch

- Django `DEBUG=False`, proper `ALLOWED_HOSTS`, HTTPS, CORS/CSRF setup.
- Tenant isolation, object-level permission checks and owner restrictions.
- JWT handling: browser localStorage currently holds tokens; a secure
  HttpOnly-cookie/CSRF design should be planned jointly with the backend
  before treating the app as hardened against XSS/token theft.
- Payment webhook signature, idempotency and credit reconciliation.
- Celery/Redis workers, scheduled invoicing/storage settlement, due-day
  restrictions and clock/timezone cases.
- PostgreSQL backup, restore drill, zero-downtime migration strategy.
- Email deliverability, password reset, magic-link expiry and staff onboarding.
- Observability, centralized errors, uptime/latency alerts, audit logs,
  privacy/security review and documented incident response.

## Automated maintenance

- Every pull request runs Oxlint, source tests, production build, bundle
  budgets and Playwright UI smoke checks.
- Failed UI screenshots are retained in GitHub Actions for seven days.
- A weekly scheduled audit checks high/critical **production** dependency
  advisories; Dependabot proposes package/workflow upgrades.
- Dependency PRs require human review, CI validation and regression testing.

## Rollback

Keep the last passing deployment for quick rollback. For frontend regressions,
re-deploy the last known good commit in Vercel; for schema/API changes, follow
a separately tested backend rollback procedure. Never undo billing records
or migrate production data without a verified recovery plan.
