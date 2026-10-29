> Later Mapbox verification: the public token was moved to the active frontend environment and 12 live tiles rendered with HTTP 200. See [the Mapbox fix](mapbox-fix-2026-10-27.md). The initial acceptance record below retains the earlier unconfigured-map state.

# Hosted Supabase acceptance — 27 October 2026

The user explicitly authorized applying the migration and bootstrapping the administrator, superseding the earlier instruction to leave hosted resources unchanged.

## Completed against the existing project

Project: PATAG, reference fzivdpjaceoegetsnbta. Database connection uses the documented session pooler with verified TLS and the official Supabase production CA at backend/certs/supabase-prod-ca-2021.crt. No TLS verification was disabled.

- npm run db:migrate applied 202610270001_admin.sql successfully. All 11 public PATAG application tables exist and have RLS enabled. The migration registry is present.
- The patag-evidence bucket exists and is private. This is bucket/schema verification, not a live file-upload test.
- npm run seed:admin created admin@patag.test through Supabase Auth and the corresponding protected administrator profile, active with Bulacan-wide scope. The password came from the private environment and was not printed.
- A second migration run reported none (already current); a second bootstrap reported Confirmed. No password reset or profile overwrite was requested/performed.
- Backend is running on http://127.0.0.1:4101/api and frontend on http://127.0.0.1:5173/admin/login.

## Live API/security verification

13 checks passed against the real hosted project:

1. API health identifies Supabase and can read the hosted database.
2. Anonymous bootstrap is rejected with 401.
3. The provisioned administrator signs in through real Supabase password Auth and receives an HttpOnly SameSite=Strict cookie; no token is returned in JSON.
4. Protected current-user lookup matches the new administrator.
5. Bootstrap returns the compatible shape and demo:false, with zero reports.
6. Seven protected report/statistics/team/user/notification/activity/duplicate routes return HTTP 200.
7. An untrusted request origin is rejected with 403.
8. All 11 application tables enable RLS, and the evidence bucket is private.
9. A verified administrator JWT can read its profile through the authenticated database role.
10. That browser role cannot update its profile role; the test transaction was rolled back.
11. Anonymous direct table reads are denied; the read-only test transaction was rolled back.
12. Real Supabase logout succeeds.
13. Reusing the logged-out cookie is rejected with 401.

Credentials, cookies and access tokens were not printed or written to this report. No report/team fixtures, additional accounts, recovery emails or operational record mutations were created by acceptance checks. Normal sign-in/audit/rate-limit records are expected.

## Live browser verification

17 checks passed using Chrome, the running Vite admin, the Node backend and real Supabase. There were no provider stubs, page errors or failed API responses. Coverage: actual password sign-in; no bearer token in browser storage; dashboard, reports, verification, duplicates, map, assignments, teams, completions, users, analytics, exports, notifications, settings and activity routes; logout. The test browser was logged out after verification.

See [machine-readable results](hosted-browser-results.json) and [dashboard screenshot](hosted-dashboard.png). Empty report views are expected: no demo report data was seeded. A Mapbox token remains unconfigured, so unavailable-state behavior is shown.

## Run it yourself

Keep private credentials in backend/.env.local and public connection metadata in root .env.local. From the repository root:

```powershell
$env:NODE_EXTRA_CA_CERTS = "$PWD\backend\certs\supabase-prod-ca-2021.crt"
npm run dev:api
```

A separate terminal can run npm --prefix admin-web run dev. Both services are currently already running; do not start duplicate copies. For future manually launched instances, Ctrl+C stops each terminal's server. Sign in as admin@patag.test using the password privately configured as PATAG_TEST_ADMIN_PASSWORD; it is not reproduced here.

The local isolated test results remain 29 focused tests and 10 browser checks, with build passing and lint returning four existing warnings. They were recorded separately; the hosted checks above do not replace that fixture coverage or claim the full hosted workflow is tested.

## Remaining acceptance limits

No live report lifecycle, multi-user jurisdiction fixtures, evidence upload/download, real recovery email, enrolled MFA challenge, production proxy/deployment, load/concurrency, retention or backup/restore test was performed. The private bucket's presence does not prove Storage object operations. The tested RLS controls cover the current administrator and anonymous roles, not a complete hosted multi-jurisdiction matrix. No Mapbox token was provisioned or live paid map request made.
