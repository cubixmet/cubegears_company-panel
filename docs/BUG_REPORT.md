# Bug Report — 2026-10-23

## BUG-001 — CI dependency installation fails (High, confirmed)
- Source: https://github.com/amnas-cubixmet/cubegears_company-panel/actions/runs/39549880783
- Reproduction: On GitHub Actions Node 22 run npm ci from the recorded commit.
- Expected: npm ci installs locked dependencies with exit 0.
- Actual: ERESOLVE; vite@8.3.4 is outside @vitejs/plugin-react@4.7.0 peer range (^4.2 || ^5 || ^6 || ^7).
- Root cause: incompatible dependency major versions.
- Fix recommendation: choose a compatible plugin/Vite pair, update package manifest and lockfile together, rerun npm ci and full pipeline.
- State: Open; no dependency files altered in this documentation-only branch.

## AUDIT-002 — Backend CI lacks Django test execution (Medium, confirmed configuration gap)
- Source: backend .github/workflows/backend-ci.yml
- Expected: Django unit/integration tests run during CI.
- Actual: workflow comment says automated test suites were removed; no manage.py test step.
- State: Open. Re-enable tests with an isolated database and network/payment mocks.

## AUDIT-003 — Docs and current backend email behavior may disagree (Medium, needs verification)
- Source: backend README describes both Celery-only delivery and synchronous SMTP; settings.py says EMAIL_CELERY_ENABLED defaults false and documents Celery-only email.
- Expected: one accurate onboarding/email architecture statement.
- Actual: contradictory textual guidance; implementation requires further inspection.
- State: Unverified implementation issue. Do not treat as confirmed runtime bug.
