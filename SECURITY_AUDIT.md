# CalSys Security Audit

Date: 2026-06-02

## Scope

Reviewed the Express backend, React frontend, route/middleware surface, MySQL access patterns, and npm dependency advisories for the current working tree.

## Findings And Fixes

### Critical

None found during this pass.

### High

- Frontend dependencies had 11 advisories, including high severity issues in axios, vite, rollup, picomatch, minimatch, and flatted.
  - Fixed by running `npm audit fix` in `frontend`; backend and frontend now report zero vulnerabilities.
- Security headers were missing on backend responses.
  - Fixed by adding a centralized Helmet-style header middleware with CSP, HSTS, frame denial, content sniffing protection, referrer policy, and cross-origin resource policies.
- JWT and CSRF tokens were persisted in `localStorage`, increasing XSS blast radius.
  - Fixed by moving token storage to `sessionStorage` and adding CSP headers.

### Medium

- Origin validation used prefix matching, allowing lookalike origins to pass.
  - Fixed by parsing `Origin`/`Referer` and comparing exact origins against the allowlist.
- Route handlers returned internal `error.message` values to clients.
  - Fixed by returning generic 500 responses while preserving detailed server logs.
- State-changing endpoints did not centrally enforce JSON content type.
  - Fixed with centralized JSON content-type validation for non-safe methods.
- API responses did not set explicit cache policy.
  - Fixed by defaulting API responses to `Cache-Control: private, no-store`, with short private caching only for selected non-sensitive lookup endpoints.

### Low

- Production startup logs exposed internal environment/port details.
  - Fixed by suppressing those logs in production.
- Rate-limit hits and authorization failures were not structured for audit review.
  - Fixed with JSON security-event logs for login success/failure, invalid/missing tokens, permission denials, origin/CSRF denials, scope denials, rate-limit hits, and auth lockouts.
- Database query patterns lacked a repo migration for common lookup indexes.
  - Fixed by adding an idempotent index migration for auth, grade, attendance, group, and lookup queries.

## Notes

- SQL access already used parameter placeholders in the reviewed routes. Dynamic `IN (...)` clauses are built from server-side array lengths and populated with placeholders.
- No command execution, XML parsing, file upload, or redirect endpoints were found in the current backend route surface.
- Redis is not configured in this project. Rate limiting and caching use in-memory stores; both are acceptable for a single-process deployment but should move to Redis before horizontal scaling.

## Verification

- `npm.cmd audit --audit-level=low` in `backend`: zero vulnerabilities.
- `npm.cmd audit --audit-level=low` in `frontend`: zero vulnerabilities.
- `npm.cmd run build` in `frontend`: passed.
- Backend syntax sweep with `node --check` across `backend/src/**/*.js`: passed.
