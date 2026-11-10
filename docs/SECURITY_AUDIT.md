# Security Audit — Initial Static Assessment (2026-10-23)

No penetration testing or exploit attempts were made. All runtime security tests remain Not Run.

- JWTAuthentication and IsAuthenticated configured as DRF defaults in backend config/settings.py; individual view overrides remain to be reviewed.
- CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS are environment-controlled; verify deployment values against actual domains.
- Debug defaults true for development. Production must explicitly set DJANGO_DEBUG=False, strong DJANGO_SECRET_KEY/JWT_SIGNING_KEY and allowed hosts.
- Feature enforcement switches are opt-in. Confirm staging/production gates are enabled as designed, independently of client-side checks.
- Test tenant isolation, owner/staff role boundaries, auth refresh rotation, password reset, signed webhooks, replay protection and rate limits before shipping.
- Public signup API forwards a validated payload to a configurable backend. Verify BACKEND_API_URL + BACKEND_SIGNUP_PATH route composition and backend contract in staging.
- Secrets must never be logged, committed, reproduced in evidence or sent to payment production.

| ID | Module | Steps | Expected | Actual | Status |
|---|---|---|---|---|---|
| SEC-001 | Tenant isolation | Query alternate-company object with valid token | Denied | Not executed | Not Run |
| SEC-002 | Staff privilege | Access admin actions as non-owner | Denied | Not executed | Not Run |
| SEC-003 | CSRF/CORS | Exercise allowed and disallowed origins | Only trusted origins accepted | Not executed | Not Run |
| SEC-004 | Webhook integrity | Supply forged signature and replay | Forgery rejected, replay idempotent | Not executed | Not Run |
