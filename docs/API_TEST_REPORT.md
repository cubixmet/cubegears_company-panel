# API Test Report — 2026-10-23

Current status: API execution **Not Run**. Source structure reviewed but no running staging API or isolated credentials were supplied.

| ID | Module | Steps | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|---|
| API-001 | Signup | POST valid workshop via public Next.js /api/signup | Django account created once | Not executed | Not Run | app/api/signup/route.ts forwards snake_case fields |
| API-002 | JWT | Login, refresh, logout, replay blacklisted refresh | Replay denied | Not executed | Not Run | Django SIMPLE_JWT settings |
| API-003 | Authorization | GET tenant-B resource with tenant-A JWT | 403 or non-revealing 404 | Not executed | Not Run | Needs two staging companies |
| API-004 | Owner permissions | Call owner-only endpoints with staff JWT | Forbidden | Not executed | Not Run | Needs permission fixtures |
| API-005 | Feature access | Request disabled paid feature | Rejected by server | Not executed | Not Run | Feature enforcement env flags require staging values |
| API-006 | Billing | Settle same month twice under concurrency | Exactly one ledger debit | Not executed | Not Run | Requires locked fixtures and mock clock |
| API-007 | Webhooks | Send valid, invalid and duplicate test webhook | Signature verified, duplicate ignored | Not executed | Not Run | Test environment only |
| API-008 | Storage | Meter file changes and reconcile records | Accurate billable bytes | Not executed | Not Run | Isolated files and DB needed |
| API-009 | Invoice | Validate GST values and render PDF | Correct calculated totals | Not executed | Not Run | Fixtures needed |

Do not run APIs against production billing records or live payments.
