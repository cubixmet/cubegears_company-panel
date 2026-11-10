# SaaS Account onboarding

Deploy with the backend owner-onboarding change and run its database migration first.

- `isCompanyOwner`, `paidAccessRequired` and `effectivePermissions` come from Django authentication responses.
- After login/password setup the owner lands at `/account`. Staff use their effective workshop permissions.
- The access endpoint remains the live source of navigation and route permissions. Every `/account` route and wallet balance chip is hidden from non-owners, including wildcard staff.
- A newly registered company has no workshop modules or Dashboard until an owner activates paid access. Unpriced modules appear in the catalogue without an activation action.
- Account → Logs contains feature On/Off/resume events and persisted monthly usage statements. Disabled labels retain business records and can resume already-paid access.
- The company slug is shown as the tenant identifier. A configured wildcard address still requires operator-provisioned DNS/TLS/hosting; this frontend does not provision a subdomain.

Production build requires `VITE_API_URL` pointing to the matching Django `/api/v1` deployment. Test coverage for owner landing and effective permissions is in `tests/ownerOnboarding.test.js`.

Owners use a shared layout with a persistent sidebar on desktop and horizontally scrollable navigation on mobile. SaaS Account, Profile and Shop Details are always available. Other links appear only when the live server feature/role intersection authorizes them; Dashboard requires its own entitlement. Unpaid settings, storage and templates remain blocked on direct navigation too.

With no active modules, owners can open purchase/recovery routes, `/profile` and `/account/company`. Shop Details reads and updates only the tenant-scoped `/company/me` API; it does not mount paid settings, storage or billing services. Staff without an authorized module see a locked-access notice with refresh/sign-out. Unavailable access verification also displays this notice. Operational routes always keep their server-derived permission checks.

Pair this UI with backend migration `companies.0004_lock_existing_company_modules`, which enables paid-module enforcement for existing companies while preserving purchases. This UI continues to use the authoritative backend policy and entitlements.

Feature Controls lists all billable modules. Unpriced/unpublished modules show 0 credits and Price not set with activation disabled. They use read-only catalogue placeholders, never free purchases. A positive published per-user price is required for a new purchase.

Monthly postpaid recovery: the server access response supplies `billingStatus`. A positive overdue closed-month debt restricts workspace navigation, including otherwise-free Dashboard/Staff. Owners retain account recovery and read-only Storage/history routes. Storage is now an owner billing tab regardless of paid storage entitlement; file writes and policy changes still require storage.manage. Overdue staff receive a contact-owner notice. Access refreshes every minute while monthly collection is configured and after credit updates.

Feature cards distinguish monthly postpaid from prepaid: a verified positive postpaid quote can activate with zero wallet balance, with usage payable on the configured next-month due date. Missing/zero prices and inactive backend billing remain blocked. Overdue debt blocks new activation; owners can still stop existing usage and buy credits. Monthly statements display due dates and overdue state. Deploy with backend migrations 0012–0014 and configure its monthly metering/worker switches; see backend docs/monthly-due-date-storage-account.md.

## Bank account setup in the workshop onboarding wizard

The wizard now offers **Bank & opening balance** between Working hours and
Invoice defaults. Owners may create a Bank-type workshop financial account,
link one that already belongs to their workshop, or explicitly skip.
The bank account number is masked in onboarding API responses, and the
opening balance is recorded in the existing finance double-entry ledger
once; subsequent adjustments belong in Finance → Accounts.

This optional onboarding step does not connect to external banks, transfer
funds, or impose a new lock on previously completed four-step workshops.
