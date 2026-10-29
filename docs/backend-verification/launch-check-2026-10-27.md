# Configured launch check — 27 October 2026

- Frontend launched at http://127.0.0.1:5173/admin/login and returned HTTP 200. The frontend process was left running for the user.
- Supabase Auth administrator read succeeded using the configured server key. The complete bounded account lookup did not find admin@patag.test.
- Initial PostgreSQL connection failed with SELF_SIGNED_CERT_IN_CHAIN. Node's system CA option did not resolve it.
- Downloaded the public production CA from Supabase's documented distribution into backend/certs/supabase-prod-ca-2021.crt. SHA-256 fingerprint: 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA. Certificate expires 26 April 2031.
- Retrying with NODE_EXTRA_CA_CERTS and certificate validation enabled reached PostgreSQL authentication, which failed with 28P01 (database password rejected). Database/schema inspection therefore did not complete.
- The real npm run dev:api startup was attempted with that CA and failed safely. No backend process remains running.
- The seed-password setting is still a placeholder. No secret values were printed or saved in this record.
- npm test: 29 passed, 0 failed, 0 skipped.
- npm run build: passed with the existing large-bundle warning.
- npm run lint: exit 0 with four existing warnings.
- npm run test:browser: 10 checks passed, no page errors, failed API responses or demo-auth requests. Uses the real local API with isolated PostgreSQL and Auth/Storage boundary stubs, not the hosted project.

No hosted migrations, account creation, recovery email or report mutations were performed. Correct SUPABASE_DB_URL privately before retrying. Hosted schema/bootstrap remain subject to the user's earlier instruction to leave resources unchanged.

For a future backend launch from the repository root in PowerShell:

```powershell
$env:NODE_EXTRA_CA_CERTS = "$PWD\backend\certs\supabase-prod-ca-2021.crt"
npm run dev:api
```

A separate terminal can run npm --prefix admin-web run dev after the currently running frontend is stopped. See ../supabase-backend.md for setup, migration authorization and credential restrictions.
