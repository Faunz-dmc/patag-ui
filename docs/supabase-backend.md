# Supabase admin backend setup

Status on 27 October 2026 (Asia/Manila): authorized hosted migration and administrator bootstrap are complete. Real Supabase sign-in/API/logout, baseline hosted RLS controls and 14 browser routes passed. Live report workflows, file operations, recovery email, enrolled MFA and production deployment remain unverified. See [hosted acceptance evidence](backend-verification/hosted-acceptance-2026-10-27.md).

The real `admin-web` uses only the Node API in `backend/`, with Supabase Auth, PostgreSQL and private Storage. `dev-mock`, previews, Flutter and maintenance-web remain separate demos/reference clients. They are not fallback backends for admin-web.

## Install and configure

Use Node 24 and npm. From this repository:

```powershell
npm ci --ignore-scripts --cache .npm-cache
npm --prefix admin-web ci --ignore-scripts --cache 'C:\Users\Admin\Documents\ChatGPT\patag-ui\.npm-cache'
if (!(Test-Path backend/.env.local)) { Copy-Item backend/.env.example backend/.env.local }
```

Configure the private file locally; do not paste secrets into chat. Root `.env.local` remains reserved for public project metadata. Node commands explicitly load root `.env.local`, then `backend/.env.local`; existing process environment variables take precedence. Real environment files, npm cache and browser test profiles are ignored.

| Variable | Use |
| --- | --- |
| `SUPABASE_URL` | Existing project `https://fzivdpjaceoegetsnbta.supabase.co`; root public metadata or server environment. |
| `SUPABASE_PUBLISHABLE_KEY` | Existing browser-safe key; the trusted API uses it for ordinary Auth calls. |
| `SUPABASE_SERVICE_ROLE_KEY` | Private legacy service-role JWT from the selected project's API settings; trusted Auth administration and Storage only. Never use a VITE variable. |
| `SUPABASE_DB_URL` | Private PostgreSQL URI for the same project; direct `db.<reference>.supabase.co` or the documented session pooler with username `postgres.<reference>`. URL-encode password characters. Do not use transaction pooling with this session/role design. |
| `ADMIN_ORIGIN` | One exact origin, initially `http://127.0.0.1:5173`; HTTPS is required outside loopback development. |
| `PORT` | API loopback port, default 4101. |
| `PATAG_TEST_ADMIN_PASSWORD` | Private 15–128 character password, needed only while running seed:admin. Never logged or committed. |
| `PATAG_ALLOW_HOSTED_MUTATIONS` | Default false. Set true only after explicit approval to apply the reviewed SQL/bootstrap to the selected hosted project. |
| `NODE_ENV` | Set `production` when deployed. The test-account seed refuses production mode. |
| `TRUST_PROXY_CLIENT_IP` | Default false. Set true only behind a controlled local proxy which overwrites X-Forwarded-For with exactly one validated client IP. Do not append untrusted incoming values. |
| `NODE_EXTRA_CA_CERTS` | Optional platform CA trust file. PostgreSQL always verifies TLS; do not disable certificate validation. |

Missing credentials cause a setup error. There is no database/demo fallback. The URI is checked against the Supabase project URL. No database password or service key belongs in root `.env.local`, either web application, VITE variables, logs, or documentation.

## Apply and bootstrap, after hosted authorization

The following commands mutate the configured hosted project. They were run after explicit user authorization; a second run confirmed idempotency. Review `supabase/migrations/202610270001_admin.sql` first, then configure private credentials and the password in `backend/.env.local` or the process environment.

```powershell
$env:NODE_EXTRA_CA_CERTS = "$PWD\backend\certs\supabase-prod-ca-2021.crt"
$env:PATAG_ALLOW_HOSTED_MUTATIONS = 'true'
npm run db:migrate
npm run seed:admin
$env:PATAG_ALLOW_HOSTED_MUTATIONS = 'false'
Remove-Item Env:PATAG_TEST_ADMIN_PASSWORD -ErrorAction SilentlyContinue
```

Remove the seed password from the private file too if it was stored there. The migration runner applies ordered SQL in one transaction under an advisory lock, records SHA-256 checksums in `patag_private.migrations`, and refuses modified applied migrations. Normal migrations contain no reset/drop-table operation. Preserve existing data; do not use a destructive database reset to retry.

The account is `admin@patag.test`, name `PATAG Test Administrator`, database role `administrator`, active, province Bulacan, municipality null (province-wide scope). Auth user IDs link to protected profiles. An identical account is left unchanged on repeat runs. Existing conflicting identities require review and explicit `npm run seed:admin -- --reset`; the command never runs automatically. Newly created Auth accounts are compensated if SQL provisioning fails. If cleanup fails, stop and reconcile the reported Auth identity privately. An explicit reset changes external Auth before SQL commit, so a failed reset also requires reconciliation; Auth and PostgreSQL do not share a transaction.

## Start admin development

```powershell
$env:NODE_EXTRA_CA_CERTS = "$PWD\backend\certs\supabase-prod-ca-2021.crt"
npm run dev:api
# Another terminal, from the same repository:
npm --prefix admin-web run dev
```

Open `http://127.0.0.1:5173/admin/login`. Vite proxies `/api` to loopback 4101. `VITE_API_URL` defaults to `/api`; the frontend checks that `/health` identifies the Supabase backend and rejects the demo service. Missing/unreachable configuration displays an error. No token is stored in browser localStorage or sessionStorage. Preferences remain browser-local.

For production, serve the built admin site over HTTPS and reverse-proxy `/api` to the loopback API on the same site. Preserve the browser Origin header, forward cookies, keep the configured origin exact, and overwrite forwarded client IPs if enabling trusted proxy mode. Cross-site cookie deployment is not supported. Auth rate limits are shared in PostgreSQL; authenticated API quotas use the verified user ID. Do not expose the Vite development server publicly.

## Authentication and recovery

Sign-in uses Supabase password Auth, validates protected profile role/active state, and sets an HttpOnly SameSite=Strict cookie (Secure over HTTPS). The trusted API stores only a hash of the access token plus its bounded expiry. Every protected request validates Auth, token issuer/expiry/sub, the live `auth.sessions` session_id, current profile and scope. Logout removes the local session immediately and calls Supabase local logout. No refresh token is kept: expiry requires a new sign-in, at most eight hours and usually the Supabase JWT lifetime.

Existing enrolled TOTP MFA must reach AAL2 before workspace access. The login screen supports challenge/verification; it cannot enroll, remove or bypass MFA. Unsupported enrolled factors fail clearly. Authoritative RLS also checks active profile, live Auth session and verified MFA factors.

Configure Supabase's redirect allowlist for `https://<admin-origin>/admin/reset-password` (use the exact loopback origin during development). Configure the **Reset Password** email template to link to:

```text
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery
```

The page supports both the standard Supabase recovery callback (`#access_token=...&type=recovery`) and the custom token-hash template above. It reads the token into memory, removes the query/fragment from the address bar, and never saves recovery tokens to browser storage. On password submission the server exchanges a token hash when supplied, validates the resulting user token with Supabase Auth and its live Auth session, then updates the password using that user token. Successful reset deletes local sessions and calls global Supabase logout. Existing MFA factors remain in force. Request a fresh email after an expired/consumed link or a callback that was previously stripped by the old page; reloading a cleaned callback requires a fresh link. Email/SMTP, redirect/template configuration and delivery require hosted acceptance; no recovery email or hosted password change was performed during the compatibility fix.

## Mapbox

Copy `admin-web/.env.example` to its ignored local environment file only if needed. Set `VITE_MAPBOX_TOKEN` to a public `pk.` token restricted to the exact admin origins in the Mapbox dashboard. Never supply an `sk.` token. A value placed only in `.env.example` is not loaded; keep the active value in `admin-web/.env.local`. Rebuild after changing frontend environment variables. The existing public token was subsequently configured and live local tile rendering passed; see [Mapbox verification](backend-verification/mapbox-fix-2026-10-27.md).

The existing Leaflet renderer uses Mapbox Static Tiles (streets-v12), preserving the existing `[14.855, 120.815]` view; no new geographic boundary is invented. It renders only authorized bootstrap reports with finite, in-range coordinates. Missing/rejected tokens show an unavailable message while report coordinates and lists remain usable. Attribution stays visible when Mapbox tiles are active. The document uses strict-origin referrers so URL restrictions can work without sending recovery URL parameters. No geocoding, routing service or token was provisioned, and no billable Mapbox request was made during checks.

## Checks and limits

```powershell
npm test
npm run test:api
npm run build
npm run lint
npm run test:browser
npm audit --cache .npm-cache
npm --prefix admin-web audit --cache 'C:\Users\Admin\Documents\ChatGPT\patag-ui\.npm-cache'
```

`npm test` uses isolated, in-memory PostgreSQL (PGlite) and provider-boundary stubs; PGlite is a development-only test dependency, not a selectable application backend. The Chrome test uses the actual built admin, Node API and isolated PostgreSQL. It requires installed Chrome and writes temporary profiles/downloads only under ignored `backend/.browser-temp/`; evidence goes to `docs/backend-verification/`. The old cross-portal demo browser test is historical and is not the real-admin acceptance runner. Runtime notification/rate-limit and unattached evidence retention require an operational cleanup policy before deployment.

Collections use pages of 1–100 rows. The compatibility adapter loads at most 5,000 rows per bootstrap collection, then fails explicitly instead of presenting incomplete statistics. CSV/PDF preparation reauthorizes at most 1,000 selected report IDs and writes an audit record before the existing frontend generates the file. Detail snapshots contain up to 200 recent history entries, 100 before photos and 100 progress updates; referenced completion/progress evidence is loaded separately. The history endpoint pages older events. The duplicate screen shows up to 50 candidate pairs and never confirms automatically.

Private evidence uploads enforce MIME signatures, base64 shape and an 8 MB size limit; they are not antivirus scans or full image decoding/redaction. Temporary unattached evidence is private to its uploader. Retention/deletion, backup/restore drills, multi-connection load/race tests, production proxy/TLS and hosted Auth/Storage/RLS remain acceptance work. In-app notifications use polling; no push transport or Realtime subscription is claimed. Public photo approval records a review decision but does not publish private evidence through this admin API.

See [hosted verification evidence](backend-verification/hosted-acceptance-2026-10-27.md), [initial local verification](backend-verification/README.md), [API contract](api-contract.md) and [the architecture decision](decisions/0001-supabase-admin.md).
