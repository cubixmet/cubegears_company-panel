# CubeGears Full Test Report — 2026-10-23

## Scope
Backend, Company Panel, Public Website. GitHub remote inspection only; no local or staging end-to-end tests were run for this report. Do not interpret historical CI successes as current production-readiness.

| ID | Module | Steps | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|---|
| QA-001 | Company Panel dependencies | Inspect latest CI npm ci step | Dependencies install | ERESOLVE: Vite 8.3.4 incompatible with @vitejs/plugin-react 4.7.0 peer range | Fail | https://github.com/amnas-cubixmet/cubegears_company-panel/actions/runs/39549880783 |
| QA-002 | Company Panel unit/build/browser | Inspect downstream CI steps | Tests/build/smoke execute | All skipped after npm ci failure | Blocked | Same CI run |
| QA-003 | Backend CI | Inspect CI run and workflow | Checks succeed | Historical CI completed successfully; automated Django test suite not executed by configured workflow | Pass (configured checks only) | https://github.com/amnas-cubixmet/cubegears-backend/actions/runs/39398583792 |
| QA-004 | Public Website CI | Inspect CI history/workflow | Signup tests, lint, types, build succeed | Historical CI success | Pass (historical CI only) | https://github.com/amnas-cubixmet/cubegears-public-website/actions/runs/39418153745 |
| QA-005 | Tenant isolation | Create tenants A/B, query cross-tenant records in isolated staging | 403/404 without leakage | Not executed | Not Run | Requires staging database/accounts |
| QA-006 | Billing settlement | Activate zero-wallet account, meter calendar period, settle next-month invoice twice | Correct single charge and overdue recovery | Not executed | Not Run | Requires isolated time-controlled environment |
| QA-007 | Razorpay webhook | Replay signed sandbox webhook and invalid signature | Idempotent acceptance / rejection | Not executed | Not Run | Requires sandbox keys |
| QA-008 | Invoice GST/PDF | Generate estimate and invoice including GST scenarios | Accurate totals and identical templates | Not executed | Not Run | Requires running API and test fixtures |
| QA-009 | Responsive navigation | Open every route at desktop/tablet/mobile and refresh | No broken routes or overflow | Not executed | Not Run | Browser testing blocked by CI install |

## Next actions
1. Resolve Vite/@vitejs/plugin-react compatibility and regenerate package-lock.json using npm install; do not use --force or --legacy-peer-deps.
2. Run npm ci, npm run check, npm test, npm run build, npm run test:ui.
3. Add Django tests to Backend CI. Run DB and billing tests against isolated storage.
4. Execute real cross-repository signup, auth, API and browser flows in staging only.
