# CubeGears Production Readiness — 2026-10-23

**Decision: NOT VERIFIED / NO-GO pending completion of QA gates.** This document does not certify production readiness.

## Confirmed blocker
- Company Panel historical CI fails at npm ci with an ERESOLVE Vite/plugin-react peer dependency conflict (2026-10-21). See BUG_REPORT.md.

## Required gates
- [ ] Pin compatible Vite and React plugin versions; regenerate lockfile and pass clean npm ci.
- [ ] Company Panel lint, unit/regression tests, build and Playwright smoke tests green on current commit.
- [ ] Backend Django checks, migration check, Django unit/integration/security suites green on current commit.
- [ ] Public site signup tests, lint, TypeScript and build green on current commit.
- [ ] Isolated end-to-end signup, onboarding, auth, owner/staff RBAC, billing, inventory, invoices and UI flows.
- [ ] Two-tenant access isolation and privilege escalation tests verified by backend HTTP checks.
- [ ] Calendar-month and next-month due-date settlement, zero wallet, overdue gates, idempotency and recovery tests.
- [ ] Razorpay test mode and verified signature/idempotency with no real money.
- [ ] Staging secrets, host/CORS/CSRF allowlists, DEBUG=False and secure cookies validated.
- [ ] DB backup/restore, persistent file storage, Celery/Redis monitoring, rate limits, mail delivery, logging and rollback rehearsed.

## Architecture observations
Backend is configured SQLite-only and documents a single app instance with durable disk; do not assume PostgreSQL or scalable multiwriter support. Frontend build must define the real VITE_API_URL or suitable same-origin reverse proxy. Next.js signup requires BACKEND_API_URL and optional BACKEND_SIGNUP_PATH with correct /api/v1 composition.
